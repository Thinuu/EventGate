const express = require('express');
const XLSX = require('../utils/spreadsheet');
const multer = require('multer');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Attendee = require('../models/Attendee');
const RfidTag = require('../models/RfidTag');
const RfidAssignment = require('../models/RfidAssignment');
const RfidAccessLog = require('../models/RfidAccessLog');
const AuditLog = require('../models/AuditLog');
const { protect, restrictTo } = require('../middleware/auth');
const { normalizeRfidTag, isValidRfidTag, assignRfidToAttendee, unassignRfidFromAttendee } = require('../services/rfidService');

const router = express.Router();
const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });
const adminRoles = ['main_admin', 'main_organiser'];
const operationalRoles = ['main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'];

const canManageEvent = async (user, eventId) => {
  if (require('../utils/rbac').normalizeRole(user.role) === 'MainAdmin') return true;
  const event = await Event.findById(eventId).select('createdBy mainOrganiser mainOrganisers');
  return !!event && (String(event.createdBy) === String(user._id) || String(event.mainOrganiser) === String(user._id) || (event.mainOrganisers || []).some((id) => String(id) === String(user._id)));
};

const getCategoryLimit = async (eventId, categoryId) => {
  const event = await Event.findById(eventId).select('categories');
  const category = event?.categories?.find((item) => String(item.id) === String(categoryId));
  if (!category) return null;
  return Number(category.capacity || 0);
};

const userHasEventAccess = async (user, eventId) => {
  if (require('../utils/rbac').normalizeRole(user.role) === 'MainAdmin') return true;
  const event = await Event.findById(eventId).select('createdBy mainOrganiser mainOrganisers subOrganisers staff volunteers');
  if (!event) return false;
  const userId = String(user._id);
  return [event.createdBy, event.mainOrganiser, ...(event.mainOrganisers || []), ...(event.subOrganisers || []), ...(event.staff || []), ...(event.volunteers || [])]
    .filter(Boolean)
    .some((id) => String(id) === userId)
    || (user.assignedEvents || []).some((id) => String(id) === String(eventId));
};

router.get('/inventory', protect, restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const filter = {};
    if (require('../utils/rbac').normalizeRole(req.user.role) !== 'MainAdmin') {
      if (!req.query.eventId || !(await canManageEvent(req.user, req.query.eventId))) return res.status(403).json({ success: false, message: 'Select an event you manage to view its inventory.' });
    }
    if (req.query.eventId) filter.event = req.query.eventId;
    if (['AVAILABLE', 'ASSIGNED', 'DISABLED'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.search) filter.rfidTag = { $regex: normalizeRfidTag(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const [tags, totals] = await Promise.all([
      RfidTag.find(filter).sort({ rfidTag: 1 }).populate('event', 'name').populate('attendee', 'fullName email phone').populate('ticket', 'ticketNumber categoryName').lean(),
      RfidTag.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    const counts = totals.reduce((result, item) => ({ ...result, [item._id]: item.count }), {});
    res.json({ success: true, data: { tags, counts: { total: tags.length, available: counts.AVAILABLE || 0, assigned: counts.ASSIGNED || 0, disabled: counts.DISABLED || 0 } } });
  } catch (err) { next(err); }
});

const insertInventoryTags = async (values, meta = {}, user = null) => {
  const normalized = values.map(normalizeRfidTag);
  const valid = normalized.filter(isValidRfidTag);
  const unique = [...new Set(valid)];
  const existing = new Set((await RfidTag.find({ rfidTag: { $in: unique } }).select('rfidTag').lean()).map((tag) => tag.rfidTag));
  
  const docs = unique.filter((value) => !existing.has(value)).map((rfidTag) => ({
    rfidTag,
    status: 'AVAILABLE',
    vendor: meta.vendor || 'unknown',
    technology: meta.technology || 'unknown',
    tagType: meta.tagType || 'card',
    registeredAt: new Date(),
    registeredBy: user?._id,
    notes: meta.notes || '',
  }));
  
  if (docs.length) await RfidTag.insertMany(docs, { ordered: false });
  return {
    imported: values.length,
    duplicates: values.length - valid.length + (valid.length - unique.length) + existing.size,
    invalid: values.length - valid.length,
    added: docs.length,
  };
};

router.post('/inventory', protect, restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const values = Array.isArray(req.body.rfidTags) ? req.body.rfidTags : [req.body.rfidTag];
    if (!values.some(isValidRfidTag)) return res.status(400).json({ success: false, message: 'At least one valid RFID identifier is required.' });
    const meta = {
      vendor: req.body.vendor,
      technology: req.body.technology,
      tagType: req.body.tagType,
      notes: req.body.notes,
    };
    res.json({ success: true, data: await insertInventoryTags(values, meta, req.user) });
  } catch (err) { next(err); }
});

router.post('/inventory/bulk', protect, restrictTo('main_admin', 'main_organiser'), excelUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel or CSV file is required.' });
    const workbook = await XLSX.read(req.file.buffer);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
    const values = rows.slice(1).map((row) => row[0]).filter(Boolean);
    const meta = {
      vendor: req.body.vendor,
      technology: req.body.technology,
      tagType: req.body.tagType,
      notes: req.body.notes,
    };
    res.json({ success: true, data: await insertInventoryTags(values, meta, req.user) });
  } catch (err) { next(err); }
});

router.post('/assign', protect, restrictTo(...operationalRoles), async (req, res, next) => {
  try {
    const qrToken = String(req.body.qrToken || '').trim();
    if (!qrToken || !req.body.rfidTag) return res.status(400).json({ success: false, message: 'qrToken and rfidTag are required.' });
    const attendee = await Attendee.findOne({ qrToken }).select('event ticket').lean();
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee could not be found.' });
    if (!(await userHasEventAccess(req.user, attendee.event))) return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    const result = await assignRfidToAttendee({ rfidTag: req.body.rfidTag, attendeeId: attendee._id, ticketId: attendee.ticket, operatorId: req.user._id });
    res.json({ success: true, message: 'RFID assigned successfully.', data: { attendee: result.attendee, tag: result.tag } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.get('/events/:eventId', protect, restrictTo(...adminRoles), async (req, res, next) => {
  try {
    if (!(await canManageEvent(req.user, req.params.eventId))) return res.status(403).json({ success: false, message: 'You do not manage this event.' });
    const tags = await RfidTag.find({ event: req.params.eventId }).sort({ categoryId: 1, sequence: 1 }).populate('attendee', 'fullName email').lean();
    res.json({ success: true, data: { tags } });
  } catch (err) { next(err); }
});

const getUniqueValidRfidValues = async (eventId, categoryId, values) => {
  const existing = await RfidTag.find({ event: eventId, categoryId }).select('rfidTag').lean();
  const used = new Set(existing.map((tag) => tag.rfidTag));
  const unique = [];

  for (const value of values) {
    const normalized = normalizeRfidTag(value);
    if (!isValidRfidTag(normalized) || used.has(normalized)) continue;
    used.add(normalized);
    unique.push(normalized);
  }

  return unique;
};

const addTags = async ({ eventId, categoryId, values }) => {
  const [existing, maxAllowed] = await Promise.all([
    RfidTag.find({ event: eventId, categoryId }).select('rfidTag').lean(),
    getCategoryLimit(eventId, categoryId),
  ]);

  if (maxAllowed === null) {
    throw new Error('Category not found for this event.');
  }

  const used = new Set(existing.map((tag) => tag.rfidTag));
  let sequence = (await RfidTag.findOne({ event: eventId, categoryId }).sort({ sequence: -1 }).select('sequence').lean())?.sequence || 0;
  const docs = [];
  for (const value of values) {
    const rfidTag = normalizeRfidTag(value);
    if (!isValidRfidTag(rfidTag) || used.has(rfidTag)) continue;
    if (existing.length + docs.length + 1 > maxAllowed) {
      break;
    }
    used.add(rfidTag);
    docs.push({ event: eventId, categoryId, rfidTag, sequence: ++sequence });
  }
  if (docs.length) await RfidTag.insertMany(docs, { ordered: false });
  return docs.length;
};

router.post('/events/:eventId/tags', protect, restrictTo(...adminRoles), async (req, res, next) => {
  try {
    if (!(await canManageEvent(req.user, req.params.eventId))) return res.status(403).json({ success: false, message: 'You do not manage this event.' });
    const values = Array.isArray(req.body.rfidTags) ? req.body.rfidTags : [req.body.rfidTag];
    if (!req.body.categoryId || !values.some(isValidRfidTag)) return res.status(400).json({ success: false, message: 'categoryId and at least one valid RFID identifier are required.' });

    const categoryLimit = await getCategoryLimit(req.params.eventId, req.body.categoryId);
    if (categoryLimit === null) return res.status(400).json({ success: false, message: 'Category not found for this event.' });

    const existingCount = await RfidTag.countDocuments({ event: req.params.eventId, categoryId: req.body.categoryId });
    const uniqueNewValues = await getUniqueValidRfidValues(req.params.eventId, req.body.categoryId, values);

    if (existingCount + uniqueNewValues.length > categoryLimit) {
      return res.status(400).json({
        success: false,
        message: `This category can only hold ${categoryLimit} RFID tags. You are trying to add ${uniqueNewValues.length} more, but ${existingCount} already exist.`,
      });
    }

    const added = await addTags({ eventId: req.params.eventId, categoryId: req.body.categoryId, values: uniqueNewValues });
    res.json({ success: true, data: { added } });
  } catch (err) { next(err); }
});

router.post('/events/:eventId/upload', protect, restrictTo(...adminRoles), excelUpload.single('file'), async (req, res, next) => {
  try {
    if (!(await canManageEvent(req.user, req.params.eventId))) return res.status(403).json({ success: false, message: 'You do not manage this event.' });
    const { categoryId } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel file is required.' });
    const workbook = await XLSX.read(req.file.buffer);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    const values = rows.map((row) => row.rfidTag || row['RFID Tag'] || row.RFID || row['RFID'] || Object.values(row)[0]);
    const categoryLimit = await getCategoryLimit(req.params.eventId, categoryId);
    if (categoryLimit === null) return res.status(400).json({ success: false, message: 'Category not found for this event.' });
    const existingCount = await RfidTag.countDocuments({ event: req.params.eventId, categoryId });
    const uniqueValues = await getUniqueValidRfidValues(req.params.eventId, categoryId, values);
    if (existingCount + uniqueValues.length > categoryLimit) {
      return res.status(400).json({
        success: false,
        message: `This category can only hold ${categoryLimit} RFID tags. You are trying to add ${uniqueValues.length} more, but ${existingCount} already exist.`,
      });
    }
    const added = await addTags({ eventId: req.params.eventId, categoryId, values: uniqueValues });
    res.json({ success: true, data: { added, skipped: values.length - added } });
  } catch (err) { next(err); }
});

router.delete('/events/:eventId/tags/:tagId', protect, restrictTo(...adminRoles), async (req, res, next) => {
  try {
    if (!(await canManageEvent(req.user, req.params.eventId))) return res.status(403).json({ success: false, message: 'You do not manage this event.' });
    const tag = await RfidTag.findOne({ _id: req.params.tagId, event: req.params.eventId });
    if (!tag) return res.status(404).json({ success: false, message: 'RFID tag not found.' });
    if (tag.status === 'assigned') return res.status(409).json({ success: false, message: 'Assigned RFID tags cannot be removed.' });
    await tag.deleteOne();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/rfid/validate/:rfidTag - Validate if an RFID is available for assignment
router.get('/validate/:rfidTag', protect, restrictTo(...operationalRoles), async (req, res, next) => {
  try {
    const { rfidTag } = req.params;
    const { eventId, categoryId } = req.query;

    if (!isValidRfidTag(rfidTag)) {
      return res.status(400).json({ 
        success: false, 
        message: 'RFID tag has an unsupported format.',
        valid: false,
        reason: 'INVALID_FORMAT'
      });
    }

    const normalizedTag = normalizeRfidTag(rfidTag);
    const tag = await RfidTag.findOne({ rfidTag: normalizedTag });

    if (!tag) {
      return res.json({
        success: true,
        data: {
          rfidTag: normalizedTag,
          exists: false,
          valid: false,
          status: null,
          reason: 'NOT_IN_INVENTORY',
          message: 'RFID tag is not registered in the inventory. Please add it to the Admin inventory first.',
        },
      });
    }

    // If eventId is provided, check if RFID is compatible
    if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      const event = await Event.findById(eventId).select('settings.rfidEnabled');
      
      if (!event?.settings?.rfidEnabled) {
        return res.json({
          success: true,
          data: {
            rfidTag: normalizedTag,
            exists: true,
            valid: false,
            status: tag.status,
            reason: 'RFID_DISABLED',
            message: 'RFID access is disabled for this event.',
          },
        });
      }

      // If category is specified, check category compatibility
      if (categoryId && tag.categoryId && tag.categoryId !== categoryId) {
        return res.json({
          success: true,
          data: {
            rfidTag: normalizedTag,
            exists: true,
            valid: false,
            status: tag.status,
            reason: 'CATEGORY_MISMATCH',
            message: `RFID tag is allocated for category ${tag.categoryId}, not ${categoryId}.`,
          },
        });
      }
    }

    if (tag.status !== 'AVAILABLE') {
      let message = 'RFID tag is already assigned.';
      let assignedInfo = null;

      if (tag.status === 'ASSIGNED' && tag.attendee) {
        const attendee = await Attendee.findById(tag.attendee).select('fullName email').lean();
        assignedInfo = {
          attendeeName: attendee?.fullName,
          attendeeId: tag.attendee,
        };
        message = `RFID tag is assigned to attendee: ${attendee?.fullName || 'Unknown'}`;
      } else if (tag.status === 'DISABLED') {
        message = 'RFID tag has been disabled.';
      }

      return res.json({
        success: true,
        data: {
          rfidTag: normalizedTag,
          exists: true,
          valid: false,
          status: tag.status,
          reason: 'NOT_AVAILABLE',
          message,
          assignedInfo,
        },
      });
    }

    res.json({
      success: true,
      data: {
        rfidTag: normalizedTag,
        exists: true,
        valid: true,
        status: 'AVAILABLE',
        reason: null,
        message: 'RFID tag is available for assignment.',
      },
    });
  } catch (err) { next(err); }
});

// DELETE /api/rfid/unassign/:rfidTag - Unassign/release an RFID from an attendee (Admin only)
router.delete('/unassign/:rfidTag', protect, restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { rfidTag } = req.params;
    const { reason } = req.body;

    if (!isValidRfidTag(rfidTag)) {
      return res.status(400).json({ success: false, message: 'RFID tag has an unsupported format.' });
    }

    const result = await unassignRfidFromAttendee({
      rfidTag,
      operatorId: req.user._id,
      reason,
    });

    res.json({
      success: true,
      message: 'RFID unassigned successfully. Tag is now available for reassignment.',
      data: {
        rfidTag: result.tag.rfidTag,
        releasedFrom: {
          attendeeId: result.attendee._id,
          attendeeName: result.attendee.fullName,
        },
        status: result.tag.status,
        reason: result.reason,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

// GET /api/rfid/assignment/:attendeeId - Get RFID assignment details for an attendee
router.get('/assignment/:attendeeId', protect, restrictTo(...operationalRoles), async (req, res, next) => {
  try {
    const { attendeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(attendeeId)) {
      return res.status(400).json({ success: false, message: 'Invalid attendee ID.' });
    }

    const attendee = await Attendee.findById(attendeeId)
      .populate('event', 'name settings.rfidEnabled')
      .select('fullName email phone rfidTag categoryName qrToken checkedIn');

    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Attendee not found.' });
    }

    // Check event access
    if (!(await userHasEventAccess(req.user, attendee.event?._id || attendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    let tagDetails = null;
    if (attendee.rfidTag) {
      tagDetails = await RfidTag.findOne({ rfidTag: attendee.rfidTag })
        .populate('event', 'name')
        .populate('assignedBy', 'name email')
        .lean();

      tagDetails.assignedAt = tagDetails.assignedAt ? new Date(tagDetails.assignedAt).toISOString() : null;
    }

    res.json({
      success: true,
      data: {
        attendee: {
          _id: attendee._id,
          fullName: attendee.fullName,
          email: attendee.email,
          phone: attendee.phone,
          categoryName: attendee.categoryName,
          qrToken: attendee.qrToken,
          rfidTag: attendee.rfidTag,
          checkedIn: attendee.checkedIn,
        },
        event: {
          _id: attendee.event._id,
          name: attendee.event.name,
          rfidEnabled: attendee.event.settings?.rfidEnabled,
        },
        rfidAssignment: tagDetails ? {
          rfidTag: tagDetails.rfidTag,
          status: tagDetails.status,
          event: tagDetails.event?.name,
          categoryId: tagDetails.categoryId,
          assignedBy: tagDetails.assignedBy?.name,
          assignedAt: tagDetails.assignedAt,
        } : null,
      },
    });
  } catch (err) { next(err); }
});

// PATCH /api/rfid/inventory/:rfidTag/disable - Disable an RFID tag (make unavailable)
router.patch('/inventory/:rfidTag/disable', protect, restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { rfidTag } = req.params;
    const { reason } = req.body;

    if (!isValidRfidTag(rfidTag)) {
      return res.status(400).json({ success: false, message: 'RFID tag identifier format is invalid.' });
    }

    const normalizedTag = normalizeRfidTag(rfidTag);
    const tag = await RfidTag.findOne({ rfidTag: normalizedTag });
    if (!tag) return res.status(404).json({ success: false, message: 'RFID tag not found in inventory.' });

    if (tag.status === 'ASSIGNED') {
      return res.status(409).json({ success: false, message: 'Cannot disable an assigned RFID. Please unassign first.' });
    }

    tag.status = 'DISABLED';
    tag.disabledAt = new Date();
    tag.disabledBy = req.user._id;
    tag.disableReason = reason || 'Manually disabled';
    await tag.save();

    res.json({ success: true, message: 'RFID tag disabled successfully.', data: { tag: { rfidTag: tag.rfidTag, status: tag.status } } });
  } catch (err) { next(err); }
});

// PATCH /api/rfid/inventory/:rfidTag/enable - Re-enable a disabled RFID tag
router.patch('/inventory/:rfidTag/enable', protect, restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { rfidTag } = req.params;

    if (!isValidRfidTag(rfidTag)) {
      return res.status(400).json({ success: false, message: 'RFID tag identifier format is invalid.' });
    }

    const normalizedTag = normalizeRfidTag(rfidTag);
    const tag = await RfidTag.findOne({ rfidTag: normalizedTag });
    if (!tag) return res.status(404).json({ success: false, message: 'RFID tag not found in inventory.' });

    if (tag.status !== 'DISABLED') {
      return res.status(409).json({ success: false, message: 'Only disabled RFID tags can be enabled.' });
    }

    tag.status = 'AVAILABLE';
    tag.disabledAt = undefined;
    tag.disabledBy = undefined;
    tag.disableReason = undefined;
    await tag.save();

    res.json({ success: true, message: 'RFID tag enabled successfully.', data: { tag: { rfidTag: tag.rfidTag, status: tag.status } } });
  } catch (err) { next(err); }
});

// DELETE /api/rfid/inventory/:rfidTag - Delete an RFID tag from inventory (only non-assigned)
router.delete('/inventory/:rfidTag', protect, restrictTo('main_admin'), async (req, res, next) => {
  try {
    const { rfidTag } = req.params;

    if (!isValidRfidTag(rfidTag)) {
      return res.status(400).json({ success: false, message: 'RFID tag identifier format is invalid.' });
    }

    const normalizedTag = normalizeRfidTag(rfidTag);
    const tag = await RfidTag.findOne({ rfidTag: normalizedTag });
    if (!tag) return res.status(404).json({ success: false, message: 'RFID tag not found in inventory.' });

    if (tag.status === 'ASSIGNED') {
      return res.status(409).json({ success: false, message: 'Cannot delete an assigned RFID. Please unassign first.' });
    }

    await tag.deleteOne();

    res.json({ success: true, message: 'RFID tag deleted from inventory.' });
  } catch (err) { next(err); }
});

// ─── NEW ARCHITECTURE ENDPOINTS ───────────────────────────────────────────────

// GET /api/rfid/assignments - List assignments with filter & pagination
router.get('/assignments', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.eventId) {
      if (!(await userHasEventAccess(req.user, req.query.eventId))) {
        return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
      }
      filter.event = req.query.eventId;
    } else if (req.user.role !== 'main_admin') {
      // Non-main admin must specify or be scoped to their assigned events
      filter.event = { $in: req.user.assignedEvents || [] };
    }

    if (req.query.status) {
      filter.status = req.query.status.toUpperCase();
    }

    if (req.query.search) {
      filter.rfidIdentifierSnapshot = { $regex: normalizeRfidTag(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // Query new RfidAssignment model
    const [newAssignments, newTotal] = await Promise.all([
      RfidAssignment.find(filter)
        .sort({ assignedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('event', 'name')
        .populate('attendee', 'fullName email phone categoryName')
        .populate('ticket', 'ticketNumber categoryName')
        .populate('assignedBy', 'name email')
        .populate('releasedBy', 'name email')
        .populate('rfidTagId', 'vendor technology tagType status')
        .lean(),
      RfidAssignment.countDocuments(filter),
    ]);

    // Also query deprecated RfidTag records for backward compatibility
    const legacyFilter = {};
    if (req.query.eventId) legacyFilter.event = req.query.eventId;
    if (req.query.status) {
      // Map status to RfidTag status enum
      legacyFilter.status = req.query.status.toUpperCase();
    } else {
      // Only show assigned tags from legacy data
      legacyFilter.status = 'ASSIGNED';
    }
    if (req.query.search) {
      legacyFilter.rfidTag = { $regex: normalizeRfidTag(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }
    // Only show tags that have deprecated assignment fields populated
    legacyFilter.attendee = { $exists: true, $ne: null };

    const legacyTags = await RfidTag.find(legacyFilter)
      .sort({ assignedAt: -1 })
      .populate('event', 'name')
      .populate('attendee', 'fullName email phone categoryName')
      .populate('ticket', 'ticketNumber categoryName')
      .populate('assignedBy', 'name email')
      .lean();

    // Convert legacy RfidTag records to RfidAssignment format
    const legacyAssignments = legacyTags.map((tag) => ({
      _id: tag._id,
      rfidTagId: { _id: tag._id, vendor: tag.vendor, technology: tag.technology, tagType: tag.tagType, status: tag.status },
      rfidIdentifierSnapshot: tag.rfidTag,
      event: tag.event,
      attendee: tag.attendee,
      ticket: tag.ticket,
      categoryId: tag.categoryId,
      status: tag.status === 'ASSIGNED' ? 'ACTIVE' : 'RELEASED',
      assignedAt: tag.assignedAt,
      assignedBy: tag.assignedBy,
      releasedAt: null,
      releasedBy: null,
      releaseReason: null,
      notes: 'Legacy assignment (deprecated RfidTag fields)',
      isLegacy: true,
    }));

    // Merge new and legacy assignments, remove duplicates by rfidTag
    const seenRfidTags = new Set();
    const mergedAssignments = [];

    // Add new assignments first
    for (const assignment of newAssignments) {
      const rfidId = assignment.rfidTagId?._id?.toString() || assignment.rfidIdentifierSnapshot;
      if (!seenRfidTags.has(rfidId)) {
        seenRfidTags.add(rfidId);
        mergedAssignments.push(assignment);
      }
    }

    // Add legacy assignments that aren't already in new assignments
    for (const legacy of legacyAssignments) {
      const rfidId = legacy.rfidTagId?._id?.toString() || legacy.rfidIdentifierSnapshot;
      if (!seenRfidTags.has(rfidId)) {
        seenRfidTags.add(rfidId);
        mergedAssignments.push(legacy);
      }
    }

    // Sort by assignedAt (newest first)
    mergedAssignments.sort((a, b) => {
      const dateA = a.assignedAt ? new Date(a.assignedAt).getTime() : 0;
      const dateB = b.assignedAt ? new Date(b.assignedAt).getTime() : 0;
      return dateB - dateA;
    });

    // Apply pagination to merged results
    const total = newTotal + legacyTags.length;
    const paginatedAssignments = mergedAssignments.slice(skip, skip + limit);

    res.json({
      success: true,
      data: {
        assignments: paginatedAssignments,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (err) { next(err); }
});

// GET /api/rfid/access-logs - List access logs with filter & pagination
router.get('/access-logs', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.eventId) {
      if (!(await userHasEventAccess(req.user, req.query.eventId))) {
        return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
      }
      filter.event = req.query.eventId;
    } else if (req.user.role !== 'main_admin') {
      filter.event = { $in: req.user.assignedEvents || [] };
    }

    if (req.query.result) {
      filter.result = req.query.result.toUpperCase();
    }
    if (req.query.gateId) filter.gateId = req.query.gateId;
    if (req.query.zoneId) filter.zoneId = req.query.zoneId;
    if (req.query.search) {
      filter.rfidIdentifierSnapshot = { $regex: normalizeRfidTag(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    // Query actual RfidAccessLog records (gate scans)
    const [scanLogs, scanTotal] = await Promise.all([
      RfidAccessLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('event', 'name')
        .populate('attendee', 'fullName email categoryName')
        .populate('performedBy', 'name email')
        .lean(),
      RfidAccessLog.countDocuments(filter),
    ]);

    // Also include assignment events as "access logs" for backward compatibility
    const assignmentFilter = {};
    if (req.query.eventId) assignmentFilter.event = req.query.eventId;
    if (req.query.search) {
      assignmentFilter.rfidIdentifierSnapshot = { $regex: normalizeRfidTag(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const assignments = await RfidAssignment.find(assignmentFilter)
      .sort({ assignedAt: -1 })
      .populate('event', 'name')
      .populate('attendee', 'fullName email categoryName')
      .populate('assignedBy', 'name email')
      .populate('releasedBy', 'name email')
      .lean();

    // Convert assignments to log format
    const assignmentLogs = [];
    for (const assignment of assignments) {
      // Add assignment event
      assignmentLogs.push({
        _id: `assign-${assignment._id}`,
        timestamp: assignment.assignedAt,
        rfidIdentifierSnapshot: assignment.rfidIdentifierSnapshot,
        result: 'GRANTED',
        attendee: assignment.attendee,
        event: assignment.event,
        gateName: 'Assignment',
        zoneName: 'System',
        performedBy: assignment.assignedBy,
        denialReason: null,
        logType: 'ASSIGNMENT',
      });

      // Add release event if applicable
      if (assignment.status === 'RELEASED' && assignment.releasedAt) {
        assignmentLogs.push({
          _id: `release-${assignment._id}`,
          timestamp: assignment.releasedAt,
          rfidIdentifierSnapshot: assignment.rfidIdentifierSnapshot,
          result: 'GRANTED',
          attendee: assignment.attendee,
          event: assignment.event,
          gateName: 'Unassignment',
          zoneName: 'System',
          performedBy: assignment.releasedBy,
          denialReason: assignment.releaseReason || 'Released',
          logType: 'UNASSIGNMENT',
        });
      }
    }

    // Also include legacy RfidTag assignments
    const legacyFilter = {};
    if (req.query.eventId) legacyFilter.event = req.query.eventId;
    if (req.query.search) {
      legacyFilter.rfidTag = { $regex: normalizeRfidTag(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }
    legacyFilter.attendee = { $exists: true, $ne: null };

    const legacyTags = await RfidTag.find(legacyFilter)
      .sort({ assignedAt: -1 })
      .populate('event', 'name')
      .populate('attendee', 'fullName email categoryName')
      .populate('assignedBy', 'name email')
      .lean();

    for (const tag of legacyTags) {
      assignmentLogs.push({
        _id: `legacy-assign-${tag._id}`,
        timestamp: tag.assignedAt,
        rfidIdentifierSnapshot: tag.rfidTag,
        result: 'GRANTED',
        attendee: tag.attendee,
        event: tag.event,
        gateName: 'Assignment (Legacy)',
        zoneName: 'System',
        performedBy: tag.assignedBy,
        denialReason: null,
        logType: 'LEGACY_ASSIGNMENT',
      });
    }

    // Merge scan logs and assignment logs
    const allLogs = [...scanLogs, ...assignmentLogs];

    // Sort by timestamp (newest first)
    allLogs.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return dateB - dateA;
    });

    // Apply pagination to merged results
    const total = scanTotal + assignmentLogs.length;
    const paginatedLogs = allLogs.slice(skip, skip + limit);

    res.json({
      success: true,
      data: {
        logs: paginatedLogs,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (err) { next(err); }
});

// GET /api/rfid/tags/:rfidTag/history - Complete lifecycle and assignment history of a physical tag
router.get('/tags/:rfidTag/history', protect, restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const normalized = normalizeRfidTag(req.params.rfidTag);
    const tag = await RfidTag.findOne({ rfidTag: normalized }).lean();
    if (!tag) {
      return res.status(404).json({ success: false, message: 'RFID tag not found in inventory.' });
    }

    const [assignments, accessLogs] = await Promise.all([
      RfidAssignment.find({ rfidTagId: tag._id })
        .sort({ assignedAt: -1 })
        .populate('event', 'name startDate endDate')
        .populate('attendee', 'fullName email categoryName')
        .populate('assignedBy', 'name email')
        .populate('releasedBy', 'name email')
        .lean(),
      RfidAccessLog.find({ rfidTagId: tag._id })
        .sort({ timestamp: -1 })
        .limit(50)
        .populate('event', 'name')
        .populate('performedBy', 'name email')
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        tag,
        assignments,
        accessLogs,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/rfid/events/:eventId/overview - Event-specific RFID statistics
router.get('/events/:eventId/overview', protect, restrictTo(...operationalRoles), async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!(await userHasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const [activeCount, releasedCount, totalScans, grantedScans, deniedScans] = await Promise.all([
      RfidAssignment.countDocuments({ event: eventId, status: 'ACTIVE' }),
      RfidAssignment.countDocuments({ event: eventId, status: 'RELEASED' }),
      RfidAccessLog.countDocuments({ event: eventId }),
      RfidAccessLog.countDocuments({ event: eventId, result: 'GRANTED' }),
      RfidAccessLog.countDocuments({ event: eventId, result: 'DENIED' }),
    ]);

    res.json({
      success: true,
      data: {
        assignments: {
          active: activeCount,
          released: releasedCount,
          total: activeCount + releasedCount,
        },
        scans: {
          total: totalScans,
          granted: grantedScans,
          denied: deniedScans,
        },
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;