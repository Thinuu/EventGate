const crypto = require('crypto');
const SystemConfig = require('../models/SystemConfig');

/**
 * PayHere (Sri Lanka) Payment Integration
 */

const getPayHereHash = async (orderId, amount, currency) => {
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const merchantId = config.payment?.publishableKey || process.env.PAYHERE_MERCHANT_ID;
  const merchantSecret = config.payment?.secretKey || process.env.PAYHERE_SECRET;
  
  if (!merchantId || !merchantSecret) throw new Error('PayHere credentials are required');
  const amountFormatted = parseFloat(amount).toFixed(2);
  
  const hash = crypto
    .createHash('md5')
    .update(
      merchantId +
      orderId +
      amountFormatted +
      currency +
      crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase()
    )
    .digest('hex')
    .toUpperCase();
    
  return hash;
};

const generatePayHereData = async (order, event) => {
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const merchantId = config.payment?.publishableKey || process.env.PAYHERE_MERCHANT_ID;
  const currency = config.payment?.defaultCurrency || 'LKR';
  
  const hash = await getPayHereHash(order.orderNumber, order.totalAmount, currency);
  
  return {
    merchant_id: merchantId,
    return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/${order.confirmationToken}/success`,
    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/${order.confirmationToken}/cancel`,
    notify_url: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payment/notify`,
    order_id: order.orderNumber,
    items: `${event.name} Tickets`,
    currency: currency,
    amount: order.totalAmount,
    first_name: order.buyerName.split(' ')[0],
    last_name: order.buyerName.split(' ').slice(1).join(' ') || 'Buyer',
    email: order.buyerEmail,
    phone: order.buyerPhone || '',
    address: 'EventGate Online',
    city: 'Colombo',
    country: 'Sri Lanka',
    hash: hash,
    // Add custom variables if needed
    custom_1: order._id.toString(),
    custom_2: event._id.toString()
  };
};

/**
 * Stripe Checkout Session
 */
const createStripeSession = async (order, event) => {
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const stripeKey = config.payment?.gateways?.stripe?.secretKey || process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    throw new Error('Stripe secret key is not configured');
  }

  const stripe = require('stripe')(stripeKey);
  const currency = (config.payment?.defaultCurrency || 'LKR').toLowerCase();

  const lineItems = order.tickets.map(ticket => ({
    price_data: {
      currency,
      product_data: {
        name: `${event.name} - ${ticket.categoryName}`,
      },
      unit_amount: Math.round(ticket.price * 100),
    },
    quantity: ticket.quantity,
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order/${order.confirmationToken}/success`,
    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/${event._id}`,
    metadata: {
      orderId: order._id.toString(),
      eventId: event._id.toString(),
      orderNumber: order.orderNumber,
    },
    customer_email: order.buyerEmail,
  });

  return session;
};

/**
 * Returns which card gateways are enabled + the default
 */
const getActiveGateways = async () => {
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const gateways = config.payment?.gateways || {};
  const active = [];

  if (gateways.payhere?.enabled !== false) {
    active.push('payhere');
  }
  if (gateways.stripe?.enabled === true) {
    active.push('stripe');
  }

  return {
    activeGateways: active,
    defaultGateway: config.payment?.defaultGateway || (active[0] || 'payhere'),
    currency: config.payment?.defaultCurrency || 'LKR',
  };
};

/**
 * Dispatcher — call the right provider based on gateway name
 */
const createPaymentSession = async (order, event, gateway) => {
  if (gateway === 'stripe') {
    const session = await createStripeSession(order, event);
    return { provider: 'stripe', sessionUrl: session.url, sessionId: session.id };
  }

  // Default to PayHere
  const payHereData = await generatePayHereData(order, event);
  return { provider: 'payhere', paymentData: payHereData };
};

module.exports = {
  getPayHereHash,
  generatePayHereData,
  createStripeSession,
  getActiveGateways,
  createPaymentSession,
};
