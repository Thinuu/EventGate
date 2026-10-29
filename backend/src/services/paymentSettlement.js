const mongoose = require('mongoose');
const Order = require('../models/Order');
const Event = require('../models/Event');
// A replica set is required. Payment state and revenue commit together; concurrent
// callbacks cannot credit revenue twice. Side effects run only for the winner.
async function settlePayment(order, eventId) {
  const session = await mongoose.startSession();
  let changed = false;
  try {
    await session.withTransaction(async () => {
      changed = false;
      const result = await Order.updateOne({ _id: order._id, paymentStatus: { $nin: ['paid', 'success'] }, status: { $nin: ['CANCELLED', 'EXPIRED'] } },
        { $set: { paymentStatus: order.paymentStatus, status: 'CONFIRMED', paidAt: order.paidAt, gatewayUsed: order.gatewayUsed, paymentDetails: order.paymentDetails } }, { session });
      if (result.modifiedCount) {
        const event = await Event.updateOne({ _id: eventId }, { $inc: { revenue: order.totalAmount } }, { session });
        if (!event.matchedCount) throw new Error('Payment event not found');
        await require('../models/PaymentTask').create([{ orderId: order._id }], { session });
        changed = true;
      }
    });
    return changed;
  } finally { await session.endSession(); }
}
module.exports = { settlePayment };
