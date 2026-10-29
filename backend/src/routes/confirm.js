const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const Order = require('../models/Order');
const { notifyFinalTicket, notifyBuyerTicketProgress } = require('../services/notificationService');
const { upload, handleAzureUpload } = require('../middleware/azureUpload');
const { resolveConfirmedTicketStatus, requiresPhotoVerification } = require('../services/ticketDeliveryService');
const { validatePhoto } = require('../services/photoValidationService');
const { allocateRfid } = require('../services/rfidService');

const getInviteExpiryDate = (ticket) => {
  if (ticket.inviteExpiresAt) return new Date(ticket.inviteExpiresAt);
  if (!ticket.inviteSentAt) return null;
  const expirationHours = parseInt(process.env.INVITE_TOKEN_EXPIRY_HOURS || '72', 10);
  return new Date(new Date(ticket.inviteSentAt).getTime() + expirationHours * 60 * 60 * 1000);
};

const isInviteExpired = (ticket) => {
  const expiryDate = getInviteExpiryDate(ticket);
  return !!expiryDate && expiryDate.getTime() < Date.now();
};

const isTicketSlotConfirmed = (status) => ['PENDING_VERIFICATION', 'ASSIGNED', 'CONFIRMED'].includes(status);

// GET /api/confirm/:inviteToken - validate token and return event/ticket info
router.get('/:inviteToken', async (req, res, next) => {
  try {
    const { inviteToken } = req.params;
    const ticket = await Ticket.findOne({ inviteToken })
      .populate('event', 'name startDate venue settings')
      .populate('attendee', 'fullName email phone');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Invalid or expired invitation token.' });
    }

    if (ticket.inviteUsedAt) {
      return res.status(400).json({ success: false, message: 'This invite link has already been used.' });
    }

    if (isInviteExpired(ticket)) {
      return res.status(400).json({ success: false, message: 'Invitation token has expired.' });
    }

    return res.json({
      success: true,
      data: {
        inviteToken,
        event: {
          id: ticket.event?._id,
          name: ticket.event?.name,
          date: ticket.event?.startDate,
          venue: ticket.event?.venue,
          smsEnabled: !!ticket.event?.settings?.communicationChannels?.sms,
        },
        ticket: {
          id: ticket._id,
          categoryName: ticket.categoryName,
          slotIndex: ticket.slotIndex,
        },
        attendee: ticket.attendee
          ? {
              fullName: ticket.attendee.fullName || '',
              email: ticket.attendee.email || ticket.inviteEmail || '',
              phone: ticket.attendee.phone || '',
            }
          : {
              fullName: '',
              email: ticket.inviteEmail || '',
              phone: '',
            },
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/confirm/:inviteToken - save attendee details and mark ticket as pending verification
router.post(
  '/:inviteToken',
  upload.single('photo'),
  handleAzureUpload('attendee-photos'),
  [
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('idNumber').optional({ checkFalsy: true }),
    body('dateOfBirth').optional({ checkFalsy: true }).isISO8601().withMessage('Valid date of birth is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('phone').optional({ checkFalsy: true }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { inviteToken } = req.params;
      const { fullName, idNumber, dateOfBirth, email, phone } = req.body;
      const ticket = await Ticket.findOne({ inviteToken }).populate('event order');

      if (!ticket) {
        return res.status(404).json({ success: false, message: 'Invalid or expired invitation token.' });
      }

      if (ticket.inviteUsedAt) {
        return res.status(400).json({ success: false, message: 'This invite link has already been used.' });
      }

      if (isInviteExpired(ticket)) {
        return res.status(400).json({ success: false, message: 'Invitation token has expired.' });
      }
      const smsEnabled = !!ticket.event?.settings?.communicationChannels?.sms;
      if (smsEnabled && !String(phone || '').trim()) {
        return res.status(400).json({ success: false, message: 'Phone number is required when SMS notifications are enabled for this event.' });
      }

      const attendee =
        (ticket.attendee && (await Attendee.findById(ticket.attendee))) ||
        new Attendee({
          ticket: ticket._id,
          order: ticket.order?._id || ticket.order,
          event: ticket.event?._id || ticket.event,
          categoryId: ticket.categoryId,
          categoryName: ticket.categoryName,
          allowedZones: ticket.allowedZones || [],
          addedVia: 'invite',
        });

      attendee.fullName = fullName;
      attendee.email = email;
      attendee.phone = phone || undefined;
      if (dateOfBirth) {
        attendee.dateOfBirth = new Date(dateOfBirth);
      }
      attendee.confirmationStatus = 'pending';
      attendee.photoVerificationStatus = 'pending';

      // Save incoming id number into one of the existing schema fields.
      if (idNumber) {
        if (idNumber.toUpperCase().startsWith('P')) {
          attendee.passportNumber = idNumber;
          attendee.nationalId = undefined;
        } else {
          attendee.nationalId = idNumber;
          attendee.passportNumber = undefined;
        }
      }

      if (req.s3Data) {
        const aiResults = await validatePhoto(req.file.buffer, ticket.event);
        attendee.photo = req.s3Data.url;
        attendee.photoS3Key = req.s3Data.key;
        attendee.photoUploadedAt = new Date();
        attendee.photoHash = aiResults.hash;
        attendee.photoValidationMetrics = {
          ...attendee.photoValidationMetrics,
          faceCount: aiResults.metrics.faceCount,
          faceConfidence: aiResults.metrics.faceConfidence,
          sharpness: aiResults.metrics.sharpness,
          brightness: aiResults.metrics.brightness,
        };
        if (!aiResults.isValid) {
          attendee.photoVerificationStatus = 'rejected';
          attendee.photoRejectionReason = `AI Auto-Reject: ${aiResults.reason}`;
        }
      }

      let incomingDescriptor = [];
      try {
        incomingDescriptor = req.body.faceDescriptor ? JSON.parse(req.body.faceDescriptor) : [];
      } catch (err) {
        incomingDescriptor = [];
      }
      if (Array.isArray(incomingDescriptor) && incomingDescriptor.every((v) => typeof v === 'number')) {
        attendee.faceDescriptor = incomingDescriptor;
      }

      if (!attendee.rfidTag) {
        attendee.rfidTag = await allocateRfid({
          eventId: ticket.event?._id || ticket.event,
          categoryId: ticket.categoryId,
          attendeeId: attendee._id,
          ticketId: ticket._id,
        });
      }

      await attendee.save();

      ticket.attendee = attendee._id;
      const nextTicketStatus = resolveConfirmedTicketStatus({ attendee, event: ticket.event });
      ticket.status = requiresPhotoVerification(ticket.event) ? 'PENDING_VERIFICATION' : nextTicketStatus;
      ticket.inviteStatus = 'ACCEPTED';
      ticket.inviteRespondedAt = ticket.inviteRespondedAt || new Date();
      ticket.inviteUsedAt = new Date();
      await ticket.save();

      if (ticket.order) {
        const orderId = ticket.order?._id || ticket.order;
        const orderTickets = await Ticket.find({ order: orderId });
        const allSlotsSubmitted = orderTickets.length > 0 && orderTickets.every((t) => isTicketSlotConfirmed(t.status));

        if (requiresPhotoVerification(ticket.event)) {
          await notifyBuyerTicketProgress({
            order: ticket.order,
            attendee,
            event: ticket.event,
            ticket,
            stage: 'pending_verification',
          });
          
          // Send pending verification email to attendee
          const { notifyAttendeePendingVerification } = require('../services/notificationService');
          await notifyAttendeePendingVerification({
            attendee,
            event: ticket.event,
          }).catch((err) => console.error('ATTENDEE PENDING VERIFICATION EMAIL ERROR:', err));
        }

        const { processOrderFinalConfirmation } = require('../services/finalConfirmationService');
        await processOrderFinalConfirmation({ orderId }).catch((err) => console.error('FINAL CONFIRMATION ERROR:', err));

        if (allSlotsSubmitted) {
          await Order.findByIdAndUpdate(orderId, { allAssigned: true });
        }

        if (false) {
          const allAttendees = await Attendee.find({ order: orderId });
          const event = ticket.event;
          await Promise.all(
            allAttendees.map((a) =>
              notifyFinalTicket({
                attendee: a,
                event,
                phone: a.phone,
                notificationChannel: 'both',
              }).catch((err) => {
                console.error('FINAL CONFIRMATION NOTIFY ERROR:', err);
              })
            )
          );
          await Order.findByIdAndUpdate(orderId, { allAssigned: true });
        }
      }

      return res.json({
        success: true,
        data: {
          attendeeId: attendee._id,
          ticketId: ticket._id,
          status: ticket.status,
          verificationStatus: attendee.photoVerificationStatus,
        },
        message: 'Attendee details submitted successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
