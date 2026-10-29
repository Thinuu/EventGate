const express = require('express');
const router = express.Router();
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const ZoneLog = require('../models/ZoneLog');
const RfidAccessLog = require('../models/RfidAccessLog');
const { protect, restrictTo } = require('../middleware/auth');
const { emitDashboardEvent } = require('../utils/socket');
const { normalizeRole, ROLES } = require('../utils/rbac');
const { enforceRfidToggle, resolveAttendee } = require('../services/credentialService');

/**
 * Check if a ticket is valid for entry.
 * Rules:
 * 1. Ticket must not be cancelled
 * 2. Ticket must be confirmed/active
 * 3. Ticket must not be expired (event end time)
 */
const isTicketValid = (ticket, event) => {
  if (!ticket) {
    return { valid: false, reason: 'INVALID_TICKET', message: 'Attendee is not linked to a ticket' };
  }

  // Check if ticket is cancelled
  if (ticket.status === 'CANCELLED' || ticket.status === 'EXPIRED') {
    return { valid: false, reason: 'TICKET_CANCELLED', message: 'Ticket has been cancelled' };
  }

  // Check if ticket is confirmed/active
  if (ticket.status !== 'CONFIRMED' && ticket.status !== 'SOLD' && ticket.status !== 'ACTIVE') {
    return { valid: false, reason: 'TICKET_NOT_CONFIRMED', message: 'Ticket has not been confirmed' };
  }

  // Check if event has ended (ticket expiration is based on event end time)
  if (event?.endDateTime) {
    const eventEndTime = new Date(event.endDateTime);
    if (eventEndTime < new Date()) {
      return { valid: false, reason: 'EVENT_ENDED', message: 'Event has ended' };
    }
  }

  return { valid: true };
};

/**
 * Check if a reservation ticket can be checked in (for cash at venue)
 * Reservations are valid until the event ends
 */
const isReservationValid = (ticket, event) => {
  // Check if ticket is reserved
  if (ticket.status !== 'RESERVED' && ticket.status !== 'PENDING') {
    return { valid: false, reason: 'NOT_RESERVED', message: 'Not a reservation ticket' };
  }

  // Check if event has ended
  if (event?.endDateTime) {
    const eventEndTime = new Date(event.endDateTime);
    if (eventEndTime < new Date()) {
      return { valid: false, reason: 'EVENT_ENDED', message: 'Event has ended' };
    }
  }

  return { valid: true };
};

const DUPLICATE_SCAN_WINDOW_MS = 5000;

// Change this to the exact name (or id) of your main entry zone
const MAIN_ENTRY_ZONE = 'Main Entry';

const normalizeZoneName = (value) => (value || '').trim();

const resolveZone = (event, requestedZone) => {
  const normalizedZone = normalizeZoneName(requestedZone);
  const zone = event?.zones?.find((item) => item.name === normalizedZone || item.id === normalizedZone);

  return {
    requestedZone: normalizedZone,
    zoneId: zone?.id || normalizedZone,
    zoneName: zone?.name || normalizedZone,
  };
};

const userHasEventAccess = async (user, event) => {
  if (!user || !event) return false;
  if (user.role === 'main_admin') return true;

  const eventId = event._id.toString();
  const assignedEventIds = (user.assignedEvents || []).map((item) => item.toString());
  if (assignedEventIds.includes(eventId)) return true;

  if (event.createdBy?.toString() === user._id.toString()) return true;
  if (event.mainOrganiser?.toString() === user._id.toString()) return true;
  if ((event.subOrganisers || []).some((id) => id?.toString() === user._id.toString())) return true;
  
  return false;
};

const userHasZoneAccess = (user, zoneName, zoneId) => {
  if (!zoneName && !zoneId) return false;
  const role = normalizeRole(user?.role);
  
  // High-level administrators always have full access
  if ([ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER].includes(role)) return true;
  
  // Other roles (SubOrganiser, Staff, Volunteer, Auditor) must have explicit zone access
  const assignedZones = [
    ...(user.assignedZones || []).map(String),
    ...(user.responsibilities?.zoneIds || []).map(String),
    ...(user.assignedGates || []).map(String),
  ].filter(Boolean);

  // Wildcard check for all zones
  if (assignedZones.includes('all') || assignedZones.includes('ALL_ZONES')) return true;

  // Sub-Organisers without specific zone restrictions can access any zone in their event
  if (role === ROLES.SUB_ORGANISER && !assignedZones.length) return true;

  // If the team member has no zones assigned, they cannot access any zone
  if (!assignedZones.length) return false;

  return assignedZones.includes(String(zoneName)) || assignedZones.includes(String(zoneId));
};

const getUserAssignedZones = (user) => Array.from(new Set([
  ...((user?.assignedZones || []).map(String)),
  ...((user?.responsibilities?.zoneIds || []).map(String)),
  ...((user?.assignedGates || []).map(String)),
])).filter(Boolean);

const getExpectedAction = async (attendeeId, zoneName) => {
  const lastGranted = await ZoneLog.findOne({
    attendeeId,
    zoneName,
    accessGranted: true,
  }).sort({ timestamp: -1 });

  if (!lastGranted) return 'ENTRY';
  return lastGranted.action === 'ENTRY' ? 'EXIT' : 'ENTRY';
};

const buildDeniedResponse = async ({
  attendee,
  zoneName,
  action,
  scanMethod,
  userId,
  io,
  denialReason,
  httpStatus,
  message,
}) => {
  if (attendee?.event) {
    const deniedLog = await ZoneLog.create({
      attendeeId: attendee._id,
      eventId: attendee.event,
      zoneName,
      action,
      accessGranted: false,
      denialReason,
      scanMethod,
      scannedBy: userId,
      attendeeSnapshot: {
        fullName: attendee.fullName,
        categoryName: attendee.categoryName,
        allowedZones: attendee.allowedZones || [],
      },
    });

    const eventIdStr = attendee.event.toString();
    const deniedPayload = {
      source: 'zone',
      eventId: eventIdStr,
      attendeeName: attendee.fullName,
      name: attendee.fullName,
      action: denialReason === 'DUPLICATE_SCAN' ? 'DUPLICATE' : 'DENIED',
      zoneName,
      timestamp: deniedLog.timestamp,
      accessGranted: false,
    };
    emitDashboardEvent(io, 'zone_scan', eventIdStr, deniedPayload);
    emitDashboardEvent(io, 'zone_update', eventIdStr, deniedPayload);
  }

  return {
    status: httpStatus,
    body: {
      success: false,
      reason: denialReason,
      message,
      data: {
        action,
        zoneName,
        attendee: attendee ? {
          _id: attendee._id,
          fullName: attendee.fullName,
          categoryName: attendee.categoryName,
          allowedZones: attendee.allowedZones || [],
          photo: attendee.photo,
        } : null,
      },
    },
  };
};

router.post('/scan', protect, require('../middleware/scanLimiter'), require('../middleware/readerScan'), restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'), async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const requestedZone = normalizeZoneName(req.body.zone || req.body.zoneId || req.body.zoneName);
    const requestedEventId = String(req.body.eventId || '').trim();
    const qrToken = req.body.qrToken?.trim();
    const rfidId = (req.body.rfidId || req.body.rfidTag)?.trim();

    if (!requestedZone) {
      return res.status(400).json({ success: false, reason: 'ZONE_REQUIRED', message: 'Zone is required.' });
    }

    if (!qrToken && !rfidId) {
      return res.status(400).json({ success: false, reason: 'TOKEN_REQUIRED', message: 'qrToken or rfidId is required.' });
    }

    const attendee = await resolveAttendee({ qrToken, rfidId, eventId: requestedEventId });

    if (!attendee) {
      return res.status(404).json({
        success: false,
        reason: 'INVALID_TICKET',
        message: 'Invalid ticket',
        data: {
          action: 'ENTRY',
          zoneName: requestedZone,
          attendee: null,
        },
      });
    }

    const event = attendee.event;
    if (requestedEventId && event?._id?.toString() !== requestedEventId) {
      return res.status(404).json({
        success: false,
        reason: 'EVENT_MISMATCH',
        message: 'Attendee does not belong to the selected event.',
        data: {
          action: 'ENTRY',
          zoneName: requestedZone,
          attendee: null,
        },
      });
    }

    const hasEventAccess = await userHasEventAccess(req.user, event);
    if (!hasEventAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const { zoneId, zoneName } = resolveZone(event, requestedZone);

    if (!userHasZoneAccess(req.user, zoneName, zoneId)) {
      return res.status(403).json({ success: false, message: `You are not assigned to scan ${zoneName}.` });
    }

    // -------------------------------------------------
    // 1. Determine expected action (strict)
    // -------------------------------------------------
    const expectedAction = await getExpectedAction(attendee._id, zoneName);
    let action = req.body.action;

    if (!action) {
      action = expectedAction;
    } else if (action !== expectedAction) {
      const denied = await buildDeniedResponse({
        attendee,
        zoneName,
        action,
        scanMethod: qrToken ? 'QR' : 'RFID',
        userId: req.user._id,
        io,
        denialReason: action === 'ENTRY' ? 'ALREADY_INSIDE' : 'ALREADY_OUTSIDE',
        httpStatus: 409,
        message: action === 'ENTRY'
          ? 'Attendee is already inside this zone. Please scan for EXIT first.'
          : 'Attendee is already outside this zone. Please scan for ENTRY first.',
      });
      return res.status(denied.status).json(denied.body);
    }

    // -------------------------------------------------
    // 2. Duplicate-scan window
    // -------------------------------------------------
    const recentLog = await ZoneLog.findOne({
      attendeeId: attendee._id,
      zoneName,
    }).sort({ timestamp: -1 });

    if (recentLog && (Date.now() - recentLog.timestamp.getTime()) < DUPLICATE_SCAN_WINDOW_MS) {
      const denied = await buildDeniedResponse({
        attendee,
        zoneName,
        action,
        scanMethod: qrToken ? 'QR' : 'RFID',
        userId: req.user._id,
        io,
        denialReason: 'DUPLICATE_SCAN',
        httpStatus: 429,
        message: 'Please wait before scanning this attendee again.',
      });
      return res.status(denied.status).json(denied.body);
    }

    // -------------------------------------------------
    // 3. Fetch full event + RFID toggle
    // -------------------------------------------------
    const fullEvent = await Event.findById(event._id).select('endDateTime zones settings');

    const rfidToggle = await enforceRfidToggle({ attendee, rfidId, fullEvent });
    if (!rfidToggle.allowed) {
      const denied = await buildDeniedResponse({
        attendee,
        zoneName,
        action: 'ENTRY',
        scanMethod: 'RFID',
        userId: req.user._id,
        io,
        denialReason: rfidToggle.reason,
        httpStatus: 403,
        message: rfidToggle.message,
      });
      return res.status(denied.status).json(denied.body);
    }

    // -------------------------------------------------
    // 4. Ticket validity + event ended
    // -------------------------------------------------
    const ticketValidation = isTicketValid(attendee.ticket, fullEvent);
    if (!ticketValidation.valid) {
      const denied = await buildDeniedResponse({
        attendee,
        zoneName,
        action,
        scanMethod: qrToken ? 'QR' : 'RFID',
        userId: req.user._id,
        io,
        denialReason: ticketValidation.reason,
        httpStatus: 403,
        message: ticketValidation.message,
      });
      return res.status(denied.status).json(denied.body);
    }

    if (fullEvent?.endDateTime && new Date(fullEvent.endDateTime) < new Date()) {
      const denied = await buildDeniedResponse({
        attendee,
        zoneName,
        action,
        scanMethod: qrToken ? 'QR' : 'RFID',
        userId: req.user._id,
        io,
        denialReason: 'EVENT_ENDED',
        httpStatus: 403,
        message: 'Event has ended. No further entries allowed.',
      });
      return res.status(denied.status).json(denied.body);
    }

    // -------------------------------------------------
    // 5. Attendee status
    // -------------------------------------------------
    if (!attendee.isActive || attendee.isDisabled || !attendee.isConfirmed || attendee.confirmationStatus !== 'confirmed') {
      const denialReason = attendee.isDisabled ? 'TICKET_DISABLED' : 'INVALID_TICKET';
      const message = attendee.isDisabled ? 'Ticket has been disabled' : 'Invalid ticket';
      const denied = await buildDeniedResponse({
        attendee,
        zoneName,
        action,
        scanMethod: qrToken ? 'QR' : 'RFID',
        userId: req.user._id,
        io,
        denialReason,
        httpStatus: 403,
        message,
      });
      return res.status(denied.status).json(denied.body);
    }

    // -------------------------------------------------
    // 6. Main-entry gate (ONLY for non-main zones)
    // -------------------------------------------------
    const isMainEntryZone = zoneName === MAIN_ENTRY_ZONE || zoneId === MAIN_ENTRY_ZONE;

    if (!isMainEntryZone && action === 'ENTRY' && !attendee.checkedIn) {
      const denied = await buildDeniedResponse({
        attendee,
        zoneName,
        action,
        scanMethod: qrToken ? 'QR' : 'RFID',
        userId: req.user._id,
        io,
        denialReason: 'MAIN_ENTRY_REQUIRED',
        httpStatus: 403,
        message: 'Attendee must check in at the Main Entry before accessing any other zone.',
      });
      return res.status(denied.status).json(denied.body);
    }

    // -------------------------------------------------
    // 7. Zone permission
    // -------------------------------------------------
    const allowedZones = attendee.allowedZones || [];
    if (!allowedZones.includes(zoneName) && !allowedZones.includes(zoneId)) {
      const denied = await buildDeniedResponse({
        attendee,
        zoneName,
        action,
        scanMethod: qrToken ? 'QR' : 'RFID',
        userId: req.user._id,
        io,
        denialReason: 'NOT_ALLOWED',
        httpStatus: 403,
        message: 'Zone not included in ticket',
      });
      return res.status(denied.status).json(denied.body);
    }

    // -------------------------------------------------
    // 8. Create the log + update checkedIn flag
    // -------------------------------------------------
    const zoneLog = await ZoneLog.create({
      attendeeId: attendee._id,
      eventId: event._id,
      zoneName,
      action,
      accessGranted: true,
      scanMethod: qrToken ? 'QR' : 'RFID',
      scannedBy: req.user._id,
      attendeeSnapshot: {
        fullName: attendee.fullName,
        categoryName: attendee.categoryName,
        allowedZones,
      },
    });

    if (rfidId || (!qrToken && attendee.rfidTag)) {
      RfidAccessLog.create({
        event: event._id,
        attendee: attendee._id,
        rfidIdentifierSnapshot: String(rfidId || attendee.rfidTag || 'UNKNOWN').trim(),
        assignment: attendee._rfidAssignment?._id,
        ticket: attendee.ticket?._id || attendee.ticket,
        zoneName,
        reader: 'Zone Scanner',
        scanMethod: 'RFID',
        result: 'GRANTED',
        performedBy: req.user._id,
      }).catch((err) => console.error('Failed to write RfidAccessLog for zone scan:', err));
    }

    // Update main-entry status
    if (isMainEntryZone) {
      if (action === 'ENTRY') {
        attendee.checkedIn = true;
        attendee.checkedInAt = new Date();
        attendee.checkedInMethod = qrToken ? 'QR' : 'RFID';
      } else if (action === 'EXIT') {
        attendee.checkedIn = false;
        attendee.checkedInAt = null;
        attendee.checkedInMethod = null;
      }
      await attendee.save();
    }

    // -------------------------------------------------
    // 9. Emit + respond
    // -------------------------------------------------
    const eventIdStr = event._id.toString();
    const successPayload = {
      source: 'zone',
      eventId: eventIdStr,
      attendeeName: attendee.fullName,
      name: attendee.fullName,
      action,
      zoneName,
      timestamp: zoneLog.timestamp,
      accessGranted: true,
      categoryName: attendee.categoryName,
      processedByName: req.user.name || req.user.email,
      scanMethod: qrToken ? 'QR' : 'RFID',
    };
    emitDashboardEvent(io, 'zone_scan', eventIdStr, successPayload);
    emitDashboardEvent(io, 'zone_update', eventIdStr, successPayload);

    res.json({
      success: true,
      message: 'Access Granted',
      data: {
        accessGranted: true,
        action,
        zoneName,
        scannedRfid: !qrToken ? rfidId : undefined,
        attendee: {
          _id: attendee._id,
          fullName: attendee.fullName,
          categoryName: attendee.categoryName,
          allowedZones,
          photo: attendee.photo,
          checkedIn: attendee.checkedIn,
        },
        event: {
          _id: event._id,
          name: event.name,
        },
        log: zoneLog,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer', 'auditor'), async (req, res, next) => {
  try {
    const { eventId, zone, limit = 10 } = req.query;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'eventId is required.' });
    }

    const event = await Event.findById(eventId).select('createdBy zones');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const hasEventAccess = await userHasEventAccess(req.user, event);
    if (!hasEventAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const filter = { eventId };
    if (zone) {
      const resolvedZone = resolveZone(event, zone);
      filter.zoneName = resolvedZone.zoneName;
    }

    const userAssignedZones = getUserAssignedZones(req.user);
    if ([ROLES.STAFF, ROLES.VOLUNTEER].includes(normalizeRole(req.user.role)) && userAssignedZones.length) {
      if (typeof filter.zoneName === 'string') {
        const resolvedFilterZone = resolveZone(event, filter.zoneName);
        const canAccessRequestedZone =
          userAssignedZones.includes(String(filter.zoneName)) ||
          userAssignedZones.includes(String(resolvedFilterZone.zoneName)) ||
          userAssignedZones.includes(String(resolvedFilterZone.zoneId));

        if (!canAccessRequestedZone) {
          return res.json({ success: true, data: { logs: [] } });
        }

        filter.zoneName = resolvedFilterZone.zoneName;
      } else {
        const allowedZoneNames = userAssignedZones
          .map((zone) => resolveZone(event, zone).zoneName)
          .filter(Boolean);
        filter.zoneName = { $in: Array.from(new Set(allowedZoneNames)) };
      }
    }

    const [logs, totalScanned, allowedCount] = await Promise.all([
      ZoneLog.find(filter)
        .populate('attendeeId', 'fullName categoryName allowedZones')
        .populate('scannedBy', 'name role')
        .sort({ timestamp: -1 })
        .limit(Math.min(parseInt(limit, 10) || 10, 25)),
      ZoneLog.countDocuments(filter),
      ZoneLog.countDocuments({ ...filter, accessGranted: true }),
    ]);

    const deniedCount = Math.max(0, totalScanned - allowedCount);

    const formattedLogs = logs.map((l) => ({
      _id: l._id,
      attendee: l.attendeeId,
      attendeeId: l.attendeeId,
      snapshot: l.attendeeSnapshot,
      zone: l.zoneName,
      zoneName: l.zoneName,
      action: l.action,
      accessGranted: l.accessGranted,
      denialReason: l.denialReason,
      timestamp: l.timestamp,
      scannedBy: l.scannedBy,
    }));

    res.json({
      success: true,
      data: {
        logs: formattedLogs,
        meta: {
          totalScanned,
          allowedCount,
          deniedCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;