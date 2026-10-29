const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const Order = require('../models/Order');
const Event = require('../models/Event');
const { upload, handleAzureUpload } = require('../middleware/azureUpload');
const { applyValidatedPhotoUpload } = require('../services/photoUploadService');
const { requiresPhotoVerification, resolveConfirmedTicketStatus } = require('../services/ticketDeliveryService');
const { notifyFinalTicket, notifyBuyerTicketProgress } = require('../services/notificationService');
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

// GET /api/invite/:token - validate invite token and return event/ticket
router.get('/:token', async (req, res, next) => {
  try {
    const token = req.params.token;
    let ticket = await Ticket.findOne({ inviteToken: token }).populate('event');
    
    // Fallback: Check if the token belongs to an Attendee
    if (!ticket) {
      const attendee = await Attendee.findOne({ confirmationToken: token }).populate('event');
      if (attendee) {
        // Find or create a ticket for this attendee if missing
        ticket = await Ticket.findOne({ attendee: attendee._id }).populate('event');
        
        if (!ticket && attendee.event) {
          // Recover: Create a complimentary order/ticket if it was missing
          const Order = require('../models/Order');
          const bulkOrder = new Order({
            eventId: attendee.event._id || attendee.event,
            buyerName: `Recovery (${attendee.fullName})`,
            buyerEmail: attendee.email || 'recovery@entrynex.com',
            totalAmount: 0,
            status: 'CONFIRMED',
            paymentStatus: 'success',
            orderNumber: `REC-${Date.now()}`,
            confirmationToken: token
          });
          await bulkOrder.save();

          ticket = new Ticket({
            event: attendee.event._id || attendee.event,
            order: bulkOrder._id,
            attendee: attendee._id,
            categoryId: attendee.categoryId,
            categoryName: attendee.categoryName,
            allowedZones: attendee.allowedZones || [],
            price: 0,
            slotIndex: 1,
            status: 'ASSIGNED',
            inviteToken: token,
            inviteEmail: attendee.email,
            invitePhone: attendee.phone,
            ticketNumber: `TKT-REC-${Date.now()}`
          });
          await ticket.save();
          // Reload with event populated
          ticket = await Ticket.findById(ticket._id).populate('event');
        }

        // If ticket exists but tokens are out of sync, sync them now
        if (ticket && ticket.inviteToken !== token) {
          ticket.inviteToken = token;
          await ticket.save();
        }
      }
    }

    if (!ticket || !ticket.event) {
      return res.status(404).json({ success: false, message: 'Invalid or expired invitation token.' });
    }
    if (ticket.inviteUsedAt) {
      return res.status(400).json({ success: false, message: 'This invitation has already been used.' });
    }
    if (ticket.status !== 'INVITED' && ticket.status !== 'PENDING' && ticket.status !== 'ASSIGNED') {
      return res.status(400).json({ success: false, message: 'This ticket is not open for invitation confirmation.' });
    }

    if (isInviteExpired(ticket)) {
      return res.status(400).json({ success: false, message: 'Invitation token has expired.' });
    }

    // Ensure attendee is populated
    if (ticket.attendee && !ticket.attendee.fullName) {
      ticket = await Ticket.findById(ticket._id).populate('event').populate('attendee');
    }

    res.json({
      success: true,
      data: {
        invite: {
          ticketId: ticket._id,
          eventId: ticket.event._id,
          eventName: ticket.event.name,
          categoryName: ticket.categoryName,
          status: ticket.status,
          inviteStatus: ticket.inviteStatus || 'PENDING',
          inviteRespondedAt: ticket.inviteRespondedAt,
          inviteExpiresAt: getInviteExpiryDate(ticket),
          eventStartDate: ticket.event.startDate,
          eventVenue: ticket.event.venue,
          attendee: ticket.attendee ? {
            fullName: ticket.attendee.fullName,
            email: ticket.attendee.email || ticket.inviteEmail,
            phone: ticket.attendee.phone || ticket.invitePhone,
            nationalId: ticket.attendee.nationalId,
            dateOfBirth: ticket.attendee.dateOfBirth,
          } : null,
        }
      }
    });
  } catch (err) { next(err); }
});

// POST /api/invite/respond - record invitation preview response
router.post('/respond', [
  body('token').notEmpty().withMessage('Invite token is required'),
  body('response').isIn(['ACCEPTED', 'DECLINED']).withMessage('Response must be ACCEPTED or DECLINED'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { token, response } = req.body;
    let ticket = await Ticket.findOne({ inviteToken: token }).populate('event');
    
    if (!ticket) {
      const attendee = await Attendee.findOne({ confirmationToken: token });
      if (attendee) {
        ticket = await Ticket.findOne({ attendee: attendee._id }).populate('event');
      }
    }

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Invalid or expired invitation token.' });
    }
    if (ticket.inviteUsedAt) {
      return res.status(400).json({ success: false, message: 'This invitation has already been used.' });
    }
    if (ticket.status !== 'INVITED' && ticket.status !== 'PENDING' && ticket.status !== 'ASSIGNED') {
      return res.status(400).json({ success: false, message: 'This ticket is not open for invitation confirmation.' });
    }
    if (isInviteExpired(ticket)) {
      return res.status(400).json({ success: false, message: 'Invitation token has expired.' });
    }

    ticket.inviteStatus = response;
    ticket.inviteRespondedAt = new Date();
    ticket.status = response === 'DECLINED' ? 'PENDING' : 'INVITED';
    await ticket.save();

    if (ticket.attendee) {
      await Attendee.findByIdAndUpdate(ticket.attendee, {
        confirmationStatus: response === 'DECLINED' ? 'pending' : 'invited',
      });
    }

    res.json({
      success: true,
      data: {
        ticketId: ticket._id,
        inviteStatus: ticket.inviteStatus,
        respondedAt: ticket.inviteRespondedAt,
        canProceed: response === 'ACCEPTED',
      },
      message: response === 'ACCEPTED' ? 'Invitation accepted.' : 'Invitation declined.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/invite/confirm - accept invite and confirm identity
router.post('/confirm', upload.single('photo'), handleAzureUpload('attendee-photos'), [
  body('token').notEmpty().withMessage('Invite token is required'),
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('email').notEmpty().isEmail().withMessage('Valid email is required'),
  body('nicPassport').optional({ checkFalsy: true }),
  body('dateOfBirth').optional({ checkFalsy: true }).isISO8601().withMessage('Valid date of birth is required'),
  body('phone').optional({ checkFalsy: true }).matches(/^\+?[1-9]\d{1,14}$/).withMessage('Phone number is invalid'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { token, fullName, nicPassport, dateOfBirth, phone, email } = req.body;

    let ticket = await Ticket.findOne({ inviteToken: token }).populate('event order');
    if (!ticket) {
      const attendee = await Attendee.findOne({ confirmationToken: token });
      if (attendee) {
        ticket = await Ticket.findOne({ attendee: attendee._id }).populate('event order');
      }
    }

    if (!ticket) return res.status(404).json({ success: false, message: 'Invalid invitation token.' });
    if (ticket.inviteUsedAt) return res.status(400).json({ success: false, message: 'Invitation has already been accepted.' });
    if (ticket.status !== 'INVITED' && ticket.status !== 'PENDING' && ticket.status !== 'ASSIGNED') {
      return res.status(400).json({ success: false, message: 'Ticket is no longer available for acceptance.' });
    }
    if ((ticket.inviteStatus || 'PENDING') !== 'ACCEPTED') {
      return res.status(400).json({ success: false, message: 'Please accept the invitation before completing the form.' });
    }

    if (isInviteExpired(ticket)) {
      return res.status(400).json({ success: false, message: 'Invitation token has expired.' });
    }

    if (requiresPhotoVerification(ticket.event) && !req.s3Data) {
      return res.status(400).json({ success: false, message: 'Identity verification photo is required.' });
    }

    // Duplicate check by NIC/passport for same event (only if provided)
    let duplicate = null;
    if (nicPassport) {
      const [nationalId, passportNumber] = nicPassport.includes('P') || nicPassport.includes('p') ? [null, nicPassport] : [nicPassport, null];
      
      const duplicateQuery = {
        event: ticket.event._id,
        $or: [
          ...(nationalId ? [{ nationalId }] : []),
          ...(passportNumber ? [{ passportNumber }] : [])
        ],
        confirmationStatus: { $in: ['confirmed', 'assigned'] }
      };

      if (ticket.attendee) {
        duplicateQuery._id = { $ne: ticket.attendee._id || ticket.attendee };
      }

      duplicate = await Attendee.findOne(duplicateQuery);
    }

    let nationalId = null;
    let passportNumber = null;
    if (nicPassport) {
      if (nicPassport.toLowerCase().includes('p')) {
        passportNumber = nicPassport;
      } else {
        nationalId = nicPassport;
      }
    }

    const attendeeData = {
      fullName,
      email: email || ticket.inviteEmail,
      phone: phone || undefined,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      nationalId: nationalId || undefined,
      passportNumber: passportNumber || undefined,
      event: ticket.event._id,
      order: ticket.order?._id,
      ticket: ticket._id,
      categoryId: ticket.categoryId,
      categoryName: ticket.categoryName,
      allowedZones: ticket.allowedZones || [],
      confirmationToken: ticket.inviteToken,
      confirmationStatus: 'confirmed',
      isConfirmed: true,
      confirmedAt: new Date(),
      confirmedBy: 'online_invite',
      addedVia: 'invite',
    };

    let attendee;
    if (ticket.attendee) {
      attendee = await Attendee.findById(ticket.attendee);
      if (attendee) {
        Object.assign(attendee, attendeeData);
      }
    }

    if (!attendee) {
      attendee = new Attendee(attendeeData);
    }

    if (req.s3Data) {
      const photoResult = await applyValidatedPhotoUpload({
        attendee,
        event: ticket.event,
        fileBuffer: req.file.buffer,
        s3Data: req.s3Data,
        body: req.body,
      });

      if (!photoResult.ok) {
        return res.status(photoResult.status).json({
          success: false,
          message: photoResult.message,
          data: photoResult.aiResults ? { aiResults: photoResult.aiResults } : undefined,
        });
      }
    } else if (!requiresPhotoVerification(ticket.event)) {
      attendee.photoVerificationStatus = 'verified';
    }

    if (!attendee.rfidTag) {
      attendee.rfidTag = await allocateRfid({
        eventId: ticket.event._id,
        categoryId: ticket.categoryId,
        attendeeId: attendee._id,
        ticketId: ticket._id,
      });
    }
    await attendee.save();

    ticket.attendee = attendee._id;
    ticket.status = resolveConfirmedTicketStatus({ attendee, event: ticket.event });
    ticket.inviteStatus = 'ACCEPTED';
    ticket.inviteRespondedAt = ticket.inviteRespondedAt || new Date();
    ticket.inviteUsedAt = new Date();
    ticket.inviteToken = null;
    await ticket.save();

    // Update order progress
    if (ticket.order) {
      const orderId = ticket.order._id || ticket.order;
      const allTickets = await Ticket.find({ order: orderId });
      const confirmedCount = allTickets.filter(t => ['ASSIGNED', 'CONFIRMED'].includes(t.status)).length;
      const isComplete = confirmedCount === allTickets.length;
      await Order.findByIdAndUpdate(orderId, {
        allAssigned: isComplete,
        confirmationStatus: isComplete ? 'complete' : 'partial',
      });

      if (isComplete) {
        const allAttendees = await Attendee.find({ order: ticket.order });
        const event = ticket.event;
        allAttendees.forEach(a => notifyFinalTicket({
          attendee: a,
          event,
          phone: a.phone,
          notificationChannel: 'both',
        }).catch(err => console.error('FINAL CONFIRM NOTIFY ERROR:', err)));
      }
    }

    if (ticket.order && ticket.event?.settings?.requirePhotoVerification) {
      await notifyBuyerTicketProgress({
        order: ticket.order,
        attendee,
        event: ticket.event,
        ticket,
        stage: 'pending_verification',
      });
    }

    await notifyFinalTicket({
      attendee,
      event: ticket.event,
      phone,
      notificationChannel: 'both',
    });

    res.json({ success: true, data: { attendee, ticket: { _id: ticket._id, status: ticket.status }}, message: 'Invite accepted and identity confirmed.' });
  } catch (err) {
    console.error('INVITE CONFIRM ERROR:', err);
    next(err);
  }
});

module.exports = router;
