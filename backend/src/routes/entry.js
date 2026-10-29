const express = require('express');
const router = express.Router();
const EntryLog = require('../models/EntryLog');
const Attendee = require('../models/Attendee');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const RfidAccessLog = require('../models/RfidAccessLog');
const mongoose = require('mongoose');
const { protect, restrictTo } = require('../middleware/auth');
const { emitDashboardEvent } = require('../utils/socket');
const { normalizeRole, ROLES } = require('../utils/rbac');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { sendOrderConfirmation, sendCashPaymentConfirmationEmail } = require('../utils/email');
const { notifyFinalTicket, notifyBuyerFinalSummary } = require('../services/notificationService');
const { allocateRfid, assignRfidToAttendee } = require('../services/rfidService');
const {
  resolveAttendee,
  getScanMethod,
  enforceRfidToggle,
  validateTicket,
  validateCheckInOut,
} = require('../services/credentialService');

const normalizeGate = (value) => (value || '').trim();
const parseScannedToken = (value) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return parsed.attendeeToken || parsed.token || parsed.qrToken || raw;
  } catch (error) {
    return raw;
  }
};

const Event = require('../models/Event');

const userHasEventAccess = async (user, eventId) => {
  if (!user || !eventId) return false;
  if (normalizeRole(user.role) === ROLES.MAIN_ADMIN) return true;

  if ((user.assignedEvents || []).some((assignedEvent) => assignedEvent.toString() === eventId.toString())) {
    return true;
  }

  try {
    const event = await Event.findById(eventId).select('createdBy mainOrganiser');
    if (event) {
      if (event.createdBy && event.createdBy.toString() === user._id.toString()) return true;
      if (event.mainOrganiser && event.mainOrganiser.toString() === user._id.toString()) return true;
    }
  } catch (err) {
    return false;
  }

  return false;
};

const userHasGateAccess = (user, gateName) => {
  if ([ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER, ROLES.SUB_ORGANISER].includes(normalizeRole(user.role))) {
    return true;
  }

  const assignedGates = (user.assignedGates || []).map((gate) => normalizeGate(gate)).filter(Boolean);
  if (!assignedGates.length) return true;

  return assignedGates.includes(normalizeGate(gateName));
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const buildLogPayload = ({
  attendee,
  gateId,
  gateName,
  zoneId,
  zoneName,
  action,
  method,
  deviceId,
  accessGranted,
  denialReason,
  processedBy,
}) => ({
  event: attendee.event._id || attendee.event,
  attendee: attendee._id,
  gateId,
  gateName,
  zoneId,
  zoneName,
  action,
  method,
  deviceId,
  accessGranted,
  denialReason,
  processedBy,
  snapshot: {
    fullName: attendee.fullName,
    categoryId: attendee.categoryId,
    categoryName: attendee.categoryName,
    allowedZones: attendee.allowedZones || [],
    photoVerified: attendee.photoVerificationStatus === 'verified',
  },
});

// POST /api/entry/scan
router.post(
  '/scan',
  protect,
  require('../middleware/scanLimiter'), require('../middleware/readerScan'),
  restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'),
  async (req, res, next) => {
    try {
      const {
        qrToken,
        rfidId,
        gateId,
        gateName,
        zoneId,
        zoneName,
        action = 'check_in',
        deviceId,
      } = req.body;
      const io = req.app.get('io');

      const rawScan = qrToken || rfidId;
      const parsedScan = parseScannedToken(rawScan);
      const scanMethod = getScanMethod({ qrToken, rfidId, parsedScan });
      const attendee = await resolveAttendee({ qrToken, rfidId, eventId: req.body.eventId });

      if (!attendee) {
        return res.status(404).json({
          success: false,
          reason: 'NOT_FOUND',
          message: 'Attendee not found. Invalid QR or RFID.',
        });
      }

      if (!(await userHasEventAccess(req.user, attendee.event?._id || attendee.event))) {
        return res.status(403).json({
          success: false,
          reason: 'EVENT_ACCESS_DENIED',
          message: 'You do not have access to this event.',
        });
      }

      const rfidToggle = await enforceRfidToggle({
        attendee,
        rfidId,
        fullEvent: attendee.event,
      });
      if (!rfidToggle.allowed) {
        const log = await EntryLog.create(
          buildLogPayload({
            attendee,
            gateId: gateId || 'RFID Scanner',
            gateName: gateName || 'RFID Scanner',
            zoneId,
            zoneName,
            action: 'denied',
            method: scanMethod,
            deviceId,
            accessGranted: false,
            denialReason: rfidToggle.message,
            processedBy: req.user._id,
          })
        );
        emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
          source: 'entry',
          eventId: attendee.event._id,
          name: attendee.fullName,
          action: 'DENIED ENTRY',
          zoneName: zoneName || 'RFID Scanner',
          timestamp: log.timestamp,
          accessGranted: false,
        });
        return res.status(400).json({
          success: false,
          reason: rfidToggle.reason,
          message: rfidToggle.message,
          data: { log },
        });
      }

      const resolvedGate = normalizeGate(gateName || gateId || 'main-entry');
      if (!resolvedGate) {
        return res.status(400).json({
          success: false,
          reason: 'GATE_REQUIRED',
          message: 'Gate is required.',
        });
      }

      if (!userHasGateAccess(req.user, resolvedGate)) {
        return res.status(403).json({
          success: false,
          reason: 'GATE_ACCESS_DENIED',
          message: `You are not assigned to ${resolvedGate}.`,
        });
      }

      if (!attendee.isActive || attendee.isDisabled) {
        const denialReason = attendee.isDisabled ? 'Ticket is disabled' : 'Attendee is deactivated';
        const reasonCode = attendee.isDisabled ? 'TICKET_DISABLED' : 'DEACTIVATED';
        const log = await EntryLog.create(
          buildLogPayload({
            attendee,
            gateId: resolvedGate,
            gateName: resolvedGate,
            zoneId,
            zoneName,
            action: 'denied',
            method: scanMethod,
            deviceId,
            accessGranted: false,
            denialReason,
            processedBy: req.user._id,
          })
        );
        emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
          source: 'entry',
          eventId: attendee.event._id,
          name: attendee.fullName,
          action: 'DENIED ENTRY',
          zoneName: zoneName || resolvedGate || 'Main Entry',
          timestamp: log.timestamp,
          accessGranted: false,
        });
        return res.status(403).json({
          success: false,
          reason: reasonCode,
          message: denialReason + '.',
          data: { log },
        });
      }

      const now = new Date();
      const eventStart = new Date(attendee.event.startDate);
      const eventEnd = attendee.event.endDate
        ? new Date(attendee.event.endDate)
        : new Date(eventStart.getTime() + 24 * 60 * 60 * 1000);
      const earlyBuffer = 2 * 60 * 60 * 1000;
      const lateBuffer = 1 * 60 * 60 * 1000;

      if (now < eventStart.getTime() - earlyBuffer) {
        return res.status(403).json({
          success: false,
          reason: 'EVENT_NOT_STARTED',
          message: `Event has not started yet. Starts at ${eventStart.toLocaleString()}.`,
        });
      }

      if (now > eventEnd.getTime() + lateBuffer) {
        return res.status(403).json({
          success: false,
          reason: 'EVENT_EXPIRED',
          message: `Event has ended. Closed at ${eventEnd.toLocaleString()}.`,
        });
      }

      if (attendee.confirmationStatus !== 'confirmed' || !attendee.isConfirmed) {
        const log = await EntryLog.create(
          buildLogPayload({
            attendee,
            gateId: resolvedGate,
            gateName: resolvedGate,
            zoneId,
            zoneName,
            action: 'denied',
            method: scanMethod,
            deviceId,
            accessGranted: false,
            denialReason: 'Identity not confirmed',
            processedBy: req.user._id,
          })
        );
        emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
          source: 'entry',
          eventId: attendee.event._id,
          name: attendee.fullName,
          action: 'DENIED ENTRY',
          zoneName: zoneName || resolvedGate || 'Main Entry',
          timestamp: log.timestamp,
          accessGranted: false,
        });
        return res.status(403).json({
          success: false,
          reason: 'NOT_CONFIRMED',
          message: 'Identity not confirmed.',
          data: { log },
        });
      }

      // Normalize action
      const rawAction = String(action || 'check_in').toLowerCase();
      const normalizedAction =
        rawAction === 'check_out' || rawAction === 'exit' || rawAction === 'checkout'
          ? 'check_out'
          : rawAction === 'zone_entry'
            ? 'zone_entry'
            : rawAction === 'zone_exit'
              ? 'zone_exit'
              : 'check_in';

      // QR ↔ RFID single check-in state (main entry)
      if (normalizedAction === 'check_in' && attendee.checkedIn) {
        const log = await EntryLog.create(
          buildLogPayload({
            attendee,
            gateId: resolvedGate,
            gateName: resolvedGate,
            zoneId,
            zoneName,
            action: 'denied',
            method: scanMethod,
            deviceId,
            accessGranted: false,
            denialReason: 'Already checked in - please use exit mode',
            processedBy: req.user._id,
          })
        );
        emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
          source: 'entry',
          eventId: attendee.event._id,
          name: attendee.fullName,
          action: 'DENIED RE-ENTRY',
          zoneName: zoneName || resolvedGate || 'Main Entry',
          timestamp: log.timestamp,
          accessGranted: false,
        });
        return res.status(409).json({
          success: false,
          reason: 'ALREADY_CHECKED_IN',
          message: 'Attendee has already checked in. Please use Exit/Check-Out mode first.',
          data: { log, attendee, suggestCheckOut: true },
        });
      }

      if (normalizedAction === 'check_out' && !attendee.checkedIn) {
        const log = await EntryLog.create(
          buildLogPayload({
            attendee,
            gateId: resolvedGate,
            gateName: resolvedGate,
            zoneId,
            zoneName,
            action: 'denied',
            method: scanMethod,
            deviceId,
            accessGranted: false,
            denialReason: 'Not currently checked in',
            processedBy: req.user._id,
          })
        );
        emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
          source: 'entry',
          eventId: attendee.event._id,
          name: attendee.fullName,
          action: 'DENIED EXIT',
          zoneName: zoneName || resolvedGate || 'Main Entry',
          timestamp: log.timestamp,
          accessGranted: false,
        });
        return res.status(409).json({
          success: false,
          reason: 'NOT_CHECKED_IN',
          message: 'Attendee is not currently checked in.',
          data: { log, attendee },
        });
      }

      let accessGranted = true;
      let denialReason = null;

      // Zone actions (optional path on same endpoint)
      if ((normalizedAction === 'zone_entry' || normalizedAction === 'zone_exit') && zoneId) {
        if (!(attendee.allowedZones || []).includes(zoneId) && !(attendee.allowedZones || []).includes(zoneName)) {
          accessGranted = false;
          denialReason = `No access to zone: ${zoneName || zoneId}`;
        } else if (normalizedAction === 'zone_entry' && !attendee.checkedIn) {
          accessGranted = false;
          denialReason = 'Must check in at main entry first';
        } else if (normalizedAction === 'zone_exit' && attendee.currentZone !== zoneId) {
          accessGranted = false;
          denialReason = 'Not currently in this zone';
        }
      }

      let updatedAttendee = null;

      if (accessGranted) {
        if (normalizedAction === 'check_in') {
          updatedAttendee = await Attendee.findOneAndUpdate(
            { _id: attendee._id, checkedIn: false },
            {
              $set: {
                checkedIn: true,
                checkedInAt: new Date(),
                lastEntryMethod: scanMethod,
              },
            },
            { new: true }
          );
          if (!updatedAttendee) {
            const log = await EntryLog.create(
              buildLogPayload({
                attendee,
                gateId: resolvedGate,
                gateName: resolvedGate,
                zoneId,
                zoneName,
                action: 'denied',
                method: scanMethod,
                deviceId,
                accessGranted: false,
                denialReason: 'Already checked in - concurrent request',
                processedBy: req.user._id,
              })
            );
            return res.status(409).json({
              success: false,
              reason: 'ALREADY_CHECKED_IN',
              message: 'Attendee has already checked in (concurrent).',
              data: { log, suggestCheckOut: true },
            });
          }
        } else if (normalizedAction === 'check_out') {
          updatedAttendee = await Attendee.findOneAndUpdate(
            { _id: attendee._id, checkedIn: true },
            {
              $set: {
                checkedIn: false,
                checkedInAt: null,
                currentZone: null,
                lastExitMethod: scanMethod,
              },
            },
            { new: true }
          );
          if (!updatedAttendee) {
            const log = await EntryLog.create(
              buildLogPayload({
                attendee,
                gateId: resolvedGate,
                gateName: resolvedGate,
                zoneId,
                zoneName,
                action: 'denied',
                method: scanMethod,
                deviceId,
                accessGranted: false,
                denialReason: 'Not currently checked in - concurrent request',
                processedBy: req.user._id,
              })
            );
            return res.status(409).json({
              success: false,
              reason: 'NOT_CHECKED_IN',
              message: 'Attendee is not currently checked in (concurrent).',
              data: { log },
            });
          }
        } else if (normalizedAction === 'zone_entry') {
          updatedAttendee = await Attendee.findOneAndUpdate(
            { _id: attendee._id, currentZone: { $ne: zoneId } },
            { $set: { currentZone: zoneId } },
            { new: true }
          );
          if (!updatedAttendee) {
            accessGranted = false;
            denialReason = 'Already in this zone';
          }
        } else if (normalizedAction === 'zone_exit') {
          updatedAttendee = await Attendee.findOneAndUpdate(
            { _id: attendee._id, currentZone: zoneId },
            { $set: { currentZone: null } },
            { new: true }
          );
          if (!updatedAttendee) {
            accessGranted = false;
            denialReason = 'Not currently in this zone';
          }
        }
      }

      // Wristband on successful check-in
      if (normalizedAction === 'check_in' && updatedAttendee && !updatedAttendee.wristbandId) {
        const wristbandId = req.body.wristbandId || `WB-${Date.now()}`;
        updatedAttendee = await Attendee.findByIdAndUpdate(
          updatedAttendee._id,
          {
            $set: {
              wristbandId,
              wristbandIssuedAt: new Date(),
              wristbandIssuedBy: req.user._id,
            },
          },
          { new: true }
        );
      }

      const finalAttendee = updatedAttendee || attendee;

      const logEntry = await EntryLog.create(
        buildLogPayload({
          attendee: finalAttendee,
          gateId: resolvedGate,
          gateName: resolvedGate,
          zoneId,
          zoneName,
          action: accessGranted ? normalizedAction : 'denied',
          method: scanMethod,
          deviceId,
          accessGranted,
          denialReason: denialReason || undefined,
          processedBy: req.user._id,
        })
      );

      // Record immutable RfidAccessLog if scanned using RFID
      if (scanMethod === 'rfid' || rfidId) {
        RfidAccessLog.create({
          event: attendee.event._id || attendee.event,
          attendee: finalAttendee._id,
          rfidIdentifierSnapshot: String(rfidId || finalAttendee.rfidTag || 'UNKNOWN').trim(),
          assignment: attendee._rfidAssignment?._id,
          ticket: attendee.ticket?._id || attendee.ticket,
          gateId: resolvedGate,
          gateName: resolvedGate,
          zoneId,
          zoneName,
          reader: deviceId || 'Entry Scanner',
          scanMethod: 'RFID',
          result: accessGranted ? 'GRANTED' : 'DENIED',
          denialReason: denialReason || undefined,
          performedBy: req.user._id,
        }).catch((err) => console.error('Failed to write RfidAccessLog:', err));
      }

      emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
        source: 'entry',
        eventId: attendee.event._id,
        name: attendee.fullName,
        action: accessGranted
          ? normalizedAction === 'check_in'
            ? 'CHECK-IN'
            : normalizedAction === 'check_out'
              ? 'CHECK-OUT'
              : normalizedAction.toUpperCase()
          : 'DENIED ENTRY',
        zoneName: zoneName || resolvedGate || 'Main Entry',
        timestamp: logEntry.timestamp,
        accessGranted,
        categoryName: attendee.categoryName,
        processedByName: req.user.name || req.user.email,
        scanMethod,
      });

      const statusCode = accessGranted ? 200 : 403;

      return res.status(statusCode).json({
        success: accessGranted,
        message: accessGranted
          ? normalizedAction === 'check_in'
            ? 'Entry allowed - Checked In'
            : normalizedAction === 'check_out'
              ? 'Exit allowed - Checked Out'
              : 'Access granted'
          : denialReason || 'Entry denied',
        reason: accessGranted ? undefined : 'ACCESS_DENIED',
        data: {
          accessGranted,
          denialReason,
          action: normalizedAction,
          attendee: {
            _id: finalAttendee._id,
            fullName: finalAttendee.fullName,
            phone: finalAttendee.phone,
            photo: finalAttendee.photo,
            categoryId: finalAttendee.categoryId,
            categoryName: finalAttendee.categoryName,
            allowedZones: finalAttendee.allowedZones,
            wristbandId: finalAttendee.wristbandId,
            rfidTag: finalAttendee.rfidTag,
            scanMethod,
            photoVerificationStatus: finalAttendee.photoVerificationStatus,
            checkedIn: finalAttendee.checkedIn,
            lastEntryMethod: finalAttendee.lastEntryMethod,
            currentZone: finalAttendee.currentZone,
          },
          event: { name: attendee.event.name, zones: attendee.event.zones },
          log: logEntry,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/entry/logs
router.get('/logs', protect, async (req, res, next) => {
  try {
    const { eventId, gateId, zoneId, action, page = 1, limit = 50 } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    if (!(await userHasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const filter = { event: eventId };
    if (gateId) filter.gateId = gateId;
    if (zoneId) filter.zoneId = zoneId;
    if (action) filter.action = action;

    if (
      [ROLES.STAFF, ROLES.VOLUNTEER].includes(normalizeRole(req.user.role)) &&
      (req.user.assignedGates || []).length
    ) {
      const assignedGates = req.user.assignedGates.map((gate) => normalizeGate(gate)).filter(Boolean);
      if (typeof filter.gateId === 'string') {
        if (!assignedGates.includes(normalizeGate(filter.gateId))) {
          return res.json({ success: true, data: { logs: [], total: 0 } });
        }
      } else {
        filter.gateId = { $in: assignedGates };
      }
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [logs, total] = await Promise.all([
      EntryLog.find(filter)
        .populate('attendee', 'fullName photo categoryName phone')
        .populate('processedBy', 'name')
        .sort('-timestamp')
        .skip(skip)
        .limit(parseInt(limit, 10)),
      EntryLog.countDocuments(filter),
    ]);
    res.json({ success: true, data: { logs, total } });
  } catch (err) {
    next(err);
  }
});

// GET /api/entry/stats
router.get('/stats', protect, async (req, res, next) => {
  try {
    const { eventId, gateId } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    if (!(await userHasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const gateFilter = {};
    if (gateId) gateFilter.gateId = normalizeGate(gateId);

    if (
      [ROLES.STAFF, ROLES.VOLUNTEER].includes(normalizeRole(req.user.role)) &&
      (req.user.assignedGates || []).length
    ) {
      const assignedGates = req.user.assignedGates.map((gate) => normalizeGate(gate)).filter(Boolean);
      if (gateFilter.gateId && !assignedGates.includes(gateFilter.gateId)) {
        return res.json({
          success: true,
          data: {
            checkedIn: 0,
            byZone: [],
            byCategory: [],
            denied: 0,
            today: { totalScanned: 0, successfulEntries: 0, deniedEntries: 0 },
          },
        });
      }
      if (!gateFilter.gateId) gateFilter.gateId = { $in: assignedGates };
    }

    const eventObjectId = new mongoose.Types.ObjectId(eventId);
    const todayMatch = {
      event: eventObjectId,
      timestamp: { $gte: startOfToday() },
      ...gateFilter,
    };

    const [checkedIn, byZone, byCategory, denied, todaySummary] = await Promise.all([
      EntryLog.countDocuments({ event: eventId, action: 'check_in', accessGranted: true, ...gateFilter }),
      EntryLog.aggregate([
        { $match: { event: eventObjectId, action: 'zone_entry', accessGranted: true, ...gateFilter } },
        { $group: { _id: '$zoneId', zoneName: { $first: '$zoneName' }, count: { $sum: 1 } } },
      ]),
      EntryLog.aggregate([
        { $match: { event: eventObjectId, action: 'check_in', accessGranted: true, ...gateFilter } },
        {
          $group: {
            _id: '$snapshot.categoryId',
            categoryName: { $first: '$snapshot.categoryName' },
            count: { $sum: 1 },
          },
        },
      ]),
      EntryLog.countDocuments({ event: eventId, action: 'denied', ...gateFilter }),
      EntryLog.aggregate([
        { $match: todayMatch },
        {
          $group: {
            _id: null,
            totalScanned: { $sum: 1 },
            successfulEntries: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$action', 'check_in'] }, { $eq: ['$accessGranted', true] }] },
                  1,
                  0,
                ],
              },
            },
            deniedEntries: {
              $sum: { $cond: [{ $eq: ['$accessGranted', false] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        checkedIn,
        byZone,
        byCategory,
        denied,
        today: todaySummary[0] || { totalScanned: 0, successfulEntries: 0, deniedEntries: 0 },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/entry/search
router.get(
  '/search',
  protect,
  restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'),
  async (req, res, next) => {
    try {
      const { eventId, q, limit = 10 } = req.query;
      if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
      if (!q?.trim()) return res.json({ success: true, data: { attendees: [] } });
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ success: false, message: 'Invalid event ID.' });
      }
      if (!(await userHasEventAccess(req.user, eventId))) {
        return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
      }

      const query = q.trim();
      const attendees = await Attendee.find({
        event: eventId,
        isActive: true,
        $or: [
          { fullName: { $regex: query, $options: 'i' } },
          { phone: { $regex: query, $options: 'i' } },
          { nationalId: { $regex: query, $options: 'i' } },
          { passportNumber: { $regex: query, $options: 'i' } },
        ],
      })
        .select('fullName phone qrToken categoryName confirmationStatus checkedIn photo')
        .sort({ checkedIn: 1, fullName: 1 })
        .limit(Math.min(parseInt(limit, 10) || 10, 20));

      res.json({ success: true, data: { attendees } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/entry/attendee/:qrToken
router.get('/attendee/:qrToken', protect, async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ qrToken: req.params.qrToken }).populate(
      'event',
      'name venue startDate zones categories'
    );
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!(await userHasEventAccess(req.user, attendee.event?._id || attendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }
    res.json({ success: true, data: { attendee } });
  } catch (err) {
    next(err);
  }
});

// GET /api/entry/lookup
router.get(
  '/lookup',
  protect,
  restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'),
  async (req, res, next) => {
    try {
      const { eventId, q, limit = 10 } = req.query;
      if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
      if (!q?.trim()) return res.json({ success: true, data: { attendees: [] } });
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ success: false, message: 'Invalid event ID.' });
      }
      if (!(await userHasEventAccess(req.user, eventId))) {
        return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
      }
      const query = q.trim();
      const attendees = await Attendee.find({
        event: eventId,
        isActive: true,
        $or: [
          { fullName: { $regex: query, $options: 'i' } },
          { phone: { $regex: query, $options: 'i' } },
          { nationalId: { $regex: query, $options: 'i' } },
          { passportNumber: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
        ],
      })
        .select(
          'fullName phone email qrToken categoryName confirmationStatus checkedIn photo allowedZones notes wristbandId'
        )
        .sort({ checkedIn: 1, fullName: 1 })
        .limit(Math.min(parseInt(limit, 10) || 10, 20));
      res.json({ success: true, data: { attendees } });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/entry/checkin
router.post(
  '/checkin',
  protect,
  restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'),
  async (req, res, next) => {
    try {
      const { attendeeId, gateId, gateName, wristbandId, deviceId, method = 'manual' } = req.body;
      const io = req.app.get('io');

      if (!attendeeId) return res.status(400).json({ success: false, message: 'attendeeId required.' });

      const attendee = await Attendee.findById(attendeeId).populate('event');
      if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
      if (!(await userHasEventAccess(req.user, attendee.event?._id || attendee.event))) {
        return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
      }

      const resolvedGate = normalizeGate(gateName || gateId || 'Main Gate');

      if (wristbandId && !attendee.wristbandId) {
        attendee.wristbandId = wristbandId;
        attendee.wristbandIssuedAt = new Date();
        attendee.wristbandIssuedBy = req.user._id;
      } else if (!attendee.wristbandId) {
        attendee.wristbandId = `WB-${Date.now()}`;
        attendee.wristbandIssuedAt = new Date();
        attendee.wristbandIssuedBy = req.user._id;
      }

      if (!attendee.checkedIn) {
        attendee.checkedIn = true;
        attendee.checkedInAt = new Date();
        attendee.lastEntryMethod = method;
      }
      await attendee.save();

      const logEntry = await EntryLog.create(
        buildLogPayload({
          attendee,
          gateId: resolvedGate,
          gateName: resolvedGate,
          zoneId: null,
          zoneName: null,
          action: 'check_in',
          method,
          deviceId,
          accessGranted: true,
          denialReason: null,
          processedBy: req.user._id,
        })
      );

      emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
        source: 'entry',
        eventId: attendee.event._id,
        name: attendee.fullName,
        action: 'CHECK-IN',
        zoneName: resolvedGate,
        timestamp: logEntry.timestamp,
        accessGranted: true,
        categoryName: attendee.categoryName,
        processedByName: req.user.name || req.user.email,
      });

      res.json({
        success: true,
        message: 'Checked in and wristband issued.',
        data: {
          wristbandId: attendee.wristbandId,
          wristbandIssuedAt: attendee.wristbandIssuedAt,
          checkedInAt: attendee.checkedInAt,
          log: logEntry,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/entry/checkout
router.post(
  '/checkout',
  protect,
  restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'),
  async (req, res, next) => {
    try {
      const { attendeeId, gateId, gateName, deviceId, method = 'manual' } = req.body;
      const io = req.app.get('io');

      if (!attendeeId) return res.status(400).json({ success: false, message: 'attendeeId required.' });

      const attendee = await Attendee.findById(attendeeId).populate('event');
      if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
      if (!(await userHasEventAccess(req.user, attendee.event?._id || attendee.event))) {
        return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
      }

      const resolvedGate = normalizeGate(gateName || gateId || 'Main Gate');
      if (!userHasGateAccess(req.user, resolvedGate)) {
        return res.status(403).json({
          success: false,
          message: `You are not assigned to ${resolvedGate}.`,
        });
      }

      if (!attendee.checkedIn) {
        return res.status(409).json({
          success: false,
          message: 'Attendee is not currently checked in.',
        });
      }

      attendee.checkedIn = false;
      attendee.checkedInAt = null;
      attendee.currentZone = null;
      attendee.lastExitMethod = method;
      await attendee.save();

      const logEntry = await EntryLog.create(
        buildLogPayload({
          attendee,
          gateId: resolvedGate,
          gateName: resolvedGate,
          zoneId: null,
          zoneName: null,
          action: 'check_out',
          method,
          deviceId,
          accessGranted: true,
          denialReason: null,
          processedBy: req.user._id,
        })
      );

      emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
        source: 'entry',
        eventId: attendee.event._id,
        name: attendee.fullName,
        action: 'CHECK-OUT',
        zoneName: resolvedGate,
        timestamp: logEntry.timestamp,
        accessGranted: true,
        categoryName: attendee.categoryName,
        processedByName: req.user.name || req.user.email,
      });

      res.json({
        success: true,
        message: 'Checked out successfully.',
        data: {
          checkedIn: attendee.checkedIn,
          log: logEntry,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/entry/receive-payment
router.post(
  '/receive-payment',
  protect,
  restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff'),
  async (req, res, next) => {
    try {
      const { confirmationToken, orderNumber, amountReceived, notes, gateId, gateName, deviceId } =
        req.body;
      const io = req.app.get('io');

      if (!confirmationToken && !orderNumber) {
        return res.status(400).json({
          success: false,
          message: 'confirmationToken or orderNumber required.',
        });
      }

      let order;
      if (confirmationToken) {
        order = await Order.findOne({ confirmationToken }).populate('eventId');
      } else if (orderNumber) {
        order = await Order.findOne({ orderNumber }).populate('eventId');
      }

      if (!order) {
        return res.status(404).json({ success: false, message: 'Reservation not found.' });
      }

      if (!['cash_at_entrance', 'cash_on_entrance'].includes(order.paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: 'This order is not a cash at entrance reservation.',
        });
      }

      if (order.paymentStatus === 'paid' || order.status === 'CONFIRMED') {
        return res.status(400).json({
          success: false,
          message: 'Payment has already been received for this reservation.',
        });
      }

      if (!(await userHasEventAccess(req.user, order.eventId?._id || order.eventId))) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this event.',
        });
      }

      if (amountReceived && Number(amountReceived) < order.totalAmount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient payment. Required: ${order.totalAmount}, Received: ${amountReceived}`,
        });
      }

      order.status = 'CONFIRMED';
      order.paymentStatus = 'paid';
      order.paidAt = new Date();
      order.paymentDetails = {
        ...order.paymentDetails,
        paymentReceivedAt: new Date(),
        paymentReceivedBy: req.user._id,
        paymentReceivedByName: req.user.name || req.user.email,
        amountReceived: amountReceived || order.totalAmount,
        notes: notes || '',
        gateId: gateId || gateName || 'Payment Counter',
      };
      await order.save();

      const tickets = await Ticket.find({ order: order._id });
      for (const ticket of tickets) {
        ticket.status = 'SOLD';
        await ticket.save();
      }

      const attendees = [];
      for (const ticket of tickets) {
        let attendee = await Attendee.findOne({ ticket: ticket._id });

        if (!attendee) {
          const token = uuidv4();
          const qrCode = await QRCode.toDataURL(token);

          attendee = new Attendee({
            event: order.eventId._id,
            ticket: ticket._id,
            order: order._id,
            qrToken: token,
            qrCode,
            fullName: order.buyerName,
            email: order.buyerEmail,
            phone: order.buyerPhone,
            categoryId: ticket.categoryId,
            categoryName: ticket.categoryName,
            allowedZones: ticket.allowedZones || [],
            confirmationStatus: 'confirmed',
            isConfirmed: true,
            confirmedAt: new Date(),
            confirmedBy: req.user._id,
            photoVerificationStatus: 'verified',
            isActive: true,
          });
          await attendee.save();
        } else {
          if (!attendee.qrToken) attendee.qrToken = uuidv4();
          attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
          attendee.confirmationStatus = 'confirmed';
          attendee.isConfirmed = true;
          attendee.confirmedAt = new Date();
          attendee.confirmedBy = req.user._id;
          attendee.isActive = true;
        }

        if (!attendee.rfidTag) {
          attendee.rfidTag = await allocateRfid({
            eventId: ticket.event || order.eventId._id,
            categoryId: ticket.categoryId,
            attendeeId: attendee._id,
            ticketId: ticket._id,
          });
        }
        await attendee.save();

        ticket.attendee = attendee._id;
        await ticket.save();
        attendees.push(attendee);
      }

      try {
        await sendCashPaymentConfirmationEmail(order, order.eventId, attendees);
        for (const a of attendees) {
          await notifyFinalTicket({
            attendee: a,
            event: order.eventId,
            phone: a.phone,
            notificationChannel: 'both',
          });
        }
        await notifyBuyerFinalSummary({ order, event: order.eventId, attendees });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }

      const resolvedGate = normalizeGate(gateName || gateId || 'Payment Counter');
      const logEntry = await EntryLog.create({
        event: order.eventId._id,
        order: order._id,
        gateId: resolvedGate,
        gateName: resolvedGate,
        action: 'payment_received',
        method: 'cash',
        deviceId,
        accessGranted: true,
        processedBy: req.user._id,
        snapshot: {
          orderNumber: order.orderNumber,
          amount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
        },
      });

      emitDashboardEvent(io, 'payment_received', order.eventId._id.toString(), {
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: order.totalAmount,
        processedBy: req.user.name || req.user.email,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: 'Payment received successfully. Tickets have been issued.',
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
          orderStatus: order.status,
          ticketsIssued: tickets.length,
          attendees: attendees.map((a) => ({
            _id: a._id,
            fullName: a.fullName,
            qrCode: a.qrCode,
            rfidTag: a.rfidTag,
            categoryName: a.categoryName,
          })),
          log: logEntry,
        },
      });
    } catch (err) {
      console.error('Payment collection error:', err);
      next(err);
    }
  }
);

// POST /api/entry/rfid-assign
router.post(
  '/rfid-assign',
  protect,
  restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'),
  async (req, res, next) => {
    try {
      const { qrToken, rfidTag, eventId } = req.body;
      const io = req.app.get('io');

      if (!qrToken || !rfidTag) {
        return res.status(400).json({
          success: false,
          message: 'qrToken and rfidTag are required.',
        });
      }

      const attendee = await Attendee.findOne({ qrToken: String(qrToken).trim() })
        .populate('event', 'name settings')
        .populate('ticket', 'ticketNumber categoryId categoryName');

      if (!attendee) {
        return res.status(404).json({
          success: false,
          message: 'Attendee not found. Invalid QR code.',
        });
      }

      if (!(await userHasEventAccess(req.user, attendee.event?._id || attendee.event))) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this event.',
        });
      }

      if (!attendee.event?.settings?.rfidEnabled) {
        return res.status(400).json({
          success: false,
          message: 'RFID access is disabled for this event.',
          rfidEnabled: false,
        });
      }

      if (attendee.rfidTag) {
        return res.status(409).json({
          success: false,
          message: 'This attendee already has an RFID tag assigned.',
          existingRfid: attendee.rfidTag,
        });
      }

      const result = await assignRfidToAttendee({
        rfidTag,
        attendeeId: attendee._id,
        ticketId: attendee.ticket?._id || attendee.ticket,
        operatorId: req.user._id,
      });

      emitDashboardEvent(io, 'rfid_assigned', attendee.event._id.toString(), {
        source: 'rfid_assignment',
        eventId: attendee.event._id,
        attendeeId: attendee._id,
        attendeeName: attendee.fullName,
        rfidTag,
        ticketNumber: attendee.ticket?.ticketNumber,
        categoryName: attendee.categoryName,
        assignedBy: req.user.name || req.user.email,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: 'RFID assigned successfully. Attendee can now use both QR and RFID.',
        data: {
          attendee: {
            _id: attendee._id,
            fullName: attendee.fullName,
            categoryName: attendee.categoryName,
            qrToken: attendee.qrToken,
            rfidTag: result.attendee.rfidTag,
          },
          tag: {
            rfidTag: result.tag.rfidTag,
            status: result.tag.status,
            event: result.tag.event,
          },
        },
      });
    } catch (err) {
      if (
        err.message.includes('RFID tag is not registered') ||
        err.message.includes('not available')
      ) {
        return res.status(404).json({ success: false, message: err.message });
      }
      if (err.message.includes('already assigned')) {
        return res.status(409).json({ success: false, message: err.message });
      }
      next(err);
    }
  }
);

// GET /api/entry/attendee-by-qr/:qrToken
router.get(
  '/attendee-by-qr/:qrToken',
  protect,
  restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'),
  async (req, res, next) => {
    try {
      const { qrToken } = req.params;
      const { eventId } = req.query;

      if (!qrToken) {
        return res.status(400).json({ success: false, message: 'qrToken is required.' });
      }

      const query = { qrToken: String(qrToken).trim() };
      if (eventId) {
        if (!mongoose.Types.ObjectId.isValid(eventId)) {
          return res.status(400).json({ success: false, message: 'Invalid event ID.' });
        }
        query.event = eventId;
      }

      const attendee = await Attendee.findOne(query)
        .populate('event', 'name venue startDate endDate settings.rfidEnabled zones categories')
        .populate('ticket', 'ticketNumber categoryId categoryName')
        .select(
          'fullName email phone categoryName categoryId photo rfidTag qrToken checkedIn wristbandId allowedZones confirmationStatus photoVerificationStatus'
        );

      if (!attendee) {
        return res.status(404).json({ success: false, message: 'Attendee not found.' });
      }

      if (!(await userHasEventAccess(req.user, attendee.event?._id || attendee.event))) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this event.',
        });
      }

      const rfidEnabled = attendee.event?.settings?.rfidEnabled === true;

      res.json({
        success: true,
        data: {
          attendee: {
            _id: attendee._id,
            fullName: attendee.fullName,
            email: attendee.email,
            phone: attendee.phone,
            categoryName: attendee.categoryName,
            categoryId: attendee.categoryId,
            photo: attendee.photo,
            qrToken: attendee.qrToken,
            rfidTag: attendee.rfidTag,
            checkedIn: attendee.checkedIn,
            wristbandId: attendee.wristbandId,
            allowedZones: attendee.allowedZones,
            confirmationStatus: attendee.confirmationStatus,
            photoVerificationStatus: attendee.photoVerificationStatus,
          },
          event: {
            _id: attendee.event._id,
            name: attendee.event.name,
            venue: attendee.event.venue,
            startDate: attendee.event.startDate,
            endDate: attendee.event.endDate,
            rfidEnabled,
            zones: attendee.event.zones,
            categories: attendee.event.categories,
          },
          ticket: attendee.ticket
            ? {
                ticketNumber: attendee.ticket.ticketNumber,
                categoryId: attendee.ticket.categoryId,
                categoryName: attendee.ticket.categoryName,
              }
            : null,
          canAssignRfid: !attendee.rfidTag && rfidEnabled,
          hasRfid: !!attendee.rfidTag,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/entry/event-rfid-status/:eventId
router.get('/event-rfid-status/:eventId', protect, async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }

    if (!(await userHasEventAccess(req.user, eventId))) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this event.',
      });
    }

    const event = await Event.findById(eventId).select('settings.rfidEnabled name').lean();

    res.json({
      success: true,
      data: {
        eventId,
        eventName: event?.name,
        rfidEnabled: event?.settings?.rfidEnabled === true,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;