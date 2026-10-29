const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const { protect, requirePermission } = require('../middleware/auth');
const { triggerCleanupNow } = require('../utils/s3Cleanup');
const { processOrderFinalConfirmation } = require('../services/finalConfirmationService');
const { finalizePhotoApproval, finalizePhotoRejection, withUploadedPhoto } = require('../services/ticketDeliveryService');
const { notifyPhotoRejectionNotification } = require('../services/notificationService');
const { logActivity } = require('../utils/logger');
const { hasZoneAccess, getAssignedZones } = require('../middleware/verificationScope');

// Check organiser event access
const hasEventAccess = async (user, eventId) => {
  if (!eventId) return false;
  if (user.role === 'main_admin') return true;
  if (user.assignedEvents?.some((assigned) => assigned.toString() === eventId.toString())) return true;
  const event = await Event.findById(eventId).select('createdBy mainOrganiser');
  return !!event && (
    event.createdBy?.toString() === user._id.toString() ||
    event.mainOrganiser?.toString() === user._id.toString()
  );
};

// Utility to escape regex special characters and limit length
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeSearch = (value) => String(value || '').trim();

// GET /api/verification/pending - list pending photos with filters, pagination, sorting
router.get('/pending', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const {
      eventId,
      status = 'pending',
      search,
      checkoutOption,
      page = 1,
      limit = 12,
      sortBy = 'createdAt',
      sortOrder = -1,
    } = req.query;

    if (!eventId || eventId === 'undefined' || eventId === '') {
      return res.status(400).json({ success: false, message: 'eventId is required.' });
    }

    if (!(await hasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const filter = withUploadedPhoto({ event: eventId, isActive: true });
    const role = req.user.role;
    if (role === "SubOrganiser") {
        const assignedZones = getAssignedZones(req.user);
        filter.allowedZones = {
            $in: assignedZones
        };
    }

    if (status) filter.photoVerificationStatus = status;

    if (checkoutOption && checkoutOption !== '') {
      filter.checkoutOption = checkoutOption;
    }

    if (search) {
      const safeSearch = escapeRegex(normalizeSearch(search)).slice(0, 100);
      filter.$or = [
        { fullName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { nationalId: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const sortObj = {};
    sortObj[sortBy] = parseInt(sortOrder, 10);

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [attendees, total] = await Promise.all([
      Attendee.find(filter)
        .select(
          '_id fullName email photo photoVerificationStatus photoValidationMetrics resubmitCount createdAt confirmationStatus checkoutOption',
        )
        .populate('event', 'name')
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Attendee.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / parseInt(limit, 10));

    res.json({
      success: true,
      data: {
        attendees,
        total,
        page: parseInt(page, 10),
        pages,
        limit: parseInt(limit, 10),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/verification/approve - approve a photo
router.post('/approve', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const { attendeeId } = req.body;
    if (!attendeeId) {
      return res.status(400).json({ success: false, message: 'Attendee ID is required.' });
    }

    const attendee = await Attendee.findById(attendeeId).populate('event');
    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Attendee not found.' });
    }

    if (!(await hasEventAccess(req.user, attendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }

    if (!hasZoneAccess(req.user, attendee)) {

    return res.status(403).json({
        success: false,
        message: "You are not assigned to this attendee's zone."
    });

    }

    const updated = await finalizePhotoApproval(attendee, {
      verifiedBy: req.user._id,
      confirmedBy: 'organiser',
    });

    // Trigger specific attendee notification
    const { notifyFinalTicket } = require('../services/notificationService');
    await notifyFinalTicket({
      attendee: updated,
      event: updated.event,
      phone: updated.phone,
      notificationChannel: 'both',
      force: true
    }).catch((err) => console.error('INDIVIDUAL FINAL NOTIFY ERROR:', err));

    // Trigger final confirmation email workflow for order context
    const finalConfirmation = await processOrderFinalConfirmation({ orderId: updated.order });

    await logActivity({
      req,
      action: 'qr_verification',
      eventId: updated.event._id || updated.event,
      details: { message: `Photo APPROVED for attendee: ${updated.fullName}` }
    });

    res.json({
      success: true,
      message: 'Photo approved successfully.',
      data: {
        attendee: updated,
        finalConfirmation,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/verification/reject - reject a photo with reason
router.post('/reject', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const { attendeeId, reason } = req.body;
    if (!attendeeId || !reason) {
      return res.status(400).json({ success: false, message: 'Attendee ID and reason are required.' });
    }

    const attendee = await Attendee.findById(attendeeId).populate('event');
    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Attendee not found.' });
    }

    if (!(await hasEventAccess(req.user, attendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }

    if (!hasZoneAccess(req.user, attendee)) {
    return res.status(403).json({
        success:false,
        message:"You are not assigned to this attendee's zone."
    });
    }

    const updated = await finalizePhotoRejection(attendee, {
      reason,
      verifiedBy: req.user._id,
    });

    await notifyPhotoRejectionNotification({
      attendee: updated,
      event: updated.event,
      reason,
    }).catch((error) => {
      console.error('PHOTO REJECTION NOTIFY ERROR:', error);
    });

    await logActivity({
      req,
      action: 'qr_verification',
      eventId: updated.event._id || updated.event,
      details: { message: `Photo REJECTED for attendee: ${updated.fullName}. Reason: ${reason}` }
    });

    res.json({ success: true, message: 'Photo rejected successfully.', data: { attendee: updated } });
  } catch (err) {
    next(err);
  }
});

// GET /api/verification/stats - get verification stats by status
router.get('/stats', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const { eventId } = req.query;
    if (!eventId || eventId === 'undefined' || eventId === '') {
      return res.status(400).json({ success: false, message: 'eventId is required.' });
    }

    if (!(await hasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const stats = await Attendee.aggregate([
      {
        $match: {
          event: new mongoose.Types.ObjectId(eventId),
          isActive: true,
          photo: { $exists: true, $nin: [null, ''] },
          allowedZones:{$in:getAssignedZones(req.user)}
        },
      },
      {
        $group: {
          _id: '$photoVerificationStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      pending: 0,
      verified: 0,
      rejected: 0,
    };

    stats.forEach((stat) => {
      if (stat._id) result[stat._id] = stat.count;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/verification/cleanup-s3 - trigger manual S3 cleanup (admin only)
router.post('/cleanup-s3', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const { ageInDays = 90 } = req.body;

    // Only allow admin to trigger cleanup
    if (req.user.role !== 'main_admin') {
      return res.status(403).json({ success: false, message: 'Only admins can trigger S3 cleanup.' });
    }

    if (ageInDays < 30 || ageInDays > 365) {
      return res.status(400).json({ success: false, message: 'Age must be between 30 and 365 days.' });
    }

    const result = await triggerCleanupNow(ageInDays);

    res.json({
      success: true,
      message: `S3 cleanup completed: ${result.deleted} deleted, ${result.failed} failed`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
