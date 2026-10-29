const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const SystemConfig = require('../models/SystemConfig');
const { sendWithProvider, baseTemplate } = require('../utils/email');
const { sendSMS } = require('../services/smsService');

/**
 * Expire stale reservations AFTER event has ended.
 * IMPORTANT: No ticket should expire before the event ends.
 * Reservations remain valid until the event end time.
 */
async function expireReservations() {
  try {
    // Get current time
    const now = new Date();

    // Find events that have ended (endDateTime < now)
    const endedEvents = await Event.find({
      endDateTime: { $lt: now }
    }).select('_id');

    if (endedEvents.length === 0) {
      console.log('[expireReservations] No events have ended yet.');
      return;
    }

    const endedEventIds = endedEvents.map(e => e._id);

    // Find reserved cash orders for events that have ended
    // These reservations should be expired since the event is over
    const expiredOrders = await Order.find({
      status: 'RESERVED',
      paymentMethod: { $in: ['cash_at_entrance', 'cash_on_entrance'] },
      eventId: { $in: endedEventIds }
    }).populate('eventId');

    if (expiredOrders.length === 0) {
      console.log('[expireReservations] No expired reservations found.');
      return;
    }

    console.log(`[expireReservations] Found ${expiredOrders.length} expired reservation(s) after event end.`);

    for (const order of expiredOrders) {
      // Check if the event truly has ended
      const eventEndTime = order.eventId?.endDateTime ? new Date(order.eventId.endDateTime) : null;
      if (!eventEndTime || eventEndTime > now) {
        console.log(`[expireReservations] Skipping order ${order.orderNumber} - event hasn't ended yet.`);
        continue;
      }

      // Cancel the order
      order.status = 'EXPIRED';
      order.paymentStatus = 'expired';
      await order.save();

      // Cancel tickets
      const tickets = await Ticket.find({ order: order._id });
      for (const ticket of tickets) {
        ticket.status = 'CANCELLED';
        await ticket.save();
      }

      // Release sold counts back to event categories
      if (order.eventId) {
        for (const item of order.tickets) {
          await Event.updateOne(
            { _id: order.eventId._id, 'categories.name': item.categoryName },
            { $inc: { 'categories.$.sold': -item.quantity } }
          );
        }
      }

      // Notify buyer
      try {
        const eventEndFormatted = eventEndTime.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const html = baseTemplate(`
          <h2>Reservation Expired</h2>
          <p>Dear ${order.buyerName},</p>
          <p>Your reservation for order <strong>#${order.orderNumber}</strong> for event 
             <strong>${order.eventId?.name || 'the event'}</strong> has expired.</p>
          <p>The event ended at ${eventEndFormatted} and payment was not collected.</p>
          <p>The reserved tickets have been released back to inventory.</p>
          <p>If you still wish to attend future events, please create a new booking.</p>
        `, 'Reservation Expired');

        await sendWithProvider({
          to: order.buyerEmail,
          subject: `Reservation Expired - #${order.orderNumber}`,
          html,
        });
      } catch (emailErr) {
        console.error(`[expireReservations] Email error for order ${order.orderNumber}:`, emailErr);
      }

      if (order.buyerPhone) {
        try {
          await sendSMS(
            order.buyerPhone,
            `EventGate: Your reservation #${order.orderNumber} has expired. Event has ended and tickets were released.`,
            { rateKey: `expire:${order.buyerPhone}` }
          );
        } catch (smsErr) {
          console.error(`[expireReservations] SMS error for order ${order.orderNumber}:`, smsErr);
        }
      }

      console.log(`[expireReservations] Expired order ${order.orderNumber}`);
    }
  } catch (error) {
    console.error('[expireReservations] Fatal error:', error);
  }
}

/**
 * Start the expiry job - runs every hour
 * Checks if events have ended and expires their pending cash reservations
 */
function startExpiryJob() {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  console.log('[expireReservations] Job scheduled – runs every hour.');
  setInterval(expireReservations, INTERVAL_MS);
  // Run once immediately on startup
  expireReservations();
}

module.exports = { expireReservations, startExpiryJob };