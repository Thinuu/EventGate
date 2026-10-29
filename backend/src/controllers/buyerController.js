const mongoose = require('mongoose');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('../utils/spreadsheet');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const PaymentSubmission = require('../models/PaymentSubmission');
const { notifyInvite, notifyFinalTicket, notifyBuyerTicketProgress } = require('../services/notificationService');
const { requiresPhotoVerification, resolveConfirmedTicketStatus } = require('../services/ticketDeliveryService');
const { applyValidatedPhotoUpload } = require('../services/photoUploadService');
const { allocateRfid, linkReservedRfidToAttendee } = require('../services/rfidService');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const ensureAttendeeRfidTag = async ({ attendee, eventId, categoryId, ticketId, order }) => {
  if (!attendee || attendee.rfidTag) return attendee;
  const isPaid = ['paid', 'success'].includes(String(order?.paymentStatus || '').toLowerCase())
    || order?.status === 'CONFIRMED';
  if (!isPaid) return attendee;
  const nextTag = await allocateRfid({
    eventId,
    categoryId,
    attendeeId: attendee._id,
    ticketId,
  });
  if (nextTag) {
    attendee.rfidTag = nextTag;
    await attendee.save();
  }
  return attendee;
};

const buildTicketSummary = (ticket) => ({
  _id: ticket._id,
  ticketNumber: ticket.ticketNumber,
  status: ticket.status,
  categoryId: ticket.categoryId,
  categoryName: ticket.categoryId?.name || ticket.categoryName,
  allowedZones: ticket.allowedZones || [],
  slotIndex: ticket.slotIndex,
  inviteEmail: ticket.inviteEmail,
  invitePhone: ticket.invitePhone,
  inviteSentAt: ticket.inviteSentAt,
  inviteRespondedAt: ticket.inviteRespondedAt,
  refundStatus: ticket.refundStatus,
  refundAmount: ticket.refundAmount,
  refundedAt: ticket.refundedAt,
  invalidatedAt: ticket.invalidatedAt,
  invalidationReason: ticket.invalidationReason,
  attendee: ticket.attendee ? {
    _id: ticket.attendee._id,
    fullName: ticket.attendee.fullName,
    email: ticket.attendee.email,
    phone: ticket.attendee.phone,
    qrCode: ticket.attendee.qrCode,
    qrToken: ticket.attendee.qrToken,
    rfidTag: ticket.attendee.rfidTag,
    confirmationStatus: ticket.attendee.confirmationStatus,
    isConfirmed: ticket.attendee.isConfirmed,
    confirmedAt: ticket.attendee.confirmedAt,
    photo: ticket.attendee.photo,
    photoVerificationStatus: ticket.attendee.photoVerificationStatus,
    photoRejectionReason: ticket.attendee.photoRejectionReason,
    resubmitToken: ticket.attendee.resubmitToken,
  } : null,
});

const getBuyerOrders = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.user.email);
      const userId = req.user?._id?.toString();
      const orderQuery = userId
        ? { $or: [{ buyerEmail: email }, { buyerId: userId }] }
        : { buyerEmail: email };
      
      // Add status filter if provided
      if (req.query.status && req.query.status !== 'all') {
        orderQuery.status = req.query.status;
      }
      
      const orders = await Order.find(orderQuery)
        .populate('eventId', 'name startDate venue settings')

    const orderIds = orders.map((order) => order._id);
    const tickets = await Ticket.find({ order: { $in: orderIds } })
      .populate('attendee', 'fullName email confirmationStatus isConfirmed');

    // Fetch payment submissions for bank transfer orders
    const bankTransferOrderIds = orders
      .filter((order) => order.paymentMethod === 'bank_transfer')
      .map((order) => order._id);
    
    const paymentSubmissions = bankTransferOrderIds.length > 0 
      ? await PaymentSubmission.find({ orderId: { $in: bankTransferOrderIds } })
          .populate('verifiedBy', 'name email')
          .sort({ submittedAt: -1 })
      : [];
    
    // Create a map of orderId to payment submission for easy lookup
    const paymentSubmissionMap = {};
    paymentSubmissions.forEach((submission) => {
      paymentSubmissionMap[submission.orderId.toString()] = submission;
    });

    const ticketGroups = tickets.reduce((acc, ticket) => {
      const key = ticket.order.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(ticket);
      return acc;
    }, {});

    const results = orders.map((order) => {
      const list = ticketGroups[order._id.toString()] || [];
      const confirmed = list.filter((t) => t.status === 'CONFIRMED').length;
      const total = list.length;
      const allConfirmed = total > 0 && confirmed === total;
      const paymentSubmission = paymentSubmissionMap[order._id.toString()];
      const assigned = list.filter((t) => Boolean(t.attendee)).length;

      // Group tickets by category
      const categoryMap = {};
      (order.tickets || []).forEach((item) => {
        categoryMap[item.categoryName] = {
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          quantity: item.quantity,
          price: item.price,
          assigned: 0,
        };
      });

      list.forEach((t) => {
        if (categoryMap[t.categoryName] && t.attendee) {
          categoryMap[t.categoryName].assigned += 1;
        }
      });

      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        currency: order.eventId?.settings?.currency || 'LKR',
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        buyerPhone: order.buyerPhone,
        confirmationStatus: allConfirmed ? 'All Confirmed' : 'Pending',
        createdAt: order.createdAt,
        stats: {
          total,
          confirmed,
          assigned,
        },
        categories: Object.values(categoryMap),
        paymentSubmission: paymentSubmission ? {
          _id: paymentSubmission._id,
          payerName: paymentSubmission.payerName,
          payerEmail: paymentSubmission.payerEmail,
          payerPhone: paymentSubmission.payerPhone,
          bankUsed: paymentSubmission.bankUsed,
          transferDate: paymentSubmission.transferDate,
          transferTime: paymentSubmission.transferTime,
          referenceNumber: paymentSubmission.referenceNumber,
          amountPaid: paymentSubmission.amountPaid,
          receiptFile: paymentSubmission.receiptFile,
          receiptFileType: paymentSubmission.receiptFileType,
          verificationStatus: paymentSubmission.verificationStatus,
          rejectionReason: paymentSubmission.rejectionReason,
          submittedAt: paymentSubmission.submittedAt,
          verifiedAt: paymentSubmission.verifiedAt,
        } : null,
        event: order.eventId ? {
          _id: order.eventId._id,
          name: order.eventId.name,
          startDate: order.eventId.startDate,
          venue: order.eventId.venue,
          currency: order.eventId.settings?.currency || 'LKR',
          mainOrganisers: order.eventId.mainOrganisers || [],
        } : null,
        progress: { confirmed, total },
      };
    });

    res.json({ success: true, data: { orders: results } });
  } catch (err) { next(err); }
};

const getBuyerOrderDetails = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }
    const email = normalizeEmail(req.user.email);
    const userId = req.user?._id?.toString();
    const order = await Order.findById(req.params.orderId).populate({
      path: 'eventId',
      select: 'name startDate venue endDate settings mainOrganisers',
      populate: { path: 'mainOrganisers', select: 'name email phone' }
    });
    const isOwnerByEmail = order && normalizeEmail(order.buyerEmail) === email;
    const isOwnerByUserId = order && userId && order.buyerId && order.buyerId.toString() === userId;

    if (!order || (!isOwnerByEmail && !isOwnerByUserId)) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const tickets = await Ticket.find({ order: order._id })
      .populate('attendee', 'fullName email phone confirmationStatus isConfirmed photo qrCode qrToken rfidTag photoVerificationStatus photoRejectionReason resubmitToken')
      .populate('categoryId', 'name')
      .sort({ slotIndex: 1 });

    const confirmed = tickets.filter((t) => t.status === 'CONFIRMED').length;

    // Fetch payment submission for bank transfer orders
    let paymentSubmission = null;
    if (order.paymentMethod === 'bank_transfer') {
      paymentSubmission = await PaymentSubmission.findOne({ orderId: order._id })
        .populate('verifiedBy', 'name email');
    }

    res.json({
      success: true,
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          currency: order.eventId?.settings?.currency || 'LKR',
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          buyerPhone: order.buyerPhone,
          paymentSubmission: paymentSubmission ? {
            _id: paymentSubmission._id,
            payerName: paymentSubmission.payerName,
            payerEmail: paymentSubmission.payerEmail,
            payerPhone: paymentSubmission.payerPhone,
            bankUsed: paymentSubmission.bankUsed,
            transferDate: paymentSubmission.transferDate,
            transferTime: paymentSubmission.transferTime,
            referenceNumber: paymentSubmission.referenceNumber,
            amountPaid: paymentSubmission.amountPaid,
            receiptFile: paymentSubmission.receiptFile,
            receiptFileType: paymentSubmission.receiptFileType,
            verificationStatus: paymentSubmission.verificationStatus,
            rejectionReason: paymentSubmission.rejectionReason,
            submittedAt: paymentSubmission.submittedAt,
            verifiedAt: paymentSubmission.verifiedAt,
          } : null,
          event: order.eventId ? {
            _id: order.eventId._id,
            name: order.eventId.name,
            startDate: order.eventId.startDate,
            endDate: order.eventId.endDate,
            venue: order.eventId.venue,
            currency: order.eventId.settings?.currency || 'LKR',
            mainOrganisers: order.eventId.mainOrganisers || [],
          } : null,
          progress: { confirmed, total: tickets.length },
        },
        tickets: tickets.map(buildTicketSummary),
      },
    });
  } catch (err) { next(err); }
};

const assignSelfToTicket = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.ticketId)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
    }
    const email = normalizeEmail(req.user.email);
    const ticket = await Ticket.findById(req.params.ticketId).populate('order').populate('event');
    if (!ticket || normalizeEmail(ticket.order?.buyerEmail) !== email) {
      return res.status(403).json({ success: false, message: 'Not authorized for this ticket.' });
    }

    let attendee = ticket.attendee ? await Attendee.findById(ticket.attendee) : null;
    if (!attendee) {
      attendee = new Attendee({
        order: ticket.order._id,
        event: ticket.event._id,
        ticket: ticket._id,
        categoryId: ticket.categoryId,
        categoryName: ticket.categoryName,
        allowedZones: ticket.allowedZones || [],
        confirmationToken: uuidv4(),
        qrToken: uuidv4(),
        addedVia: 'self_purchase',
      });
    }

    const { fullName, phone, dateOfBirth, nationalId, passportNumber, nationality } = req.body;
    attendee.fullName = fullName;
    attendee.email = email;
    attendee.phone = phone;
    if (dateOfBirth) attendee.dateOfBirth = new Date(dateOfBirth);
    if (nationalId) attendee.nationalId = nationalId;
    if (passportNumber) attendee.passportNumber = passportNumber;
    if (nationality) attendee.nationality = nationality;

    if (requiresPhotoVerification(ticket.event) && !req.s3Data && !attendee.photo) {
      return res.status(400).json({ success: false, message: 'Identity verification photo is required for this event.' });
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
    }

    const needsPhotoApproval = requiresPhotoVerification(ticket.event) && attendee.photo;

    if (!needsPhotoApproval) {
      if (!attendee.qrToken) attendee.qrToken = uuidv4();
      attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
    }

    attendee.confirmationStatus = 'confirmed';
    attendee.isConfirmed = true;
    attendee.confirmedAt = new Date();
    attendee.confirmedBy = 'self';

    await attendee.save();
    if (!attendee.rfidTag) {
      attendee.rfidTag = await linkReservedRfidToAttendee({ ticketId: ticket._id, attendeeId: attendee._id });
      if (attendee.rfidTag) await attendee.save();
    }
    await ensureAttendeeRfidTag({
      attendee,
      eventId: ticket.event?._id || ticket.event,
      categoryId: ticket.categoryId || attendee.categoryId,
      ticketId: ticket._id,
      order: ticket.order,
    });
    ticket.attendee = attendee._id;
    const nextTicketStatus = resolveConfirmedTicketStatus({ attendee, event: ticket.event });
    ticket.status = needsPhotoApproval ? 'PENDING_VERIFICATION' : nextTicketStatus;
    await ticket.save();

    // Update order confirmation status
    const tickets = await Ticket.find({ order: ticket.order._id });
    const confirmedCount = tickets.filter((t) => t.status === 'CONFIRMED').length;
    const confirmationStatus = confirmedCount === tickets.length ? 'complete' : 'partial';
    await Order.findByIdAndUpdate(ticket.order._id, { confirmationStatus });

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
        notificationChannel: 'email',
      });
    }

    res.json({ success: true, data: { attendee }, message: 'Details submitted successfully.' });
  } catch (err) { next(err); }
};

const inviteForTicket = async (req, res, next) => {
  try {
    const { email, phone, notificationChannel } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const ticket = await Ticket.findById(req.params.ticketId).populate('order').populate('event');
    if (!ticket || normalizeEmail(ticket.order?.buyerEmail) !== normalizeEmail(req.user.email)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this ticket.' });
    }
    
    console.log('Buyer invite debug:', {
      ticketId: req.params.ticketId,
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
      return res.status(400).json({ success: false, message: 'Ticket already assigned.' });
    }
    */

    const attendee = new Attendee({
      order: ticket.order._id,
      event: ticket.event._id,
      ticket: ticket._id,
      email,
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
    await ensureAttendeeRfidTag({
      attendee,
      eventId: ticket.event?._id || ticket.event,
      categoryId: ticket.categoryId || attendee.categoryId,
      ticketId: ticket._id,
      order: ticket.order,
    });

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
  } catch (err) { next(err); }
};

module.exports = {
  getBuyerOrders,
  getBuyerOrderDetails,
  assignSelfToTicket,
  inviteForTicket,
  getBuyerTickets: async (req, res, next) => {
    try {
      const email = normalizeEmail(req.user.email);
      const userId = req.user?._id?.toString();
      const orderQuery = userId
        ? { $or: [{ buyerEmail: email }, { buyerId: userId }] }
        : { buyerEmail: email };
      const orders = await Order.find(orderQuery)
        .populate('eventId', 'name startDate endDate venue coverImage description settings instructions status')
        .sort({ createdAt: -1 });

      const orderIds = orders.map((o) => o._id);
      const tickets = await Ticket.find({ order: { $in: orderIds } })
        .populate('attendee', 'fullName email phone confirmationStatus isConfirmed photo qrCode qrToken rfidTag')
        .populate('event', 'name startDate endDate venue coverImage settings instructions status')
        .sort({ createdAt: -1 });

      // Fetch payment submissions for bank transfer orders
      const bankTransferOrderIds = orders
        .filter((order) => order.paymentMethod === 'bank_transfer')
        .map((order) => order._id);
      
      const paymentSubmissions = bankTransferOrderIds.length > 0 
        ? await PaymentSubmission.find({ orderId: { $in: bankTransferOrderIds } })
            .populate('verifiedBy', 'name email')
            .sort({ submittedAt: -1 })
        : [];
      
      // Create a map of orderId to payment submission for easy lookup
      const paymentSubmissionMap = {};
      paymentSubmissions.forEach((submission) => {
        paymentSubmissionMap[submission.orderId.toString()] = submission;
      });

      const normalizedOrders = orders.map((order) => {
        const orderTickets = tickets.filter((t) => t.order?.toString?.() === order._id.toString());
        const assigned = orderTickets.filter((t) => ['INVITED', 'PENDING_VERIFICATION', 'ASSIGNED', 'CONFIRMED'].includes(t.status)).length;
        const pending = orderTickets.filter((t) => t.status === 'PENDING').length;
        const paymentSubmission = paymentSubmissionMap[order._id.toString()];

        const byCategory = orderTickets.reduce((acc, ticket) => {
          const key = ticket.categoryId || ticket.categoryName || 'unknown';
          if (!acc[key]) {
            acc[key] = {
              categoryId: ticket.categoryId,
              categoryName: ticket.categoryName,
              quantity: 0,
              assigned: 0,
              pending: 0,
              ticketIds: [],
            };
          }
          acc[key].quantity += 1;
          acc[key].ticketIds.push(ticket._id);
          if (ticket.status === 'PENDING') acc[key].pending += 1;
          else acc[key].assigned += 1;
          return acc;
        }, {});

        return {
          _id: order._id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          buyerPhone: order.buyerPhone,
          currency: order.eventId?.settings?.currency || 'LKR',
          event: order.eventId ? {
            _id: order.eventId._id,
            name: order.eventId.name,
            startDate: order.eventId.startDate,
            endDate: order.eventId.endDate,
            venue: order.eventId.venue,
            coverImage: order.eventId.coverImage,
            description: order.eventId.description,
            status: order.eventId.status,
            requirePhotoVerification: !!(order.eventId.settings?.requirePhotoVerification),
            currency: order.eventId.settings?.currency || 'LKR',
            instructions: order.eventId.instructions || '',
          } : null,
          stats: {
            total: orderTickets.length,
            assigned,
            pending,
          },
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod || null,
          paymentStatus: order.paymentStatus || null,
          paymentSubmission: paymentSubmission ? {
            _id: paymentSubmission._id,
            payerName: paymentSubmission.payerName,
            payerEmail: paymentSubmission.payerEmail,
            payerPhone: paymentSubmission.payerPhone,
            bankUsed: paymentSubmission.bankUsed,
            transferDate: paymentSubmission.transferDate,
            transferTime: paymentSubmission.transferTime,
            referenceNumber: paymentSubmission.referenceNumber,
            amountPaid: paymentSubmission.amountPaid,
            receiptFile: paymentSubmission.receiptFile,
            receiptFileType: paymentSubmission.receiptFileType,
            verificationStatus: paymentSubmission.verificationStatus,
            rejectionReason: paymentSubmission.rejectionReason,
            submittedAt: paymentSubmission.submittedAt,
            verifiedAt: paymentSubmission.verifiedAt,
          } : null,
          categories: Object.values(byCategory).sort((a, b) => (a.categoryName || '').localeCompare(b.categoryName || '')),
        };
      });

      res.json({ success: true, data: { orders: normalizedOrders } });
    } catch (err) {
      next(err);
    }
  },
  assignAttendeeToTicket: async (req, res, next) => {
    try {
      const { ticketId, fullName, email, phone, notificationChannel } = req.body;
      if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
        return res.status(400).json({ success: false, message: 'Valid ticketId is required.' });
      }
      if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

      const ticket = await Ticket.findById(ticketId).populate('order').populate('event').populate('attendee');
      if (!ticket || normalizeEmail(ticket.order?.buyerEmail) !== normalizeEmail(req.user.email)) {
        return res.status(403).json({ success: false, message: 'Not authorized for this ticket.' });
      }
      
      console.log('Buyer assign debug:', {
        ticketId,
        currentStatus: ticket.status,
        attendee: ticket.attendee,
        orderStatus: ticket.order?.status,
        paymentStatus: ticket.order?.paymentStatus
      });
      
      // Temporarily remove status check to debug
      // Only check if ticket already has an attendee
      if (ticket.attendee) {
        console.log('Ticket already has attendee:', ticket.attendee);
        return res.status(400).json({ success: false, message: 'Ticket already assigned.' });
      }

      const attendee = new Attendee({
        order: ticket.order._id,
        event: ticket.event._id,
        ticket: ticket._id,
        fullName: fullName || '',
        email: String(email).trim().toLowerCase(),
        phone: phone || '',
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
      await ensureAttendeeRfidTag({
        attendee,
        eventId: ticket.event?._id || ticket.event,
        categoryId: ticket.categoryId || attendee.categoryId,
        ticketId: ticket._id,
        order: ticket.order,
      });

      ticket.attendee = attendee._id;
      ticket.inviteEmail = attendee.email;
      ticket.invitePhone = attendee.phone;
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
        phone: attendee.phone,
        email: attendee.email,
        notificationChannel: notificationChannel || 'email',
      });

      await notifyBuyerTicketProgress({
        order: ticket.order,
        attendee,
        event: ticket.event,
        ticket,
        stage: 'invited',
      });

      res.json({ success: true, data: { attendee }, message: 'Invite sent successfully.' });
    } catch (err) {
      next(err);
    }
  },
  getBuyerInvites: async (req, res, next) => {
    try {
      const email = normalizeEmail(req.user.email);
      const orders = await Order.find({ buyerEmail: email }).select('_id');
      const orderIds = orders.map((o) => o._id);

      const tickets = await Ticket.find({ order: { $in: orderIds }, status: { $in: ['INVITED', 'PENDING_VERIFICATION', 'CONFIRMED'] } })
        .populate('event', 'name startDate venue coverImage')
        .populate('attendee', 'fullName email phone confirmationStatus photoVerificationStatus photoRejectionReason resubmitToken confirmationToken');

      const invites = tickets
        .filter((t) => t.attendee)
        .map((t) => ({
          ticketId: t._id,
          status: t.status,
          inviteSentAt: t.inviteSentAt,
          inviteExpiresAt: t.inviteExpiresAt,
          inviteUsedAt: t.inviteUsedAt,
          event: t.event ? {
            _id: t.event._id,
            name: t.event.name,
            startDate: t.event.startDate,
            venue: t.event.venue,
            coverImage: t.event.coverImage,
          } : null,
          attendee: {
            _id: t.attendee._id,
            fullName: t.attendee.fullName || '',
            email: t.attendee.email || '',
            phone: t.attendee.phone || '',
            confirmationStatus: t.attendee.confirmationStatus,
            photoVerificationStatus: t.attendee.photoVerificationStatus,
            photoRejectionReason: t.attendee.photoRejectionReason,
            resubmitToken: t.attendee.resubmitToken,
            confirmationToken: t.attendee.confirmationToken,
          },
        }))
        .sort((a, b) => new Date(b.inviteSentAt || 0) - new Date(a.inviteSentAt || 0));

      res.json({ success: true, data: { invites } });
    } catch (err) {
      next(err);
    }
  },
  resendInviteForTicket: async (req, res, next) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.ticketId)) {
        return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
      }
      const ticket = await Ticket.findById(req.params.ticketId).populate('order').populate('event').populate('attendee');
      if (!ticket || normalizeEmail(ticket.order?.buyerEmail) !== normalizeEmail(req.user.email)) {
        return res.status(403).json({ success: false, message: 'Not authorized for this ticket.' });
      }
      if (!ticket.attendee) {
        return res.status(400).json({ success: false, message: 'No attendee attached to this ticket.' });
      }
      if (!['INVITED', 'PENDING_VERIFICATION'].includes(ticket.status)) {
        return res.status(400).json({ success: false, message: 'Invite can only be resent for invited tickets.' });
      }

      const attendee = await Attendee.findById(ticket.attendee);
      if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });

      ticket.inviteSentAt = new Date();
      ticket.inviteExpiresAt = new Date(Date.now() + (parseInt(process.env.INVITE_TOKEN_EXPIRY_HOURS || '72', 10) * 60 * 60 * 1000));
      await ticket.save();

      await notifyInvite({
        attendee,
        event: ticket.event,
        phone: attendee.phone,
        email: attendee.email,
        notificationChannel: req.body.notificationChannel || 'email',
      });

      await notifyBuyerTicketProgress({
        order: ticket.order,
        attendee,
        event: ticket.event,
        ticket,
        stage: 'invited',
      });

      res.json({ success: true, message: 'Invite resent successfully.' });
    } catch (err) {
      next(err);
    }
  },
  bulkAssignFromSheet: async (req, res, next) => {
    try {
      const { orderId, notificationChannel } = req.body;
      if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ success: false, message: 'Valid orderId is required.' });
      }
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, message: 'Excel/CSV file is required.' });
      }

      const buyerEmail = normalizeEmail(req.user.email);
      const order = await Order.findById(orderId).populate('eventId');
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }
      if (normalizeEmail(order.buyerEmail) !== buyerEmail) {
        return res.status(403).json({ success: false, message: 'You do not have access to this order.' });
      }

      const workbook = await XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const pick = (obj, keys) => {
        for (const key of keys) {
          if (obj && Object.prototype.hasOwnProperty.call(obj, key) && String(obj[key]).trim()) return obj[key];
        }
        return '';
      };

      const normalizedRows = rows
        .map((row) => ({
          fullName: pick(row, ['fullName', 'FullName', 'name', 'Name', 'Full Name', 'FULL NAME']),
          email: pick(row, ['email', 'Email', 'E-mail', 'E-Mail', 'EMAIL']),
          phone: pick(row, ['phone', 'Phone', 'Phone Number', 'phoneNumber', 'PhoneNumber', 'MOBILE', 'Mobile']),
        }))
        .filter((r) => String(r.email || '').trim());

      if (normalizedRows.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid rows found. Expect columns: fullName, email, phone.' });
      }

      const pendingTickets = await Ticket.find({ order: order._id, status: 'PENDING' }).populate('event').sort({ slotIndex: 1 });
      if (pendingTickets.length === 0) {
        return res.status(400).json({ success: false, message: 'No pending ticket slots available for this order.' });
      }

      const assignCount = Math.min(pendingTickets.length, normalizedRows.length);
      const results = [];

      for (let i = 0; i < assignCount; i += 1) {
        const ticket = pendingTickets[i];
        const row = normalizedRows[i];

        const attendee = new Attendee({
          order: order._id,
          event: ticket.event?._id || ticket.event,
          ticket: ticket._id,
          fullName: row.fullName || '',
          email: String(row.email).trim().toLowerCase(),
          phone: row.phone || '',
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
        await ensureAttendeeRfidTag({
          attendee,
          eventId: ticket.event?._id || ticket.event,
          categoryId: ticket.categoryId || attendee.categoryId,
          ticketId: ticket._id,
          order,
        });

        ticket.attendee = attendee._id;
        ticket.inviteEmail = attendee.email;
        ticket.invitePhone = attendee.phone;
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
          phone: attendee.phone,
          email: attendee.email,
          notificationChannel: notificationChannel || 'email',
        });

        await notifyBuyerTicketProgress({
          order,
          attendee,
          event: ticket.event,
          ticket,
          stage: 'invited',
        });

        results.push({ ticketId: ticket._id, attendeeId: attendee._id, email: attendee.email });
      }

      res.json({
        success: true,
        data: {
          assigned: results.length,
          skipped: Math.max(0, normalizedRows.length - results.length),
          results,
        },
        message: `Assigned ${results.length} attendee(s).`,
      });
    } catch (err) {
      next(err);
    }
  },
  cancelOrder: async (req, res, next) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.orderId)) {
        return res.status(400).json({ success: false, message: 'Invalid order ID.' });
      }
      const email = normalizeEmail(req.user.email);
      const { reason } = req.body;

      const order = await Order.findById(req.params.orderId);
      if (!order || normalizeEmail(order.buyerEmail) !== email) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      // Only allow cancellation for PENDING or CONFIRMED orders
      if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel order with status: ${order.status}`
        });
      }

      // Update order status
      order.status = 'CANCELLED';
      order.cancelReason = reason || 'No reason provided';
      order.cancelledAt = new Date();
      order.cancelledBy = req.user._id;
      await order.save();

      // Update all tickets in the order
      await Ticket.updateMany(
        { order: order._id },
        {
          $set: {
            status: 'CANCELLED',
            invalidatedAt: new Date(),
            invalidationReason: reason || 'Order cancelled'
          }
        }
      );

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        data: { orderId: order._id, status: order.status }
      });
    } catch (err) {
      next(err);
    }
  },
  requestRefund: async (req, res, next) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.orderId)) {
        return res.status(400).json({ success: false, message: 'Invalid order ID.' });
      }
      const email = normalizeEmail(req.user.email);
      const { reason } = req.body;

      if (!reason || reason.trim().length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Refund reason must be at least 10 characters.'
        });
      }

      const order = await Order.findById(req.params.orderId);
      if (!order || normalizeEmail(order.buyerEmail) !== email) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      // Only allow refunds for CONFIRMED orders
      if (order.status !== 'CONFIRMED') {
        return res.status(400).json({
          success: false,
          message: `Refund only available for confirmed orders. Current status: ${order.status}`
        });
      }

      // Check if refund already requested
      if (order.refundStatus === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Refund request already pending for this order.'
        });
      }

      // Update order refund status
      order.refundStatus = 'pending';
      order.refundReason = reason;
      order.refundRequestedAt = new Date();
      await order.save();

      // Update all confirmed tickets to REFUND_PENDING
      await Ticket.updateMany(
        { order: order._id, status: 'CONFIRMED' },
        {
          $set: {
            refundStatus: 'pending',
            refundRequestReason: reason,
            refundRequestedAt: new Date()
          }
        }
      );

      res.json({
        success: true,
        message: 'Refund request submitted successfully. Our team will review within 3-5 business days.',
        data: { orderId: order._id, refundStatus: 'pending' }
      });
    } catch (err) {
      next(err);
    }
  },
};
