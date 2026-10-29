const Ticket = require('../models/Ticket');
const Order = require('../models/Order');
const Event = require('../models/Event');
const QRCode = require('qrcode');
const { requiresPhotoVerification } = require('./ticketDeliveryService');
const { allocateRfid, linkReservedRfidToAttendee } = require('./rfidService');

const processOrderFinalConfirmation = async ({ orderId }) => {
  if (!orderId) return { sentCount: 0, skipped: true, reason: 'missing_order' };

  const order = await Order.findById(orderId).lean();
  if (!order) return { sentCount: 0, skipped: true, reason: 'order_not_found' };

  const tickets = await Ticket.find({ order: orderId }).populate('attendee');
  if (!tickets.length) return { sentCount: 0, skipped: true, reason: 'no_tickets' };

  const event = await Event.findById(order.eventId).lean();
  if (!event) return { sentCount: 0, skipped: true, reason: 'event_not_found' };

  const isPaid = ['paid', 'success'].includes(String(order.paymentStatus || '').toLowerCase())
    || order.status === 'CONFIRMED';
  if (!isPaid) return { sentCount: 0, skipped: true, reason: 'payment_not_confirmed' };

  let sentCount = 0;
  const summaryRows = [];

  const { notifyFinalTicket, notifyBuyerFinalSummary } = require('./notificationService');

  for (const ticket of tickets) {
    const attendee = ticket.attendee;
    if (!attendee) {
      await allocateRfid({
        eventId: ticket.event || order.eventId,
        categoryId: ticket.categoryId,
        ticketId: ticket._id,
      });
      continue;
    }

    if (!attendee.rfidTag) {
      attendee.rfidTag = await linkReservedRfidToAttendee({
        ticketId: ticket._id,
        attendeeId: attendee._id,
      });
    }
    if (!attendee.rfidTag) {
      attendee.rfidTag = await allocateRfid({
        eventId: ticket.event || order.eventId,
        categoryId: ticket.categoryId || attendee.categoryId,
        attendeeId: attendee._id,
        ticketId: ticket._id,
      });
    }

    if (attendee.qrToken && !attendee.qrCode) {
      attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
    }
    await attendee.save();

    summaryRows.push({
      fullName: attendee.fullName || 'N/A',
      email: attendee.email || 'N/A',
      categoryName: ticket.categoryName || attendee.categoryName || 'N/A',
      verificationStatus: attendee.photoVerificationStatus || 'pending',
    });

    const result = await notifyFinalTicket({
      attendee,
      event,
      phone: attendee.phone,
      notificationChannel: 'both'
    });

    if (result && result.delivered) {
      sentCount += 1;
    }
  }

  const allVerified = tickets.every((ticket) => {
    if (!ticket.attendee) return false;
    if (!requiresPhotoVerification(event)) return ticket.attendee.confirmationStatus === 'confirmed';
    return String(ticket.attendee.photoVerificationStatus || '').toLowerCase() === 'verified';
  });

  if (allVerified && summaryRows.length > 0 && order.buyerEmail && sentCount > 0) {
    await notifyBuyerFinalSummary({
      order,
      event,
      attendees: summaryRows
    });
  }

  return { sentCount, skipped: false, allVerified };
};

module.exports = {
  processOrderFinalConfirmation,
};
