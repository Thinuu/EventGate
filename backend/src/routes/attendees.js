const express = require('express');
const router = express.Router();
const path = require('path');
const XLSX = require('../utils/spreadsheet');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const Attendee = require('../models/Attendee');
const Ticket = require('../models/Ticket');
const Order = require('../models/Order');
const Event = require('../models/Event');
const { protect, restrictTo, requireEventAccess, requirePermission } = require('../middleware/auth');
const { notifyInvite, notifyFinalTicket, notifyBuyerTicketProgress } = require('../services/notificationService');
const { sendAttendeeVerificationConfirmation } = require('../utils/email');
const { upload, excelUpload, handleAzureUpload } = require('../middleware/azureUpload');
const { deleteImageFromAzure, getSignedUrl } = require('../services/azureBlobService');
const { validatePhoto } = require('../services/photoValidationService');
const { requiresPhotoVerification, resolveConfirmedTicketStatus, finalizePhotoApproval, finalizePhotoRejection, handleMaxResubmissionsReached, MAX_RESUBMIT_COUNT } = require('../services/ticketDeliveryService');
const { processOrderFinalConfirmation } = require('../services/finalConfirmationService');
const { ROLES, normalizeRole } = require('../utils/rbac');

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

const getUserAssignedZoneIds = (user) => Array.from(new Set([
  ...(user.assignedZones || []).map(String),
  ...(user.responsibilities?.zoneIds || []).map(String),
]));

const canUserAccessCategory = (user, category) => {
  if (!category) return false;
  const role = normalizeRole(user.role);
  if (role === ROLES.MAIN_ADMIN || role === ROLES.MAIN_ORGANISER) return true;

  const userId = String(user._id);
  if (category.createdBy && String(category.createdBy) === userId) return true;
  if ((category.assignedSubOrganisers || []).map(String).includes(userId)) return true;

  const myZoneIds = getUserAssignedZoneIds(user);
  const categoryZones = (category.allowedZones || []).map(String);
  return categoryZones.length === 0 || categoryZones.some((zoneId) => myZoneIds.includes(zoneId));
};

const euclideanDistance = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return null;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

const similarityFromDistance = (distance) => {
  if (typeof distance !== 'number' || Number.isNaN(distance)) return 0;
  const sim = 1 - distance;
  return Math.max(0, Math.min(1, sim));
};

const clampThreshold = (value) => {
  let threshold = parseFloat(value);
  if (Number.isNaN(threshold)) threshold = 0.5;
  return Math.max(0.4, Math.min(0.6, threshold));
};

// Multer configured in azureUpload middleware
// Using memory storage with Azure Blob upload handler

// POST /api/attendees/confirm/:token - attendee self-confirms identity (public)
router.post('/confirm/:token', upload.single('photo'), handleAzureUpload('attendee-photos'), async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ confirmationToken: req.params.token }).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Invalid confirmation link.' });
    if (attendee.confirmationStatus === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Already confirmed.' });
    }

    const { fullName, email, phone, dateOfBirth, nationalId, passportNumber, nationality } = req.body;
    // Enforce phone/email based on event-level communication settings
    const smsRequired = attendee.event?.settings?.communicationChannels?.sms === true;
    const emailRequired = attendee.event?.settings?.communicationChannels?.email === true;
    if (smsRequired && (!phone || String(phone).trim() === '')) {
      return res.status(400).json({ success: false, message: 'Phone number is required for this event.' });
    }
    if (emailRequired && (!email || String(email).trim() === '')) {
      return res.status(400).json({ success: false, message: 'Email is required for this event.' });
    }
    attendee.fullName = fullName;
    attendee.email = email;
    attendee.phone = phone;
    if (dateOfBirth) attendee.dateOfBirth = new Date(dateOfBirth);
    if (nationalId) attendee.nationalId = nationalId;
    if (passportNumber) attendee.passportNumber = passportNumber;
    if (nationality) attendee.nationality = nationality;
    
    // Store S3 photo data
    if (req.s3Data) {
      // --- AI VALIDATION ---
      const aiResults = await validatePhoto(req.file.buffer, attendee.event);
      
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
      } else {
        attendee.photoVerificationStatus = 'pending';
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

    attendee.confirmationStatus = 'confirmed';
    attendee.isConfirmed = true;
    attendee.confirmedAt = new Date();
    attendee.confirmedBy = 'self';

    // DO NOT generate QR code here. It will be generated after admin photo approval.
    // attendee.qrCode = await QRCode.toDataURL(qrData);

    await attendee.save();

    const nextTicketStatus = resolveConfirmedTicketStatus({ attendee, event: attendee.event });
    await Ticket.findOneAndUpdate({ attendee: attendee._id }, { status: nextTicketStatus });

    // Send attendee verification confirmation email if photo verification is required
    if (requiresPhotoVerification(attendee.event) && attendee.photoVerificationStatus === 'pending') {
      await sendAttendeeVerificationConfirmation(attendee, attendee.event).catch(err => console.error('ATTENDEE VERIFICATION EMAIL ERROR:', err));
    }

    // Check if all tickets in the order are now submitted
    if (attendee.order) {
      const tickets = await Ticket.find({ order: attendee.order });
      const assignedCount = tickets.filter(t => t.status === 'ASSIGNED' || t.status === 'CONFIRMED').length;
      if (assignedCount === tickets.length) {
        await Order.findByIdAndUpdate(attendee.order, { confirmationStatus: 'complete' });
        if (!requiresPhotoVerification(attendee.event)) {
          await notifyFinalTicket({
            attendee,
            event: attendee.event,
            phone: attendee.phone,
            notificationChannel: 'email',
          }).catch(console.error);
        } else {
          const ticket = await Ticket.findOne({ attendee: attendee._id });
          const order = await Order.findById(attendee.order);
          await notifyBuyerTicketProgress({
            order,
            attendee,
            event: attendee.event,
            ticket,
            stage: 'pending_verification',
          });
        }
      } else {
        await Order.findByIdAndUpdate(attendee.order, { confirmationStatus: 'partial' });
        if (requiresPhotoVerification(attendee.event)) {
          const ticket = await Ticket.findOne({ attendee: attendee._id });
          const order = await Order.findById(attendee.order);
          await notifyBuyerTicketProgress({
            order,
            attendee,
            event: attendee.event,
            ticket,
            stage: 'pending_verification',
          });
        }
      }
    }

    res.json({ success: true, data: { attendee }, message: 'Identity confirmed successfully.' });
  } catch (err) { next(err); }
});

// GET /api/attendees/confirm/:token - get attendee confirmation info (public)
router.get('/confirm/:token', async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ confirmationToken: req.params.token })
      .populate('event', 'name venue startDate categories');
    if (!attendee) return res.status(404).json({ success: false, message: 'Invalid link.' });
    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

// GET /api/attendees - list attendees for event (organiser/sub-organiser)
router.get('/', protect, async (req, res, next) => {
  try {
    const { eventId, status, categoryId, search, page = 1, limit = 20 } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
    if (!(await hasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const filter = { event: eventId, isActive: true };
    if (status) filter.confirmationStatus = status;
    if (categoryId) filter.categoryId = categoryId;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { nationalId: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [attendees, total] = await Promise.all([
      Attendee.find(filter).sort('-createdAt').skip(skip).limit(parseInt(limit)),
      Attendee.countDocuments(filter),
    ]);
    res.json({ success: true, data: { attendees, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/attendees/export - export attendees for event as CSV
router.get('/export', protect, async (req, res, next) => {
  try {
    const { eventId, status, categoryId, search } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
    if (!(await hasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const filter = { event: eventId, isActive: true };
    if (status) filter.confirmationStatus = status;
    if (categoryId) filter.categoryId = categoryId;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const attendees = await Attendee.find(filter).sort('-createdAt');
    const rows = [
      ['Full Name', 'Email', 'Phone', 'Category', 'Status', 'Photo Status', 'QR Token', 'RFID Tag', 'Checked In'],
      ...attendees.map((attendee) => [
        attendee.fullName || '',
        attendee.email || '',
        attendee.phone || '',
        attendee.categoryName || '',
        attendee.confirmationStatus || '',
        attendee.photoVerificationStatus || '',
        attendee.qrToken || '',
        attendee.rfidTag || '',
        attendee.checkedIn ? 'Yes' : 'No',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendees-${eventId}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// POST /api/attendees - manually add attendee (sub-organiser)
router.post('/', protect, requirePermission('canAddAttendees'), async (req, res, next) => {
  try {
    const { eventId, categoryId, notificationChannel, ...attendeeData } = req.body;
    if (!(await hasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const category = event.categories.find(c => c.id === categoryId);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });

    // Zone and category access validation for Sub-Organisers
    const role = normalizeRole(req.user.role);
    if (role === ROLES.SUB_ORGANISER) {
      if (!canUserAccessCategory(req.user, category)) {
        return res.status(403).json({ 
          success: false, 
          message: 'This category does not grant access to any of your assigned zones or category assignments.' 
        });
      }
    }

    const allowedZones = category ? category.allowedZones : [];

    // Enforce phone/email presence based on event-level settings
    const smsRequired = event.settings?.communicationChannels?.sms === true;
    const emailRequired = event.settings?.communicationChannels?.email === true;
    if (smsRequired && (!attendeeData.phone || String(attendeeData.phone).trim() === '')) {
      return res.status(400).json({ success: false, message: 'Phone number is required for this event.' });
    }
    if (emailRequired && (!attendeeData.email || String(attendeeData.email).trim() === '')) {
      return res.status(400).json({ success: false, message: 'Email is required for this event.' });
    }

    const attendee = await Attendee.create({
      ...attendeeData,
      event: eventId,
      categoryId,
      categoryName: category?.name,
      allowedZones,
      addedBy: req.user._id,
      addedVia: 'manual',
      confirmationStatus: notificationChannel && notificationChannel !== 'none' ? 'invited' : 'pending',
    });

    // Generate QR code
    attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
    await attendee.save();

    if (notificationChannel && notificationChannel !== 'none') {
      await notifyInvite({
        attendee,
        event,
        phone: attendee.phone,
        email: attendee.email,
        notificationChannel,
      });
    }

    // UPDATE SOLD COUNT AND BROADCAST
    await Event.updateOne(
      { _id: eventId, 'categories.id': categoryId },
      { $inc: { 'categories.$.sold': 1 } }
    );

    const { emitDashboardEvent } = require('../utils/socket');
    const io = req.app.get('io');
    emitDashboardEvent(io, 'event_update', eventId, {
      type: 'MANUAL_ADDITION',
      eventId,
      categoryId
    });

    res.status(201).json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

router.post('/bulk-upload', protect, excelUpload.single('file'), async (req, res, next) => {
  try {
    const role = normalizeRole(req.user.role);
    if (![ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER, ROLES.SUB_ORGANISER].includes(role) && !req.user.permissions?.canBulkUpload) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform bulk uploads.' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel file required.' });
    const { eventId, categoryId } = req.body;
    if (!(await hasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    const category = (event.categories || []).find(c => c.id === categoryId);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });

    const smsRequired = event.settings?.communicationChannels?.sms === true;
    const emailRequired = event.settings?.communicationChannels?.email === true;

    // Zone and category access validation for Sub-Organisers
    if (role === ROLES.SUB_ORGANISER) {
      if (!canUserAccessCategory(req.user, category)) {
        return res.status(403).json({ 
          success: false, 
          message: 'This category does not grant access to any of your assigned zones or category assignments.' 
        });
      }
    }

    const workbook = await XLSX.read(req.file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const results = { created: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row['Full Name'] || (emailRequired && !row['Email'])) {
          results.errors.push({ row: i + 2, message: `Full Name${emailRequired ? ' and Email' : ''} are required.` });
          continue;
        }
        if (smsRequired && !row['Phone']) {
          results.errors.push({ row: i + 2, message: 'Phone is required for this event.' });
          continue;
        }
        const rfidTag = row['RFID Tag'] ? String(row['RFID Tag']).trim() : undefined;
        if (rfidTag && !/^[a-zA-Z0-9_-]{1,64}$/.test(rfidTag)) {
          results.errors.push({ row: i + 2, message: 'RFID Tag must be a valid RFID identifier.' });
          continue;
        }
        const attendee = await Attendee.create({
          fullName: row['Full Name'],
          email: row['Email'],
          phone: row['Phone'] || '',
          nationalId: row['National ID'] || '',
          dateOfBirth: row['Date of Birth'] ? new Date(row['Date of Birth']) : undefined,
          nationality: row['Nationality'] || '',
          rfidTag,
          event: eventId,
          categoryId: categoryId,
          categoryName: category?.name,
          allowedZones: category?.allowedZones || [],
          addedBy: req.user._id,
          addedVia: 'bulk_upload',
          confirmationStatus: 'pending',
        });
        attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
        await attendee.save();
        results.created++;
      } catch (err) {
        results.errors.push({ row: i + 2, message: err.message });
      }
    }

    // UPDATE SOLD COUNT AND BROADCAST FOR BULK
    if (results.created > 0) {
      await Event.updateOne(
        { _id: eventId, 'categories.id': categoryId },
        { $inc: { 'categories.$.sold': results.created } }
      );

      const { emitDashboardEvent } = require('../utils/socket');
      const io = req.app.get('io');
      emitDashboardEvent(io, 'event_update', eventId, {
        type: 'BULK_UPLOAD',
        eventId,
        categoryId,
        count: results.created
      });
    }

    res.json({ success: true, data: results, message: `${results.created} attendees imported. ${results.errors.length} errors.` });
  } catch (err) { next(err); }
});

// GET /api/attendees/template - download blank Excel template
router.get('/template', protect, async (req, res, next) => {
  try {
    const wb = XLSX.utils.book_new();
    const headers = [['Full Name', 'Email', 'Phone', 'National ID', 'Passport Number', 'Date of Birth', 'Nationality', 'RFID Tag', 'Notes']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws['!cols'] = headers[0].map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Attendees');
    const buffer = await XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=attendee_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) { next(err); }
});

// POST /api/attendees/invite-by-ticket/:ticketId - invite attendee by ticket ID and email (public for buyers)
router.post('/invite-by-ticket/:ticketId', async (req, res, next) => {
  try {
    const { email, phone, notificationChannel } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const ticket = await Ticket.findById(req.params.ticketId).populate('order').populate('event');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
    if (ticket.status !== 'PENDING') return res.status(400).json({ success: false, message: 'Ticket is already assigned.' });

    // Create attendee
    const attendee = new Attendee({
      order: ticket.order._id,
      event: ticket.event._id,
      ticket: ticket._id,
      email: email,
      phone,
      categoryId: ticket.categoryId,
      categoryName: ticket.categoryName,
      allowedZones: ticket.allowedZones || [],
      confirmationToken: uuidv4(),
      qrToken: uuidv4(),
      confirmationStatus: 'invited',
      invitedAt: new Date(),
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
      phone,
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

    res.json({ success: true, message: 'Invite sent successfully.' });
  } catch (err) {
    console.error('INVITE BY TICKET ERROR:', err);
    next(err);
  }
});

// POST /api/attendees/:id/invite - send invite to attendee
router.post('/:id/invite', protect, async (req, res, next) => {
  try {
    let attendee = await Attendee.findById(req.params.id)
      .populate({ path: 'order', select: 'buyerEmail' })
      .populate('event', 'name venue startDate');
    
    // If not found, check if it's a ticket ID
    if (!attendee) {
      const ticket = await Ticket.findById(req.params.id).populate('attendee');
      if (ticket && ticket.attendee) {
        attendee = await Attendee.findById(ticket.attendee._id)
          .populate({ path: 'order', select: 'buyerEmail' })
          .populate('event', 'name venue startDate');
      }
    }

    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });

    // Authorization check: Admin/Organiser OR the buyer of the order
    const isOrganiser = ['main_admin', 'main_organiser'].includes(req.user.role) || 
                       (req.user.role === 'sub_organiser' && req.user.permissions?.canInviteAttendees);
    const isBuyer = attendee.order && attendee.order.buyerEmail === req.user.email;

    if (!isOrganiser && !isBuyer) {
      return res.status(403).json({ success: false, message: 'You are not authorised to invite for this ticket.' });
    }

    attendee.confirmationStatus = 'invited';
    await attendee.save();
    const attendeeTicket = await Ticket.findOne({ attendee: attendee._id });
    if (ticket) {
      ticket.status = 'INVITED';
      ticket.inviteStatus = 'PENDING';
      ticket.inviteSentAt = new Date();
      ticket.inviteExpiresAt = new Date(Date.now() + (parseInt(process.env.INVITE_TOKEN_EXPIRY_HOURS || '72', 10) * 60 * 60 * 1000));
      ticket.inviteRespondedAt = null;
      ticket.inviteUsedAt = null;
      if (!ticket.inviteToken) ticket.inviteToken = attendee.confirmationToken;
      if (!ticket.inviteEmail && attendee.email) ticket.inviteEmail = attendee.email;
      await ticket.save();
    }
    await notifyInvite({
      attendee,
      event: attendee.event,
      phone: req.body.phone || attendee.phone,
      email: attendee.email,
      notificationChannel: req.body.notificationChannel || 'email',
    });
    const ticket = await Ticket.findOne({ attendee: attendee._id });
    const order = attendee.order?._id ? attendee.order : await Order.findById(attendee.order);
    await notifyBuyerTicketProgress({
      order,
      attendee,
      event: attendee.event,
      ticket: attendeeTicket,
      stage: 'invited',
    });
    res.json({ success: true, message: 'Invite sent.' });
  } catch (err) {
    console.error('INVITE ERROR:', err);
    next(err);
  }
});

// PATCH /api/attendees/:id/verify-photo - organiser verifies photo
router.patch('/:id/verify-photo', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    const attendee = await Attendee.findById(req.params.id).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    
    if (status === 'rejected') {
      attendee.photoVerificationStatus = 'rejected';
      attendee.photoRejectionReason = rejectionReason;
      attendee.photoVerifiedBy = req.user._id;
      attendee.photoVerifiedAt = new Date();
      attendee.qrCode = null;
      await attendee.save();
    } else if (status === 'verified') {
      const approvedAttendee = await finalizePhotoApproval(attendee, {
        verifiedBy: req.user._id,
        confirmedBy: 'organiser',
      });

      await notifyFinalTicket({
        attendee: approvedAttendee,
        event: approvedAttendee.event,
        phone: approvedAttendee.phone,
        notificationChannel: 'both',
        force: true,
      }).catch(console.error);

      if (approvedAttendee.order) {
        await processOrderFinalConfirmation({ orderId: approvedAttendee.order }).catch(console.error);
      }

      return res.json({ success: true, data: { attendee: approvedAttendee } });
    }

    await attendee.save();
    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

// POST /api/attendees/reject-photo - reject photo and send resubmit notification
router.post('/reject-photo', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const { attendeeId, reason } = req.body;
    if (!attendeeId || !reason) {
      return res.status(400).json({ success: false, message: 'Attendee ID and reason are required.' });
    }

    const attendee = await Attendee.findById(attendeeId).populate('event', 'name');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!(await hasEventAccess(req.user, attendee.event?._id))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }

    const rejectedAttendee = await finalizePhotoRejection(attendee, {
      reason,
      verifiedBy: req.user._id,
    });

    if ((rejectedAttendee.resubmitCount || 0) < MAX_RESUBMIT_COUNT && rejectedAttendee.resubmitToken) {
      const { notifyPhotoRejection } = require('../services/notificationService');
      await notifyPhotoRejection({
        attendee: rejectedAttendee,
        reason,
        resubmitToken: rejectedAttendee.resubmitToken,
      });
    }

    const ticket = await Ticket.findOne({ attendee: rejectedAttendee._id });
    const invalidated = ticket?.status === 'CANCELLED' && ticket?.refundStatus === 'refunded';

    res.json({
      success: true,
      message: invalidated
        ? 'Photo rejected. Maximum resubmissions reached; ticket invalidated and refund initiated.'
        : 'Photo rejected and resubmit notification sent.',
      data: { attendee: rejectedAttendee, ticket },
    });
  } catch (err) { next(err); }
});

// GET /api/attendees/resubmit/:token - get resubmit info (public)
router.get('/resubmit/:token', async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ resubmitToken: req.params.token }).populate('event', 'name photoRequirements');
    if (!attendee) return res.status(404).json({ success: false, message: 'Invalid resubmit link.' });

    if (attendee.resubmitCount >= MAX_RESUBMIT_COUNT) {
      const invalidation = await handleMaxResubmissionsReached(attendee, {
        reason: 'Maximum photo resubmissions reached.',
      });
      if (invalidation.handled) {
        const { notifyTicketInvalidationRefund } = require('../services/notificationService');
        await notifyTicketInvalidationRefund(invalidation).catch(console.error);
      }

      return res.status(400).json({
        success: false,
        message: 'Maximum resubmissions reached. This ticket has been invalidated and a refund has been initiated.',
        data: {
          invalidated: true,
          refundAmount: invalidation.refundAmount || invalidation.ticket?.refundAmount || 0,
          ticketNumber: invalidation.ticket?.ticketNumber,
        },
      });
    }

    res.json({
      success: true,
      data: {
        attendee: {
          id: attendee._id,
          fullName: attendee.fullName,
          email: attendee.email,
          rejectionReason: attendee.photoRejectionReason,
          resubmitCount: attendee.resubmitCount,
          photo: attendee.photo,
          faceDescriptor: attendee.faceDescriptor || [],
        },
        event: attendee.event,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/attendees/resubmit/photo - resubmit photo
router.post('/resubmit/photo', upload.single('photo'), handleAzureUpload('attendee-photos'), async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required.' });

    const attendee = await Attendee.findOne({ resubmitToken: token });
    if (!attendee) return res.status(404).json({ success: false, message: 'Invalid token.' });

    if (attendee.resubmitCount >= MAX_RESUBMIT_COUNT) {
      const invalidation = await handleMaxResubmissionsReached(attendee, {
        reason: 'Maximum photo resubmissions reached.',
      });
      if (invalidation.handled) {
        const { notifyTicketInvalidationRefund } = require('../services/notificationService');
        await notifyTicketInvalidationRefund(invalidation).catch(console.error);
      }

      return res.status(400).json({
        success: false,
        message: 'Maximum resubmissions reached. This ticket has been invalidated and a refund has been initiated.',
        data: {
          invalidated: true,
          refundAmount: invalidation.refundAmount || invalidation.ticket?.refundAmount || 0,
          ticketNumber: invalidation.ticket?.ticketNumber,
        },
      });
    }

    if (!req.s3Data) return res.status(400).json({ success: false, message: 'Photo is required.' });

    const faceValidationPassed = req.body.faceValidationPassed === 'true' || req.body.faceValidationPassed === true;
    if (!faceValidationPassed) {
      return res.status(400).json({ success: false, message: 'Frontend face validation not passed.' });
    }

    // Face descriptor matching logic
    let newFaceDescriptor = [];
    try {
      newFaceDescriptor = req.body.faceDescriptor ? JSON.parse(req.body.faceDescriptor) : [];
    } catch (err) {
      newFaceDescriptor = [];
    }
    if (!Array.isArray(newFaceDescriptor) || newFaceDescriptor.some((v) => typeof v !== 'number')) {
      newFaceDescriptor = [];
    }

    const existingDescriptor = Array.isArray(attendee.faceDescriptor) ? attendee.faceDescriptor : [];
    const threshold = clampThreshold(req.body.threshold);
    const skipFaceMatch = req.body.skipFaceMatch === 'true' || req.body.skipFaceMatch === true;

    let matchDistance = 0;
    let matchSimilarity = 0;
    let isMatchPass = true;

    if (existingDescriptor.length > 0 && !skipFaceMatch) {
      if (newFaceDescriptor.length === 0) {
        return res.status(400).json({ success: false, message: 'Face descriptor missing from submission.' });
      }
      matchDistance = euclideanDistance(existingDescriptor, newFaceDescriptor);
      if (matchDistance === null) {
        return res.status(400).json({ success: false, message: 'Face descriptor should be same dimensionality.' });
      }
      matchSimilarity = similarityFromDistance(matchDistance);

      if (matchSimilarity < threshold) {
        // Delete the S3 image if face doesn't match
        if (req.s3Data?.key) {
          await deleteImageFromS3(req.s3Data.key).catch(console.error);
        }

        attendee.photoVerificationStatus = 'rejected';
        attendee.photoRejectionReason = `Face mismatch: similarity ${matchSimilarity.toFixed(3)} below threshold ${threshold}`;
        attendee.photoValidationMetrics = {
          faceCount: Number(req.body.faceCount || 0),
          faceConfidence: Number(req.body.faceConfidence || 0),
          brightness: Number(req.body.brightness || 0),
          sharpness: Number(req.body.sharpness || 0),
          faceMatchDistance: Number(matchDistance),
          faceMatchSimilarity: Number(matchSimilarity),
          faceMatchThreshold: threshold,
        };
        await attendee.save();
        return res.status(400).json({ success: false, message: 'Face does not match the existing attendee record.', data: { matchSimilarity, matchDistance, threshold } });
      }
    }

    if (newFaceDescriptor.length > 0) {
      attendee.faceDescriptor = newFaceDescriptor;
    }

    // Delete old photo from S3 if exists
    if (attendee.photoS3Key) {
      await deleteImageFromS3(attendee.photoS3Key).catch(console.error);
    }

    // --- AI VALIDATION ---
    const aiResults = await validatePhoto(req.file.buffer, attendee.event);

    // Store new S3 photo data
    attendee.photo = req.s3Data.url;
    attendee.photoS3Key = req.s3Data.key;
    attendee.photoUploadedAt = new Date();
    attendee.photoHash = aiResults.hash;

    // Log stats for audit
    attendee.photoValidationMetrics = {
      faceCount: aiResults.metrics.faceCount,
      faceConfidence: aiResults.metrics.faceConfidence,
      sharpness: aiResults.metrics.sharpness,
      brightness: aiResults.metrics.brightness,
      faceMatchDistance: Number(matchDistance),
      faceMatchSimilarity: Number(matchSimilarity),
      faceMatchThreshold: threshold,
    };

    if (skipFaceMatch) {
      attendee.notes = [attendee.notes, 'Face match skipped during photo resubmission because client models were unavailable.']
        .filter(Boolean)
        .join(' | ');
    }

    if (!aiResults.isValid) {
      attendee.photoVerificationStatus = 'rejected';
      attendee.photoRejectionReason = `AI Auto-Reject: ${aiResults.reason}`;
      await attendee.save();
      return res.status(400).json({ 
        success: false, 
        message: `Photo rejected by AI: ${aiResults.reason.replace(/_/g, ' ')}`,
        data: { aiResults }
      });
    }

    attendee.photoVerificationStatus = 'pending';
    attendee.photoRejectionReason = null; // Clear rejection reason
    attendee.qrCode = null; // Ensure no QR while pending
    await attendee.save();

    res.json({ success: true, message: 'Photo resubmitted successfully. It is now pending organiser verification.' });
  } catch (err) { next(err); }
});

// GET /api/attendees/:id - get single attendee
router.get('/:id', protect, async (req, res, next) => {
  try {
    const attendee = await Attendee.findById(req.params.id).populate('event', 'name venue startDate zones categories');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!(await hasEventAccess(req.user, attendee.event?._id || attendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }
    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

// POST /api/attendees/:id/rfid - assign an event-scoped RFID tag
router.post('/:id/rfid', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff'), async (req, res, next) => {
  try {
    const rfidTag = String(req.body.rfidTag || '').trim();
    const replaceExisting = req.body.replaceExisting === true;
    
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(rfidTag)) {
      return res.status(400).json({ success: false, message: 'rfidTag must be a valid RFID identifier.' });
    }

    const existingAttendee = await Attendee.findById(req.params.id).select('event rfidTag');
    if (!existingAttendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!(await hasEventAccess(req.user, existingAttendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }

    // Enforce constraint: User cannot have multiple RFIDs unless explicitly replacing
    if (existingAttendee.rfidTag && !replaceExisting) {
      return res.status(409).json({ success: false, message: 'This attendee already has an RFID tag assigned.' });
    }

    if (existingAttendee.rfidTag && replaceExisting) return res.status(409).json({ success: false, message: 'Unassign the existing tag before assigning a replacement.' });
    const { attendee } = await require('../services/rfidService').assignRfidToAttendee({ rfidTag, attendeeId: req.params.id, operatorId: req.user._id });
    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

// DELETE /api/attendees/:id/rfid - clear an event-scoped RFID tag
router.delete('/:id/rfid', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff'), async (req, res, next) => {
  try {
    const attendee = await Attendee.findById(req.params.id).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!(await hasEventAccess(req.user, attendee.event?._id || attendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }
    if (attendee.rfidTag) await require('../services/rfidService').unassignRfidFromAttendee({ rfidTag: attendee.rfidTag, operatorId: req.user._id });
    attendee.rfidTag = undefined;
    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

// PATCH /api/attendees/:id - update attendee
router.patch('/:id', protect, restrictTo('MainAdmin', 'MainOrganiser', 'SubOrganiser'), async (req, res, next) => {
  try {
    const existingAttendee = await Attendee.findById(req.params.id).select('event');
    if (!existingAttendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!(await hasEventAccess(req.user, existingAttendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }
    const allowed = ['fullName', 'email', 'phone', 'nationalId', 'notes'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const attendee = await Attendee.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true }).populate('event');
    
    // Trigger notification if status changed to confirmed
    if (req.body.confirmationStatus === 'confirmed') {
      const { notifyFinalTicket } = require('../services/notificationService');
      await notifyFinalTicket({
        attendee,
        event: attendee.event,
        phone: attendee.phone,
        notificationChannel: 'both',
        force: true
      }).catch(console.error);
    }

    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

module.exports = router;
