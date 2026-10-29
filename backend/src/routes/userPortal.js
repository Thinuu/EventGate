const express = require('express');
const mongoose = require('mongoose');
const Attendee = require('../models/Attendee');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Notification = require('../models/Notification');
const { protect, checkRole } = require('../middleware/auth');
const { upload, handleAzureUpload } = require('../middleware/azureUpload');
const { deleteImageFromAzure } = require('../services/azureBlobService');
const QRCode = require('qrcode');
const { requiresPhotoVerification, resolveConfirmedTicketStatus } = require('../services/ticketDeliveryService');
const { notifyFinalTicket, notifyBuyerTicketProgress } = require('../services/notificationService');

const router = express.Router();

const buildAssetUrl = (value) => value || '';

const mapTicket = (ticket) => {
  const event = ticket.event || {};
  const attendee = ticket.attendee || {};
  const order = ticket.order || {};

  return {
    _id: ticket._id,
    ticketNumber: ticket.ticketNumber,
    status: ticket.status,
    categoryId: ticket.categoryId,
    categoryName: ticket.categoryName,
    allowedZones: ticket.allowedZones || [],
    price: ticket.price,
    orderNumber: order.orderNumber,
    orderId: order._id,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: order.status,
    event: event?._id ? {
      _id: event._id,
      name: event.name,
      slug: event.slug,
      description: event.description,
      coverImage: buildAssetUrl(event.coverImage),
      startDate: event.startDate,
      endDate: event.endDate,
      venue: event.venue,
      instructions: event.instructions,
      status: event.status,
      requirePhotoVerification: !!(event.settings?.requirePhotoVerification),
      settings: event.settings,
    } : null,
    inviteSentAt: ticket.inviteSentAt,
    inviteRespondedAt: ticket.inviteRespondedAt,
    refundStatus: ticket.refundStatus,
    refundAmount: ticket.refundAmount,
    refundedAt: ticket.refundedAt,
    invalidatedAt: ticket.invalidatedAt,
    invalidationReason: ticket.invalidationReason,
    attendee: attendee?._id ? {
      _id: attendee._id,
      fullName: attendee.fullName,
      email: attendee.email,
      phone: attendee.phone,
      qrCode: attendee.qrCode,
      qrToken: attendee.qrToken,
      rfidTag: attendee.rfidTag,
      confirmationToken: attendee.confirmationToken,
      confirmationStatus: attendee.confirmationStatus,
      isConfirmed: attendee.isConfirmed,
      confirmedAt: attendee.confirmedAt,
      checkedIn: attendee.checkedIn,
      allowedZones: attendee.allowedZones || ticket.allowedZones || [],
      photo: attendee.photo,
      photoVerificationStatus: attendee.photoVerificationStatus,
      photoRejectionReason: attendee.photoRejectionReason,
      resubmitToken: attendee.resubmitToken,
    } : null,
  };
};

const getUserScopedTickets = async (user) => {
  const email = user.email?.toLowerCase?.() || '';

  const [orders, attendees] = await Promise.all([
    Order.find({ buyerEmail: email }).select('_id'),
    Attendee.find({ email }).select('_id ticket'),
  ]);

  const orderIds = orders.map((order) => order._id);
  const attendeeIds = attendees.map((attendee) => attendee._id);
  const attendeeTicketIds = attendees.map((attendee) => attendee.ticket).filter(Boolean);

  const query = {
    $or: [
      orderIds.length ? { order: { $in: orderIds } } : null,
      attendeeIds.length ? { attendee: { $in: attendeeIds } } : null,
      attendeeTicketIds.length ? { _id: { $in: attendeeTicketIds } } : null,
    ].filter(Boolean),
  };

  if (!query.$or.length) {
    return [];
  }

  return Ticket.find(query)
    .populate('event', 'name slug description coverImage startDate endDate venue zones categories settings')
    .populate('attendee', 'fullName email phone qrCode qrToken rfidTag confirmationStatus isConfirmed checkedIn allowedZones photo photoVerificationStatus photoRejectionReason resubmitToken')
    .populate('order', 'orderNumber buyerName buyerEmail buyerPhone totalAmount status createdAt paymentMethod paymentStatus')
    .sort({ createdAt: -1 });
};

router.use(protect, checkRole(['BUYER']));

const isUserAllowedToManageAttendee = async ({ user, attendee }) => {
  if (!user || !attendee) return false;
  const email = user.email?.toLowerCase?.() || '';
  if (attendee.email && attendee.email.toLowerCase() === email) return true;

  if (attendee.order) {
    const order = await Order.findById(attendee.order).select('buyerEmail');
    if (order?.buyerEmail?.toLowerCase?.() === email) return true;
  }

  return false;
};

// GET /api/user/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const tickets = await getUserScopedTickets(req.user);
    const now = new Date();

    const normalizedTickets = tickets.map(mapTicket);
    const upcomingEvents = normalizedTickets
      .filter((ticket) => ticket.event?.startDate && new Date(ticket.event.startDate) >= now)
      .sort((a, b) => new Date(a.event.startDate) - new Date(b.event.startDate));

    const pastEvents = normalizedTickets
      .filter((ticket) => ticket.event?.endDate && new Date(ticket.event.endDate) < now)
      .sort((a, b) => new Date(b.event.endDate) - new Date(a.event.endDate));

    const notifications = normalizedTickets
      .map((ticket) => {
        if (ticket.status === 'PENDING' || ticket.status === 'INVITED') {
          return {
            id: `${ticket._id}-pending`,
            type: 'action_required',
            message: `${ticket.event?.name || 'Your event'} ticket still needs confirmation.`,
          };
        }
        if (ticket.status === 'CONFIRMED' && ticket.event?.startDate) {
          return {
            id: `${ticket._id}-confirmed`,
            type: 'ticket_ready',
            message: `Your ticket for ${ticket.event.name} is ready to use.`,
          };
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, 6);

    res.json({
      success: true,
      data: {
        upcomingEvents,
        pastEvents,
        tickets: normalizedTickets,
        notifications,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/user/events - unique events for the user
router.get('/events', async (req, res, next) => {
  try {
    const tickets = await getUserScopedTickets(req.user);
    const normalizedTickets = tickets.map(mapTicket);

    const byId = new Map();
    normalizedTickets.forEach((ticket) => {
      if (ticket.event?._id) {
        byId.set(String(ticket.event._id), ticket.event);
      }
    });

    res.json({
      success: true,
      data: {
        events: Array.from(byId.values()).sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/user/tickets
router.get('/tickets', async (req, res, next) => {
  try {
    const tickets = await getUserScopedTickets(req.user);
    res.json({
      success: true,
      data: {
        tickets: tickets.map(mapTicket),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/user/ticket/:id
router.get('/ticket/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
    }

    const tickets = await getUserScopedTickets(req.user);
    const ticket = tickets.find((item) => item._id.toString() === req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    res.json({
      success: true,
      data: {
        ticket: mapTicket(ticket),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/user/profile
router.get('/profile', async (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        isVerified: req.user.isVerified,
        createdAt: req.user.createdAt,
        lastLogin: req.user.lastLogin,
        mfaEnabled: req.user.mfaEnabled,
        profilePhoto: req.user.profilePhoto,
      },
    },
  });
});

// PUT /api/user/profile
router.put('/profile', async (req, res, next) => {
  try {
    const previousEmail = req.user.email;
    const updateData = {
      name: req.body.name?.trim(),
      email: req.body.email?.trim()?.toLowerCase?.(),
      phone: req.body.phone?.trim(),
    };

    Object.keys(updateData).forEach((key) => {
      if (!updateData[key]) delete updateData[key];
    });

    const user = await req.user.constructor.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (previousEmail && user.email && previousEmail !== user.email) {
      await Promise.all([
        Order.updateMany(
          { buyerEmail: previousEmail },
          {
            $set: {
              buyerEmail: user.email,
              ...(user.name ? { buyerName: user.name } : {}),
              ...(user.phone ? { buyerPhone: user.phone } : {}),
            },
          }
        ),
        Attendee.updateMany(
          { email: previousEmail },
          {
            $set: {
              email: user.email,
              ...(user.phone ? { phone: user.phone } : {}),
            },
          }
        ),
      ]);
    } else {
      await Order.updateMany(
        { buyerEmail: user.email },
        {
          $set: {
            ...(user.name ? { buyerName: user.name } : {}),
            ...(user.phone ? { buyerPhone: user.phone } : {}),
          },
        }
      );
    }

    res.json({
      success: true,
      data: {
        user,
      },
      message: 'Profile updated successfully.',
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/user/notifications
router.get('/notifications', async (req, res, next) => {
  try {
    const { unreadOnly, limit = 20 } = req.query;
    const filter = { user: req.user._id };
    if (unreadOnly === 'true') filter.read = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 20, 50));

    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/user/notifications/:id/read
router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    res.json({ success: true, data: { notification } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/user/notifications/mark-all-read
router.patch('/notifications/mark-all-read', async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/user/notifications/:id
router.delete('/notifications/:id', async (req, res, next) => {
  try {
    const deleted = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    res.json({ success: true, message: 'Notification deleted.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/user/confirm/:token - fetch attendee confirmation info (scoped)
router.get('/confirm/:token', async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ confirmationToken: req.params.token }).populate('event', 'name venue startDate endDate settings instructions');
    if (!attendee) return res.status(404).json({ success: false, message: 'Invalid confirmation link.' });
    if (!(await isUserAllowedToManageAttendee({ user: req.user, attendee }))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this confirmation link.' });
    }
    res.json({
      success: true,
      data: {
        attendee,
        event: attendee.event,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/user/confirm/:token - submit confirmation (scoped)
router.post('/confirm/:token', upload.single('photo'), handleAzureUpload('attendee-photos'), async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ confirmationToken: req.params.token }).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Invalid confirmation link.' });
    if (!(await isUserAllowedToManageAttendee({ user: req.user, attendee }))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this confirmation link.' });
    }
    if (attendee.confirmationStatus === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Already confirmed.' });
    }

    const { fullName, email, phone, dateOfBirth, nationalId, passportNumber, nationality } = req.body;
    const smsEnabled = !!attendee.event?.settings?.communicationChannels?.sms;
    if (!fullName || !email) {
      return res.status(400).json({ success: false, message: 'fullName and email are required.' });
    }
    if (smsEnabled && !String(phone || '').trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required when SMS notifications are enabled for this event.' });
    }

    attendee.fullName = String(fullName).trim();
    attendee.email = String(email).trim().toLowerCase();
    attendee.phone = phone ? String(phone).trim() : undefined;
    if (dateOfBirth) attendee.dateOfBirth = new Date(dateOfBirth);
    if (nationalId) attendee.nationalId = nationalId;
    if (passportNumber) attendee.passportNumber = passportNumber;
    if (nationality) attendee.nationality = nationality;

    if (req.s3Data) {
      attendee.photo = req.s3Data.url;
      attendee.photoS3Key = req.s3Data.key;
      attendee.photoUploadedAt = new Date();
      attendee.photoVerificationStatus = 'pending';
      attendee.photoRejectionReason = null;
    }

    const needsPhotoApproval = requiresPhotoVerification(attendee.event) && attendee.photo;

    attendee.confirmationStatus = 'confirmed';
    attendee.isConfirmed = true;
    attendee.confirmedAt = new Date();
    attendee.confirmedBy = 'self';

    if (!needsPhotoApproval) {
      attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
    } else {
      attendee.qrCode = null;
    }

    await attendee.save();
    const nextTicketStatus = resolveConfirmedTicketStatus({ attendee, event: attendee.event });
    const ticket = await Ticket.findOneAndUpdate({ attendee: attendee._id }, { status: nextTicketStatus }, { new: true });

    if (!requiresPhotoVerification(attendee.event)) {
      await notifyFinalTicket({
        attendee,
        event: attendee.event,
        phone: attendee.phone,
        notificationChannel: 'email',
      }).catch(console.error);
    } else {
      const order = attendee.order ? await Order.findById(attendee.order) : null;
      await notifyBuyerTicketProgress({
        order,
        attendee,
        event: attendee.event,
        ticket,
        stage: 'pending_verification',
      });
    }

    res.json({ success: true, data: { attendee }, message: 'Identity confirmed successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/user/upload-photo - upload / re-upload photo for a ticket you own
router.post('/upload-photo', upload.single('photo'), handleAzureUpload('attendee-photos'), async (req, res, next) => {
  try {
    const { ticketId } = req.body;
    if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({ success: false, message: 'Valid ticketId is required.' });
    }
    if (!req.s3Data) {
      return res.status(400).json({ success: false, message: 'Photo is required.' });
    }

    const tickets = await getUserScopedTickets(req.user);
    const ticket = tickets.find((item) => item._id.toString() === ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const attendeeId = ticket.attendee?._id || ticket.attendee;
    if (!attendeeId) return res.status(400).json({ success: false, message: 'No attendee is linked to this ticket yet.' });

    const attendee = await Attendee.findById(attendeeId);
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!(await isUserAllowedToManageAttendee({ user: req.user, attendee }))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }

    if (attendee.photoS3Key) {
      await deleteImageFromS3(attendee.photoS3Key).catch(() => null);
    }

    attendee.photo = req.s3Data.url;
    attendee.photoS3Key = req.s3Data.key;
    attendee.photoUploadedAt = new Date();
    attendee.photoVerificationStatus = 'pending';
    attendee.photoRejectionReason = null;
    attendee.qrCode = null;
    attendee.resubmitCount = (attendee.resubmitCount || 0) + 1;

    await attendee.save();
    await Ticket.findOneAndUpdate({ attendee: attendee._id }, { status: 'PENDING_VERIFICATION' });
    res.json({ success: true, data: { attendee }, message: 'Photo uploaded successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
