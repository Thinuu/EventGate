const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const EntryLog = require('../models/EntryLog');
const ZoneLog = require('../models/ZoneLog');
const PaymentSubmission = require('../models/PaymentSubmission');
const Order = require('../models/Order');
const { normalizeRole, ROLES } = require('../utils/rbac');

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const getAccessibleEventIds = async (user, requestedEventId) => {
  const role = normalizeRole(user.role);
  const requestedId = String(requestedEventId || '').trim();

  if (role === ROLES.MAIN_ADMIN) {
    if (requestedId) {
      if (!mongoose.Types.ObjectId.isValid(requestedId)) return [];
      const exists = await Event.exists({ _id: requestedId });
      return exists ? [requestedId] : [];
    }

    const events = await Event.find({}, '_id').lean();
    return events.map((event) => event._id.toString());
  }

  const assigned = (user.assignedEvents || []).map((eventId) => eventId.toString());
  if (requestedId) {
    return assigned.includes(requestedId) ? [requestedId] : [];
  }

  return assigned;
};

const buildEventMatch = (eventIds) => {
  const objectIds = eventIds.map((eventId) => toObjectId(eventId));
  return objectIds.length === 1 ? objectIds[0] : { $in: objectIds };
};

router.use(protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser'));

router.get('/stats', async (req, res, next) => {
  try {
    const { eventId, zone } = req.query;
    const accessibleEventIds = await getAccessibleEventIds(req.user, eventId);

    if (!accessibleEventIds.length) {
      return res.status(403).json({ success: false, message: 'You do not have access to the requested event.' });
    }

    const eventMatch = buildEventMatch(accessibleEventIds);
    const zoneFilter = zone ? { zoneName: zone } : {};

    const [totalTickets, confirmedAttendees, checkedInCount, deniedEntryLogs, deniedZoneLogs, entryTrend, zoneEntryCounts, zoneExitCounts, byCategory] = await Promise.all([
      Ticket.countDocuments({ event: eventMatch }),
      Attendee.countDocuments({ event: eventMatch, isConfirmed: true }),
      EntryLog.countDocuments({ event: eventMatch, action: 'check_in', accessGranted: true }),
      EntryLog.countDocuments({ event: eventMatch, action: 'denied' }),
      ZoneLog.countDocuments({ eventId: eventMatch, accessGranted: false, ...zoneFilter }),
      EntryLog.aggregate([
        { $match: { event: eventMatch, action: 'check_in', accessGranted: true } },
        {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' },
              hour: { $hour: '$timestamp' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
        {
          $project: {
            _id: 0,
            label: {
              $concat: [
                { $toString: '$_id.year' }, '-',
                { $toString: '$_id.month' }, '-',
                { $toString: '$_id.day' }, ' ',
                { $toString: '$_id.hour' }, ':00',
              ],
            },
            count: 1,
          },
        },
      ]),
      ZoneLog.aggregate([
        { $match: { eventId: eventMatch, accessGranted: true, action: 'ENTRY', ...zoneFilter } },
        { $group: { _id: '$zoneName', entries: { $sum: 1 } } },
      ]),
      ZoneLog.aggregate([
        { $match: { eventId: eventMatch, accessGranted: true, action: 'EXIT', ...zoneFilter } },
        { $group: { _id: '$zoneName', exits: { $sum: 1 } } },
      ]),
      Attendee.aggregate([
        { $match: { event: eventMatch, isActive: true } },
        { $group: { _id: '$categoryName', categoryName: { $first: '$categoryName' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const exitLookup = new Map(zoneExitCounts.map((item) => [item._id, item.exits]));
    const zoneOccupancy = zoneEntryCounts.map((item) => ({
      zoneName: item._id,
      occupancy: Math.max(item.entries - (exitLookup.get(item._id) || 0), 0),
      entries: item.entries,
      exits: exitLookup.get(item._id) || 0,
    }));

    res.json({
      success: true,
      data: {
        totalTickets,
        confirmedAttendees,
        checkedInCount,
        deniedCount: deniedEntryLogs + deniedZoneLogs,
        entryTrend,
        zoneOccupancy,
        byCategory,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const { eventId, zone, limit = 20 } = req.query;
    const accessibleEventIds = await getAccessibleEventIds(req.user, eventId);

    if (!accessibleEventIds.length) {
      return res.status(403).json({ success: false, message: 'You do not have access to the requested event.' });
    }

    const eventObjectIds = accessibleEventIds.map((id) => toObjectId(id));
    const entryMatch = {
      event: eventObjectIds.length === 1 ? eventObjectIds[0] : { $in: eventObjectIds },
    };
    const zoneMatch = {
      eventId: eventObjectIds.length === 1 ? eventObjectIds[0] : { $in: eventObjectIds },
    };

    if (zone) {
      entryMatch.$or = [{ zoneName: zone }, { gateName: zone }, { zoneId: zone }];
      zoneMatch.zoneName = zone;
    }

    const activity = await EntryLog.aggregate([
      { $match: entryMatch },
      {
        $lookup: {
          from: 'attendees',
          localField: 'attendee',
          foreignField: '_id',
          as: 'attendeeDoc',
        },
      },
      {
        $project: {
          _id: 1,
          source: { $literal: 'entry' },
          eventId: '$event',
          name: {
            $ifNull: [
              { $arrayElemAt: ['$attendeeDoc.fullName', 0] },
              '$snapshot.fullName',
            ],
          },
          action: {
            $switch: {
              branches: [
                { case: { $eq: ['$action', 'check_in'] }, then: 'CHECK-IN' },
                { case: { $eq: ['$action', 'check_out'] }, then: 'CHECK-OUT' },
                { case: { $eq: ['$action', 'zone_entry'] }, then: 'ZONE ENTRY' },
                { case: { $eq: ['$action', 'zone_exit'] }, then: 'ZONE EXIT' },
                { case: { $eq: ['$action', 'denied'] }, then: 'DENIED ENTRY' },
              ],
              default: { $toUpper: '$action' },
            },
          },
          zoneName: { $ifNull: ['$zoneName', '$gateName'] },
          timestamp: '$timestamp',
          accessGranted: '$accessGranted',
        },
      },
      {
        $unionWith: {
          coll: 'zonelogs',
          pipeline: [
            { $match: zoneMatch },
            {
              $lookup: {
                from: 'attendees',
                localField: 'attendeeId',
                foreignField: '_id',
                as: 'attendeeDoc',
              },
            },
            {
              $project: {
                _id: 1,
                source: { $literal: 'zone' },
                eventId: '$eventId',
                name: {
                  $ifNull: [
                    { $arrayElemAt: ['$attendeeDoc.fullName', 0] },
                    '$attendeeSnapshot.fullName',
                  ],
                },
                action: {
                  $cond: [
                    { $eq: ['$accessGranted', false] },
                    'ZONE DENIED',
                    {
                      $cond: [{ $eq: ['$action', 'ENTRY'] }, 'ZONE ENTRY', 'ZONE EXIT'],
                    },
                  ],
                },
                zoneName: '$zoneName',
                timestamp: '$timestamp',
                accessGranted: '$accessGranted',
              },
            },
          ],
        },
      },
      { $sort: { timestamp: -1 } },
      { $limit: Math.min(parseInt(limit, 10) || 20, 100) },
    ]);

    res.json({ success: true, data: { logs: activity } });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/timeline | check-ins per hour for today
router.get('/timeline', async (req, res, next) => {
  try {
    const { eventId } = req.query;
    const accessibleEventIds = await getAccessibleEventIds(req.user, eventId);
    if (!accessibleEventIds.length) {
      return res.status(403).json({ success: false, message: 'No access.' });
    }
    const eventMatch = buildEventMatch(accessibleEventIds);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const timeline = await EntryLog.aggregate([
      { $match: { event: eventMatch, action: 'check_in', accessGranted: true, timestamp: { $gte: todayStart } } },
      { $group: {
          _id: { $hour: '$timestamp' },
          count: { $sum: 1 },
      }},
      { $sort: { '_id': 1 } },
      { $project: { _id: 0, hour: '$_id', count: 1, label: { $concat: [{ $toString: '$_id' }, ':00'] } } },
    ]);

    // Fill in missing hours with 0
    const currentHour = new Date().getHours();
    const filled = [];
    for (let h = 0; h <= currentHour; h++) {
      const match = timeline.find(t => t.hour === h);
      filled.push({ hour: h, label: `${String(h).padStart(2,'0')}:00`, count: match?.count || 0 });
    }

    res.json({ success: true, data: { timeline: filled } });
  } catch (err) { next(err); }
});

// GET /api/dashboard/denied | denied access entries with pagination
router.get('/denied', async (req, res, next) => {
  try {
    const { eventId, page = 1, limit = 20, from, to } = req.query;
    const accessibleEventIds = await getAccessibleEventIds(req.user, eventId);
    if (!accessibleEventIds.length) {
      return res.status(403).json({ success: false, message: 'No access.' });
    }
    const eventMatch = buildEventMatch(accessibleEventIds);
    const filter = { event: eventMatch, accessGranted: false };
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to)   filter.timestamp.$lte = new Date(to);
    }
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [logs, total] = await Promise.all([
      EntryLog.find(filter)
        .populate('attendee', 'fullName categoryName photo')
        .populate('processedBy', 'name')
        .sort('-timestamp')
        .skip(skip)
        .limit(parseInt(limit, 10)),
      EntryLog.countDocuments(filter),
    ]);
    res.json({ success: true, data: { logs, total, pages: Math.ceil(total / parseInt(limit, 10)) } });
  } catch (err) { next(err); }
});

// GET /api/dashboard/export | Excel/CSV export
router.get('/export', async (req, res, next) => {
  try {
    const XLSX = require('../utils/spreadsheet');
    const Attendee = require('../models/Attendee');
    const { eventId, report = 'attendees', format: fmt = 'csv', from, to, zone } = req.query;
    const accessibleEventIds = await getAccessibleEventIds(req.user, eventId);
    if (!accessibleEventIds.length) {
      return res.status(403).json({ success: false, message: 'No access.' });
    }

    const wb = XLSX.utils.book_new();

    if (report === 'attendees') {
      const filter = { event: { $in: accessibleEventIds } };
      const rows = await Attendee.find(filter)
        .select('fullName email phone categoryName confirmationStatus photoVerificationStatus checkedIn checkedInAt wristbandId createdAt')
        .lean();
      const headers = ['Full Name','Email','Phone','Category','Confirmation','Photo Status','Checked In','Check-in Time','Wristband ID','Added At'];
      const data = rows.map(r => [
        r.fullName, r.email, r.phone, r.categoryName, r.confirmationStatus,
        r.photoVerificationStatus, r.checkedIn ? 'Yes' : 'No',
        r.checkedInAt ? new Date(r.checkedInAt).toISOString() : '',
        r.wristbandId || '',
        r.createdAt ? new Date(r.createdAt).toISOString() : '',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      ws['!cols'] = headers.map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Attendees');

    } else if (report === 'entry_logs') {
      const filter = { event: { $in: accessibleEventIds.map(id => toObjectId(id)) } };
      if (from || to) { filter.timestamp = {}; if (from) filter.timestamp.$gte = new Date(from); if (to) filter.timestamp.$lte = new Date(to); }
      if (zone) filter.$or = [{ zoneName: zone }, { gateId: zone }];
      const logs = await EntryLog.find(filter).populate('attendee', 'fullName categoryName').sort('-timestamp').lean();
      const headers = ['Timestamp','Attendee','Category','Gate','Zone','Action','Method','Access','Denial Reason'];
      const data = logs.map(l => [
        new Date(l.timestamp).toISOString(),
        l.attendee?.fullName || l.snapshot?.fullName || '-',
        l.attendee?.categoryName || l.snapshot?.categoryName || '-',
        l.gateName || l.gateId || '-', l.zoneName || '-',
        l.action, l.method, l.accessGranted ? 'Granted' : 'Denied', l.denialReason || '-',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      ws['!cols'] = headers.map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Entry Logs');

    } else if (report === 'denied') {
      const filter = { event: { $in: accessibleEventIds.map(id => toObjectId(id)) }, accessGranted: false };
      if (from || to) { filter.timestamp = {}; if (from) filter.timestamp.$gte = new Date(from); if (to) filter.timestamp.$lte = new Date(to); }
      const logs = await EntryLog.find(filter).populate('attendee', 'fullName categoryName').sort('-timestamp').lean();
      const headers = ['Timestamp','Attendee','Category','Gate','Action','Denial Reason','Processed By'];
      const data = logs.map(l => [
        new Date(l.timestamp).toISOString(),
        l.attendee?.fullName || l.snapshot?.fullName || '-',
        l.attendee?.categoryName || l.snapshot?.categoryName || '-',
        l.gateName || l.gateId || '-', l.action, l.denialReason || '-',
        l.processedBy?.name || '-',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      ws['!cols'] = headers.map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Denied Access');
    }

    const isExcel = fmt === 'xlsx';
    const buffer = await XLSX.write(wb, { type: 'buffer', bookType: isExcel ? 'xlsx' : 'csv' });
    const ext = isExcel ? 'xlsx' : 'csv';
    const mime = isExcel ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv';
    res.setHeader('Content-Disposition', `attachment; filename="${report}-export.${ext}"`);
    res.setHeader('Content-Type', mime);
    return res.send(buffer);
  } catch (err) { next(err); }
});

// GET /api/dashboard/payments | Payment submissions for dashboard
router.get('/payments', async (req, res, next) => {
  try {
    const { eventId, status = 'pending', page = 1, limit = 20 } = req.query;
    const accessibleEventIds = await getAccessibleEventIds(req.user, eventId);

    if (!accessibleEventIds.length) {
      return res.status(403).json({ success: false, message: 'You do not have access to the requested event.' });
    }

    // Get orders for accessible events
    const ordersForEvents = await Order.find({ 
      eventId: { $in: accessibleEventIds.map(id => toObjectId(id)) },
      paymentMethod: 'bank_transfer'
    }).select('_id');
    
    const orderIds = ordersForEvents.map(o => o._id);

    if (orderIds.length === 0) {
      return res.json({ 
        success: true, 
        data: { 
          payments: [], 
          total: 0, 
          pages: 0 
        } 
      });
    }

    // Build filter
    const filter = { orderId: { $in: orderIds } };
    if (status && status !== 'all') {
      filter.verificationStatus = status;
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
