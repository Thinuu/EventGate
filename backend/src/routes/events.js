const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const SystemConfig = require('../models/SystemConfig');
const { protect, restrictTo, requireEventAccess } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { logActivity } = require('../utils/logger');
const { uploadBuffer } = require('../services/azureBlobService');

// Helper to validate ObjectId
const isValidObjectId = (id) => {
  if (!id) return false;
  if (typeof id === 'object' && id._id) return mongoose.Types.ObjectId.isValid(id._id);
  if (typeof id === 'object' && id.toString) {
    try {
      return mongoose.Types.ObjectId.isValid(id.toString());
    } catch {
      return false;
    }
  }
  return mongoose.Types.ObjectId.isValid(id);
};

// Use memory storage for event images (files will be uploaded to Azure Blob Storage)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize:
      parseInt(process.env.EVENT_COVER_MAX_FILE_SIZE, 10) ||
      parseInt(process.env.MAX_FILE_SIZE, 10) ||
      3 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only JPG, JPEG, PNG, WEBP, or GIF images are allowed.'));
    }
    cb(null, true);
  },
});

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!['{', '[', '"'].includes(trimmed[0])) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const normalizeEventPayload = (body, file, files) => {
  const payload = { ...body };

  ['venue', 'categories', 'zones', 'settings', 'customFields'].forEach((key) => {
    if (key in payload) {
      payload[key] = parseMaybeJson(payload[key]);
    }
  });

  if (body.customEventType) {
    payload.customEventType = body.customEventType;
  }

  if (payload.settings) {
    if (payload.settings.emailTemplates === undefined || payload.settings.emailTemplates === null) {
      delete payload.settings.emailTemplates;
    }
    if (payload.settings.smsTemplates === undefined || payload.settings.smsTemplates === null) {
      delete payload.settings.smsTemplates;
    }
  }

  if (payload.organiserIds) {
    payload.mainOrganisers = Array.isArray(payload.organiserIds) ? payload.organiserIds : [payload.organiserIds];
    delete payload.organiserIds;
  }

  if (payload.mainOrganisers) {
    payload.mainOrganisers = payload.mainOrganisers
      .map(id => (typeof id === 'object' ? (id._id || id.id || id) : id))
      .filter(id => id && id !== '' && id !== 'null' && id !== 'undefined' && mongoose.Types.ObjectId.isValid(id))
      .slice(0, 2);
  }

  // Image handling is performed in the route using Azure Blob Storage.

  // Sync old structure to new eventDetails structure for consistency
  // This ensures that when the form updates matchDetails, concertDetails, etc.,
  // the corresponding eventDetails fields are also updated


  // Also sync from new structure to old structure when eventDetails is provided
  // This handles the case when the frontend sends eventDetails directly


  return payload;
};

// GET /api/events/config/public - public system config
router.get('/config/public', async (req, res, next) => {
  try {
    const config = await SystemConfig.findOne({ key: 'global' });
    res.json({
      success: true,
      data: {
        currency: config?.regional?.defaultCurrency || config?.payment?.defaultCurrency || 'LKR',
        maintenanceMode: config?.general?.systemStatus === 'Maintenance',
        platformName: config?.general?.platformName || 'EventGate',
        systemStatus: config?.general?.systemStatus || 'Active',
      },
    });
  } catch (err) { next(err); }
});

// GET /api/events - public listing (no auth needed)
router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 12, search, date, category } = req.query;
    
    const filter = {
      status: status ? status : { $in: ['published', 'ongoing'] },
      endDate: { $gte: new Date() } // Filter out overdue events
    };

    console.log('[PUBLIC_LISTING] Querying events with filter:', JSON.stringify(filter));

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { customEventType: { $regex: search, $options: 'i' } },
        { 'venue.name': { $regex: search, $options: 'i' } }
      ];
    }

    if (date) {
      filter.startDate = { $gte: new Date(date) };
    }

    if (category) {
      filter.eventType = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [events, total] = await Promise.all([
      Event.find(filter)
        .select('name slug description venue startDate eventType customEventType categories coverImage bannerImage branding settings currency')
        .sort('startDate')
        .skip(skip)
        .limit(parseInt(limit)),
      Event.countDocuments(filter),
    ]);
    console.log(`[PUBLIC_LISTING] Found ${total} events matching criteria.`);
    res.json({ success: true, data: { events, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/events/admin/all - admin sees all events
router.get('/admin/all', protect, restrictTo('main_admin'), async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, search, from, to } = req.query;
    const filter = status ? { status } : {};
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    if (from || to) {
      const dateFilter = {};
      if (from) {
        const fromDate = new Date(from);
        if (!Number.isNaN(fromDate.getTime())) dateFilter.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!Number.isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          dateFilter.$lte = toDate;
        }
      }
      if (Object.keys(dateFilter).length) {
        filter.startDate = dateFilter;
      }
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [events, total] = await Promise.all([
      Event.find(filter)      .populate('mainOrganisers', 'name email').sort('-createdAt').skip(skip).limit(parseInt(limit)),
      Event.countDocuments(filter),
    ]);
    const Attendee = require('../models/Attendee');
    const eventIds = events.map((event) => event._id);
    const attendeeCounts = await Attendee.aggregate([
      { $match: { event: { $in: eventIds } } },
      { $group: { _id: '$event', count: { $sum: 1 } } },
    ]);
    const countMap = attendeeCounts.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});
    const eventsWithCounts = events.map((event) => ({
      ...event.toObject(),
      totalAttendees: countMap[event._id.toString()] || 0,
      ticketCategoryCount: event.categories?.length || 0,
    }));
    res.json({ success: true, data: { events: eventsWithCounts, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/events/my/events - organiser's assigned events, with admins seeing the full list
router.get('/my/events', protect, async (req, res, next) => {
  try {
    // Normalize role to match the canonical values defined in the User model.
    const rawRole = String(req.user?.role || '');
    const normalized = rawRole
      .trim()
      .toUpperCase()
      .replace(/_/g, ''); // remove underscores for matching

    // Map normalized roles to the keys used in RBAC checks.
    const roleMap = {
      MAINADMIN: 'main_admin',
      SUPERADMIN: 'super_admin',
      ADMIN: 'admin',
      MAINORGANISER: 'main_organiser',
      SUBORGANISER: 'sub_organiser',
      STAFF: 'staff',
      VOLUNTEER: 'volunteer',
      AUDITOR: 'auditor',
    };
    const role = roleMap[normalized] || normalized.toLowerCase();

    if (role === 'main_admin' || role === 'super_admin' || role === 'admin') {
      const events = await Event.find()
        .populate('mainOrganisers', 'name email')
        .sort('-startDate');
      return res.json({ success: true, data: { events } });
    }

    if (!['main_organiser', 'sub_organiser', 'staff', 'volunteer', 'auditor'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to event list.' });
    }

    const assignedEventIds = (req.user.assignedEvents || [])
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    const events = await Event.find({
      $or: [
        { _id: { $in: assignedEventIds } },
        { createdBy: req.user._id },
        { mainOrganisers: req.user._id },
      ],
    })
      .populate('mainOrganisers', 'name email')
      .sort('-startDate');

    res.json({ success: true, data: { events } });
  } catch (err) { next(err); }
});

// GET /api/events/manage/:eventId - load event for editing
router.get('/manage/:eventId', protect, requireEventAccess, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId)
            .populate('mainOrganisers', 'name email')
      .populate('subOrganisers', 'name email');

    if (!event) {
      return res.status(404).json({ success: false, message: `Event not found. (ID: ${req.params.eventId})` });
    }

    res.json({ success: true, data: { event } });
  } catch (err) {
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }
    next(err);
  }
});

// POST /api/events - create event (admin and organiser)
router.post('/', protect, restrictTo('main_admin', 'main_organiser'), upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'logoImage', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 }
]), [
  body('name').notEmpty().withMessage('Event name required'),
  body('venue.name').notEmpty().withMessage('Venue name required'),
  body('startDate').isISO8601().withMessage('Valid start date required'),
  body('endDate').isISO8601().withMessage('Valid end date required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const eventData = normalizeEventPayload(req.body, req.file, req.files);
    eventData.createdBy = req.user._id;

    // Security: Organisers cannot enable SMS on creation
    if (req.user.role !== 'main_admin' && eventData.settings?.communicationChannels) {
      console.log('[POST] Disabling unauthorised SMS channel in new event by organiser.');
      eventData.settings.communicationChannels.sms = false;
    }

    const event = await Event.create(eventData);
    await logActivity({
      req,
      action: 'event_update',
      eventId: event._id,
      details: { message: `Created event: ${event.name}` }
    });
    
    // Auto-assign to creator (admin)
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { assignedEvents: event._id } });
    
    // Auto-assign to main organisers if provided
    if (eventData.mainOrganisers && eventData.mainOrganisers.length > 0) {
      if (req.user.role !== 'main_admin') {
        const otherOrgs = eventData.mainOrganisers.filter(id => id.toString() !== req.user._id.toString());
        if (otherOrgs.length > 0) {
          return res.status(403).json({ success: false, message: 'You can only assign yourself as the organiser.' });
        }
      }
      await User.updateMany(
        { _id: { $in: eventData.mainOrganisers } },
        { $addToSet: { assignedEvents: event._id } }
      );
    }
    
    res.status(201).json({ success: true, data: { event } });
  } catch (err) { 
    console.error('EVENT_POST_ERROR:', err.message);
    next(err); 
  }
});

// PATCH /api/events/:eventId/assign-organiser
router.patch('/:eventId/assign-organiser', protect, restrictTo('main_admin'), async (req, res, next) => {
  try {
    const rawIds = req.body.organiserIds || req.body.organiserId;
    if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }
    
    const ids = (Array.isArray(rawIds) ? rawIds : (rawIds ? [rawIds] : []))
      .filter(id => id && id !== '' && id !== 'null' && id !== 'undefined');

    if (ids.length > 2) return res.status(400).json({ success: false, message: 'Maximum 2 organisers allowed.' });

    // Validate each ID is a valid ObjectId format
    for (const id of ids) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: `Invalid organiser ID format: ${id}` });
      }
    }

    const User = require('../models/User');
    const existingEvent = await Event.findById(req.params.eventId);
    if (!existingEvent) return res.status(404).json({ success: false, message: 'Event not found.' });

    const oldIds = existingEvent.mainOrganisers || [];
    
    const [event] = await Promise.all([
      Event.findByIdAndUpdate(req.params.eventId, { mainOrganisers: ids }, { new: true }),
      User.updateMany({ _id: { $in: oldIds } }, { $pull: { assignedEvents: req.params.eventId } }),
      User.updateMany({ _id: { $in: ids } }, { $addToSet: { assignedEvents: req.params.eventId } }),
    ]);
    
    res.json({ success: true, data: { event } });
  } catch (err) { next(err); }
});

// PATCH /api/events/:eventId/publish
router.patch('/:eventId/publish', protect, restrictTo('main_admin'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }
    const event = await Event.findByIdAndUpdate(
      req.params.eventId,
      { status: 'published', publishedAt: new Date() },
      { new: true }
    );
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, data: { event } });
  } catch (err) { next(err); }
});

// GET /api/events/:eventId/dashboard - organiser dashboard data
router.get('/:eventId/dashboard', protect, requireEventAccess, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }
    const Attendee = require('../models/Attendee');
    const Order = require('../models/Order');
    const EntryLog = require('../models/EntryLog');

    const [event, attendeeStats, orderStats, recentLogs] = await Promise.all([
      Event.findById(eventId)
        .select('name slug description venue startDate endDate eventType customEventType categories coverImage bannerImage branding settings currency')
        .populate('mainOrganisers', 'name email')
        .populate('subOrganisers', 'name email'),
      Attendee.aggregate([
        { $match: { event: new mongoose.Types.ObjectId(eventId) } },
        { $group: { _id: '$confirmationStatus', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { event: new mongoose.Types.ObjectId(eventId) } },
        { $group: { _id: '$paymentStatus', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      ]),
      EntryLog.find({ event: eventId }).sort('-timestamp').limit(20).populate('attendee', 'fullName categoryName'),
    ]);

    if (!event) {
      console.warn('[DASHBOARD] Event not found:', eventId);
      return res.status(404).json({ success: false, message: `Event not found. (ID: ${eventId})` });
    }
    res.json({ success: true, data: { event, attendeeStats, orderStats, recentLogs } });
  } catch (err) { next(err); }
});

// PATCH /api/events/:eventId - update event
router.patch('/:eventId', protect, upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'logoImage', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 }
]), restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { eventId } = req.params;
    
    console.log('[PATCH /events/:eventId]', { 
      eventId, 
      eventIdType: typeof eventId,
      user: { id: req.user?._id, role: req.user?.role }
    });
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      console.error('[PATCH] ObjectId validation failed:', eventId);
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }
    
    // 1. Fetch event for access check AND current state
    const existingEvent = await Event.findById(eventId);
    if (!existingEvent) {
      console.warn('[PATCH] Event not found in DB:', eventId);
      return res.status(404).json({ success: false, message: `Event not found. (ID: ${eventId})` });
    }

    // 2. Check access for non-admin users
    if (req.user.role !== 'main_admin') {
      const isAssigned = req.user.assignedEvents?.some(e => e.toString() === eventId);
      const isCreator = existingEvent.createdBy?.toString() === req.user._id.toString();
      const isMainOrg = existingEvent.mainOrganisers?.some(id => id.toString() === req.user._id.toString());

      if (!isAssigned && !isCreator && !isMainOrg) {
        console.warn('[PATCH] Unauthorized access attempt:', { user: req.user._id, eventId });
        return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
      }
    }

    // 3. Process payload
    const updateData = normalizeEventPayload(req.body, req.file, req.files);

    // 4. Security: Restrict SMS channel control to admins
    if (req.user.role !== 'main_admin') {
      if (updateData.settings?.communicationChannels) {
        const currentSmsStatus = existingEvent.settings?.communicationChannels?.sms ?? false;
        if (updateData.settings.communicationChannels.sms !== undefined && updateData.settings.communicationChannels.sms !== currentSmsStatus) {
          console.log('[PATCH] Reverting unauthorised SMS channel change attempt by organiser.');
          updateData.settings.communicationChannels.sms = currentSmsStatus;
        }
      }
      
      // Also prevent changing the mainOrganisers field if already set
      if (updateData.mainOrganisers && updateData.mainOrganisers.length > 0) {
        const isOnlySelf = updateData.mainOrganisers.every(id => id.toString() === req.user._id.toString());
        if (!isOnlySelf) {
          return res.status(403).json({ success: false, message: 'You can only assign yourself as the organiser.' });
        }
      }
    }

    // 5. Admin-only feature controls and audit logging
    const adminOnlyFeaturePaths = [
      'communicationChannels.email',
      'communicationChannels.sms',
      'requirePhotoVerification',
      'rfidEnabled',
      'mfaEnforced'
    ];

    const getNested = (obj, path) => {
      if (!obj) return undefined;
      return path.split('.').reduce((acc, p) => (acc && Object.prototype.hasOwnProperty.call(acc, p) ? acc[p] : undefined), obj);
    };

    const setNested = (obj, path, value) => {
      const parts = path.split('.');
      let cur = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (!cur[p]) cur[p] = {};
        cur = cur[p];
      }
      cur[parts[parts.length - 1]] = value;
    };

    // Ensure settings object exists
    updateData.settings = updateData.settings || {};

    for (const path of adminOnlyFeaturePaths) {
      const incoming = getNested(updateData.settings, path);
      const existing = getNested(existingEvent.settings, path);
      if (incoming === undefined) continue;

      if (req.user.role !== 'main_admin') {
        // Non-admin cannot change these
        if (incoming !== existing) {
          setNested(updateData.settings, path, existing);
          console.log('[PATCH] Reverted non-admin change to admin-only feature:', path);
        }
      } else {
        // Admin changed a feature: log the change
        if (incoming !== existing) {
          await logActivity({
            req,
            action: 'feature_toggle',
            eventId,
            details: { setting: path, oldValue: existing, newValue: incoming }
          });
        }
      }
    }

    // Log any other settings changes by admin for audit purposes
    if (req.user.role === 'main_admin' && updateData.settings) {
      const incomingSettings = updateData.settings;
      Object.keys(incomingSettings).forEach((key) => {
        const oldVal = existingEvent.settings ? existingEvent.settings[key] : undefined;
        const newVal = incomingSettings[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          // Non-blocking log (don't await multiple logs in loop)
          logActivity({ req, action: 'settings_change', eventId, details: { setting: `settings.${key}`, oldValue: oldVal, newValue: newVal } }).catch(err => console.error('LOG_ACTIVITY_ERROR:', err));
        }
      });
    }

    console.log('[PATCH] Update data being saved:', JSON.stringify({
      // event detail fields removed
    }));

    const event = await Event.findByIdAndUpdate(eventId, updateData, {
      new: true, runValidators: true,
    });

    console.log('[PATCH] Event saved successfully.');

    await logActivity({
      req,
      action: 'event_update',
      eventId: event._id,
      details: { message: `Updated event: ${event.name}` }
    });

    if (req.user.role === 'main_admin' && Object.prototype.hasOwnProperty.call(updateData, 'mainOrganisers')) {
      const User = require('../models/User');
      const oldOrganiserIds = existingEvent.mainOrganisers || [];
      const newOrganiserIds = updateData.mainOrganisers || [];

      // Find organisers to remove
      const toRemove = oldOrganiserIds.filter(id => !newOrganiserIds.some(nid => nid.toString() === id.toString()));
      // Find organisers to add
      const toAdd = newOrganiserIds.filter(id => !oldOrganiserIds.some(oid => oid.toString() === id.toString()));

      if (toRemove.length > 0) {
        await User.updateMany({ _id: { $in: toRemove } }, { $pull: { assignedEvents: event._id } });
      }
      if (toAdd.length > 0) {
        await User.updateMany({ _id: { $in: toAdd } }, { $addToSet: { assignedEvents: event._id } });
      }
    }

    console.log('[PATCH] Event updated successfully:', event._id);
    const io = req.app.get('io');
    if (io) {
      io.to(`event:${event._id}`).emit('event_update', { eventId: event._id });
      io.to(`dashboard:${event._id}`).emit('event_update', { eventId: event._id });
    }

    res.json({ success: true, data: { event } });
  } catch (err) {
    console.error('[PATCH] Error:', err.message);
    next(err);
  }
});

// DELETE /api/events/:eventId - delete event (admin only)
router.delete('/:eventId', protect, restrictTo('main_admin'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }
    const event = await Event.findByIdAndDelete(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    // Also remove from assignedEvents in all users
    const User = require('../models/User');
    await User.updateMany({}, { $pull: { assignedEvents: req.params.eventId } });
    res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (err) { next(err); }
});

// GET /api/events/:slug - public detail (no auth needed) - MUST BE LAST!
router.get('/:slug', async (req, res, next) => {
  try {
    const event = await Event.findOne({
      $or: [
        { slug: req.params.slug },
        { _id: req.params.slug.match(/^[a-f\d]{24}$/i) ? req.params.slug : null }
      ],
    }).populate('mainOrganisers', 'name email');

    if (!event) {
      console.warn('[PUBLIC_EVENT] Event not found for slug/id:', req.params.slug);
      return res.status(404).json({ success: false, message: `Event not found. (Slug/ID: ${req.params.slug})` });
    }

    if (event.status === 'draft') {
      console.warn('[PUBLIC_EVENT] Attempted to access draft event:', event._id);
      return res.status(404).json({ success: false, message: 'This event is not yet available to the public.' });
    }

    const isExpired = event.endDate && new Date(event.endDate) < new Date();
    res.json({ success: true, data: { event, isExpired } });
  } catch (err) { next(err); }
});

// POST /api/events/:slug/validate-code
router.post('/:slug/validate-code', async (req, res, next) => {
  try {
    const { categoryId, accessCode } = req.body;
    if (!categoryId || !accessCode) {
      return res.status(400).json({ success: false, message: 'Category ID and Access Code are required.' });
    }

    const event = await Event.findOne({
      $or: [{ slug: req.params.slug }, { _id: req.params.slug.match(/^[a-f\d]{24}$/i) ? req.params.slug : null }],
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const category = event.categories.find(c => String(c.id) === String(categoryId));
    if (!category) {
      return res.status(404).json({ success: false, message: 'Ticket category not found.' });
    }

    if (!category.isPrivate || !category.accessCodeHash) {
      return res.status(400).json({ success: false, message: 'This ticket category is not private.' });
    }

    // Check usage limits (if applicable)
    if (category.maxUsage && category.usageCount >= category.maxUsage) {
      return res.status(403).json({ success: false, message: 'This access code has reached its maximum usage limit.' });
    }

    // Check overall capacity
    if (category.sold >= category.capacity) {
      return res.status(403).json({ success: false, message: 'This ticket category is sold out.' });
    }

    // Verify code
    const isMatch = await bcrypt.compare(accessCode, category.accessCodeHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid access code.' });
    }

    res.json({ 
      success: true, 
      message: 'Access code validated successfully.',
      data: {
        categoryId,
        unlocked: true
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
