const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const Attendee = require('../models/Attendee');
const Ticket = require('../models/Ticket');
const Order = require('../models/Order');
const Event = require('../models/Event');
const { generateTicketPDF, generateOrderSummaryPDF } = require('./pdfService');
const { sendFinalConfirmation, sendOrderConfirmation } = require('../utils/email');

const MAX_RESUBMIT_COUNT = 3;

const requiresPhotoVerification = (event) => !!event?.settings?.requirePhotoVerification;

const requireUploadedPhotoFilter = {
  photo: { $exists: true, $nin: [null, ''] },
};

const withUploadedPhoto = (filter = {}) => ({
  ...filter,
  ...requireUploadedPhotoFilter,
});

const normalizePhotoStatus = (status) => String(status || '').toLowerCase();

const isTicketDeliverable = ({ attendee, event }) => {
  if (!attendee || !event) return false;
  if (!attendee.isConfirmed || attendee.confirmationStatus !== 'confirmed') return false;

  if (!requiresPhotoVerification(event)) {
    return true;
  }

  return normalizePhotoStatus(attendee.photoVerificationStatus) === 'verified';
};

const resolveConfirmedTicketStatus = ({ attendee, event }) => (
  isTicketDeliverable({ attendee, event }) ? 'CONFIRMED' : 'ASSIGNED'
);

const ensureAttendeeQrAssets = async (attendee) => {
  if (!attendee.qrToken) {
    attendee.qrToken = uuidv4();
  }

  attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
  return attendee;
};

const syncTicketAfterPhotoRejection = async (attendeeId) => {
  if (!attendeeId) return;
  await Ticket.findOneAndUpdate({ attendee: attendeeId }, { status: 'PENDING_VERIFICATION' });
};

const releasePublicTicketInventory = async (event, ticket) => {
  if (!event || !ticket?.categoryName) {
    return { released: false, reason: 'missing_event_or_category' };
  }

  const category = (event.categories || []).find(
    (item) => item.name === ticket.categoryName || item.id === ticket.categoryId,
  );

  if (!category) {
    return { released: false, reason: 'category_not_found' };
  }

  if (category.isPrivate) {
    return { released: false, reason: 'private_category' };
  }

  await Event.updateOne(
    { _id: event._id, 'categories.name': ticket.categoryName },
    { $inc: { 'categories.$.sold': -1 } },
  );

  return { released: true, categoryName: ticket.categoryName };
};

const handleMaxResubmissionsReached = async (attendeeInput, options = {}) => {
  const attendee = attendeeInput?.save
    ? attendeeInput
    : await Attendee.findById(attendeeInput?._id || attendeeInput);

  if (!attendee) {
    return { handled: false, reason: 'attendee_not_found' };
  }

  if ((attendee.resubmitCount || 0) < MAX_RESUBMIT_COUNT) {
    return { handled: false, reason: 'limit_not_reached' };
  }

  const ticket = await Ticket.findOne({ attendee: attendee._id });
  if (!ticket) {
    return { handled: false, reason: 'ticket_not_found' };
  }

  if (ticket.refundStatus === 'refunded' || ticket.status === 'CANCELLED') {
    return {
      handled: false,
      reason: 'already_invalidated',
      ticket,
      attendee,
      refundAmount: ticket.refundAmount || ticket.price || 0,
    };
  }

  const event = await Event.findById(attendee.event || ticket.event);
  const order = attendee.order
    ? await Order.findById(attendee.order)
    : await Order.findById(ticket.order);

  const refundAmount = ticket.price || 0;
  const reason = options.reason || 'Maximum photo resubmissions reached. Ticket invalidated and refund initiated.';
  const inventoryResult = await releasePublicTicketInventory(event, ticket);

  if (refundAmount > 0 && event) {
    await Event.findByIdAndUpdate(event._id, { $inc: { revenue: -refundAmount } });
  }

  ticket.status = 'CANCELLED';
  ticket.refundStatus = 'refunded';
  ticket.refundAmount = refundAmount;
  ticket.refundedAt = new Date();
  ticket.invalidatedAt = new Date();
  ticket.invalidationReason = reason;
  await ticket.save();

  attendee.confirmationStatus = 'rejected';
  attendee.isConfirmed = false;
  attendee.isActive = false;
  attendee.isDisabled = true;
  attendee.photoVerificationStatus = 'rejected';
  attendee.photoRejectionReason = reason;
  attendee.resubmitToken = null;
  attendee.qrCode = null;
  await attendee.save();

  if (order) {
    const refunds = Array.isArray(order.paymentDetails?.refunds) ? order.paymentDetails.refunds : [];
    refunds.push({
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
      amount: refundAmount,
      reason,
      refundedAt: new Date(),
      type: 'max_resubmissions',
    });
    order.paymentDetails = {
      ...(order.paymentDetails || {}),
      refunds,
    };
    order.markModified('paymentDetails');

    const allTickets = await Ticket.find({ order: order._id });
    const activeTickets = allTickets.filter((item) => item.status !== 'CANCELLED');
    if (activeTickets.length === 0) {
      order.status = 'CANCELLED';
    }
    await order.save();
  }

  return {
    handled: true,
    ticket,
    attendee,
    order,
    event,
    refundAmount,
    inventoryReleased: inventoryResult.released,
    reason,
  };
};

const finalizePhotoRejection = async (attendeeInput, { reason, verifiedBy } = {}) => {
  let attendee = attendeeInput;
  if (!attendee?.save) {
    attendee = await Attendee.findById(attendeeInput?._id || attendeeInput);
  }
  if (!attendee) {
    throw new Error('Attendee not found');
  }

  attendee.photoVerificationStatus = 'rejected';
  attendee.photoRejectionReason = reason || 'Rejected';
  attendee.photoVerifiedBy = verifiedBy || attendee.photoVerifiedBy;
  attendee.photoVerifiedAt = new Date();
  attendee.resubmitToken = attendee.resubmitToken || uuidv4();
  attendee.resubmitCount = (attendee.resubmitCount || 0) + 1;
  attendee.qrCode = null;

  await attendee.save();
  await syncTicketAfterPhotoRejection(attendee._id);

  if ((attendee.resubmitCount || 0) >= MAX_RESUBMIT_COUNT) {
    const invalidation = await handleMaxResubmissionsReached(attendee, {
      reason: 'Maximum photo resubmissions reached after organiser rejection.',
    });
    if (invalidation.handled) {
      const { notifyTicketInvalidationRefund } = require('./notificationService');
      await notifyTicketInvalidationRefund(invalidation).catch((error) => {
        console.error('MAX RESUBMISSION REFUND NOTIFY ERROR:', error);
      });
      return invalidation.attendee;
    }
  }

  return attendee;
};

const finalizePhotoApproval = async (attendeeInput, options = {}) => {
  const {
    verifiedBy = null,
    confirmedBy = 'organiser',
  } = options;

  let attendee = attendeeInput;
  if (!attendee?.save) {
    attendee = await Attendee.findById(attendeeInput?._id || attendeeInput).populate('event');
  }
  if (!attendee) {
    throw new Error('Attendee not found');
  }

  attendee.photoVerificationStatus = 'verified';
  attendee.photoRejectionReason = null;
  attendee.confirmationStatus = 'confirmed';
  attendee.isConfirmed = true;
  attendee.confirmedAt = attendee.confirmedAt || new Date();
  attendee.confirmedBy = confirmedBy;

  if (verifiedBy) {
    attendee.photoVerifiedBy = verifiedBy;
    attendee.photoVerifiedAt = new Date();
  }

  await ensureAttendeeQrAssets(attendee);
  await attendee.save();

  await Ticket.findOneAndUpdate({ attendee: attendee._id }, { status: 'CONFIRMED' });

  return attendee;
};

const loadAttendeeContext = async (attendeeOrId) => {
  const attendeeId = attendeeOrId?._id || attendeeOrId;
  if (!attendeeId) return null;

  const attendee = await Attendee.findById(attendeeId)
    .populate('event')
    .populate('ticket')
    .populate('order');

  if (!attendee) return null;

  let ticket = attendee.ticket;
  if (!ticket) {
    ticket = await Ticket.findOne({ attendee: attendee._id });
  }

  return {
    attendee,
    event: attendee.event,
    order: attendee.order,
    ticket,
  };
};

const deliverAttendeeTicketEmail = async ({ attendee: attendeeInput, event: eventInput, ticket: ticketInput, force = false }) => {
  let attendee = attendeeInput;
  let event = eventInput;
  let ticket = ticketInput;

  if (!attendee?._id || !event?._id) {
    const context = await loadAttendeeContext(attendeeInput);
    if (!context) {
      return { delivered: false, skipped: true, reason: 'attendee_not_found' };
    }
    attendee = context.attendee;
    event = context.event;
    ticket = ticket || context.ticket;
  }

  if (!attendee.email) {
    return { delivered: false, skipped: true, reason: 'missing_email' };
  }

  if (!isTicketDeliverable({ attendee, event })) {
    return { delivered: false, skipped: true, reason: 'ticket_not_ready' };
  }

  if (attendee.confirmationEmailSent && !force) {
    return { delivered: false, skipped: true, reason: 'already_sent' };
  }

  await ensureAttendeeQrAssets(attendee);

  const pdfBuffer = await generateTicketPDF(attendee, event, ticket);

  await sendFinalConfirmation({
    attendee,
    event,
    ticketCategory: ticket?.categoryName || attendee.categoryName,
    zoneAccessList: attendee.allowedZones || ticket?.allowedZones || [],
    pdfBuffer,
    supportEmail: process.env.EVENT_SUPPORT_EMAIL || 'support@entrynex.com',
    supportPhone: process.env.EVENT_SUPPORT_PHONE || '+94 11 234 5678',
  });

  attendee.confirmationEmailSent = true;
  attendee.confirmationSentAt = new Date();
  await attendee.save();

  return { delivered: true, attendeeId: attendee._id.toString() };
};

const sendBuyerPurchaseSummaryEmail = async ({ order: orderInput, event: eventInput }) => {
  const orderId = orderInput?._id || orderInput;
  const order = orderInput?._id ? orderInput : await Order.findById(orderId).lean();
  if (!order) {
    return { delivered: false, skipped: true, reason: 'order_not_found' };
  }

  const event = eventInput?._id ? eventInput : await Event.findById(eventInput || order.eventId).lean();
  if (!event) {
    return { delivered: false, skipped: true, reason: 'event_not_found' };
  }

  if (order.paymentStatus !== 'success' && order.paymentStatus !== 'paid') {
    return { delivered: false, skipped: true, reason: 'payment_not_successful' };
  }

  // Skip bank transfer orders - they use sendBankTransferPaymentApproved instead
  if (order.paymentMethod === 'bank_transfer') {
    console.log(`SKIPPING purchase summary email for bank transfer order ${order.orderNumber}`);
    return { delivered: false, skipped: true, reason: 'bank_transfer_order' };
  }

  const pdfBuffer = await generateOrderSummaryPDF(order, event);
  await sendOrderConfirmation(order, event, { pdfBuffer });
  return { delivered: true };
};

const sendBuyerOrderCreatedEmail = async ({ order: orderInput, event: eventInput }) => {
  const orderId = orderInput?._id || orderInput;
  const order = orderInput?._id ? orderInput : await Order.findById(orderId).lean();
  if (!order) {
    return { delivered: false, skipped: true, reason: 'order_not_found' };
  }

  const event = eventInput?._id ? eventInput : await Event.findById(eventInput || order.eventId).lean();
  if (!event) {
    return { delivered: false, skipped: true, reason: 'event_not_found' };
  }

  // Skip bank transfer orders - they will receive different email workflow
  if (order.paymentMethod === 'bank_transfer') {
    console.log(`SKIPPING order created email for bank transfer order ${order.orderNumber}`);
    return { delivered: false, skipped: true, reason: 'bank_transfer_order' };
  }

  const pdfBuffer = await generateOrderSummaryPDF(order, event);
  await sendOrderConfirmation(order, event, { pdfBuffer, stage: 'created' });
  return { delivered: true };
};

module.exports = {
  MAX_RESUBMIT_COUNT,
  requiresPhotoVerification,
  requireUploadedPhotoFilter,
  withUploadedPhoto,
  isTicketDeliverable,
  resolveConfirmedTicketStatus,
  ensureAttendeeQrAssets,
  finalizePhotoApproval,
  finalizePhotoRejection,
  syncTicketAfterPhotoRejection,
  releasePublicTicketInventory,
  handleMaxResubmissionsReached,
  deliverAttendeeTicketEmail,
  sendBuyerPurchaseSummaryEmail,
  sendBuyerOrderCreatedEmail,
};
