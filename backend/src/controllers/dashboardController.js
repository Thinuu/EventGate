const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const PaymentSubmission = require('../models/PaymentSubmission');

const mapTicket = (ticket) => ({
  _id: ticket._id,
  ticketNumber: ticket.ticketNumber,
  status: ticket.status,
  categoryName: ticket.categoryName,
  allowedZones: ticket.allowedZones || [],
  attendee: ticket.attendee ? {
    _id: ticket.attendee._id,
    fullName: ticket.attendee.fullName,
    email: ticket.attendee.email,
    photo: ticket.attendee.photo,
    confirmationStatus: ticket.attendee.confirmationStatus,
    isConfirmed: ticket.attendee.isConfirmed,
    qrCode: ticket.attendee.qrCode,
    qrToken: ticket.attendee.qrToken,
    notes: ticket.attendee.notes,
    allowedZones: ticket.attendee.allowedZones || ticket.allowedZones || [],
  } : null,
  event: ticket.event ? {
    _id: ticket.event._id,
    name: ticket.event.name,
    startDate: ticket.event.startDate,
    endDate: ticket.event.endDate,
    venue: ticket.event.venue,
    status: ticket.event.status,
  } : null,
});

const getDashboardData = async (req, res, next) => {
  try {
    const email = req.user.email?.toLowerCase?.() || '';
    const now = new Date();

    const buyerOrders = await Order.find({ buyerEmail: email })
      .populate('eventId', 'name startDate endDate venue status')
      .sort({ createdAt: -1 });

    // Fetch payment submissions for bank transfer orders
    const orderIds = buyerOrders.map((order) => order._id);
    const bankTransferOrderIds = buyerOrders
      .filter((order) => order.paymentMethod === 'bank_transfer')
      .map((order) => order._id);
    
    const paymentSubmissions = bankTransferOrderIds.length > 0 
      ? await PaymentSubmission.find({ orderId: { $in: bankTransferOrderIds } })
          .populate('verifiedBy', 'name email')
          .sort({ submittedAt: -1 })
      : [];
    
    // Create a map of orderId to payment submission for easy lookup
    const paymentSubmissionMap = {};
    paymentSubmissions.forEach((submission) => {
      paymentSubmissionMap[submission.orderId.toString()] = submission;
    });

    const attendeeRecords = await Attendee.find({ email })
      .select('_id ticket event confirmationStatus isConfirmed qrCode qrToken allowedZones categoryName fullName photo notes')
      .populate('event', 'name startDate endDate venue status zones');

    const attendeeIds = attendeeRecords.map((a) => a._id);
    const attendeeTicketIds = attendeeRecords.map((a) => a.ticket).filter(Boolean);

    const tickets = await Ticket.find({
      $or: [
        orderIds.length ? { order: { $in: orderIds } } : null,
        attendeeIds.length ? { attendee: { $in: attendeeIds } } : null,
        attendeeTicketIds.length ? { _id: { $in: attendeeTicketIds } } : null,
      ].filter(Boolean),
    })
      .populate('event', 'name startDate endDate venue status')
      .populate('attendee', 'fullName email photo confirmationStatus isConfirmed qrCode qrToken notes allowedZones')
      .sort({ updatedAt: -1 });

    const currentTickets = tickets
      .filter((t) => t.event?.startDate && new Date(t.event.startDate) >= now)
      .map(mapTicket);

    const previousOrders = buyerOrders
      .filter((o) => o.eventId?.endDate && new Date(o.eventId.endDate) < now)
      .map((o) => {
        const paymentSubmission = paymentSubmissionMap[o._id.toString()];
        return {
          _id: o._id,
          orderNumber: o.orderNumber,
          totalAmount: o.totalAmount,
          status: o.status,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          createdAt: o.createdAt,
          paymentSubmission: paymentSubmission ? {
            _id: paymentSubmission._id,
            payerName: paymentSubmission.payerName,
            payerEmail: paymentSubmission.payerEmail,
            payerPhone: paymentSubmission.payerPhone,
            bankUsed: paymentSubmission.bankUsed,
            transferDate: paymentSubmission.transferDate,
            transferTime: paymentSubmission.transferTime,
            referenceNumber: paymentSubmission.referenceNumber,
            amountPaid: paymentSubmission.amountPaid,
            receiptFile: paymentSubmission.receiptFile,
            receiptFileType: paymentSubmission.receiptFileType,
            verificationStatus: paymentSubmission.verificationStatus,
            rejectionReason: paymentSubmission.rejectionReason,
            submittedAt: paymentSubmission.submittedAt,
            verifiedAt: paymentSubmission.verifiedAt,
          } : null,
          event: o.eventId ? {
            _id: o.eventId._id,
            name: o.eventId.name,
            startDate: o.eventId.startDate,
            endDate: o.eventId.endDate,
            venue: o.eventId.venue,
          } : null,
        };
      });

    let assignedEvents = [];
    if (req.user.assignedEvents?.length) {
      const ids = req.user.assignedEvents;
      const events = await Event.find({ _id: { $in: ids } })
        .select('name startDate venue status')
        .sort({ startDate: 1 });

      const stats = await Attendee.aggregate([
        { $match: { event: { $in: ids } } },
        {
          $group: {
            _id: '$event',
            total: { $sum: 1 },
            confirmed: { $sum: { $cond: ['$isConfirmed', 1, 0] } },
            checkedIn: { $sum: { $cond: ['$checkedIn', 1, 0] } },
          },
        },
      ]);
      const statMap = stats.reduce((acc, item) => {
        acc[item._id.toString()] = item;
        return acc;
      }, {});

      assignedEvents = events.map((event) => {
        const eventStats = statMap[event._id.toString()] || {};
        return {
          _id: event._id,
          name: event.name,
          startDate: event.startDate,
          venue: event.venue,
          status: event.status,
          stats: {
            total: eventStats.total || 0,
            confirmed: eventStats.confirmed || 0,
            checkedIn: eventStats.checkedIn || 0,
          },
        };
      });
    }

    const upcomingPublicEvents = await Event.find({
      status: 'published',
      startDate: { $gte: now },
    })
      .select('name startDate venue coverImage')
      .sort({ startDate: 1 })
      .limit(6);

    const recentActivity = [
      ...tickets.slice(0, 4).map((t) => ({
        id: `ticket-${t._id}`,
        message: `${t.status === 'CONFIRMED' ? 'Ticket confirmed' : 'Ticket updated'} for ${t.event?.name || 'event'}`,
        time: t.updatedAt || t.createdAt,
      })),
      ...buyerOrders.slice(0, 2).map((o) => ({
        id: `order-${o._id}`,
        message: `Order ${o.orderNumber} created for ${o.eventId?.name || 'event'}`,
        time: o.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 6);

    res.json({
      success: true,
      data: {
        userRole: req.user.role,
        currentTickets,
        previousOrders,
        assignedEvents,
        upcomingPublicEvents,
        recentActivity,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboardData };
