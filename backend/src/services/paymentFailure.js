const mongoose = require('mongoose');
const Order = require('../models/Order');
const Event = require('../models/Event');
async function failPayment(order, payload) {
  const session = await mongoose.startSession();
  let changed = false;
  try {
    await session.withTransaction(async () => {
      changed = false;
      const result = await Order.updateOne({ _id: order._id, paymentStatus: { $nin: ['paid', 'success', 'failed'] }, status: { $nin: ['CANCELLED', 'EXPIRED'] } }, { $set: {
        paymentStatus: 'failed', status: 'CANCELLED', paymentDetails: { gateway: 'payhere', errorCode: payload.status_code },
      } }, { session });
      if (!result.modifiedCount) return;
      const event = await Event.findById(order.eventId).session(session);
      if (!event) throw new Error('Payment event not found');
      for (const item of order.tickets) {
        const category = event.categories.find(c => c.name === item.categoryName);
        if (category) {
          category.sold = Math.max(0, (category.sold || 0) - item.quantity);
          if (category.isPrivate) category.usageCount = Math.max(0, (category.usageCount || 0) - item.quantity);
        }
      }
      await event.save({ session }); changed = true;
    });
    return changed;
  } finally { await session.endSession(); }
}
module.exports = { failPayment };
