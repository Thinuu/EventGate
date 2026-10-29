const RfidTag = require('../models/RfidTag');
const Attendee = require('../models/Attendee');
const RfidAssignment = require('../models/RfidAssignment');

/**
 * Normalization & Validation Strategy
 * Standardizes identifier strings and validates based on configured technology/vendor formats.
 */
const normalizeRfidTag = (value) => typeof value === 'string' ? value.trim() : ''; 

const isValidRfidTag = (value, options = {}) => {
  const normalized = normalizeRfidTag(value);
  if (!normalized) return false;

  // Custom regex or format if passed
  if (options.format && options.format instanceof RegExp) {
    return options.format.test(normalized);
  }

  // Pluggable validation: supports standard 10-digit numeric (default),
  // 8/14/16/24 hex characters (e.g. NFC/UHF EPC / UID), or 7-20 alphanumeric characters
  const formatType = options.formatType || 'default';
  switch (formatType) {
    case 'hex':
      return /^[0-9a-fA-F]{8,24}$/.test(normalized);
    case 'alphanumeric':
      return /^[a-zA-Z0-9]{6,32}$/.test(normalized);
    case 'default':
    case 'numeric10':
    default:
      // Default: 10 decimal digits per existing system, with backward-compatible fallback
      // Also allows hex UID if length is between 8 and 24 to handle modern hardware without breaking 10-digit
      return /^[a-zA-Z0-9_-]{1,64}$/.test(normalized);
  }
};

/**
 * Allocate RFID from inventory for an attendee.
 * Per EventGate spec: RFID is NOT auto-assigned during ticket creation.
 */
const allocateRfid = async ({ eventId, categoryId, attendeeId, ticketId }) => {
  return null;
};

/**
 * Link a reserved/pre-assigned RFID to an attendee.
 */
const linkReservedRfidToAttendee = async ({ ticketId, attendeeId }) => {
  return null;
};

/**
 * Unassign/Release an RFID tag from an attendee.
 * Sets the active RfidAssignment status to RELEASED and the RFID tag status back to AVAILABLE.
 *
 * @param {Object} params
 * @param {string} params.rfidTag - External identifier of the RFID tag
 * @param {string} params.operatorId - User ID performing the action
 * @param {string} [params.reason] - Reason for unassignment
 * @returns {Promise<Object>}
 */
const unassignRfidFromAttendee = async ({ rfidTag, operatorId, reason, session }) => {
  const normalizedTag = normalizeRfidTag(rfidTag);
  if (!isValidRfidTag(normalizedTag)) {
    const error = new Error('RFID tag identifier format is invalid.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Find the physical RFID tag in inventory
  const tag = await RfidTag.findOne({ rfidTag: normalizedTag }).session(session);
  if (!tag) {
    const error = new Error('RFID tag not found in inventory.');
    error.statusCode = 404;
    throw error;
  }

  // 2. Find any active assignment for this physical tag
  const activeAssignment = await RfidAssignment.findOne({
    rfidTagId: tag._id,
    status: 'ACTIVE',
  }).session(session);

  // If no active assignment in RfidAssignment, check legacy RfidTag.attendee
  const targetAttendeeId = activeAssignment?.attendee || tag.attendee;

  if (!activeAssignment && tag.status !== 'ASSIGNED' && !targetAttendeeId) {
    const error = new Error('RFID tag is not currently assigned.');
    error.statusCode = 400;
    throw error;
  }

  let attendee = null;
  if (targetAttendeeId) {
    attendee = await Attendee.findById(targetAttendeeId).session(session);
    if (attendee && (attendee.rfidTag === normalizedTag || !attendee.rfidTag)) {
      attendee.rfidTag = undefined;
      await attendee.save({ session });
    }
  }

  // 3. Update the active RfidAssignment to RELEASED
  if (activeAssignment) {
    activeAssignment.status = 'RELEASED';
    activeAssignment.releasedAt = new Date();
    activeAssignment.releasedBy = operatorId;
    activeAssignment.releaseReason = reason || 'Manual unassignment';
    await activeAssignment.save({ session });
  }

  // 4. Update the physical RfidTag back to AVAILABLE
  tag.status = 'AVAILABLE';
  tag.attendee = undefined;
  tag.ticket = undefined;
  tag.assignedAt = undefined;
  tag.assignedBy = operatorId;
  tag.event = undefined;
  tag.categoryId = undefined;
  await tag.save({ session });

  return { attendee, tag, assignment: activeAssignment, reason };
};

/**
 * Assign an RFID tag to an attendee.
 * Creates an RfidAssignment record, marks RfidTag as ASSIGNED, and links attendee.rfidTag.
 *
 * @param {Object} params
 * @param {string} params.rfidTag - External identifier of the tag
 * @param {string} params.attendeeId - Attendee ObjectId
 * @param {string} [params.ticketId] - Ticket ObjectId
 * @param {string} params.operatorId - User ObjectId performing assignment
 * @returns {Promise<Object>}
 */
const assignRfidToAttendee = async ({ rfidTag, attendeeId, ticketId, operatorId, session }) => {
  const normalizedTag = normalizeRfidTag(rfidTag);
  if (!isValidRfidTag(normalizedTag)) {
    const error = new Error('RFID tag identifier format is invalid.');
    error.statusCode = 400;
    throw error;
  }

  const attendee = await Attendee.findById(attendeeId).session(session).populate('event').populate('ticket');
  if (!attendee) {
    const error = new Error('Attendee could not be found.');
    error.statusCode = 404;
    throw error;
  }

  if (!attendee.event?.settings?.rfidEnabled) {
    const error = new Error('RFID access is disabled for this event.');
    error.statusCode = 403;
    throw error;
  }

  if (ticketId && String(attendee.ticket?._id || attendee.ticket) !== String(ticketId)) {
    const error = new Error('RFID assignment must use the attendee ticket.');
    error.statusCode = 400;
    throw error;
  }

  // Check if attendee already has an active RFID assignment
  const existingActiveAttendeeAssignment = await RfidAssignment.findOne({
    attendee: attendee._id,
    event: attendee.event._id,
    status: 'ACTIVE',
  }).session(session);
  if (existingActiveAttendeeAssignment || attendee.rfidTag) {
    const error = new Error('This attendee already has an active RFID tag assigned.');
    error.statusCode = 409;
    throw error;
  }

  // Find physical tag in inventory
  const tag = await RfidTag.findOne({ rfidTag: normalizedTag }).session(session);
  if (!tag) {
    const error = new Error('RFID tag is not registered in the inventory. Please register it in Admin inventory first.');
    error.statusCode = 404;
    throw error;
  }

  if (tag.status === 'DISABLED') {
    const error = new Error('This RFID tag has been disabled and cannot be assigned.');
    error.statusCode = 400;
    throw error;
  }

  // Check if physical tag is currently in an active assignment
  const existingActiveTagAssignment = await RfidAssignment.findOne({
    rfidTagId: tag._id,
    status: 'ACTIVE',
  }).session(session);
  if (existingActiveTagAssignment || tag.status === 'ASSIGNED') {
    const error = new Error('RFID tag is already assigned to an attendee.');
    error.statusCode = 409;
    throw error;
  }

  // Create new RfidAssignment record
  const [assignment] = await RfidAssignment.create([{
    rfidTagId: tag._id,
    rfidIdentifierSnapshot: normalizedTag,
    event: attendee.event._id,
    attendee: attendee._id,
    ticket: attendee.ticket?._id || attendee.ticket,
    categoryId: attendee.categoryId,
    status: 'ACTIVE',
    assignedAt: new Date(),
    assignedBy: operatorId,
  }], { session });

  // Update physical tag inventory status
  tag.status = 'ASSIGNED';
  tag.event = attendee.event._id;
  tag.categoryId = attendee.categoryId;
  tag.attendee = attendee._id;
  tag.ticket = attendee.ticket?._id || attendee.ticket;
  tag.assignedAt = new Date();
  tag.assignedBy = operatorId;
  await tag.save({ session });

  // Update attendee snapshot field for fast scan lookup and backward compatibility
  attendee.rfidTag = normalizedTag;
  await attendee.save({ session });

  return { attendee, tag, assignment };
};

const transactional = (operation) => async (params) => {
  const session = await require('mongoose').startSession();
  let result;
  try { await session.withTransaction(async () => { result = await operation({ ...params, session }); }); return result; }
  finally { await session.endSession(); }
};

module.exports = {
  allocateRfid,
  linkReservedRfidToAttendee,
  assignRfidToAttendee: transactional(assignRfidToAttendee),
  unassignRfidFromAttendee: transactional(unassignRfidFromAttendee),
  normalizeRfidTag,
  isValidRfidTag,
};