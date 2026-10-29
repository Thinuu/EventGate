const mongoose = require('mongoose');
const Order = require('../models/Order');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
async function expireOrder(orderId, eligibility) {
  const session = await mongoose.startSession();
  let expired = false;
  try {
    await session.withTransaction(async () => {
      expired = false;
      const order = await Order.findOneAndUpdate({ _id: orderId, ...eligibility, paymentStatus: { $nin: ['paid', 'success'] } }, { $set: { status: 'EXPIRED', paymentStatus: 'expired' } }, { session, new: false });
      if (!order) return;
      await Ticket.updateMany({ order: order._id }, { $set: { status: 'CANCELLED' } }, { session });
      for (const item of order.tickets) {
        const update = { 'categories.$.sold': -item.quantity };
        await Event.updateOne({ _id: order.eventId, categories: { $elemMatch: { name: item.categoryName, sold: { $gte: item.quantity } } } }, { $inc: update }, { session });
      }
      expired = true;
    });
    return expired;
  } finally { await session.endSession(); }
}
async function runReservationMaintenance(limit = 25) {
  const now = new Date();
  const ended = await Event.find({ endDate: { $lt: now } }).limit(100).select('_id').lean();
  const filters = [
    { paymentMethod: 'bank_transfer', status: 'PENDING_PAYMENT', reservationExpiry: { $lt: now } },
    { paymentMethod: { $in: ['cash_at_entrance', 'cash_on_entrance'] }, status: 'RESERVED', eventId: { $in: ended.map(event => event._id) } },
  ];
  let count = 0;
  for (const filter of filters) {
    const orders = await Order.find({ ...filter, paymentStatus: { $nin: ['paid', 'success'] } }).limit(limit).select('_id').lean();
    for (const order of orders) if (await expireOrder(order._id, filter)) count++;
  }
  return { expired: count };
}
module.exports = { expireOrder, runReservationMaintenance };
