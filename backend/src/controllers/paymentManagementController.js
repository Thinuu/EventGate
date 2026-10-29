const mongoose = require('mongoose');
const PaymentSubmission = require('../models/PaymentSubmission');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const Attendee = require('../models/Attendee');
const Notification = require('../models/Notification');
const { logActivity } = require('../utils/logger');
const { notifyFinalTicket, notifyBuyerTicketProgress, sendCashPaymentConfirmedEmail } = require('../services/notificationService');
const { emitDashboardEvent, emitBuyerEvent } = require('../utils/socket');
const { sendBankTransferPaymentApproved, sendBankTransferPaymentRejected, sendBankTransferMoreInfoRequired } = require('../utils/email');
const { sendBuyerPurchaseSummaryEmail } = require('../services/ticketDeliveryService');
const { sendSMS } = require('../services/smsService');
const { processOrderFinalConfirmation } = require('../services/finalConfirmationService');

const normalizeReceiptFileUrl = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return null;

  const trimmed = filePath.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;

  const normalized = trimmed.replace(/\\/g, '/');
  const uploadsIndex = normalized.toLowerCase().indexOf('/uploads/');
  if (uploadsIndex >= 0) return normalized.slice(uploadsIndex);
  if (normalized.startsWith('uploads/')) return `/${normalized}`;

  return normalized;
};


const isPlatformAdmin = (role) => {
  const r = String(role || '').toLowerCase().replace(/[\s-]/g, '_');
  return ['main_admin', 'super_admin', 'mainadmin', 'superadmin'].includes(r) ||
    ['main_admin', 'super_admin'].includes(String(role || '').toLowerCase());
};

const isSubOrganiserRole = (role) => {
  const r = String(role || '').toLowerCase().replace(/[\s-]/g, '_');
  return r === 'sub_organiser' || r === 'suborganiser';
};

const createBuyerNotification = async (buyerId, payload) => {
  if (!buyerId) return;
  try {
    await Notification.create({ user: buyerId, ...payload });
  } catch (err) {
    console.error('Notification create failed:', err.message);
  }
};

const getSubOrgAssignedZoneIds = (user, event) => {
  if (!user || !event) return [];

  const fromAssignedZones = (user.assignedZones || []).map(String);
  const fromResponsibilities = (user.responsibilities?.zoneIds || []).map(String);
  const fromEventZones = (event.zones || [])
    .filter((zone) => zone.assignedSubOrganiser && zone.assignedSubOrganiser.toString() === user._id.toString())
    .map((zone) => zone.id || zone.name)
    .filter(Boolean)
    .map(String);

  return Array.from(new Set([...fromAssignedZones, ...fromResponsibilities, ...fromEventZones]));
};

const getSubOrgPermittedCategoryNames = (user, event) => {
  if (!user || !event) return [];

  const userId = user._id?.toString();
  const myZones = getSubOrgAssignedZoneIds(user, event);

  return (event.categories || [])
    .filter((cat) => {
      if (cat.assignedSubOrganisers && cat.assignedSubOrganisers.some((id) => id.toString() === userId)) {
        return true;
      }
      if (cat.createdBy && cat.createdBy.toString() === userId) {
        return true;
      }
      const allowedZones = (cat.allowedZones || []).map(String);
      if (!allowedZones.length) {
        return true;
      }
      return allowedZones.some((zoneId) => myZones.includes(zoneId));
    })
    .map((cat) => cat.name);
};

const orderHasPermittedCategories = (order, categoryNames) => {
  if (!order || !Array.isArray(order.tickets) || !categoryNames.length) return false;
  return order.tickets.some((ticket) => categoryNames.includes(ticket.categoryName));
};

/**
 * Get payment submissions with filtering and pagination
 * Updated to support all payment methods, using Order as the base entity.
 */
const getPaymentSubmissions = async (req, res, next) => {
  try {
    const {
      status = 'all',
      eventId,
      page = 1,
      limit = 20,
      search = '',
      dateFrom,
      dateTo,
      paymentMethod,
    } = req.query;

    const user = req.user;
    const role = user.role?.toLowerCase();
    
    // Build base Order filter
    const filter = {};
    
    if (paymentMethod && paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    } else {
      // If not specified, return all payment methods that result in actual payments
      filter.paymentMethod = { $in: ['card', 'bank_transfer', 'cash_on_entrance', 'cash_at_entrance'] };
    }
    
    // Status mapping for Order
    if (status && status !== 'all') {
      if (status === 'pending_verification') filter.paymentStatus = 'pending_verification';
      else if (status === 'approved' || status === 'paid' || status === 'verified') filter.paymentStatus = { $in: ['paid', 'success'] };
      else if (status === 'rejected') filter.paymentStatus = { $in: ['rejected'] };
      else if (status === 'awaiting_payment') filter.paymentStatus = 'awaiting_payment';
      else if (status === 'pending') filter.paymentStatus = 'pending';
    }
    
    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    
    // Search filter
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { buyerName: { $regex: search, $options: 'i' } },
        { buyerEmail: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Event scoping based on user role
    let accessibleEventIds = [];
    
    if (isPlatformAdmin(role)) {
      if (eventId) {
        filter.eventId = mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : eventId;
      }
    } else {
      // Organisers only see payments for their assigned events
      accessibleEventIds = (user.assignedEvents || []).map(id => 
        mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
      );
      
      if (accessibleEventIds.length === 0) {
        return res.json({ success: true, data: { payments: [], total: 0, pages: 0 } });
      }
      
      if (eventId) {
        if (!accessibleEventIds.some(id => id.toString() === eventId.toString())) {
          return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
        }
        filter.eventId = mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : eventId;
      } else {
        filter.eventId = { $in: accessibleEventIds };
      }

      if (isSubOrganiserRole(role)) {
        const accessibleEvents = await Event.find({ _id: { $in: accessibleEventIds } });
        let assignedCategoryNames = [];
        
        accessibleEvents.forEach((event) => {
          assignedCategoryNames.push(...getSubOrgPermittedCategoryNames(user, event));
        });
        
        assignedCategoryNames = Array.from(new Set(assignedCategoryNames));
        
        if (assignedCategoryNames.length === 0) {
           return res.json({ 
             success: true, 
             data: { 
               payments: [], 
               total: 0, 
               pages: 0,
               _message: 'No categories assigned. Please contact organizer.'
             } 
           });
        }
        
        filter['tickets.categoryName'] = { $in: assignedCategoryNames };
      }
    }
    
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('eventId', 'name startDate endDate venue settings currency')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      Order.countDocuments(filter)
    ]);
    
    // Fetch related PaymentSubmissions for bank transfers
    const bankTransferOrderIds = orders.filter(o => o.paymentMethod === 'bank_transfer').map(o => o._id);
    let paymentSubmissions = [];
    if (bankTransferOrderIds.length > 0) {
      paymentSubmissions = await PaymentSubmission.find({ orderId: { $in: bankTransferOrderIds } })
        .populate('verifiedBy', 'name email role')
        .lean();
    }
    const submissionMap = new Map(paymentSubmissions.map(ps => [ps.orderId.toString(), ps]));
    
    // Enriched responses
    const enrichedPayments = orders.map(order => {
      const submission = submissionMap.get(order._id.toString());
      
      // Calculate ticket summary
      const ticketSummary = (order.tickets || []).reduce((acc, ticket) => {
        if (!acc[ticket.categoryName]) acc[ticket.categoryName] = { count: 0, total: 0 };
        acc[ticket.categoryName].count += ticket.quantity || 1;
        acc[ticket.categoryName].total += ticket.price || 0;
        return acc;
      }, {});
      
      return {
        _id: order._id, // Expose order ID as the primary ID
        orderId: order._id,
        orderNumber: order.orderNumber,
        event: order.eventId ? {
          _id: order.eventId._id,
          name: order.eventId.name,
          startDate: order.eventId.startDate,
          endDate: order.eventId.endDate,
          currency: order.eventId.settings?.currency || order.eventId.currency || 'LKR',
          settings: {
            currency: order.eventId.settings?.currency || order.eventId.currency || 'LKR',
          },
        } : null,
        buyer: {
          name: order.buyerName,
          email: order.buyerEmail,
          phone: order.buyerPhone,
        },
        ticketSummary: Object.entries(ticketSummary).map(([name, data]) => ({
          categoryName: name,
          quantity: data.count,
          amount: data.total,
        })),
        totalAmount: order.totalAmount,
        currency: order.eventId?.settings?.currency || order.eventId?.currency || 'LKR',
        paymentMethod: order.paymentMethod,
        gatewayUsed: order.gatewayUsed,
        
        // Order level status
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
        
        // Submission specific details (if bank transfer)
        submissionId: submission?._id,
        bankUsed: submission?.bankUsed,
        referenceNumber: submission?.referenceNumber,
        amountPaid: submission?.amountPaid || order.totalAmount,
        receiptFile: normalizeReceiptFileUrl(submission?.receiptFile),
        submittedAt: submission?.submittedAt || order.createdAt,
        verificationStatus: submission?.verificationStatus || order.paymentStatus, // unify the field for frontend
        verifiedAt: submission?.verifiedAt || order.paidAt,
        verifiedBy: submission?.verifiedBy ? {
          name: submission.verifiedBy.name,
          role: submission.verifiedBy.role,
        } : null,
        rejectionReason: submission?.rejectionReason,
      };
    });
    
    res.json({ 
      success: true, 
      data: { 
        payments: enrichedPayments,
        total, 
        pages: Math.ceil(total / parseInt(limit, 10)),
        currentPage: parseInt(page, 10),
      } 
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get payment details
 */
const getPaymentSubmissionDetails = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const user = req.user;
    
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ success: false, message: 'Invalid payment ID.' });
    }

    let paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId');

    let order;
    if (paymentSubmission) {
      order = await Order.findById(paymentSubmission.orderId?._id || paymentSubmission.orderId)
        .populate('eventId', 'name startDate endDate venue settings categories');
    } else {
      order = await Order.findById(submissionId)
        .populate('eventId', 'name startDate endDate venue settings categories');
    }
      
    if (!order) {
      return res.status(404).json({ success: false, message: 'Payment order not found.' });
    }
    
    // Check access permissions
    const role = user.role?.toLowerCase();
    const assignedEventIds = (user.assignedEvents || []).map(id => id.toString());
    
    if (!isPlatformAdmin(role)) {
      if (!assignedEventIds.includes(order.eventId?._id?.toString())) {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have access to this payment.' 
        });
      }

      if (isSubOrganiserRole(role)) {
        const Event = require('../models/Event');
        const event = await Event.findById(order.eventId?._id);
        const assignedCategoryNames = getSubOrgPermittedCategoryNames(user, event);
        const hasAssignedCategory = orderHasPermittedCategories(order, assignedCategoryNames);
        if (!hasAssignedCategory) {
          return res.status(403).json({ 
            success: false, 
            message: 'You do not have access to the ticket categories in this payment.' 
          });
        }
      }
    }
    
    paymentSubmission = await PaymentSubmission.findOne({ orderId: order._id })
      .populate('verifiedBy', 'name email role');
      
    // Get tickets for this order
    const tickets = await Ticket.find({ order: order._id })
      .populate('attendee', 'fullName email phone confirmationStatus')
      .lean();
    
    const event = order.eventId;
    
    res.json({
      success: true,
      data: {
        paymentSubmission: paymentSubmission ? {
          _id: paymentSubmission._id,
          payerName: paymentSubmission.payerName,
          payerEmail: paymentSubmission.payerEmail,
          payerPhone: paymentSubmission.payerPhone,
          payerNicPassport: paymentSubmission.payerNicPassport,
          bankUsed: paymentSubmission.bankUsed,
          transferDate: paymentSubmission.transferDate,
          transferTime: paymentSubmission.transferTime,
          referenceNumber: paymentSubmission.referenceNumber,
          amountPaid: paymentSubmission.amountPaid,
          receiptFile: normalizeReceiptFileUrl(paymentSubmission.receiptFile),
          receiptFileType: paymentSubmission.receiptFileType,
          notes: paymentSubmission.notes,
          verificationStatus: paymentSubmission.verificationStatus,
          rejectionReason: paymentSubmission.rejectionReason,
          submittedAt: paymentSubmission.submittedAt,
          verifiedAt: paymentSubmission.verifiedAt,
          verifiedBy: paymentSubmission.verifiedBy ? {
            _id: paymentSubmission.verifiedBy._id,
            name: paymentSubmission.verifiedBy.name,
            email: paymentSubmission.verifiedBy.email,
            role: paymentSubmission.verifiedBy.role,
          } : null,
        } : null,
        order: order ? {
          _id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          currency: order.eventId?.settings?.currency || order.eventId?.currency || order.currency || 'LKR',
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          buyerPhone: order.buyerPhone,
          createdAt: order.createdAt,
        } : null,
        event: event ? {
          _id: event._id,
          name: event.name,
          startDate: event.startDate,
          endDate: event.endDate,
          venue: event.venue,
          settings: event.settings,
        } : null,
        tickets: tickets.map(ticket => ({
          _id: ticket._id,
          ticketNumber: ticket.ticketNumber,
          categoryName: ticket.categoryName,
          price: ticket.price,
          status: ticket.status,
          attendee: ticket.attendee ? {
            fullName: ticket.attendee.fullName,
            email: ticket.attendee.email,
            phone: ticket.attendee.phone,
            confirmationStatus: ticket.attendee.confirmationStatus,
          } : null,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Approve a payment submission
 */
const approvePayment = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { notes } = req.body;
    const user = req.user;
    
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ success: false, message: 'Invalid submission ID.' });
    }
    
    let paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId');
    
    if (!paymentSubmission) {
      paymentSubmission = await PaymentSubmission.findOne({ orderId: submissionId })
        .populate('orderId');
    }

    // Resolve the order — either from the submission or directly by the passed ID
    let order;
    if (paymentSubmission) {
      if (paymentSubmission.verificationStatus === 'approved') {
        return res.status(400).json({ success: false, message: 'Payment is already approved.' });
      }
      order = await Order.findById(paymentSubmission.orderId?._id || paymentSubmission.orderId)
        .populate('eventId');
    } else {
      // No PaymentSubmission — the submissionId is actually an orderId
      order = await Order.findById(submissionId).populate('eventId');
      if (!order) {
        return res.status(404).json({ success: false, message: 'Payment submission not found.' });
      }
      if (order.paymentStatus === 'paid') {
        return res.status(400).json({ success: false, message: 'Payment is already approved.' });
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Associated order not found.' });
    }
    
    // Check access permissions
    const role = user.role?.toLowerCase();
    const assignedEventIds = (user.assignedEvents || []).map(id => id.toString());
    
    if (!isPlatformAdmin(role)) {
      if (!assignedEventIds.includes(order.eventId?._id?.toString())) {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have permission to approve this payment.' 
        });
      }

      if (isSubOrganiserRole(role)) {
        const Event = require('../models/Event');
        const event = await Event.findById(order.eventId?._id);
        const assignedCategoryNames = getSubOrgPermittedCategoryNames(user, event);
        const hasAssignedCategory = orderHasPermittedCategories(order, assignedCategoryNames);
        if (!hasAssignedCategory) {
          return res.status(403).json({ 
            success: false, 
            message: 'You do not have permission to approve payments for the ticket categories in this order.' 
          });
        }
      }
    }
    
    // Update payment submission if it exists
    if (paymentSubmission) {
      paymentSubmission.verificationStatus = 'approved';
      paymentSubmission.verifiedBy = user._id;
      paymentSubmission.verifiedAt = new Date();
      paymentSubmission.notes = notes || paymentSubmission.notes;
      await paymentSubmission.save();
    }
    
    // Update order status
    order.status = 'CONFIRMED';
    order.paymentStatus = 'paid';
    order.paidAt = order.paidAt || new Date();
    
    if (order.paymentMethod === 'cash_at_entrance' || order.paymentMethod === 'cash_on_entrance') {
      if (!order.paymentDetails) order.paymentDetails = {};
      order.paymentDetails.collectedBy = user._id;
      order.paymentDetails.collectedByName = user.name;
      order.paymentDetails.collectedAt = new Date();
    }
    
    await order.save();
    
    // Update ticket statuses
    await Ticket.updateMany(
      { order: order._id },
      { status: 'SOLD' }
    );
    
    // Activate QR codes and confirm attendees
    const tickets = await Ticket.find({ order: order._id })
      .populate('attendee');
    
    for (const ticket of tickets) {
      if (ticket.attendee) {
        ticket.attendee.confirmationStatus = 'confirmed';
        ticket.attendee.isConfirmed = true;
        await ticket.attendee.save();
      }
      
      if (!ticket.qrCode) {
        const QRCode = require('qrcode');
        ticket.qrCode = await QRCode.toDataURL(ticket.ticketNumber);
        await ticket.save();
      }
    }

    await processOrderFinalConfirmation({ orderId: order._id })
      .catch((error) => console.error('Payment approval QR/RFID assignment error:', error));
    
    // Send notifications
    try {
      if (order.paymentMethod === 'bank_transfer') {
        await sendBankTransferPaymentApproved(order, order.eventId);
        // Also deliver tickets + summary like other paid methods
        for (const ticket of tickets) {
          if (ticket.attendee) {
            await notifyFinalTicket(ticket.attendee, order.eventId);
          }
        }
        try {
          await sendBuyerPurchaseSummaryEmail({ order, event: order.eventId });
        } catch (e) {
          console.error('Purchase summary email failed:', e.message);
        }
      } else if (order.paymentMethod === 'cash_at_entrance' || order.paymentMethod === 'cash_on_entrance') {
        // Cash payment - send full confirmation flow
        await notifyBuyerTicketProgress(order.buyerEmail, {
          orderNumber: order.orderNumber,
          eventName: order.eventId?.name,
          status: 'confirmed',
        });
        
        for (const ticket of tickets) {
          if (ticket.attendee) {
            await notifyFinalTicket(ticket.attendee, order.eventId);
          }
        }

        await sendBuyerPurchaseSummaryEmail({ order, event: order.eventId });
        
        // Send specific cash payment confirmation email
        await sendCashPaymentConfirmedEmail(
          { name: order.buyerName, email: order.buyerEmail },
          order
        );
      } else {
        // Other payment methods (card, etc.)
        await notifyBuyerTicketProgress(order.buyerEmail, {
          orderNumber: order.orderNumber,
          eventName: order.eventId?.name,
          status: 'confirmed',
        });
        
        for (const ticket of tickets) {
          if (ticket.attendee) {
            await notifyFinalTicket(ticket.attendee, order.eventId);
          }
        }

        await sendBuyerPurchaseSummaryEmail({ order, event: order.eventId });
      }
      
      if (order.buyerPhone) {
        try {
          const smsMessage = order.paymentMethod === 'cash_at_entrance' || order.paymentMethod === 'cash_on_entrance'
            ? `EventGate: Your cash payment for order ${order.orderNumber} has been received. Your tickets are now confirmed! Complete your attendee details at your EventGate account.`
            : `EventGate: Your payment has been approved. Your order ${order.orderNumber} is confirmed. Please complete your attendee details through your EventGate account.`;
          await sendSMS(order.buyerPhone, smsMessage);
        } catch (smsErr) {
          console.error('Error sending approval SMS:', smsErr);
        }
      }
      
      if (order.buyerId) await Notification.create({
        user: order.buyerId,
        title: 'Payment Approved',
        message: `Your payment for order ${order.orderNumber} has been approved. Your tickets are now confirmed.`,
        type: 'success',
        metadata: {
          orderId: order._id,
          submissionId: paymentSubmission?._id,
        },
      });
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }
    
    await logActivity({
      req,
      action: 'payment_approval',
      eventId: order.eventId?._id,
      details: {
        message: `Payment approved for order ${order.orderNumber}`,
        submissionId: paymentSubmission?._id,
        amount: paymentSubmission?.amountPaid || order.totalAmount,
        approvedBy: user.name,
      },
    });
    
    const io = req.app.get('io');
    emitDashboardEvent(io, 'payment_approved', order.eventId?._id, {
      orderId: order._id,
      submissionId: paymentSubmission?._id,
      amount: paymentSubmission?.amountPaid || order.totalAmount,
    });
    if (order.buyerId) {
      emitBuyerEvent(io, String(order.buyerId), 'order_status_changed', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        action: 'approved',
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Payment approved successfully.',
      data: {
        paymentSubmission: paymentSubmission ? {
          _id: paymentSubmission._id,
          verificationStatus: paymentSubmission.verificationStatus,
          verifiedAt: paymentSubmission.verifiedAt,
          verifiedBy: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
        } : {
          orderId: order._id,
          verificationStatus: 'approved',
          verifiedAt: new Date(),
          verifiedBy: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reject a payment submission
 */
const rejectPayment = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { rejectionReason } = req.body;
    const user = req.user;
    
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ success: false, message: 'Invalid submission ID.' });
    }
    
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }
    
    let paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId');
    
    if (!paymentSubmission) {
      paymentSubmission = await PaymentSubmission.findOne({ orderId: submissionId })
        .populate('orderId');
    }
    
    let order;
    if (paymentSubmission) {
      if (paymentSubmission.verificationStatus === 'rejected') {
        return res.status(400).json({ success: false, message: 'Payment is already rejected.' });
      }
      order = await Order.findById(paymentSubmission.orderId?._id || paymentSubmission.orderId)
        .populate('eventId');
    } else {
      order = await Order.findById(submissionId).populate('eventId');
      if (!order) {
        return res.status(404).json({ success: false, message: 'Payment submission not found.' });
      }
      if (order.paymentStatus === 'rejected') {
        return res.status(400).json({ success: false, message: 'Payment is already rejected.' });
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Associated order not found.' });
    }
    
    // Check access permissions
    const role = user.role?.toLowerCase();
    const assignedEventIds = (user.assignedEvents || []).map(id => id.toString());
    
    if (!isPlatformAdmin(role)) {
      if (!assignedEventIds.includes(order.eventId?._id?.toString())) {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have permission to reject this payment.' 
        });
      }

      if (isSubOrganiserRole(role)) {
        const Event = require('../models/Event');
        const event = await Event.findById(order.eventId?._id);
        const assignedCategoryNames = getSubOrgPermittedCategoryNames(user, event);
        const hasAssignedCategory = orderHasPermittedCategories(order, assignedCategoryNames);
        if (!hasAssignedCategory) {
          return res.status(403).json({ 
            success: false, 
            message: 'You do not have permission to reject payments for the ticket categories in this order.' 
          });
        }
      }
    }
    
    // Update payment submission if it exists
    if (paymentSubmission) {
      paymentSubmission.verificationStatus = 'rejected';
      paymentSubmission.verifiedBy = user._id;
      paymentSubmission.verifiedAt = new Date();
      paymentSubmission.rejectionReason = rejectionReason.trim();
      await paymentSubmission.save();
    }
    
    // Update order status
    order.status = 'CANCELLED';
    order.paymentStatus = 'rejected';
    await order.save();
    
    // Update ticket statuses
    await Ticket.updateMany(
      { order: order._id },
      { status: 'CANCELLED' }
    );
    
    // Send notification
    try {
      if (order.paymentMethod === 'bank_transfer') {
        await sendBankTransferPaymentRejected(order, order.eventId, rejectionReason);
      }
      
      if (order.buyerPhone) {
        try {
          await sendSMS(
            order.buyerPhone,
            `EventGate: Your payment could not be verified. Please log in to your EventGate account to upload a new payment receipt or contact the event organizer. Order: ${order.orderNumber}`
          );
        } catch (smsErr) {
          console.error('Error sending rejection SMS:', smsErr);
        }
      }
      
      if (order.buyerId) await Notification.create({
        user: order.buyerId,
        title: 'Payment Rejected',
        message: `Your payment for order ${order.orderNumber} has been rejected. Reason: ${rejectionReason}`,
        type: 'error',
        metadata: {
          orderId: order._id,
          submissionId: paymentSubmission?._id,
          rejectionReason,
        },
      });
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }
    
    await logActivity({
      req,
      action: 'payment_rejection',
      eventId: order.eventId?._id,
      details: {
        message: `Payment rejected for order ${order.orderNumber}`,
        submissionId: paymentSubmission?._id,
        amount: paymentSubmission?.amountPaid || order.totalAmount,
        rejectedBy: user.name,
        rejectionReason,
      },
    });
    
    const io = req.app.get('io');
    emitDashboardEvent(io, 'payment_rejected', order.eventId?._id, {
      orderId: order._id,
      submissionId: paymentSubmission?._id,
      amount: paymentSubmission?.amountPaid || order.totalAmount,
      rejectionReason,
    });
    if (order.buyerId) {
      emitBuyerEvent(io, String(order.buyerId), 'order_status_changed', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        action: 'rejected',
        reason: rejectionReason,
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Payment rejected successfully.',
      data: {
        paymentSubmission: paymentSubmission ? {
          _id: paymentSubmission._id,
          verificationStatus: paymentSubmission.verificationStatus,
          verifiedAt: paymentSubmission.verifiedAt,
          verifiedBy: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
          rejectionReason: paymentSubmission.rejectionReason,
        } : {
          orderId: order._id,
          verificationStatus: 'rejected',
          verifiedAt: new Date(),
          verifiedBy: {
            _id: user._id,
            name: user.name,
            email: user.email,
          },
          rejectionReason: rejectionReason.trim(),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Request more information for a payment submission
 */
const requestMoreInfo = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { message } = req.body;
    const user = req.user;
    
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ success: false, message: 'Invalid submission ID.' });
    }
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    
    let paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId');
    
    if (!paymentSubmission) {
      paymentSubmission = await PaymentSubmission.findOne({ orderId: submissionId })
        .populate('orderId');
    }
    
    let order;
    if (paymentSubmission) {
      order = await Order.findById(paymentSubmission.orderId?._id || paymentSubmission.orderId)
        .populate('eventId');
    } else {
      order = await Order.findById(submissionId).populate('eventId');
      if (!order) {
        return res.status(404).json({ success: false, message: 'Payment submission not found.' });
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Associated order not found.' });
    }
    
    // Check access permissions
    const role = user.role?.toLowerCase();
    const assignedEventIds = (user.assignedEvents || []).map(id => id.toString());
    
    if (!isPlatformAdmin(role)) {
      if (!assignedEventIds.includes(order.eventId?._id?.toString())) {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have permission to request information for this payment.' 
        });
      }

      if (isSubOrganiserRole(role)) {
        const Event = require('../models/Event');
        const event = await Event.findById(order.eventId?._id);
        const assignedCategoryNames = getSubOrgPermittedCategoryNames(user, event);
        const hasAssignedCategory = orderHasPermittedCategories(order, assignedCategoryNames);
        if (!hasAssignedCategory) {
          return res.status(403).json({ 
            success: false, 
            message: 'You do not have permission to request information for the ticket categories in this order.' 
          });
        }
      }
    }
    
    // Update payment submission if it exists
    if (paymentSubmission) {
      paymentSubmission.verificationStatus = 'needs_info';
      paymentSubmission.notes = message.trim();
      await paymentSubmission.save();
    }
    
    // Send notification
    try {
      if (order.paymentMethod === 'bank_transfer') {
        await sendBankTransferMoreInfoRequired(order, order.eventId, message);
      }
      
      if (order.buyerPhone) {
        try {
          await sendSMS(
            order.buyerPhone,
            `EventGate: Additional information is required for your payment. Please log in to your EventGate account to update your payment details. Order: ${order.orderNumber}`
          );
        } catch (smsErr) {
          console.error('Error sending info request SMS:', smsErr);
        }
      }
      
      if (order.buyerId) await Notification.create({
        user: order.buyerId,
        title: 'Payment Information Requested',
        message: `Additional information is required for your payment for order ${order.orderNumber}: ${message}`,
        type: 'info',
        metadata: {
          orderId: order._id,
          submissionId: paymentSubmission?._id,
        },
      });
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }
    
    await logActivity({
      req,
      action: 'payment_info_request',
      eventId: order.eventId?._id,
      details: {
        message: `Information requested for order ${order.orderNumber}`,
        KPIsubmissionId: paymentSubmission?._id,
        requestedBy: user.name,
        infoRequest: message,
      },
    });
    
    const io = req.app.get('io');
    if (order.buyerId) {
      emitBuyerEvent(io, String(order.buyerId), 'order_status_changed', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        action: 'needs_info',
        message: message?.trim(),
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Information request sent successfully.',
      data: {
        paymentSubmission: paymentSubmission ? {
          _id: paymentSubmission._id,
          verificationStatus: paymentSubmission.verificationStatus,
          notes: paymentSubmission.notes,
        } : {
          orderId: order._id,
          verificationStatus: 'needs_info',
          notes: message.trim(),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get payment statistics for dashboard
 */
const getPaymentStatistics = async (req, res, next) => {
  try {
    const { eventId } = req.query;
    const user = req.user;
    const role = user.role?.toLowerCase();
    
    let filter = {
      paymentMethod: { $in: ['card', 'bank_transfer', 'cash_on_entrance', 'cash_at_entrance'] }
    };
    
    let accessibleEventIds = [];
    let assignedCategoryNames = [];
    let scopedCurrency = 'LKR';
    if (isPlatformAdmin(role)) {
      if (eventId) {
        filter.eventId = mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : eventId;
      }
    } else {
      accessibleEventIds = (user.assignedEvents || []).map(id => 
        mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
      );
      if (accessibleEventIds.length === 0) {
        return res.json({ success: true, data: { overview: {}, recentPayments: [] } });
      }
      if (eventId) {
        if (!accessibleEventIds.some(id => id.toString() === eventId.toString())) {
          return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
        }
        filter.eventId = mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : eventId;
      } else {
        filter.eventId = { $in: accessibleEventIds };
      }

      if (isSubOrganiserRole(role)) {
        const accessibleEvents = await Event.find({ _id: { $in: accessibleEventIds } });
        assignedCategoryNames = [];
        
        accessibleEvents.forEach(event => {
          const eventCategories = getSubOrgPermittedCategoryNames(user, event);
          assignedCategoryNames.push(...eventCategories);
        });
        
        assignedCategoryNames = Array.from(new Set(assignedCategoryNames));
        
        if (assignedCategoryNames.length === 0) {
           return res.json({
             success: true,
             data: {
               overview: {
                 currency: scopedCurrency,
                 totalPayments: 0,
                 pendingPayments: 0,
                 approvedPayments: 0,
                 rejectedPayments: 0,
                 needsInfoPayments: 0,
                 totalAmount: 0,
                 approvedAmount: 0,
                 pendingAmount: 0,
                 pendingBankTransfers: 0,
                 approvedBankTransfers: 0,
                 cashReservations: 0,
                 cashCollected: 0,
               },
               recentPayments: [],
             }
           });
        }
      }
    }

    const scopedEventId = eventId || (accessibleEventIds[0] ? accessibleEventIds[0].toString() : null);
    if (scopedEventId && mongoose.Types.ObjectId.isValid(scopedEventId)) {
      const scopedEvent = await Event.findById(scopedEventId).select('settings currency').lean();
      scopedCurrency = scopedEvent?.settings?.currency || scopedEvent?.currency || scopedCurrency;
    }
    
    let revenuePipeline = [
      { $match: { ...filter, paymentStatus: { $in: ['paid', 'success'] } } }
    ];
    let pendingRevenuePipeline = [
      { $match: { ...filter, paymentStatus: { $in: ['pending', 'pending_verification', 'awaiting_payment'] } } }
    ];
    let totalRevenuePipeline = [
      { $match: filter }
    ];
    let cashCollectedPipeline = [
      { $match: { ...filter, paymentMethod: { $in: ['cash_at_entrance', 'cash_on_entrance'] }, paymentStatus: { $in: ['paid', 'success'] } } }
    ];

    if (isSubOrganiserRole(role)) {
      [revenuePipeline, pendingRevenuePipeline, totalRevenuePipeline, cashCollectedPipeline].forEach(pipeline => {
        pipeline.push(
          { $unwind: '$tickets' },
          { $match: { 'tickets.categoryName': { $in: assignedCategoryNames } } },
          { $group: { _id: null, total: { $sum: { $multiply: ['$tickets.price', '$tickets.quantity'] } } } }
        );
      });
    } else {
      [revenuePipeline, pendingRevenuePipeline, totalRevenuePipeline, cashCollectedPipeline].forEach(pipeline => {
        pipeline.push(
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        );
      });
    }

    // For sub-organizers, we need to count orders that have at least one ticket in their assigned categories
    let countFilter = filter;
    let hasSubOrgCategories = assignedCategoryNames.length > 0;
    
    if (isSubOrganiserRole(role)) {
      if (hasSubOrgCategories) {
        // For counting, we need to find orders that have tickets in assigned categories
        const ordersWithAssignedCategories = await Order.find({
          ...filter,
          'tickets.categoryName': { $in: assignedCategoryNames }
        }).select('_id');
        const orderIds = ordersWithAssignedCategories.map(o => o._id);
        countFilter = { _id: { $in: orderIds } };
      } else {
        // No categories assigned - return zeros
        countFilter = { _id: { $in: [] } };
      }
    }

    const [
      totalPayments,
      approvedPayments,
      pendingPayments,
      rejectedPayments,
      revenueData,
      pendingRevenueData,
      totalRevenueData,
      pendingBankTransfers,
      approvedBankTransfers,
      cashReservations,
      cashCollectedData,
    ] = await Promise.all([
      Order.countDocuments(countFilter),
      Order.countDocuments({ ...countFilter, paymentStatus: { $in: ['paid', 'success'] } }),
      Order.countDocuments({ ...countFilter, paymentStatus: { $in: ['pending', 'pending_verification', 'awaiting_payment'] } }),
      Order.countDocuments({ ...countFilter, paymentStatus: { $in: ['rejected'] } }),
      Order.aggregate(revenuePipeline),
      Order.aggregate(pendingRevenuePipeline),
      Order.aggregate(totalRevenuePipeline),
      Order.countDocuments({ ...countFilter, paymentMethod: 'bank_transfer', paymentStatus: { $in: ['pending', 'pending_verification'] } }),
      Order.countDocuments({ ...countFilter, paymentMethod: 'bank_transfer', paymentStatus: { $in: ['paid', 'success'] } }),
      Order.countDocuments({ ...countFilter, paymentMethod: { $in: ['cash_at_entrance', 'cash_on_entrance'] }, paymentStatus: { $in: ['pending', 'awaiting_payment', 'reserved'] } }),
      Order.aggregate(cashCollectedPipeline)
    ]);
    
    // Needs info is tracked in PaymentSubmission
    let needsInfoPayments = 0;
    const orderIdsResult = await Order.find(countFilter).select('_id');
    const orderIds = orderIdsResult.map(o => o._id);
    if (orderIds.length > 0) {
       needsInfoPayments = await PaymentSubmission.countDocuments({ 
         orderId: { $in: orderIds },
         verificationStatus: 'needs_info'
       });
    }

    const recentOrders = await Order.find(countFilter)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    res.json({
      success: true,
      data: {
        overview: {
          currency: scopedCurrency,
          totalPayments,
          pendingPayments,
          approvedPayments,
          rejectedPayments,
          needsInfoPayments,
          totalAmount: totalRevenueData[0]?.total || 0,
          approvedAmount: revenueData[0]?.total || 0,
          pendingAmount: pendingRevenueData[0]?.total || 0,
          pendingBankTransfers,
          approvedBankTransfers,
          cashReservations,
          cashCollected: cashCollectedData[0]?.total || 0,
        },
        recentPayments: recentOrders.map(order => ({
          _id: order._id,
          orderNumber: order.orderNumber,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          amountPaid: order.totalAmount,
          verificationStatus: order.paymentStatus,
          submittedAt: order.createdAt,
          paymentMethod: order.paymentMethod,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Export payment data
 */
const exportPayments = async (req, res, next) => {
  try {
    const XLSX = require('../utils/spreadsheet');
    const { status, eventId, format = 'xlsx', paymentMethod } = req.query;
    const user = req.user;
    const role = user.role?.toLowerCase();
    
    // Build filter
    const filter = {};
    if (paymentMethod && paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    } else {
      filter.paymentMethod = { $in: ['card', 'bank_transfer', 'cash_on_entrance', 'cash_at_entrance'] };
    }
    
    // Status mapping for Order
    if (status && status !== 'all') {
      if (status === 'pending_verification') filter.paymentStatus = 'pending_verification';
      else if (status === 'approved' || status === 'paid' || status === 'verified') filter.paymentStatus = { $in: ['paid', 'success'] };
      else if (status === 'rejected') filter.paymentStatus = { $in: ['rejected'] };
      else if (status === 'awaiting_payment') filter.paymentStatus = 'awaiting_payment';
      else if (status === 'pending') filter.paymentStatus = 'pending';
    }
    
    // Event scoping
    if (isPlatformAdmin(role)) {
      if (eventId) {
        filter.eventId = mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : eventId;
      }
    } else {
      const assignedEventIds = (user.assignedEvents || []).map(id => 
        mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id
      );
      if (assignedEventIds.length === 0) {
        return res.status(403).json({ success: false, message: 'No events assigned.' });
      }
      if (eventId) {
        if (!assignedEventIds.some(id => id.toString() === eventId.toString())) {
          return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
        }
        filter.eventId = mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : eventId;
      } else {
        filter.eventId = { $in: assignedEventIds };
      }
    }
    
    const orders = await Order.find(filter)
      .populate('eventId', 'name')
      .sort({ createdAt: -1 })
      .lean();
    
    const bankTransferOrderIds = orders.filter(o => o.paymentMethod === 'bank_transfer').map(o => o._id);
    let paymentSubmissions = [];
    if (bankTransferOrderIds.length > 0) {
      paymentSubmissions = await PaymentSubmission.find({ orderId: { $in: bankTransferOrderIds } })
        .populate('verifiedBy', 'name')
        .lean();
    }
    const submissionMap = new Map(paymentSubmissions.map(ps => [ps.orderId.toString(), ps]));
    
    // Prepare data for export
    const headers = [
      'Order Number',
      'Event',
      'Payment Method',
      'Buyer Name',
      'Buyer Email',
      'Payer Name (Bank)',
      'Bank Used',
      'Reference Number',
      'Amount Paid',
      'Status',
      'Created At',
      'Verified At',
      'Verified By',
    ];
    
    const data = orders.map(order => {
      const submission = submissionMap.get(order._id.toString());
      return [
        order.orderNumber || '',
        order.eventId?.name || '',
        order.paymentMethod || '',
        order.buyerName || '',
        order.buyerEmail || '',
        submission?.payerName || '',
        submission?.bankUsed || '',
        submission?.referenceNumber || '',
        order.totalAmount,
        order.paymentStatus || order.status,
        order.createdAt ? new Date(order.createdAt).toISOString() : '',
        order.paidAt || submission?.verifiedAt ? new Date(order.paidAt || submission?.verifiedAt).toISOString() : '',
        submission?.verifiedBy?.name || '',
      ];
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Payments');
    
    const isExcel = format === 'xlsx';
    const buffer = await XLSX.write(wb, { type: 'buffer', bookType: isExcel ? 'xlsx' : 'csv' });
    const ext = isExcel ? 'xlsx' : 'csv';
    const mime = isExcel ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv';
    
    res.setHeader('Content-Disposition', `attachment; filename="payments-export-${Date.now()}.${ext}"`);
    res.setHeader('Content-Type', mime);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

/**
 * Get all transactions for Super Admin (platform-wide view)
 */
const getAllTransactions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      eventId,
      companyId,
      mainOrganizerId,
      subOrganizerId,
      paymentMethod = 'all',
      paymentStatus = 'all',
      orderStatus = 'all',
      buyer,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const user = req.user;
    const role = user.role?.toLowerCase();

    // Only Super Admin and Main Admin can access this endpoint
    if (!isPlatformAdmin(role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Super Admin only.' });
    }

    // Build comprehensive filter
    const filter = {};

    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    } else {
      filter.paymentMethod = { $in: ['card', 'bank_transfer', 'cash_on_entrance', 'cash_at_entrance'] };
    }

    // Payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      if (paymentStatus === 'pending_verification') {
        filter.paymentStatus = 'pending_verification';
      } else if (paymentStatus === 'approved' || paymentStatus === 'paid') {
        filter.paymentStatus = { $in: ['paid', 'success'] };
      } else if (paymentStatus === 'rejected') {
        filter.paymentStatus = { $in: ['rejected'] };
      } else if (paymentStatus === 'awaiting_payment') {
        filter.paymentStatus = 'awaiting_payment';
      } else if (paymentStatus === 'pending') {
        filter.paymentStatus = 'pending';
      }
    }

    // Order status filter
    if (orderStatus && orderStatus !== 'all') {
      filter.status = orderStatus;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Event filter
    if (eventId) {
      filter.eventId = mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : eventId;
    }

    // Buyer filter (search by name, email, or order number)
    if (buyer) {
      filter.$or = [
        { orderNumber: { $regex: buyer, $options: 'i' } },
        { buyerName: { $regex: buyer, $options: 'i' } },
        { buyerEmail: { $regex: buyer, $options: 'i' } }
      ];
    }

    // Search filter (order number, buyer name, event name)
    if (search) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { orderNumber: { $regex: search, $options: 'i' } },
          { buyerName: { $regex: search, $options: 'i' } },
          { buyerEmail: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    // Fetch orders with population
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('eventId', 'name startDate endDate venue companyId')
        .populate('companyId', 'name')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      Order.countDocuments(filter)
    ]);

    // Fetch payment submissions for bank transfers
    const bankTransferOrderIds = orders.filter(o => o.paymentMethod === 'bank_transfer').map(o => o._id);
    let paymentSubmissions = [];
    if (bankTransferOrderIds.length > 0) {
      paymentSubmissions = await PaymentSubmission.find({ orderId: { $in: bankTransferOrderIds } })
        .populate('verifiedBy', 'name email role')
        .populate('assignedSubOrganizer', 'name email')
        .populate('assignedMainOrganizer', 'name email')
        .lean();
    }

    // Fetch sub-organizer assignments from events
    const eventIds = orders.map(o => o.eventId?._id).filter(Boolean);
    const eventsWithSubOrgs = await Event.find({ _id: { $in: eventIds } })
      .populate('subOrganizers', 'name email')
      .lean();
    
    const eventSubOrgsMap = new Map(eventsWithSubOrgs.map(e => [e._id.toString(), e.subOrganizers || []]));

    const submissionMap = new Map(paymentSubmissions.map(ps => [ps.orderId.toString(), ps]));

    // Build transaction records
    const transactions = orders.map(order => {
      const submission = submissionMap.get(order._id.toString());
      const subOrganizers = eventSubOrgsMap.get(order.eventId?._id?.toString()) || [];
      
      // Get ticket categories
      const ticketCategories = (order.tickets || []).map(t => t.categoryName).join(', ');

      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        transactionId: submission?._id || order._id,
        event: order.eventId ? {
          _id: order.eventId._id,
          name: order.eventId.name,
          startDate: order.eventId.startDate,
          endDate: order.eventId.endDate,
          venue: order.eventId.venue,
          companyId: order.eventId.companyId,
        } : null,
        company: order.eventId?.companyId ? {
          _id: order.eventId.companyId._id,
          name: order.eventId.companyId.name,
        } : null,
        buyer: {
          name: order.buyerName,
          email: order.buyerEmail,
          phone: order.buyerPhone,
        },
        ticketCategories,
        ticketSummary: (order.tickets || []).map(t => ({
          categoryName: t.categoryName,
          quantity: t.quantity || 1,
          price: t.price || 0,
        })),
        paymentMethod: order.paymentMethod,
        gatewayUsed: order.gatewayUsed || submission?.paymentGateway,
        amount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        orderStatus: order.status,
        mainOrganizer: submission?.assignedMainOrganizer ? {
          _id: submission.assignedMainOrganizer._id,
          name: submission.assignedMainOrganizer.name,
        } : null,
        assignedSubOrganizer: submission?.assignedSubOrganizer ? {
          _id: submission.assignedSubOrganizer._id,
          name: submission.assignedSubOrganizer.name,
        } : null,
        submission: submission ? {
          _id: submission._id,
          bankUsed: submission.bankUsed,
          referenceNumber: submission.referenceNumber,
          amountPaid: submission.amountPaid,
          verificationStatus: submission.verificationStatus,
          rejectionReason: submission.rejectionReason,
          submittedAt: submission.submittedAt,
          verifiedAt: submission.verifiedAt,
          verifiedBy: submission.verifiedBy ? {
            name: submission.verifiedBy.name,
            role: submission.verifiedBy.role,
          } : null,
          receiptFile: submission.receiptFile,
          statusTimeline: submission.statusTimeline || [],
          auditLog: submission.auditLog || [],
        } : null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };
    });

    res.json({
      success: true,
      data: {
        transactions,
        total,
        pages: Math.ceil(total / parseInt(limit, 10)),
        currentPage: parseInt(page, 10),
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get transaction statistics for Super Admin dashboard
 */
const getTransactionStatistics = async (req, res, next) => {
  try {
    const user = req.user;
    const role = user.role?.toLowerCase();

    if (!isPlatformAdmin(role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Super Admin only.' });
    }

    const { dateFrom, dateTo, eventId } = req.query;

    // Build base filter
    const baseFilter = {
      paymentMethod: { $in: ['card', 'bank_transfer', 'cash_on_entrance', 'cash_at_entrance'] }
    };

    if (dateFrom || dateTo) {
      baseFilter.createdAt = {};
      if (dateFrom) baseFilter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) baseFilter.createdAt.$lte = new Date(dateTo);
    }

    if (eventId) {
      baseFilter.eventId = mongoose.Types.ObjectId.isValid(eventId) ? new mongoose.Types.ObjectId(eventId) : eventId;
    }

    // Get counts and revenue
    const [
      totalTransactions,
      approvedCount,
      pendingCount,
      rejectedCount,
      refundedCount,
      approvedRevenue,
      pendingRevenue,
      totalRevenue,
    ] = await Promise.all([
      Order.countDocuments(baseFilter),
      Order.countDocuments({ ...baseFilter, paymentStatus: { $in: ['paid', 'success'] } }),
      Order.countDocuments({ ...baseFilter, paymentStatus: { $in: ['pending', 'pending_verification', 'awaiting_payment'] } }),
      Order.countDocuments({ ...baseFilter, paymentStatus: { $in: ['rejected'] } }),
      Order.countDocuments({ ...baseFilter, paymentStatus: 'refunded' }), // Future-ready
      Order.aggregate([
        { $match: { ...baseFilter, paymentStatus: { $in: ['paid', 'success'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Order.aggregate([
        { $match: { ...baseFilter, paymentStatus: { $in: ['pending', 'pending_verification', 'awaiting_payment'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Order.aggregate([
        { $match: baseFilter },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalTransactions,
          approvedPayments: approvedCount,
          pendingPayments: pendingCount,
          rejectedPayments: rejectedCount,
          refundedPayments: refundedCount,
          totalRevenue: totalRevenue[0]?.total || 0,
          approvedRevenue: approvedRevenue[0]?.total || 0,
          pendingRevenue: pendingRevenue[0]?.total || 0,
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get transaction details for Super Admin
 */
const getTransactionDetails = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const user = req.user;
    const role = user.role?.toLowerCase();

    if (!isPlatformAdmin(role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Super Admin only.' });
    }

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ success: false, message: 'Invalid transaction ID.' });
    }

    const order = await Order.findById(transactionId)
      .populate('eventId', 'name startDate endDate venue companyId categories subOrganizers')
      .populate('companyId', 'name')
      .populate('buyerId', 'name email phone');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    const paymentSubmission = await PaymentSubmission.findOne({ orderId: order._id })
      .populate('verifiedBy', 'name email role')
      .populate('assignedSubOrganizer', 'name email')
      .populate('assignedMainOrganizer', 'name email');

    const tickets = await Ticket.find({ order: order._id })
      .populate('attendee', 'fullName email phone confirmationStatus')
      .lean();

    // Build payment timeline from submission status timeline
    const paymentTimeline = paymentSubmission?.statusTimeline || [];
    
    // Add order created event
    paymentTimeline.unshift({
      status: 'order_created',
      description: 'Order created successfully',
      timestamp: order.createdAt,
    });

    // Add submission event if exists
    if (paymentSubmission) {
      const submitEntry = paymentTimeline.find(e => e.status === 'submitted');
      if (!submitEntry) {
        paymentTimeline.push({
          status: 'submitted',
          description: 'Payment submitted and receipt uploaded',
          timestamp: paymentSubmission.submittedAt,
        });
      }
    }

    // Add confirmation events if approved
    if (paymentSubmission?.verificationStatus === 'approved') {
      paymentTimeline.push({
        status: 'confirmation_email_sent',
        description: 'Order confirmation email sent to buyer',
        timestamp: paymentSubmission.verifiedAt,
      });
    }

    res.json({
      success: true,
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          gatewayUsed: order.gatewayUsed,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          buyerPhone: order.buyerPhone,
          buyerId: order.buyerId,
          tickets: order.tickets,
          confirmationToken: order.confirmationToken,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        },
        event: order.eventId ? {
          _id: order.eventId._id,
          name: order.eventId.name,
          startDate: order.eventId.startDate,
          endDate: order.eventId.endDate,
          venue: order.eventId.venue,
          company: order.eventId.companyId,
          categories: order.eventId.categories,
          subOrganizers: order.eventId.subOrganizers,
        } : null,
        paymentSubmission: paymentSubmission ? {
          _id: paymentSubmission._id,
          payerName: paymentSubmission.payerName,
          payerEmail: paymentSubmission.payerEmail,
          payerPhone: paymentSubmission.payerPhone,
          payerNicPassport: paymentSubmission.payerNicPassport,
          bankUsed: paymentSubmission.bankUsed,
          transferDate: paymentSubmission.transferDate,
          transferTime: paymentSubmission.transferTime,
          referenceNumber: paymentSubmission.referenceNumber,
          amountPaid: paymentSubmission.amountPaid,
          receiptFile: paymentSubmission.receiptFile,
          receiptFileType: paymentSubmission.receiptFileType,
          notes: paymentSubmission.notes,
          verificationStatus: paymentSubmission.verificationStatus,
          rejectionReason: paymentSubmission.rejectionReason,
          submittedAt: paymentSubmission.submittedAt,
          verifiedAt: paymentSubmission.verifiedAt,
          verifiedBy: paymentSubmission.verifiedBy ? {
            _id: paymentSubmission.verifiedBy._id,
            name: paymentSubmission.verifiedBy.name,
            email: paymentSubmission.verifiedBy.email,
            role: paymentSubmission.verifiedBy.role,
          } : null,
          assignedSubOrganizer: paymentSubmission.assignedSubOrganizer ? {
            _id: paymentSubmission.assignedSubOrganizer._id,
            name: paymentSubmission.assignedSubOrganizer.name,
            email: paymentSubmission.assignedSubOrganizer.email,
          } : null,
          assignedMainOrganizer: paymentSubmission.assignedMainOrganizer ? {
            _id: paymentSubmission.assignedMainOrganizer._id,
            name: paymentSubmission.assignedMainOrganizer.name,
            email: paymentSubmission.assignedMainOrganizer.email,
          } : null,
          statusTimeline: paymentSubmission.statusTimeline || [],
          auditLog: paymentSubmission.auditLog || [],
          submissionHistory: paymentSubmission.submissionHistory || [],
        } : null,
        tickets: tickets.map(t => ({
          _id: t._id,
          ticketNumber: t.ticketNumber,
          categoryName: t.categoryName,
          price: t.price,
          status: t.status,
          attendee: t.attendee ? {
            fullName: t.attendee.fullName,
            email: t.attendee.email,
            phone: t.attendee.phone,
            confirmationStatus: t.attendee.confirmationStatus,
          } : null,
        })),
        paymentTimeline,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get transaction timeline
 */
const getTransactionTimeline = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const user = req.user;
    const role = user.role?.toLowerCase();

    if (!isPlatformAdmin(role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Super Admin only.' });
    }

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ success: false, message: 'Invalid transaction ID.' });
    }

    const order = await Order.findById(transactionId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    const paymentSubmission = await PaymentSubmission.findOne({ orderId: order._id });

    // Build comprehensive timeline
    const timeline = [];

    // Order created
    timeline.push({
      status: 'order_created',
      description: 'Order created successfully',
      timestamp: order.createdAt,
      icon: 'document',
      color: 'blue',
    });

    // Payment submitted (for bank transfer)
    if (paymentSubmission) {
      timeline.push({
        status: 'payment_submitted',
        description: 'Payment details submitted and receipt uploaded',
        timestamp: paymentSubmission.submittedAt,
        icon: 'upload',
        color: 'green',
        details: {
          bankUsed: paymentSubmission.bankUsed,
          referenceNumber: paymentSubmission.referenceNumber,
          amountPaid: paymentSubmission.amountPaid,
        }
      });

      // Assigned to organizer
      if (paymentSubmission.assignedSubOrganizer || paymentSubmission.assignedMainOrganizer) {
        const assignedTo = paymentSubmission.assignedSubOrganizer 
          ? `Sub Organizer ${paymentSubmission.assignedSubOrganizer.name}`
          : 'Main Organizer';
        timeline.push({
          status: 'assigned_to_organizer',
          description: `Payment assigned to ${assignedTo}`,
          timestamp: paymentSubmission.submittedAt,
          icon: 'user',
          color: 'purple',
        });
      }

      // Under review
      timeline.push({
        status: 'under_review',
        description: 'Payment is being reviewed by organizer',
        timestamp: paymentSubmission.verifiedAt && paymentSubmission.verificationStatus === 'pending' ? new Date() : null,
        icon: 'eye',
        color: 'amber',
      });

      // Info requested
      if (paymentSubmission.verificationStatus === 'needs_info') {
        timeline.push({
          status: 'needs_info',
          description: 'Additional information requested from buyer',
          timestamp: paymentSubmission.updatedAt,
          icon: 'question',
          color: 'yellow',
          details: paymentSubmission.notes,
        });
      }

      // Approved
      if (paymentSubmission.verificationStatus === 'approved') {
        timeline.push({
          status: 'approved',
          description: 'Payment approved and order confirmed',
          timestamp: paymentSubmission.verifiedAt,
          icon: 'check',
          color: 'green',
          details: {
            approvedBy: paymentSubmission.verifiedBy?.name,
          }
        });

        // Email sent
        timeline.push({
          status: 'email_sent',
          description: 'Order confirmation email sent to buyer',
          timestamp: paymentSubmission.verifiedAt,
          icon: 'mail',
          color: 'green',
        });

        // SMS sent
        timeline.push({
          status: 'sms_sent',
          description: 'Confirmation SMS sent to buyer',
          timestamp: paymentSubmission.verifiedAt,
          icon: 'phone',
          color: 'green',
        });
      }

      // Rejected
      if (paymentSubmission.verificationStatus === 'rejected') {
        timeline.push({
          status: 'rejected',
          description: `Payment rejected: ${paymentSubmission.rejectionReason || 'Verification failed'}`,
          timestamp: paymentSubmission.verifiedAt,
          icon: 'x',
          color: 'red',
        });
      }
    }

    // Buyer completed attendee details (if applicable)
    const tickets = await Ticket.find({ order: order._id }).populate('attendee');
    const completedAttendee = tickets.find(t => t.attendee?.isConfirmed);
    if (completedAttendee?.attendee) {
      timeline.push({
        status: 'attendee_completed',
        description: 'Buyer completed attendee details',
        timestamp: completedAttendee.attendee.confirmedAt,
        icon: 'user-check',
        color: 'green',
      });
    }

    // Sort by timestamp
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        timeline,
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get transaction audit log
 */
const getTransactionAuditLog = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const user = req.user;
    const role = user.role?.toLowerCase();

    if (!isPlatformAdmin(role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Super Admin only.' });
    }

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ success: false, message: 'Invalid transaction ID.' });
    }

    const order = await Order.findById(transactionId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    const paymentSubmission = await PaymentSubmission.findOne({ orderId: order._id });

    // Get audit log from payment submission
    const auditLog = paymentSubmission?.auditLog || [];

    // Add order creation to audit log
    auditLog.unshift({
      action: 'order_created',
      userName: order.buyerName,
      userRole: 'buyer',
      details: 'Order created successfully',
      timestamp: order.createdAt,
    });

    // Add IP address from request if available
    const ipAddress = req.ip || req.connection?.remoteAddress;

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        auditLog: auditLog.map(entry => ({
          ...entry,
          ipAddress: entry.ipAddress || ipAddress,
        })),
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Export all transactions for Super Admin
 */
const exportAllTransactions = async (req, res, next) => {
  try {
    const user = req.user;
    const role = user.role?.toLowerCase();

    if (!isPlatformAdmin(role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Super Admin only.' });
    }

    const { format = 'xlsx', ...filters } = req.query;

    // Build filter similar to getAllTransactions
    const filter = {};
    const paymentMethod = filters.paymentMethod || 'all';
    if (paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    } else {
      filter.paymentMethod = { $in: ['card', 'bank_transfer', 'cash_on_entrance', 'cash_at_entrance'] };
    }

    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'pending_verification') filter.paymentStatus = 'pending_verification';
      else if (filters.status === 'approved') filter.paymentStatus = { $in: ['paid', 'success'] };
      else if (filters.status === 'rejected') filter.paymentStatus = { $in: ['rejected'] };
    }

    if (filters.dateFrom || filters.dateTo) {
      filter.createdAt = {};
      if (filters.dateFrom) filter.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) filter.createdAt.$lte = new Date(filters.dateTo);
    }

    const orders = await Order.find(filter)
      .populate('eventId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const bankTransferOrderIds = orders.filter(o => o.paymentMethod === 'bank_transfer').map(o => o._id);
    let paymentSubmissions = [];
    if (bankTransferOrderIds.length > 0) {
      paymentSubmissions = await PaymentSubmission.find({ orderId: { $in: bankTransferOrderIds } })
        .populate('verifiedBy', 'name')
        .populate('assignedSubOrganizer', 'name')
        .populate('assignedMainOrganizer', 'name')
        .lean();
    }

    const submissionMap = new Map(paymentSubmissions.map(ps => [ps.orderId.toString(), ps]));

    // Build Excel data
    const headers = [
      'Order Number',
      'Transaction ID',
      'Event',
      'Payment Method',
      'Gateway',
      'Buyer Name',
      'Buyer Email',
      'Buyer Phone',
      'Ticket Categories',
      'Amount',
      'Payment Status',
      'Order Status',
      'Main Organizer',
      'Sub Organizer',
      'Bank Used',
      'Reference Number',
      'Submitted Date',
      'Verified Date',
      'Verified By',
      'Created Date',
      'Updated Date',
    ];

    const data = orders.map(order => {
      const submission = submissionMap.get(order._id.toString());
      const ticketCategories = (order.tickets || []).map(t => t.categoryName).join(', ');

      return [
        order.orderNumber || '',
        submission?._id?.toString() || order._id.toString(),
        order.eventId?.name || '',
        order.paymentMethod || '',
        order.gatewayUsed || '-',
        order.buyerName || '',
        order.buyerEmail || '',
        order.buyerPhone || '',
        ticketCategories,
        order.totalAmount || 0,
        order.paymentStatus || '',
        order.status || '',
        submission?.assignedMainOrganizer?.name || '-',
        submission?.assignedSubOrganizer?.name || '-',
        submission?.bankUsed || '-',
        submission?.referenceNumber || '-',
        submission?.submittedAt ? new Date(submission.submittedAt).toISOString() : '-',
        submission?.verifiedAt ? new Date(submission.verifiedAt).toISOString() : '-',
        submission?.verifiedBy?.name || '-',
        order.createdAt ? new Date(order.createdAt).toISOString() : '-',
        order.updatedAt ? new Date(order.updatedAt).toISOString() : '-',
      ];
    });

    const XLSX = require('../utils/spreadsheet');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    
    // Set column widths
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    const isExcel = format === 'xlsx';
    const buffer = await XLSX.write(wb, { type: 'buffer', bookType: isExcel ? 'xlsx' : 'csv' });
    const ext = isExcel ? 'xlsx' : 'csv';
    const mime = isExcel ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv';

    res.setHeader('Content-Disposition', `attachment; filename="transactions-export-${Date.now()}.${ext}"`);
    res.setHeader('Content-Type', mime);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPaymentSubmissions,
  getPaymentSubmissionDetails,
  approvePayment,
  rejectPayment,
  requestMoreInfo,
  getPaymentStatistics,
  exportPayments,
  // Super Admin endpoints
  getAllTransactions,
  getTransactionStatistics,
  getTransactionDetails,
  getTransactionTimeline,
  getTransactionAuditLog,
  exportAllTransactions,
};
