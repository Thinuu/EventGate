const express = require('express');
const mongoose = require('mongoose');
const XLSX = require('../utils/spreadsheet');
const { protect, restrictTo } = require('../middleware/auth');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const EntryLog = require('../models/EntryLog');
const ZoneLog = require('../models/ZoneLog');
const Notification = require('../models/Notification');
const User = require('../models/User');
const RequestLog = require('../models/RequestLog');
const SystemConfig = require('../models/SystemConfig');
const PaymentSubmission = require('../models/PaymentSubmission');
const Order = require('../models/Order');
const {
  getStats,
  getDashboardStats,
  listEvents,
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
  listUsers,
  createUser,
  updateUser,
  duplicateEvent,
} = require('../controllers/adminController');

const router = express.Router();

router.use(protect, restrictTo('main_admin', 'super_admin'));

const buildDateFilter = (from, to, field = 'createdAt') => {
  const range = {};
  if (from) {
    const start = new Date(from);
    if (!Number.isNaN(start.getTime())) range.$gte = start;
  }
  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
  }
  return Object.keys(range).length ? { [field]: range } : {};
};

const getSystemConfig = () => SystemConfig.findOneAndUpdate(
  { key: 'global' },
  { $setOnInsert: { key: 'global' } },
  { new: true, upsert: true, setDefaultsOnInsert: true }
);

router.get('/workspace', async (req, res, next) => {
  try {
    const {
      eventId,
      search = '',
      status = '',
      verificationStatus = '',
      gate = '',
      zone = '',
      page = 1,
      limit = 8,
      from,
      to,
    } = req.query;

    const safeLimit = Math.min(parseInt(limit, 10) || 8, 25);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * safeLimit;
    const objectEventId = mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : null;
    const entryDateFilter = buildDateFilter(from, to, 'timestamp');
    const createdDateFilter = buildDateFilter(from, to, 'createdAt');
    const eventFilter = objectEventId ? { _id: objectEventId } : {};

    const attendeeFilter = {
      ...(objectEventId ? { event: objectEventId } : {}),
      ...(status ? { confirmationStatus: status } : {}),
      ...(verificationStatus ? { photoVerificationStatus: verificationStatus } : {}),
      ...(search ? {
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { categoryName: { $regex: search, $options: 'i' } },
        ],
      } : {}),
      ...createdDateFilter,
    };

    const entryFilter = {
      ...(objectEventId ? { event: objectEventId } : {}),
      ...(gate ? { $or: [{ gateId: gate }, { gateName: gate }] } : {}),
      ...entryDateFilter,
    };

    const zoneFilter = {
      ...(objectEventId ? { eventId: objectEventId } : {}),
      ...(zone ? { zoneName: zone } : {}),
      ...entryDateFilter,
    };

    const [config, events, totals, ticketsByStatus, attendeesPage, attendeeTotal, verificationQueue, entryLogs, zoneLogs, notifications, apiHealth, ticketTrend, checkinsByHour, zoneOccupancy, activeUsersByRole, ticketCategoryMix, ticketsByEventData, totalOrdersCount] = await Promise.all([
      getSystemConfig(),
      Event.find(eventFilter).select('name startDate endDate status venue categories zones mainOrganiser').populate('mainOrganiser', 'name email').sort({ startDate: 1 }).limit(50),
      Promise.all([
        Event.countDocuments(eventFilter),
        Ticket.countDocuments(objectEventId ? { event: objectEventId } : {}),
        Attendee.countDocuments({ ...(objectEventId ? { event: objectEventId } : {}), confirmationStatus: 'confirmed' }),
        EntryLog.countDocuments({ ...(objectEventId ? { event: objectEventId } : {}), action: 'check_in', accessGranted: true }),
        Promise.all([
          EntryLog.countDocuments({ ...(objectEventId ? { event: objectEventId } : {}), accessGranted: false }),
          ZoneLog.countDocuments({ ...(objectEventId ? { eventId: objectEventId } : {}), accessGranted: false }),
        ]).then(([entryDenied, zoneDenied]) => entryDenied + zoneDenied),
      ]),
      Ticket.aggregate([
        { $match: objectEventId ? { event: objectEventId } : {} },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Ticket.aggregate([
        { $match: objectEventId ? { event: objectEventId } : {} },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Attendee.find(attendeeFilter)
        .populate('event', 'name startDate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
      Attendee.countDocuments(attendeeFilter),
      Attendee.find({
        ...(objectEventId ? { event: objectEventId } : {}),
        photoVerificationStatus: { $in: ['pending', 'Pending'] },
      })
        .populate('event', 'name')
        .sort({ createdAt: -1 })
        .limit(8),
      EntryLog.find(entryFilter)
        .populate('attendee', 'fullName categoryName photo')
        .populate('processedBy', 'name role')
        .sort({ timestamp: -1 })
        .limit(10),
      ZoneLog.find(zoneFilter)
        .populate('attendeeId', 'fullName categoryName')
        .populate('scannedBy', 'name role')
        .sort({ timestamp: -1 })
        .limit(10),
      Notification.find({})
        .populate('user', 'name email role')
        .sort({ createdAt: -1 })
        .limit(12),
      RequestLog.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            errorRequests: { $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] } },
            avgLatencyMs: { $avg: '$durationMs' },
          },
        },
      ]),
      Ticket.aggregate([
        { $match: objectEventId ? { event: objectEventId } : {} },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        {
          $project: {
            _id: 0,
            label: {
              $concat: [
                { $toString: '$_id.year' }, '-',
                { $toString: '$_id.month' }, '-',
                { $toString: '$_id.day' },
              ],
            },
            count: 1,
          },
        },
      ]),
      EntryLog.aggregate([
        { $match: { ...(objectEventId ? { event: objectEventId } : {}), action: 'check_in', accessGranted: true } },
        {
          $group: {
            _id: { month: { $month: '$timestamp' }, day: { $dayOfMonth: '$timestamp' }, hour: { $hour: '$timestamp' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
        {
          $project: {
            _id: 0,
            month: '$_id.month',
            day: '$_id.day',
            hour: '$_id.hour',
            label: { $concat: [{ $toString: '$_id.day' }, '/', { $toString: '$_id.month' }, ' ', { $toString: '$_id.hour' }, ':00'] },
            count: 1,
          },
        },
      ]),
      ZoneLog.aggregate([
        { $match: { ...(objectEventId ? { eventId: objectEventId } : {}), accessGranted: true } },
        {
          $group: {
            _id: { zoneName: '$zoneName', action: '$action' },
            count: { $sum: 1 },
          },
        },
      ]),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Ticket.aggregate([
        { $match: objectEventId ? { event: objectEventId } : {} },
        { $group: { _id: '$categoryName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      // Tickets by event for "Tickets by Event" chart
      Ticket.aggregate([
        { $group: { _id: '$event', ticketsSold: { $sum: 1 } } },
        { $sort: { ticketsSold: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'events',
            localField: '_id',
            foreignField: '_id',
            as: 'event'
          }
        },
        { $unwind: '$event', $skipNulls: true },
        { $project: { _id: 0, eventId: '$_id', name: '$event.name', ticketsSold: 1 } }
      ]),
      // Total orders count
      Order.countDocuments({ paymentStatus: 'success' })
    ]);

    const zoneMap = new Map();
    zoneOccupancy.forEach((row) => {
      const existing = zoneMap.get(row._id.zoneName) || { zoneName: row._id.zoneName, entries: 0, exits: 0, occupancy: 0 };
      if (row._id.action === 'ENTRY') existing.entries = row.count;
      if (row._id.action === 'EXIT') existing.exits = row.count;
      existing.occupancy = Math.max(existing.entries - existing.exits, 0);
      zoneMap.set(row._id.zoneName, existing);
    });

    const [totalEvents, totalTicketsSold, confirmedAttendees, checkedInUsers, deniedEntries] = totals;
    const requestHealth = apiHealth[0] || { totalRequests: 0, errorRequests: 0, avgLatencyMs: 0 };

    res.json({
      success: true,
      data: {
        filters: {
          eventId: eventId || null,
          search,
          status,
          verificationStatus,
          gate,
          zone,
          from: from || null,
          to: to || null,
          page: Math.floor(skip / safeLimit) + 1,
          limit: safeLimit,
        },
        overview: {
          totalEvents,
          totalTicketsSold,
          confirmedAttendees,
          checkedInUsers,
          deniedEntries,
          totalOrders: totalOrdersCount,
          requestHealth: {
            totalRequests: requestHealth.totalRequests,
            errorRequests: requestHealth.errorRequests,
            avgLatencyMs: Math.round(requestHealth.avgLatencyMs || 0),
          },
        },
        charts: {
          ticketTrend,
          checkinsByHour,
          zoneOccupancy: Array.from(zoneMap.values()),
          ticketCategoryMix,
          ticketsByStatus,
          activeUsersByRole,
        },
        events,
        attendees: {
          rows: attendeesPage,
          total: attendeeTotal,
          page: Math.floor(skip / safeLimit) + 1,
          pages: Math.ceil(attendeeTotal / safeLimit) || 1,
        },
        verificationQueue,
        entryLogs,
        zoneLogs,
        notifications,
        settings: config,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await getSystemConfig();
    res.json({ success: true, data: { settings } });
  } catch (err) {
    next(err);
  }
});

router.patch('/settings', async (req, res, next) => {
  try {
    const settings = await SystemConfig.findOneAndUpdate(
      { key: 'global' },
      { $set: req.body, $setOnInsert: { key: 'global' } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: { settings }, message: 'System settings updated.' });
  } catch (err) {
    next(err);
  }
});

router.get('/reports/export', async (req, res, next) => {
  try {
    const { type = 'attendees', eventId, format = 'csv', from, to } = req.query;
    const objectEventId = mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : null;
    const wb = XLSX.utils.book_new();
    let filename = `${type}-report`;

    if (type === 'entry_logs') {
      const rows = await EntryLog.find({
        ...(objectEventId ? { event: objectEventId } : {}),
        ...buildDateFilter(from, to, 'timestamp'),
      })
        .populate('attendee', 'fullName categoryName')
        .sort({ timestamp: -1 })
        .lean();

      const data = [
        ['Timestamp', 'Attendee', 'Category', 'Gate', 'Zone', 'Action', 'Status'],
        ...rows.map((row) => [
          row.timestamp ? new Date(row.timestamp).toISOString() : '',
          row.attendee?.fullName || row.snapshot?.fullName || '-',
          row.attendee?.categoryName || row.snapshot?.categoryName || '-',
          row.gateName || row.gateId || '-',
          row.zoneName || '-',
          row.action,
          row.accessGranted ? 'Allowed' : `Denied${row.denialReason ? `: ${row.denialReason}` : ''}`,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Entry Logs');
      filename = 'entry-logs';
    } else if (type === 'zone_access') {
      const rows = await ZoneLog.find({
        ...(objectEventId ? { eventId: objectEventId } : {}),
        ...buildDateFilter(from, to, 'timestamp'),
      })
        .populate('attendeeId', 'fullName categoryName')
        .sort({ timestamp: -1 })
        .lean();
      const data = [
        ['Timestamp', 'Attendee', 'Category', 'Zone', 'Action', 'Status'],
        ...rows.map((row) => [
          row.timestamp ? new Date(row.timestamp).toISOString() : '',
          row.attendeeId?.fullName || row.attendeeSnapshot?.fullName || '-',
          row.attendeeId?.categoryName || row.attendeeSnapshot?.categoryName || '-',
          row.zoneName,
          row.action,
          row.accessGranted ? 'Allowed' : `Denied${row.denialReason ? `: ${row.denialReason}` : ''}`,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Zone Access');
      filename = 'zone-access';
    } else {
      const rows = await Attendee.find({
        ...(objectEventId ? { event: objectEventId } : {}),
        ...buildDateFilter(from, to, 'createdAt'),
      })
        .populate('event', 'name')
        .sort({ createdAt: -1 })
        .lean();

      const data = [
        ['Event', 'Attendee', 'Email', 'Phone', 'Category', 'Confirmation', 'Photo Verification', 'Checked In'],
        ...rows.map((row) => [
          row.event?.name || '-',
          row.fullName || '-',
          row.email || '-',
          row.phone || '-',
          row.categoryName || '-',
          row.confirmationStatus || '-',
          row.photoVerificationStatus || '-',
          row.checkedIn ? 'Yes' : 'No',
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Attendees');
      filename = 'attendees';
    }

    const isXlsx = format === 'xlsx';
    const buffer = await XLSX.write(wb, { type: 'buffer', bookType: isXlsx ? 'xlsx' : 'csv' });
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.${isXlsx ? 'xlsx' : 'csv'}"`);
    res.setHeader('Content-Type', isXlsx ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get('/stats', getStats);
router.get('/dashboard/stats', getDashboardStats);

router.get('/events', listEvents);
router.post('/events', createEvent);
router.get('/events/:id', getEvent);
router.patch('/events/:id', updateEvent);
router.delete('/events/:id', deleteEvent);
router.post('/events/:id/duplicate', duplicateEvent);

router.get('/users', listUsers);
router.post('/users', createUser);
router.patch('/users/:id', updateUser);

// GET /api/admin/payments - Payment submissions for admin dashboard
router.get('/payments', async (req, res, next) => {
  try {
    const { status = 'pending', page = 1, limit = 20, eventId } = req.query;
    
    // Build filter
    const filter = {};
    if (status && status !== 'all') {
      filter.verificationStatus = status;
    }
    
    if (eventId) {
      // Get orders for the specific event
      const ordersForEvent = await Order.find({ 
        eventId: mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : eventId,
        paymentMethod: 'bank_transfer'
      }).select('_id');
      const orderIds = ordersForEvent.map(o => o._id);
      filter.orderId = { $in: orderIds };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [payments, total] = await Promise.all([
      PaymentSubmission.find(filter)
        .populate('orderId', 'orderNumber totalAmount buyerEmail buyerName eventId')
        .populate('verifiedBy', 'name email')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      PaymentSubmission.countDocuments(filter)
    ]);

    res.json({ 
      success: true, 
      data: { 
        payments: payments.map(payment => ({
          _id: payment._id,
          payerName: payment.payerName,
          payerEmail: payment.payerEmail,
          payerPhone: payment.payerPhone,
          payerNicPassport: payment.payerNicPassport,
          bankUsed: payment.bankUsed,
          transferDate: payment.transferDate,
          transferTime: payment.transferTime,
          referenceNumber: payment.referenceNumber,
          amountPaid: payment.amountPaid,
          receiptFile: payment.receiptFile,
          receiptFileType: payment.receiptFileType,
          notes: payment.notes,
          verificationStatus: payment.verificationStatus,
          rejectionReason: payment.rejectionReason,
          submittedAt: payment.submittedAt,
          verifiedAt: payment.verifiedAt,
          verifiedBy: payment.verifiedBy ? {
            _id: payment.verifiedBy._id,
            name: payment.verifiedBy.name,
            email: payment.verifiedBy.email,
          } : null,
          order: payment.orderId ? {
            _id: payment.orderId._id,
            orderNumber: payment.orderId.orderNumber,
            totalAmount: payment.orderId.totalAmount,
            buyerEmail: payment.orderId.buyerEmail,
            buyerName: payment.orderId.buyerName,
            eventId: payment.orderId.eventId,
          } : null,
        })),
        total, 
        pages: Math.ceil(total / parseInt(limit, 10)) 
      } 
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
