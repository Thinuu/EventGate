const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const Ticket = require('../models/Ticket');
const Order = require('../models/Order');
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const QRCode = require('qrcode');
const { upload, handleAzureUpload } = require('../middleware/azureUpload');
const { applyValidatedPhotoUpload } = require('../services/photoUploadService');
const { notifyInvite, notifyFinalTicket, notifyBuyerTicketProgress } = require('../services/notificationService');
const { requiresPhotoVerification, resolveConfirmedTicketStatus } = require('../services/ticketDeliveryService');
const { generateTicketPDF } = require('../services/pdfService');
const { protect } = require('../middleware/auth');
const { allocateRfid } = require('../services/rfidService');

// POST /api/tickets/assign - Assign attendee to ticket (self-assignment)
router.post('/assign', upload.single('photo'), handleAzureUpload('attendee-photos'), [
  body('ticketId').notEmpty().withMessage('Ticket ID is required'),
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional({ checkFalsy: true }).matches(/^\+?[1-9]\d{1,14}$/).withMessage('Phone number is invalid'),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth required'),
  body('nationalId').optional(),
  body('passportNumber').optional(),
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (!req.s3Data) {
      return res.status(400).json({
        success: false,
        message: 'Identity Verification Photo is required',
        errors: [{ msg: 'Identity Verification Photo is required', param: 'photo' }]
      });
    }

    const { ticketId, fullName, email, phone, dateOfBirth, nationalId, passportNumber } = req.body;

    // Find ticket
    const ticket = await Ticket.findById(ticketId).populate('order').populate('event');
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    console.log('Ticket assignment debug:', {
      ticketId,
      currentStatus: ticket.status,
      attendee: ticket.attendee,
      attendeeId: ticket.attendee?._id,
      orderStatus: ticket.order?.status,
      paymentStatus: ticket.order?.paymentStatus
    });

    // TEMPORARILY ALLOW ALL ASSIGNMENTS FOR DEBUGGING
    // Commenting out the attendee check to see what happens
    /*
    if (ticket.attendee) {
      console.log('Ticket already has attendee:', ticket.attendee);
      return res.status(400).json({
        success: false,
        message: 'Ticket is already assigned or invited'
      });
    }
    */

    // Create attendee
    const attendee = new Attendee({
      fullName,
      email,
      phone,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      nationalId,
      passportNumber,
      order: ticket.order._id,
      event: ticket.event._id,
      ticket: ticket._id,
      categoryId: ticket.categoryId,
      categoryName: ticket.categoryName,
      allowedZones: ticket.allowedZones || [],
      confirmationToken: uuidv4(),
      qrToken: uuidv4(),
      confirmationStatus: 'confirmed',
      confirmedAt: new Date(),
      confirmedBy: 'self',
      addedVia: 'self_purchase',
    });

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

    const needsPhotoApproval = requiresPhotoVerification(ticket.event) && attendee.photo;

    if (!needsPhotoApproval) {
      const qrData = attendee.qrToken;
      attendee.qrCode = await QRCode.toDataURL(qrData);
    }

    // RFID allocation is now handled after QR scan in a separate flow.
      attendee.rfidTag = null;

    await attendee.save();

    // Update ticket
    ticket.attendee = attendee._id;
    ticket.status = needsPhotoApproval ? 'PENDING_VERIFICATION' : resolveConfirmedTicketStatus({ attendee, event: ticket.event });
    await ticket.save();

    // Check if all tickets in the order are now assigned
    const allTickets = await Ticket.find({ order: ticket.order._id });
    const assignedCount = allTickets.filter(t => t.status === 'ASSIGNED' || t.status === 'CONFIRMED').length;

    if (assignedCount === allTickets.length) {
      await Order.findByIdAndUpdate(ticket.order._id, { allAssigned: true });
    }

    if (needsPhotoApproval) {
      await notifyBuyerTicketProgress({
        order: ticket.order,
        attendee,
        event: ticket.event,
        ticket,
        stage: 'pending_verification',
      });
    } else {
      await notifyFinalTicket({
        attendee,
        event: ticket.event,
        phone: attendee.phone,
        notificationChannel: 'both',
      });
    }

    res.json({
      success: true,
      data: {
        attendee,
        ticket: {
          _id: ticket._id,
          status: ticket.status,
          categoryName: ticket.categoryName,
          ticketNumber: ticket.ticketNumber
        }
      },
      message: 'Ticket assigned successfully'
    });

  } catch (error) {
    console.error('Ticket assignment error:', error);
    
    // Handle multer file upload errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Photo file is too large. Maximum size is 5MB.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Only one photo file is allowed.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}, (err, req, res, next) => {
  // Error handling middleware for multer
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Photo upload failed'
    });
  }
});

// POST /api/tickets/invite - Send invite to ticket (existing functionality, moved here for consistency)
router.post('/invite', [
  body('ticketId').notEmpty().withMessage('Ticket ID is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional({ checkFalsy: true }).matches(/^\+?[1-9]\d{1,14}$/).withMessage('Phone number is invalid'),
  body('notificationChannel').optional().isIn(['email', 'sms', 'both']).withMessage('Invalid notification channel'),
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Invite validation failed:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { ticketId, email, phone, notificationChannel } = req.body;

    // Find ticket
    const ticket = await Ticket.findById(ticketId).populate('order').populate('event');
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    console.log('Ticket invite debug:', {
      ticketId,
      currentStatus: ticket.status,
      attendee: ticket.attendee,
      attendeeId: ticket.attendee?._id,
      orderStatus: ticket.order?.status,
      paymentStatus: ticket.order?.paymentStatus
    });

    // TEMPORARILY ALLOW ALL ASSIGNMENTS FOR DEBUGGING
    // Commenting out the attendee check to see what happens
    /*
    if (ticket.attendee) {
      console.log('Ticket already has attendee:', ticket.attendee);
      return res.status(400).json({
        success: false,
        message: 'Ticket is already assigned or invited'
      });
    }
    */

    // Create attendee
    const attendee = new Attendee({
      email,
      phone,
      order: ticket.order._id,
      event: ticket.event._id,
      ticket: ticket._id,
      categoryId: ticket.categoryId,
      categoryName: ticket.categoryName,
      allowedZones: ticket.allowedZones || [],
      confirmationToken: uuidv4(),
      qrToken: uuidv4(),
      confirmationStatus: 'invited',
      addedVia: 'invite',
    });

    await attendee.save();

    // Update ticket
    ticket.attendee = attendee._id;
    ticket.inviteEmail = email;
    ticket.inviteToken = attendee.confirmationToken;
    ticket.status = 'INVITED';
    ticket.inviteSentAt = new Date();
    ticket.inviteExpiresAt = new Date(Date.now() + (parseInt(process.env.INVITE_TOKEN_EXPIRY_HOURS || '72', 10) * 60 * 60 * 1000));
    ticket.inviteStatus = 'PENDING';
    ticket.inviteRespondedAt = null;
    ticket.inviteUsedAt = null;
    await ticket.save();

    await notifyInvite({
      attendee,
      event: ticket.event,
      phone: phone || attendee.phone,
      email,
      notificationChannel: notificationChannel || 'email',
    });

    await notifyBuyerTicketProgress({
      order: ticket.order,
      attendee,
      event: ticket.event,
      ticket,
      stage: 'invited',
    });

    res.json({
      success: true,
      data: {
        ticket: {
          _id: ticket._id,
          status: ticket.status,
          inviteEmail: ticket.inviteEmail
        }
      },
      message: 'Invite sent successfully'
    });

  } catch (error) {
    console.error('Ticket invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/tickets/:id/attendee - Assign attendee details directly to a slot
router.post('/:id/attendee', upload.single('photo'), [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional({ checkFalsy: true }).matches(/^\+?[1-9]\d{1,14}$/).withMessage('Phone number is invalid'),
  body('dateOfBirth').optional({ checkFalsy: true }).isISO8601().withMessage('Valid date of birth required'),
  body('nationalId').optional(),
  body('passportNumber').optional(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Identity Verification Photo is required',
        errors: [{ msg: 'Identity Verification Photo is required', param: 'photo' }]
      });
    }

    const ticketId = req.params.id;
    const { fullName, email, phone, dateOfBirth, nationalId, passportNumber } = req.body;
    const ticket = await Ticket.findById(ticketId).populate('order').populate('event');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    console.log('Ticket assign by ID debug:', {
      ticketId,
      currentStatus: ticket.status,
      attendee: ticket.attendee,
      attendeeId: ticket.attendee?._id,
      orderStatus: ticket.order?.status,
      paymentStatus: ticket.order?.paymentStatus
    });

    // TEMPORARILY ALLOW ALL ASSIGNMENTS FOR DEBUGGING
    // Commenting out the status check to see what happens
    /*
    if (ticket.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Ticket is already assigned or invited',
      });
    }
    */

    const attendee = new Attendee({
      fullName,
      email,
      phone,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      nationalId,
      passportNumber,
      photo: req.file ? `uploads/${req.file.filename}` : undefined,
      order: ticket.order._id,
      event: ticket.event._id,
      ticket: ticket._id,
      categoryId: ticket.categoryId,
      categoryName: ticket.categoryName,
      allowedZones: ticket.allowedZones || [],
      confirmationToken: uuidv4(),
      qrToken: uuidv4(),
      confirmationStatus: 'confirmed',
      confirmedAt: new Date(),
      confirmedBy: 'self',
      addedVia: 'self_purchase',
    });

    attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
    await attendee.save();

    ticket.attendee = attendee._id;
    ticket.status = resolveConfirmedTicketStatus({ attendee, event: ticket.event });
    await ticket.save();

    await notifyFinalTicket({
      attendee,
      event: ticket.event,
      phone: attendee.phone,
      notificationChannel: 'both',
    });

    return res.json({
      success: true,
      data: {
        attendee,
        ticket: {
          _id: ticket._id,
          status: ticket.status,
          categoryName: ticket.categoryName,
          ticketNumber: ticket.ticketNumber,
        },
      },
      message: 'Attendee details saved successfully',
    });
  } catch (error) {
    console.error('Ticket attendee assignment error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/tickets/:id/invite - Send invite link for a slot
router.post('/:id/invite', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional({ checkFalsy: true }).matches(/^\+?[1-9]\d{1,14}$/).withMessage('Phone number is invalid'),
  body('notificationChannel').optional().isIn(['email', 'sms', 'both']).withMessage('Invalid notification channel'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const ticketId = req.params.id;
    const { email, phone, notificationChannel } = req.body;
    const ticket = await Ticket.findById(ticketId).populate('order').populate('event');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    console.log('Ticket invite by ID debug:', {
      ticketId,
      currentStatus: ticket.status,
      attendee: ticket.attendee,
      attendeeId: ticket.attendee?._id,
      orderStatus: ticket.order?.status,
      paymentStatus: ticket.order?.paymentStatus
    });

    // TEMPORARILY ALLOW ALL ASSIGNMENTS FOR DEBUGGING
    // Commenting out the attendee check to see what happens
    /*
    if (ticket.attendee) {
      console.log('Ticket already has attendee:', ticket.attendee);
      return res.status(400).json({
        success: false,
        message: 'Ticket is already assigned or invited',
      });
    }
    */

    const attendee = new Attendee({
      email,
      phone,
      order: ticket.order._id,
      event: ticket.event._id,
      ticket: ticket._id,
      categoryId: ticket.categoryId,
      categoryName: ticket.categoryName,
      allowedZones: ticket.allowedZones || [],
      confirmationToken: uuidv4(),
      qrToken: uuidv4(),
      confirmationStatus: 'invited',
      addedVia: 'invite',
    });

    await attendee.save();

    ticket.attendee = attendee._id;
    ticket.inviteEmail = email;
    ticket.inviteToken = attendee.confirmationToken;
    ticket.status = 'INVITED';
    ticket.inviteSentAt = new Date();
    ticket.inviteExpiresAt = new Date(Date.now() + (parseInt(process.env.INVITE_TOKEN_EXPIRY_HOURS || '72', 10) * 60 * 60 * 1000));
    ticket.inviteStatus = 'PENDING';
    await ticket.save();

    await notifyInvite({
      attendee,
      event: ticket.event,
      phone: phone || attendee.phone,
      email,
      notificationChannel: notificationChannel || 'email',
    });

    await notifyBuyerTicketProgress({
      order: ticket.order,
      attendee,
      event: ticket.event,
      ticket,
      stage: 'invited',
    });

    return res.json({
      success: true,
      data: {
        ticket: {
          _id: ticket._id,
          status: ticket.status,
          inviteEmail: ticket.inviteEmail,
          inviteToken: ticket.inviteToken,
        },
      },
      message: 'Invite sent successfully',
    });
  } catch (error) {
    console.error('Ticket invite by id error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * GET /api/tickets/download/:token
 * Protected endpoint to download the PDF ticket using attendee qrToken / confirmationToken
 */
router.get('/download/:token', protect, async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ 
      $or: [
        { qrToken: req.params.token },
        { confirmationToken: req.params.token }
      ]
    }).populate('event');

    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    if (!attendee.isConfirmed || attendee.confirmationStatus !== 'confirmed') {
      return res.status(403).json({ success: false, message: 'Ticket identity is not yet confirmed or approved.' });
    }

    const requesterEmail = req.user?.email?.toLowerCase?.() || '';
    let isAllowed = attendee.email?.toLowerCase?.() === requesterEmail;

    if (!isAllowed && attendee.order) {
      const order = await Order.findById(attendee.order).select('buyerEmail');
      isAllowed = order?.buyerEmail?.toLowerCase?.() === requesterEmail;
    }

    // Allow Sponsor to download their team members' tickets
    if (!isAllowed && req.user.role === 'Sponsor') {
      const Sponsor = require('../models/Sponsor');
      const sponsor = await Sponsor.findOne({ userId: req.user._id });
      if (sponsor && attendee.sponsorId?.toString() === sponsor._id.toString()) {
        isAllowed = true;
      }
    }

    if (!isAllowed) {
      return res.status(403).json({ success: false, message: 'You are not authorised to download this ticket.' });
    }

    const pdfBuffer = await generateTicketPDF(attendee, attendee.event);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="EventGate-Ticket-${attendee.fullName.replace(/\s+/g, '-')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('TICKET DOWNLOAD ERROR:', err);
    next(err);
  }
});

/**
 * GET /api/tickets/order-download/:orderId
 * Protected endpoint to download the order summary PDF
 */
router.get('/order-download/:orderId', protect, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('eventId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const requesterEmail = req.user?.email?.toLowerCase?.() || '';
    const isAllowed = order.buyerEmail?.toLowerCase?.() === requesterEmail;

    if (!isAllowed) {
      return res.status(403).json({ success: false, message: 'You are not authorised to download this order summary.' });
    }

    const { generateOrderSummaryPDF } = require('../services/pdfService');
    const pdfBuffer = await generateOrderSummaryPDF(order, order.eventId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="EventGate-Order-${order.orderNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('ORDER DOWNLOAD ERROR:', err);
    next(err);
  }
});

module.exports = router;
