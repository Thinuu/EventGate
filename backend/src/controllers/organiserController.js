const mongoose = require('mongoose');
const Event = require('../models/Event');
const Attendee = require('../models/Attendee');
const Order = require('../models/Order');
const EntryLog = require('../models/EntryLog');
const User = require('../models/User');
const { normalizeRole } = require('../utils/rbac');
const { notifySubOrganiserInvite, notifyInvite, createNotification } = require('../services/notificationService');

const resolveEventId = (user) => (user.assignedEvents && user.assignedEvents[0]);

const getOrganiserEvent = async (req, res, next) => {
  try {
    const eventId = resolveEventId(req.user);
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, data: { event } });
  } catch (err) { next(err); }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const eventId = resolveEventId(req.user);
    const [totalAttendees, confirmed, checkedIn, revenueRows] = await Promise.all([
      Attendee.countDocuments({ event: eventId }),
      Attendee.countDocuments({ event: eventId, isConfirmed: true }),
      EntryLog.countDocuments({ event: eventId, action: 'check_in', accessGranted: true }),
      Order.aggregate([
        { $match: { eventId: new mongoose.Types.ObjectId(eventId), status: { $ne: 'CANCELLED' } } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
      ]),
    ]);
    res.json({
      success: true,
      data: {
        totalAttendees,
        confirmed,
        checkedIn,
        revenue: revenueRows[0]?.totalRevenue || 0,
      },
    });
  } catch (err) { next(err); }
};

const getAttendees = async (req, res, next) => {
  try {
    const eventId = resolveEventId(req.user);
    const { search = '', status, category, photoStatus, page = 1, limit = 20 } = req.query;
    const filter = { event: eventId, isActive: true };
    if (status) filter.confirmationStatus = status;
    if (category) filter.categoryName = category;
    if (photoStatus) filter.photoVerificationStatus = photoStatus;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },+
        { nationalId: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [attendees, total] = await Promise.all([
      Attendee.find(filter).sort('-createdAt').skip(skip).limit(parseInt(limit, 10)),
      Attendee.countDocuments(filter),
    ]);
    res.json({ success: true, data: { attendees, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

const getEntryLogs = async (req, res, next) => {
  try {
    const eventId = resolveEventId(req.user);
    const { limit = 50, gate, zone, from, to, attendeeId } = req.query;
    const filter = { event: eventId };
    if (gate) filter.gateId = gate;
    if (zone) filter.zoneId = zone;
    if (attendeeId && mongoose.Types.ObjectId.isValid(attendeeId)) {
      filter.attendee = attendeeId;
    }
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }
    const logs = await EntryLog.find(filter)
      .populate('attendee', 'fullName categoryName')
      .populate('processedBy', 'name')
      .sort('-timestamp')
      .limit(parseInt(limit, 10));
    res.json({ success: true, data: { logs } });
  } catch (err) { next(err); }
};

const listSubOrganisers = async (req, res, next) => {
  try {
    const eventId = resolveEventId(req.user);
    const users = await User.find({ role: normalizeRole('SubOrganiser'), assignedEvents: eventId })
      .select('-password')
      .sort('-createdAt');
    res.json({ success: true, data: { users } });
  } catch (err) { next(err); }
};

const createSubOrganiser = async (req, res, next) => {
  try {
    const eventId = resolveEventId(req.user);
    const {
      canCollectCash,
      canConfirmCashPayments,
      canApproveBankTransfer,
      canViewPayments,
      canProcessRefunds,
      canManagePaymentMethods,
      canViewPaymentHistory,
      canHandlePaymentDisputes,
      canGeneratePaymentReports,
      canAddAttendees,
      canPhotoVerification,
      canSendInvitations,
      canExcelBulkImports,
      canGateScanAccess,
      canViewEvents,
      canEditEvents,
      canViewAttendees,
      canEditAttendees,
      canViewTickets,
      canEditTickets,
      canScanTickets,
      canViewZones,
      canManageZones,
      canViewReports,
      canExportReports,
      canViewRevenue,
      canSendNotifications,
      // New permission names from frontend
      canEntryAccess,
      canScanZones,
      canVerifyPhotos,
      canBulkUpload,
      canInviteAttendees,
      assignedGates,
      assignedCategories,
      ...rest
    } = req.body;

    // Map frontend permission names to backend names
    const permissions = {
      canCollectCash: canCollectCash || false,
      canConfirmCashPayments: canConfirmCashPayments || false,
      canApproveBankTransfer: canApproveBankTransfer || false,
      canViewPayments: canViewPayments || false,
      canProcessRefunds: canProcessRefunds || false,
      canManagePaymentMethods: canManagePaymentMethods || false,
      canViewPaymentHistory: canViewPaymentHistory || false,
      canHandlePaymentDisputes: canHandlePaymentDisputes || false,
      canGeneratePaymentReports: canGeneratePaymentReports || false,
      canAddAttendees: canAddAttendees || false,
      canPhotoVerification: canPhotoVerification || false,
      canSendInvitations: canSendInvitations || false,
      canExcelBulkImports: canExcelBulkImports || false,
      canGateScanAccess: canGateScanAccess || false,
      canViewEvents: canViewEvents || false,
      canEditEvents: canEditEvents || false,
      canViewAttendees: canViewAttendees || false,
      canEditAttendees: canEditAttendees || false,
      canViewTickets: canViewTickets || false,
      canEditTickets: canEditTickets || false,
      canScanTickets: canScanTickets || false,
      canViewZones: canViewZones || false,
      canManageZones: canManageZones || false,
      canViewReports: canViewReports || false,
      canExportReports: canExportReports || false,
      canViewRevenue: canViewRevenue || false,
      canSendNotifications: canSendNotifications || false,
      // Map new frontend names to backend names
      canEntryAccess: canEntryAccess || canGateScanAccess || false,
      canScanZones: canScanZones || false,
      canVerifyPhotos: canVerifyPhotos || canPhotoVerification || false,
      canBulkUpload: canBulkUpload || canExcelBulkImports || false,
      canInviteAttendees: canInviteAttendees || canSendInvitations || false,
    };

    // Also set individual permission fields for backward compatibility
    const permissionFields = {
      canCollectCash: canCollectCash || false,
      canConfirmCashPayments: canConfirmCashPayments || false,
      canApproveBankTransfer: canApproveBankTransfer || false,
      canViewPayments: canViewPayments || false,
      canProcessRefunds: canProcessRefunds || false,
      canManagePaymentMethods: canManagePaymentMethods || false,
      canViewPaymentHistory: canViewPaymentHistory || false,
      canHandlePaymentDisputes: canHandlePaymentDisputes || false,
      canGeneratePaymentReports: canGeneratePaymentReports || false,
      canAddAttendees: canAddAttendees || false,
      canPhotoVerification: canPhotoVerification || false,
      canSendInvitations: canSendInvitations || false,
      canExcelBulkImports: canExcelBulkImports || false,
      canGateScanAccess: canGateScanAccess || false,
      canViewEvents: canViewEvents || false,
      canEditEvents: canEditEvents || false,
      canViewAttendees: canViewAttendees || false,
      canEditAttendees: canEditAttendees || false,
      canViewTickets: canViewTickets || false,
      canEditTickets: canEditTickets || false,
      canScanTickets: canScanTickets || false,
      canViewZones: canViewZones || false,
      canManageZones: canManageZones || false,
      canViewReports: canViewReports || false,
      canExportReports: canExportReports || false,
      canViewRevenue: canViewRevenue || false,
      canSendNotifications: canSendNotifications || false,
      // New permission fields
      canEntryAccess: canEntryAccess || canGateScanAccess || false,
      canScanZones: canScanZones || false,
      canVerifyPhotos: canVerifyPhotos || canPhotoVerification || false,
      canBulkUpload: canBulkUpload || canExcelBulkImports || false,
      canInviteAttendees: canInviteAttendees || canSendInvitations || false,
    };

    const payload = {
      ...rest,
      role: normalizeRole('SubOrganiser'),
      assignedEvents: [eventId],
      status: 'Active',
      assignedGates: assignedGates || [],
      assignedZones: assignedZones || [],
      canCollectCash: canCollectCash || false,
      canConfirmCashPayments: canConfirmCashPayments || false,
      canApproveBankTransfer: canApproveBankTransfer || false,
      canViewPayments: canViewPayments || false,
      canProcessRefunds: canProcessRefunds || false,
      canManagePaymentMethods: canManagePaymentMethods || false,
      canViewPaymentHistory: canViewPaymentHistory || false,
      canHandlePaymentDisputes: canHandlePaymentDisputes || false,
      canGeneratePaymentReports: canGeneratePaymentReports || false,
      canAddAttendees: canAddAttendees || false,
      canPhotoVerification: canPhotoVerification || false,
      canSendInvitations: canSendInvitations || false,
      canExcelBulkImports: canExcelBulkImports || false,
      canGateScanAccess: canGateScanAccess || false,
      canViewEvents: canViewEvents || false,
      canEditEvents: canEditEvents || false,
      canViewAttendees: canViewAttendees || false,
      canEditAttendees: canEditAttendees || false,
      canViewTickets: canViewTickets || false,
      canEditTickets: canEditTickets || false,
      canScanTickets: canScanTickets || false,
      canViewZones: canViewZones || false,
      canManageZones: canManageZones || false,
      canViewReports: canViewReports || false,
      canExportReports: canExportReports || false,
      canViewRevenue: canViewRevenue || false,
      canSendNotifications: canSendNotifications || false,
      permissions,
    };
    const user = await User.create(payload);
    
    // Get the event to find the main organiser
    const event = await Event.findById(eventId).select('mainOrganisers name').lean();
    
    // Create notification for all main organisers
    if (event?.mainOrganisers?.length) {
      await Promise.all(event.mainOrganisers.map(orgId => 
        createNotification(
          orgId,
          'New Team Member Added',
          `${req.user.name} added ${user.name} as a Sub-Organiser for ${event.name}`,
          'info',
          { 
            eventId: eventId, 
            actionType: 'team_member_added',
            addedBy: req.user._id,
            newMemberId: user._id 
          }
        )
      ));
    }

    // Update Ticket Categories
    if (assignedCategories && Array.isArray(assignedCategories)) {
      const mongoose = require('mongoose');
      await mongoose.model('TicketCategory').updateMany(
        { eventId, _id: { $in: assignedCategories } },
        { $addToSet: { assignedSubOrganisers: user._id } }
      );
    }
    
    await notifySubOrganiserInvite({ user, event, phone: user.phone, email: user.email });
    res.status(201).json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

const updateSubOrganiserStatus = async (req, res, next) => {
  try {
    const eventId = resolveEventId(req.user);
    const { 
      status, 
      name, 
      email, 
      phone, 
      password, 
      canCollectCash, 
      canConfirmCashPayments,
      canApproveBankTransfer,
      canViewPayments,
      canProcessRefunds,
      canManagePaymentMethods,
      canViewPaymentHistory,
      canHandlePaymentDisputes,
      canGeneratePaymentReports,
      canAddAttendees,
      canPhotoVerification,
      canSendInvitations,
      canExcelBulkImports,
      canGateScanAccess,
      canViewEvents,
      canEditEvents,
      canViewAttendees,
      canEditAttendees,
      canViewTickets,
      canEditTickets,
      canScanTickets,
      canViewZones,
      canManageZones,
      canViewReports,
      canExportReports,
      canViewRevenue,
      canSendNotifications,
      permissions,
      assignedGates,
      assignedZones,
      assignedCategories 
    } = req.body;
    
    // Handle both simple status updates and full user updates
    const updateData = {};
    
    if (status && ['Active', 'Inactive', 'active', 'inactive'].includes(status)) {
      updateData.status = status === 'active' ? 'Active' : status === 'inactive' ? 'Inactive' : status;
    }
    
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (password) updateData.password = password;
    if (assignedGates && Array.isArray(assignedGates)) updateData.assignedGates = assignedGates;
    if (assignedZones && Array.isArray(assignedZones)) updateData.assignedZones = assignedZones;
    
    // Handle individual permission flags
    if (canCollectCash !== undefined) {
      updateData.canCollectCash = canCollectCash;
    }
    if (canConfirmCashPayments !== undefined) {
      updateData.canConfirmCashPayments = canConfirmCashPayments;
    }
    if (canApproveBankTransfer !== undefined) {
      updateData.canApproveBankTransfer = canApproveBankTransfer;
    }
    
    // Handle permissions object if provided
    if (permissions && typeof permissions === 'object') {
      updateData.permissions = permissions;
    } else {
      // Build permissions from individual flags
      const builtPermissions = {};
      if (canCollectCash !== undefined) builtPermissions.canCollectCash = canCollectCash;
      if (canConfirmCashPayments !== undefined) builtPermissions.canConfirmCashPayments = canConfirmCashPayments;
      if (canApproveBankTransfer !== undefined) builtPermissions.canApproveBankTransfer = canApproveBankTransfer;
      if (canViewPayments !== undefined) builtPermissions.canViewPayments = canViewPayments;
      if (canProcessRefunds !== undefined) builtPermissions.canProcessRefunds = canProcessRefunds;
      if (canManagePaymentMethods !== undefined) builtPermissions.canManagePaymentMethods = canManagePaymentMethods;
      if (canViewPaymentHistory !== undefined) builtPermissions.canViewPaymentHistory = canViewPaymentHistory;
      if (canHandlePaymentDisputes !== undefined) builtPermissions.canHandlePaymentDisputes = canHandlePaymentDisputes;
      if (canGeneratePaymentReports !== undefined) builtPermissions.canGeneratePaymentReports = canGeneratePaymentReports;
      if (canAddAttendees !== undefined) builtPermissions.canAddAttendees = canAddAttendees;
      if (canPhotoVerification !== undefined) builtPermissions.canPhotoVerification = canPhotoVerification;
      if (canSendInvitations !== undefined) builtPermissions.canSendInvitations = canSendInvitations;
      if (canExcelBulkImports !== undefined) builtPermissions.canExcelBulkImports = canExcelBulkImports;
      if (canGateScanAccess !== undefined) builtPermissions.canGateScanAccess = canGateScanAccess;
      if (canViewEvents !== undefined) builtPermissions.canViewEvents = canViewEvents;
      if (canEditEvents !== undefined) builtPermissions.canEditEvents = canEditEvents;
      if (canViewAttendees !== undefined) builtPermissions.canViewAttendees = canViewAttendees;
      if (canEditAttendees !== undefined) builtPermissions.canEditAttendees = canEditAttendees;
      if (canViewTickets !== undefined) builtPermissions.canViewTickets = canViewTickets;
      if (canEditTickets !== undefined) builtPermissions.canEditTickets = canEditTickets;
      if (canScanTickets !== undefined) builtPermissions.canScanTickets = canScanTickets;
      if (canViewZones !== undefined) builtPermissions.canViewZones = canViewZones;
      if (canManageZones !== undefined) builtPermissions.canManageZones = canManageZones;
      if (canViewReports !== undefined) builtPermissions.canViewReports = canViewReports;
      if (canExportReports !== undefined) builtPermissions.canExportReports = canExportReports;
      if (canViewRevenue !== undefined) builtPermissions.canViewRevenue = canViewRevenue;
      if (canSendNotifications !== undefined) builtPermissions.canSendNotifications = canSendNotifications;
      
      if (Object.keys(builtPermissions).length > 0) {
        updateData.permissions = builtPermissions;
      }
    }
    
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, assignedEvents: eventId },
      updateData,
      { new: true }
    ).select('-password');
    
    if (!user) return res.status(404).json({ success: false, message: 'Sub organiser not found.' });

    // Update Ticket Categories
    if (assignedCategories && Array.isArray(assignedCategories)) {
      const mongoose = require('mongoose');
      // Remove this user from all categories for this event first
      await mongoose.model('TicketCategory').updateMany(
        { eventId },
        { $pull: { assignedSubOrganisers: user._id } }
      );
      // Then add to the selected ones
      if (assignedCategories.length > 0) {
        await mongoose.model('TicketCategory').updateMany(
          { eventId, _id: { $in: assignedCategories } },
          { $addToSet: { assignedSubOrganisers: user._id } }
        );
      }
    }
    
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

const sendInvite = async (req, res, next) => {
  try {
    const attendee = await Attendee.findById(req.params.id).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    await notifyInvite({
      attendee,
      event: attendee.event,
      email: attendee.email,
      phone: attendee.phone,
      notificationChannel: 'both',
    });
    res.json({ success: true, message: 'Invite sent.' });
  } catch (err) { next(err); }
};

module.exports = {
  getOrganiserEvent,
  getDashboardStats,
  getAttendees,
  getEntryLogs,
  listSubOrganisers,
  createSubOrganiser,
  updateSubOrganiserStatus,
  sendInvite,
};
