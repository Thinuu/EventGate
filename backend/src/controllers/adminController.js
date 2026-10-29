const mongoose = require('mongoose');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Attendee = require('../models/Attendee');
const User = require('../models/User');
const { normalizeRole } = require('../utils/rbac');
const crypto = require('crypto');
const notificationService = require('../services/notificationService');

const getStats = async (req, res, next) => {
  try {
    const [totalEvents, totalAttendees, revenueRows, totalUsers, revenuePerOrganiser] = await Promise.all([
      Event.countDocuments(),
      Attendee.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: 'success' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
      ]),
      User.countDocuments({ status: 'Active' }),
      Event.aggregate([
        { $match: { revenue: { $gt: 0 } } },
        { $group: { _id: '$mainOrganiser', totalRevenue: { $sum: '$revenue' } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'organiser' } },
        { $unwind: { path: '$organiser', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, name: { $ifNull: ['$organiser.name', 'Unknown'] }, totalRevenue: 1 } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalEvents,
        totalAttendees,
        totalRevenue: revenueRows[0]?.totalRevenue || 0,
        totalUsers,
        revenuePerOrganiser
      },
    });
  } catch (err) { next(err); }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const [totalEvents, totalAttendees, revenueRows, usersByRole, revenuePerEvent, ticketsByEvent, totalOrders] = await Promise.all([
      Event.countDocuments(),
      Attendee.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: 'success' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
      ]),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Revenue per event from Orders
      Order.aggregate([
        { $match: { paymentStatus: 'success' } },
        { $group: { _id: '$eventId', totalRevenue: { $sum: '$totalAmount' } } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'events',
            localField: '_id',
            foreignField: '_id',
            as: 'event'
          }
        },
        { $unwind: '$event' },
        { $project: { _id: 0, eventId: '$_id', name: '$event.name', revenue: '$totalRevenue' } }
      ]),
      // Tickets by event
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
        { $unwind: '$event' },
        { $project: { _id: 0, eventId: '$_id', name: '$event.name', ticketsSold: 1 } }
      ]),
      // Total orders count
      Order.countDocuments({ paymentStatus: 'success' })
    ]);

    res.json({
      success: true,
      data: {
        totalEvents,
        totalAttendees,
        totalRevenue: revenueRows[0]?.totalRevenue || 0,
        usersByRole,
        revenuePerEvent,
        ticketsByEvent,
        totalOrders
      },
    });
  } catch (err) { next(err); }
};

const listEvents = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: 'i' };
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [events, total] = await Promise.all([
      Event.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
      Event.countDocuments(filter),
    ]);
    res.json({ success: true, data: { events, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

const createEvent = async (req, res, next) => {
  try {
    const event = await Event.create(req.body);
    res.status(201).json({ success: true, data: { event } });
  } catch (err) { next(err); }
};

const getEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: `Event not found. (ID: ${req.params.id})` });
    res.json({ success: true, data: { event } });
  } catch (err) { next(err); }
};

const updateEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ success: false, message: `Event not found. (ID: ${req.params.id})` });
    res.json({ success: true, data: { event } });
  } catch (err) { next(err); }
};

const deleteEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, message: 'Event deleted.' });
  } catch (err) { next(err); }
};

const listUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role) filter.role = normalizeRole(role);
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [users, total] = await Promise.all([
      User.find(filter).select('-password').populate('assignedEvents', 'name').skip(skip).limit(parseInt(limit, 10)).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, data: { users, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

const createUser = async (req, res, next) => {
  try {
    const payload = { ...req.body, role: normalizeRole(req.body.role) };
    
    let tempPassword = payload.password;
    if (!tempPassword) {
      tempPassword = crypto.randomBytes(8).toString('hex');
      payload.password = tempPassword;
    }
    
    payload.isTempPassword = true;
    payload.isVerified = true;

    // Enforce phone/email if assigned events require SMS/Email
    if (payload.assignedEvents && Array.isArray(payload.assignedEvents) && payload.assignedEvents.length > 0) {
      const events = await Event.find({ _id: { $in: payload.assignedEvents } }).lean();
      const smsRequired = events.some(e => e.settings?.communicationChannels?.sms === true);
      const emailRequired = events.some(e => e.settings?.communicationChannels?.email === true);
      if (smsRequired && (!payload.phone || String(payload.phone).trim() === '')) {
        return res.status(400).json({ success: false, message: 'Phone number is required for users assigned to these events.' });
      }
      if (emailRequired && (!payload.email || String(payload.email).trim() === '')) {
        return res.status(400).json({ success: false, message: 'Email is required for users assigned to these events.' });
      }
    }

    const user = await User.create(payload);

    await notificationService.notifyUserCredentials(user, tempPassword);

    res.status(201).json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

const updateUser = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }
    const payload = { ...req.body };
    if (payload.role) payload.role = normalizeRole(payload.role);
    if (payload.password && String(payload.password).trim() !== '') {
      payload.password = await bcrypt.hash(payload.password, 12);
    } else {
      delete payload.password;
    }
    const user = await User.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }).select('-password').populate('assignedEvents', 'name');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Notify if critical permissions changed
    if (req.body.role || req.body.assignedEvent || req.body.assignedEvents) {
      await notificationService.notifyRoleAssignment(user, user.role, user.assignedEvents);
    }

    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

const duplicateEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    const { newName, newStartDate, newEndDate, status = 'draft' } = req.body;
    
    if (!newName || !newStartDate || !newEndDate) {
      return res.status(400).json({ success: false, message: 'New name, start date, and end date are required.' });
    }

    const sourceEvent = await Event.findById(req.params.id).lean();
    if (!sourceEvent) return res.status(404).json({ success: false, message: 'Event not found.' });

    delete sourceEvent._id;
    delete sourceEvent.slug;
    delete sourceEvent.revenue;
    delete sourceEvent.publishedAt;
    delete sourceEvent.createdAt;
    delete sourceEvent.updatedAt;
    delete sourceEvent.__v;
    
    sourceEvent.mainOrganiser = null;
    sourceEvent.subOrganisers = [];
    sourceEvent.staff = [];
    sourceEvent.volunteers = [];
    sourceEvent.auditors = [];

    if (sourceEvent.categories) {
      sourceEvent.categories.forEach(cat => {
        cat.sold = 0;
        cat.usageCount = 0;
      });
    }

    sourceEvent.name = newName;
    sourceEvent.startDate = newStartDate;
    sourceEvent.endDate = newEndDate;
    sourceEvent.status = status;

    const newEvent = await Event.create(sourceEvent);

    res.status(201).json({ success: true, data: { event: newEvent }, message: 'Event duplicated successfully.' });
  } catch (err) { next(err); }
};

module.exports = {
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
};
