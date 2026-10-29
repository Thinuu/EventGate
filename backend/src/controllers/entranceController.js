const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const { notifyBuyerFinalSummary } = require('../services/notificationService');

/**
 * POST /api/entrance/confirm/:orderId
 * Staff endpoint to confirm cash payment at entrance.
 * Updates paymentStatus to 'paid' and status to 'CONFIRMED'.
 * Also activates tickets and QR codes.
 */
const confirmCashPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    // Assuming middleware validates staff role
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.paymentMethod !== 'cash_on_entrance') {
      return res.status(400).json({ success: false, message: 'Order is not a cash on entrance payment' });
    }
    // Update order status
    order.paymentStatus = 'paid';
    order.status = 'CONFIRMED';
    order.paidAt = new Date();
    await order.save();

    // Activate all tickets for this order
    await Ticket.updateMany({ order: order._id }, { $set: { status: 'CONFIRMED', qrActive: true } });

    // Send final confirmation notification (reuse existing service)
    try {
      await notifyBuyerFinalSummary({ order, event: null, attendees: [] });
    } catch (e) {
      console.error('Notification after cash confirmation failed:', e);
    }

    res.json({ success: true, message: 'Cash payment confirmed', data: { orderId: order._id } });
  } catch (err) {
    next(err);
  }
};

module.exports = { confirmCashPayment };
