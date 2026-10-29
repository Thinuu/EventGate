const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/Order');
const Event = require('../models/Event');
const { getPayHereHash, createPaymentSession, getActiveGateways } = require('../services/paymentService');
const { notifyOrderConfirmation } = require('../services/notificationService');
const { processOrderFinalConfirmation } = require('../services/finalConfirmationService');
const { emitDashboardEvent, emitBuyerEvent } = require('../utils/socket');

/**
 * GET /api/payment/config/:eventId
 * Returns the active gateways & payment methods for this event's checkout page.
 */
router.get('/config/:eventId', async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).lean();
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const gatewayInfo = await getActiveGateways();

    res.json({
      success: true,
      data: {
        paymentMethods: event.settings?.paymentMethods || ['card'],
        gateways: gatewayInfo.activeGateways,
        defaultGateway: gatewayInfo.defaultGateway,
        currency: gatewayInfo.currency,
      }
    });
  } catch (error) {
    console.error('Payment config error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/payment/create-session
 * Creates a payment session for the given order & gateway (stripe or payhere).
 */
router.post('/create-session', async (req, res) => {
  try {
    const { orderId, gateway } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (req.body.confirmationToken !== order.confirmationToken) return res.status(403).json({ success: false, message: 'Order confirmation token required' });
    if (['paid', 'success'].includes(order.paymentStatus) || ['CANCELLED', 'EXPIRED'].includes(order.status)) return res.status(409).json({ success: false, message: 'Order is not payable' });
    const event = await Event.findById(order.eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const chosenGateway = gateway || (await getActiveGateways()).defaultGateway;
    const sessionResult = await createPaymentSession(order, event, chosenGateway);

    // Store gateway on the order
    order.gatewayUsed = chosenGateway;
    if (chosenGateway === 'stripe' && sessionResult.sessionId) {
      order.stripeSessionId = sessionResult.sessionId;
    }
    await order.save();

    res.json({
      success: true,
      data: sessionResult,
    });
  } catch (error) {
    console.error('Create payment session error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/payment/stripe-webhook
 * Stripe sends webhook events here (checkout.session.completed, etc.).
 */
router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const SystemConfig = require('../models/SystemConfig');

  try {
    const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
    const endpointSecret = config.payment?.gateways?.stripe?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;
    const stripeKey = config.payment?.gateways?.stripe?.secretKey || process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      return res.status(500).send('Stripe not configured');
    }

    const stripe = require('stripe')(stripeKey);
    let event;

    if (endpointSecret) {
      const sig = req.headers['stripe-signature'];
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err) {
        console.error('Stripe webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      // CRITICAL: Fail webhook if endpointSecret is not configured
      // In production, this MUST be configured for security
      console.error('Stripe webhook received but endpointSecret is not configured. Rejecting request.');
      return res.status(500).send('Webhook secret not configured');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      const eventId = session.metadata?.eventId;

      if (!orderId) {
        console.error('Stripe webhook: missing orderId in metadata');
        return res.status(400).send('Missing orderId');
      }

      const order = await Order.findById(orderId);
      if (!order) {
        console.error('Stripe webhook: order not found', orderId);
        return res.status(404).send('Order not found');
      }

      if (session.payment_status !== 'paid' || session.amount_total !== Math.round(order.totalAmount * 100) ||
          session.id !== order.stripeSessionId || session.currency !== (config.payment?.defaultCurrency || 'LKR').toLowerCase() || String(order.eventId) !== String(eventId)) {
        return res.status(400).send('Payment session does not match order');
      }
      if (!['paid', 'success'].includes(order.paymentStatus)) {
        order.paymentStatus = 'paid';
        order.status = 'CONFIRMED';
        order.paidAt = new Date();
        order.gatewayUsed = 'stripe';
        order.paymentDetails = {
          gateway: 'stripe',
          stripeSessionId: session.id,
          stripePaymentIntent: session.payment_intent,
          amountTotal: session.amount_total,
          currency: session.currency,
        };
        if (!(await require('../services/paymentSettlement').settlePayment(order, eventId))) return res.json({ received: true });

        const io = req.app.get('io');
        emitDashboardEvent(io, 'payment_approved', eventId, {
          orderId: order._id,
          amount: order.totalAmount,
          paymentMethod: 'card',
          gateway: 'stripe',
        });
        emitDashboardEvent(io, 'event_update', eventId, {
          type: 'PAYMENT_CONFIRMED',
          eventId,
          orderId: order._id,
          paymentMethod: 'card',
          gateway: 'stripe',
        });

        if (order.buyerId) {
          emitBuyerEvent(io, String(order.buyerId), 'order_status_changed', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: 'CONFIRMED',
            paymentStatus: order.paymentStatus,
          });
        }

        require('../services/wakePaymentWorker')();
        // Durable fulfillment is handled by the payment task worker.
        console.log(`STRIPE PAYMENT SUCCESS: Order ${order.orderNumber}`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * PayHere Notify (Webhook)
 * PayHere sends a POST request to this URL when a payment is processed.
 */
router.post('/notify', async (req, res) => {
  try {
    const {
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
      custom_1: orderId,
      custom_2: eventId
    } = req.body;

    // 1. Verify the merchant_id matches our configured merchant ID
    const config = await require('../models/SystemConfig').findOne({ key: 'global' }).lean() || {};
    const configuredMerchantId = config.payment?.publishableKey || process.env.PAYHERE_MERCHANT_ID;
    if (!configuredMerchantId || merchant_id !== configuredMerchantId) {
      console.error('INVALID MERCHANT_ID in PayHere webhook:', merchant_id);
      return res.status(400).send('Invalid merchant ID');
    }

    // 2. Verify the signature
    const merchantSecret = config.payment?.secretKey || process.env.PAYHERE_SECRET;
    if (!merchantSecret) {
      console.error('PAYHERE webhook received but PAYHERE_SECRET is not configured. Rejecting request.');
      return res.status(500).send('Payment gateway not configured');
    }
    const amountFormatted = parseFloat(payhere_amount).toFixed(2);
    const localMd5Sig = crypto
      .createHash('md5')
      .update(
        merchant_id +
        order_id +
        amountFormatted +
        payhere_currency +
        status_code +
        crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase()
      )
      .digest('hex')
      .toUpperCase();

    if (typeof md5sig !== 'string' || !/^[a-fA-F0-9]{32}$/.test(md5sig) || !crypto.timingSafeEqual(Buffer.from(localMd5Sig, 'hex'), Buffer.from(md5sig, 'hex'))) {
      console.error('INVALID PAYMENT SIGNATURE:', order_id);
      return res.status(400).send('Invalid signature');
    }

    // 2. Handle payment status
    // status_code: 2 (Success), 0 (Pending), -1 (Cancelled), -2 (Failed), -3 (Charged Back)
    const order = await Order.findById(orderId);
    if (!order) {
      console.error('ORDER NOT FOUND FOR PAYMENT:', orderId);
      return res.status(404).send('Order not found');
    }

    if (order.orderNumber !== order_id || String(order.eventId) !== String(eventId) ||
        payhere_currency !== (config.payment?.defaultCurrency || 'LKR')) {
      return res.status(400).send('Payment order, event or currency mismatch');
    }
    if (['paid', 'success'].includes(order.paymentStatus)) return res.status(200).send('OK');

    if (status_code === '2' && (typeof req.body.payment_id !== 'string' || !req.body.payment_id)) return res.status(400).send('Transaction ID required');
    if (status_code === '2') {
      // SUCCESS
      // IDEMPOTENCY: Check if this transaction was already processed
      if (order.paymentDetails?.transactionId === req.body.payment_id) {
        console.log('PAYMENT ALREADY PROCESSED: Order', order.orderNumber, '- Transaction', req.body.payment_id);
        return res.status(200).send('OK');
      }

      // AMOUNT VALIDATION: Verify payhere_amount matches order.totalAmount
      const expectedAmount = parseFloat(order.totalAmount).toFixed(2);
      const callbackAmount = parseFloat(payhere_amount).toFixed(2);
      if (expectedAmount !== callbackAmount) {
        console.error('PAYMENT AMOUNT MISMATCH: Order', order.orderNumber, '- Expected', expectedAmount, '- Got', callbackAmount);
        return res.status(400).send('Amount mismatch');
      }

      if (order.paymentStatus !== 'success') {
        order.paymentStatus = 'success';
        order.status = 'CONFIRMED';
        order.paidAt = new Date();
        order.gatewayUsed = 'payhere';
        order.paymentDetails = { 
          gateway: 'payhere',
          transactionId: req.body.payment_id,
          method: req.body.method
        };
        if (!(await require('../services/paymentSettlement').settlePayment(order, eventId))) return res.status(200).send('OK');

        const io = req.app.get('io');
        emitDashboardEvent(io, 'payment_approved', eventId, {
          orderId: order._id,
          amount: order.totalAmount,
          paymentMethod: 'card',
          gateway: 'payhere',
        });
        emitDashboardEvent(io, 'event_update', eventId, {
          type: 'PAYMENT_CONFIRMED',
          eventId,
          orderId: order._id,
          paymentMethod: 'card',
          gateway: 'payhere',
        });

        if (order.buyerId) {
          emitBuyerEvent(io, String(order.buyerId), 'order_status_changed', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: 'CONFIRMED',
            paymentStatus: order.paymentStatus,
          });
        }

        require('../services/wakePaymentWorker')();
        // Durable fulfillment is handled by the payment task worker.
        console.log(`PAYMENT SUCCESS: Order ${order.orderNumber}, Amount ${payhere_amount}`);
      }
    } else if (status_code === '0') {
      await Order.updateOne({ _id: order._id, paymentStatus: { $nin: ['paid', 'success', 'failed'] }, status: { $nin: ['CANCELLED', 'EXPIRED'] } }, { $set: { paymentStatus: 'pending' } });
    } else if (['-1', '-2', '-3'].includes(status_code)) {
      await require('../services/paymentFailure').failPayment(order, req.body);
    } else {
      return res.status(400).send('Unsupported payment status');
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('PAYMENT NOTIFY ERROR:', error);
    res.status(500).send('Internal Server Error');
  }
});


// ──────────────────────────────────────────────
// Cash at Entrance routes
// ──────────────────────────────────────────────
const cashEntranceController = require('../controllers/cashEntranceController');
const { protect: authenticate } = require('../middleware/auth');

// Public: create a cash reservation
router.post('/cash-reservation', cashEntranceController.createCashReservation);

// Public: get cash payment instructions for an order
router.get('/cash-instructions/:orderId', cashEntranceController.getCashInstructions);

// Public: submit additional reservation info
router.post('/cash-reservation/:orderId/info', cashEntranceController.submitReservationInfo);

// Protected: staff confirms cash payment received at venue
router.post('/cash-confirm/:orderId', authenticate, cashEntranceController.confirmCashPayment);

// Protected: get cash orders for staff dashboard
router.get('/cash-orders', authenticate, cashEntranceController.getCashOrders);

module.exports = router;

