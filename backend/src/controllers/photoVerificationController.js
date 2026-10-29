const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Attendee = require('../models/Attendee');
const Order = require('../models/Order');
const Event = require('../models/Event');
const { notifyPhotoRejectionNotification, notifyStatusChange } = require('../services/notificationService');
const { finalizePhotoApproval, finalizePhotoRejection, withUploadedPhoto } = require('../services/ticketDeliveryService');
const { hasZoneAccess } = require('../middleware/verificationScope');

const listPendingPhotos = async (req, res, next) => {
  try {
    const { eventId } = req.query;
    const filter = withUploadedPhoto({ photoVerificationStatus: { $in: ['pending', 'Pending'] } });
    if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      filter.event = eventId;
    }

    // Sub-organisers only see attendees in their assigned zones
    const { normalizeRole, ROLES } = require('../utils/rbac');
    const role = normalizeRole(req.user.role);
    if (role === ROLES.SUB_ORGANISER) {
      const { getAssignedZones } = require('../middleware/verificationScope');
      const myZones = getAssignedZones(req.user);
      if (myZones.length > 0) {
        filter.allowedZones = { $in: myZones };
      }
    }

    const attendees = await Attendee.find(filter)
      .populate('event', 'name startDate venue')
      .populate('order', 'buyerName buyerEmail buyerPhone orderNumber')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { attendees } });
  } catch (err) { next(err); }
};

const verifyPhoto = async (req, res, next) => {
  try {
    const { attendeeId, status, reason } = req.body;
    if (!attendeeId || !mongoose.Types.ObjectId.isValid(attendeeId)) {
      return res.status(400).json({ success: false, message: 'Invalid attendeeId.' });
    }
    const normalized = String(status || '').toLowerCase();
    if (!['verified', 'rejected'].includes(normalized)) {
      return res.status(400).json({ success: false, message: 'Status must be verified or rejected.' });
    }

    const attendee = await Attendee.findById(attendeeId).populate('event').populate('order');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });

    // Zone access check — must happen AFTER attendee is loaded
    if (!hasZoneAccess(req.user, attendee)) {
      return res.status(403).json({ success: false, message: 'Unauthorized zone.' });
    }

    if (normalized === 'rejected') {
      const rejectedAttendee = await finalizePhotoRejection(attendee, {
        reason: reason || 'Rejected',
        verifiedBy: req.user._id,
      });
      rejectedAttendee.verifiedBy = req.user._id;
      rejectedAttendee.verifiedAt = new Date();
      await rejectedAttendee.save();
      await notifyPhotoRejectionNotification({
        attendee: rejectedAttendee,
        event: rejectedAttendee.event,
        reason: rejectedAttendee.photoRejectionReason,
      });
      return res.json({ success: true, data: { attendee: rejectedAttendee } });
    }

    const approvedAttendee = await finalizePhotoApproval(attendee, {
      verifiedBy: req.user._id,
      confirmedBy: 'organiser',
    });

    const { notifyFinalTicket } = require('../services/notificationService');
    const { processOrderFinalConfirmation } = require('../services/finalConfirmationService');

    await notifyFinalTicket({
      attendee: approvedAttendee,
      event: approvedAttendee.event,
      phone: approvedAttendee.phone,
      notificationChannel: 'both',
      force: true,
    }).catch((err) => console.error('CONTROLLER FINAL NOTIFY ERROR:', err));

    if (approvedAttendee.order) {
      await processOrderFinalConfirmation({ orderId: approvedAttendee.order }).catch(console.error);
    }

    await notifyStatusChange({
      attendee: approvedAttendee,
      event: approvedAttendee.event,
      status: 'Photo Verified',
      message: 'Your photo has been verified successfully and your ticket with QR code has been sent to your email.',
    });

    res.json({ success: true, data: { attendee: approvedAttendee } });
  } catch (err) { next(err); }
};

const resubmitPhoto = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required.' });

    const attendee = await Attendee.findOne({ resubmitToken: token }).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Invalid token.' });
    if (!req.s3Data) return res.status(400).json({ success: false, message: 'Photo is required.' });

    attendee.photo = req.s3Data.url;
    attendee.photoS3Key = req.s3Data.key;
    attendee.photoUploadedAt = new Date();
    attendee.photoVerificationStatus = 'pending';
    attendee.photoRejectionReason = null;
    attendee.photoVerifiedBy = null;
    attendee.photoVerifiedAt = null;
    attendee.verifiedBy = null;
    attendee.verifiedAt = null;
    attendee.resubmitCount = (attendee.resubmitCount || 0) + 1;

    await attendee.save();

    res.json({ success: true, message: 'Photo resubmitted successfully.', data: { attendee } });
  } catch (err) { next(err); }
};

module.exports = {
  listPendingPhotos,
  verifyPhoto,
  resubmitPhoto,
};
