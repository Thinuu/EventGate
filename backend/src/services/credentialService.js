// backend/src/services/credentialService.js

/**
 * Service for resolving attendees from QR or RFID credentials
 * and performing common validation shared by entry & zone routes.
 */

const Attendee = require('../models/Attendee');
const Event = require('../models/Event');

const RfidAssignment = require('../models/RfidAssignment');

/**
 * Resolve an attendee based on provided QR token or RFID identifier.
 * Returns the attendee document populated with `event` and `ticket`.
 * Checks both the new active RfidAssignment collection and the Attendee rfidTag/wristbandId fallback.
 */
async function resolveAttendee({ qrToken, rfidId, eventId }) {
  if (!qrToken && !rfidId) {
    return null;
  }

  if (qrToken) {
    return Attendee.findOne({ qrToken: String(qrToken).trim() })
      .populate('event')
      .populate('ticket');
  }

  const cleanRfid = String(rfidId).trim();

  // 1. Try finding an active assignment for this RFID tag within the event
  const assignmentQuery = {
    rfidIdentifierSnapshot: cleanRfid,
    status: 'ACTIVE',
  };
  if (eventId) {
    assignmentQuery.event = eventId;
  }

  const activeAssignment = await RfidAssignment.findOne(assignmentQuery)
    .populate('attendee')
    .populate('event')
    .populate('ticket');

  if (activeAssignment?.attendee) {
    // Populate event and ticket if not populated
    const attendee = await Attendee.findById(activeAssignment.attendee._id || activeAssignment.attendee)
      .populate('event')
      .populate('ticket');
    if (attendee) {
      attendee._rfidAssignment = activeAssignment;
      return attendee;
    }
  }

  // 2. Fallback to Attendee model (for legacy records or direct fields)
  const attendeeQuery = eventId
    ? {
        event: eventId,
        $or: [
          { rfidTag: cleanRfid },
          { wristbandId: cleanRfid },
        ],
      }
    : {
        $or: [
          { rfidTag: cleanRfid },
          { wristbandId: cleanRfid },
        ],
      };

  return Attendee.findOne(attendeeQuery)
    .populate('event')
    .populate('ticket');
}

/**
 * Determine the scan method ('rfid' or 'qr') based on input values.
 */
function getScanMethod({ qrToken, rfidId, parsedScan }) {
  if (rfidId) return 'rfid';

  // Some scanners send a pure 10-digit number even for RFID
  if (parsedScan && /^\d{10}$/.test(String(parsedScan).trim())) {
    return 'rfid';
  }

  return 'qr';
}

/**
 * Enforce the event-level RFID toggle + RFID assignment check.
 * Returns { allowed, reason, message }
 */
async function enforceRfidToggle({ attendee, rfidId, fullEvent }) {
  // No RFID was scanned → always allowed
  if (!rfidId) {
    return { allowed: true };
  }

  const event = fullEvent || attendee?.event;
  const tag = await require('../models/RfidTag').findOne({ rfidTag: String(rfidId).trim() }).select('status').lean();
  if (tag?.status === 'DISABLED') return { allowed: false, reason: 'RFID_DISABLED', message: 'This physical tag is disabled.' };

  // RFID feature is disabled for this event
  if (!event?.settings?.rfidEnabled) {
    return {
      allowed: false,
      reason: 'RFID_DISABLED',
      message: 'RFID functionality is disabled for this event.',
    };
  }

  // RFID scanned but attendee has no RFID / wristband assigned
  if (!attendee?._rfidAssignment && !attendee?.rfidTag && !attendee?.wristbandId) {
    return {
      allowed: false,
      reason: 'RFID_NOT_ASSIGNED',
      message: 'No RFID tag has been assigned to this attendee yet. Please assign RFID first.',
    };
  }

  return { allowed: true };
}

/**
 * Validate ticket status against event dates.
 * Used by both entry and zone scans.
 */
function validateTicket({ ticket, event }) {
  if (!ticket) {
    return {
      valid: false,
      reason: 'INVALID_TICKET',
      message: 'Attendee is not linked to a ticket',
    };
  }

  if (['CANCELLED', 'EXPIRED'].includes(ticket.status)) {
    return {
      valid: false,
      reason: 'TICKET_CANCELLED',
      message: 'Ticket has been cancelled',
    };
  }

  if (!['CONFIRMED', 'SOLD', 'ACTIVE'].includes(ticket.status)) {
    return {
      valid: false,
      reason: 'TICKET_NOT_CONFIRMED',
      message: 'Ticket has not been confirmed',
    };
  }

  // Support both endDateTime and endDate field names
  const endDate = event?.endDateTime || event?.endDate;
  if (endDate && new Date(endDate) < new Date()) {
    return {
      valid: false,
      reason: 'EVENT_ENDED',
      message: 'Event has ended',
    };
  }

  return { valid: true };
}

/**
 * Ensure QR and RFID share a single check-in state.
 *
 * Rules:
 * - check_in  → only allowed if NOT already checked in
 * - check_out → only allowed if currently checked in
 *
 * This makes QR and RFID interchangeable for the first check-in,
 * but blocks any second check-in until a check-out happens.
 */
function validateCheckInOut({ attendee, action }) {
  const normalizedAction = String(action || '').toLowerCase();

  // Support both naming conventions used in the codebase
  const isCheckIn =
    normalizedAction === 'check_in' ||
    normalizedAction === 'entry' ||
    normalizedAction === 'zone_entry';

  const isCheckOut =
    normalizedAction === 'check_out' ||
    normalizedAction === 'exit' ||
    normalizedAction === 'zone_exit';

  if (isCheckIn && attendee.checkedIn) {
    return {
      allowed: false,
      reason: 'ALREADY_CHECKED_IN',
      message: 'Attendee has already checked in. Please use Exit / Check-Out mode first.',
    };
  }

  if (isCheckOut && !attendee.checkedIn) {
    return {
      allowed: false,
      reason: 'NOT_CHECKED_IN',
      message: 'Attendee is not currently checked in.',
    };
  }

  return { allowed: true };
}

/**
 * Validate that a zone entry is only allowed after main-entry check-in.
 */
function validateZoneEntry({ attendee, action, zoneId }) {
  const normalizedAction = String(action || '').toLowerCase();

  const isZoneEntry =
    normalizedAction === 'zone_entry' ||
    normalizedAction === 'entry';

  if (isZoneEntry && zoneId && !attendee.checkedIn) {
    return {
      allowed: false,
      reason: 'MAIN_ENTRY_REQUIRED',
      message: 'Attendee must check in at the Main Entry before accessing any other zone.',
    };
  }

  return { allowed: true };
}

module.exports = {
  resolveAttendee,
  getScanMethod,
  enforceRfidToggle,
  validateTicket,
  validateCheckInOut,
  validateZoneEntry,
};