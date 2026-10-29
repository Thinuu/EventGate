const PaymentTask = require('../models/PaymentTask');
const Order = require('../models/Order');
const Event = require('../models/Event');
let running = false;
async function processNextTask() {
  if (running) return { processed: false };
  running = true;
  let task;
  try {
    const now = new Date();
    task = await PaymentTask.findOneAndUpdate({ attempts: { $lt: 8 }, $or: [
      { status: 'pending', nextAttemptAt: { $lte: now } },
      { status: 'processing', lockedUntil: { $lte: now } },
    ] }, { $set: { status: 'processing', lockedUntil: new Date(Date.now() + 300000) }, $inc: { attempts: 1 } }, { new: true });
    if (!task) return { processed: false };
    const order = await Order.findById(task.orderId);
    const event = order && await Event.findById(order.eventId);
    if (!order || !event || !['paid', 'success'].includes(order.paymentStatus)) throw new Error('Paid order or event unavailable');
    await require('../services/finalConfirmationService').processOrderFinalConfirmation({ orderId: order._id });
    await require('../services/notificationService').notifyOrderConfirmation({ order, event, buyerPhone: order.buyerPhone, notificationChannel: order.notificationChannel || 'email', strictDelivery: true });
    await PaymentTask.updateOne({ _id: task._id }, { $set: { status: 'done', completedAt: new Date() }, $unset: { lastError: 1, lockedUntil: 1 } });
  } catch (error) {
    console.error('Payment fulfillment task failed:', task?._id?.toString() || 'claim', error.message);
    if (task) await PaymentTask.updateOne({ _id: task._id }, { $set: { status: task.attempts >= 8 ? 'failed' : 'pending', lastError: 'Fulfillment failed; inspect server logs', nextAttemptAt: new Date(Date.now() + Math.min(3600000, 15000 * 2 ** task.attempts)) }, $unset: { lockedUntil: 1 } }).catch(() => {});
  } finally { running = false; }
  return { processed: !!task };
}
function startPaymentTasks() { processNextTask(); const timer = setInterval(processNextTask, 10000); timer.unref(); return timer; }
module.exports = { processNextTask, startPaymentTasks };
