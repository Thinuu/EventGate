const mongoose = require('mongoose');
const Order = require('../models/Order');
const PaymentSubmission = require('../models/PaymentSubmission');
const BankAccount = require('../models/BankAccount');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const Notification = require('../models/Notification');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendWithProvider, baseTemplate, sendFinalConfirmation, sendBankTransferPaymentSubmitted, sendBankTransferPaymentApproved } = require('../utils/email');
const { sendBuyerPurchaseSummaryEmail } = require('../services/ticketDeliveryService');
const { sendSMS } = require('../services/smsService');
const QRCode = require('qrcode');
const { logActivity } = require('../utils/logger');
const { emitDashboardEvent } = require('../utils/socket');

// Configure multer for file uploads
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 3 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and PDF files are allowed'));
    }
  }
});

module.exports.upload = upload;

// Create order with bank transfer payment method
exports.createBankTransferOrder = async (req, res) => {
  try {
    const { eventId, buyerName, buyerEmail, buyerPhone, notificationChannel, tickets } = req.body;

    // Validate event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Calculate total amount
    let totalAmount = 0;
    tickets.forEach(ticket => {
      totalAmount += ticket.price * ticket.quantity;
    });

    // Set reservation expiry (48 hours from now)
    const reservationExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const order = new Order({
      eventId,
      buyerName,
      buyerEmail,
      buyerPhone,
      notificationChannel,
      tickets,
      totalAmount,
      paymentMethod: 'bank_transfer',
      paymentStatus: 'pending',
      status: 'PENDING_PAYMENT',
      reservationExpiry,
    });

    // After saving the order, create ticket documents with RESERVED status
    const ticketPromises = [];
    let slotIndex = 1;
    for (const ticket of tickets) {
      // Find matching category to get its ID
      const category = event.categories.find(cat => cat.name === ticket.categoryName);
      if (!category) {
        // Skip if category not found (should have been validated earlier)
        continue;
      }
      for (let i = 0; i < ticket.quantity; i++) {
        const ticketDoc = new Ticket({
          order: order._id,
          event: eventId,
          categoryId: category.id,
          categoryName: ticket.categoryName,
          allowedZones: category.allowedZones || [],
          price: ticket.price,
          status: 'RESERVED',
          slotIndex: slotIndex,
          ticketNumber: `${order.orderNumber}-${slotIndex}`,
          qrCode: null, // QR code should be inactive for reserved orders
        });
        ticketPromises.push(ticketDoc.save());
        slotIndex++;
      }
    }
    await Promise.all(ticketPromises);

    res.status(201).json({
      message: 'Order created successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        confirmationToken: order.confirmationToken,
        reservationExpiry: order.reservationExpiry,
      },
    });
  } catch (error) {
    console.error('Error creating bank transfer order:', error);
    res.status(500).json({ message: 'Failed to create order', error: error.message });
  }
};

// Get bank transfer instructions
exports.getBankTransferInstructions = async (req, res) => {
  try {
    const { orderIdOrToken } = req.params;
    const orderId = orderIdOrToken;
    console.log(`Fetching bank transfer instructions for: ${orderId}`);

    // Try to find by confirmationToken first (primary for email links), then by _id
    let order = await Order.findOne({ confirmationToken: orderId }).populate('eventId');
    
    if (!order) {
      // Fallback to lookup by _id for backwards compatibility
      if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
        order = await Order.findById(orderId).populate('eventId');
      }
    }
    
    if (!order) {
      console.warn(`Order not found for: ${orderId}`);
      return res.status(404).json({ message: 'The requested order could not be found' });
    }

    if (order.paymentMethod !== 'bank_transfer') {
      console.warn(`Attempted to get bank instructions for non-bank transfer order: ${orderId}`);
      return res.status(400).json({ message: 'This order does not utilize the bank transfer payment method' });
    }

    // Get active bank accounts for the event
    const bankAccounts = await BankAccount.find({ 
      isActive: true, 
      eventId: order.eventId?._id || order.eventId 
    });

    // If no event-specific accounts, get all active accounts
    const finalBankAccounts = bankAccounts.length > 0 ? bankAccounts : await BankAccount.find({ isActive: true });

    res.status(200).json({
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          confirmationToken: order.confirmationToken,
          eventName: order.eventId?.name,
          tickets: order.tickets,
          totalAmount: order.totalAmount,
          reservationExpiry: order.reservationExpiry,
          status: order.status,
          paymentStatus: order.paymentStatus,
          currency: order.currency || order.eventId?.settings?.currency || 'LKR',
        },
        bankAccounts: finalBankAccounts,
      },
    });
  } catch (error) {
    console.error(`Error retrieving bank transfer instructions for ${orderId}:`, error);
    res.status(500).json({ message: 'An internal error occurred while fetching bank transfer instructions', error: error.message });
  }
};

// Submit payment receipt
exports.submitPaymentReceipt = async (req, res) => {
  try {
    const { orderIdOrToken } = req.params;
    const {
      payerName,
      payerEmail,
      payerPhone,
      payerNicPassport,
      bankUsed,
      transferDate,
      transferTime,
      referenceNumber,
      amountPaid,
      notes,
    } = req.body;

    // Try to find by confirmationToken first, then by _id
    let order = await Order.findOne({ confirmationToken: orderIdOrToken });
    
    if (!order && orderIdOrToken.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findById(orderIdOrToken);
    }
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.paymentMethod !== 'bank_transfer') {
      return res.status(400).json({ message: 'This order is not a bank transfer order' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Receipt file is required' });
    }

    // Fetch event for email template
    const event = await Event.findById(order.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Determine file type
    const receiptFileType = req.file.mimetype.startsWith('image/') ? 'image' : 'pdf';

    // Create payment submission
    const submission = new PaymentSubmission({
      orderId: order._id,
      payerName,
      payerEmail,
      payerPhone,
      payerNicPassport,
      bankUsed,
      transferDate,
      transferTime,
      referenceNumber,
      amountPaid,
      receiptFile: await require('../services/privateReceiptStorage').uploadReceipt(req.file),
      receiptFileType,
      notes,
      verificationStatus: 'pending',
    });

    await submission.save();

    // Update order status
    order.paymentStatus = 'pending_verification';
    order.status = 'PENDING_VERIFICATION';
    await order.save();

    // Send email notification - Payment Submission Received (NOT order confirmation)
    try {
      await sendBankTransferPaymentSubmitted(order, event, submission);
    } catch (emailErr) {
      console.error('Error sending payment submitted email:', emailErr);
    }

    // Send SMS notification - Payment Submitted
    if (payerPhone) {
      try {
        await sendSMS(
          payerPhone,
          `EventGate: We have received your bank transfer submission. Your payment is currently being verified. You will receive another notification once your order has been confirmed. Order: ${order.orderNumber}`
        );
      } catch (smsErr) {
        console.error('Error sending submission SMS:', smsErr);
      }
    }

    // In-app Notification
    if (order.buyerId) {
      try {
        const notif = new Notification({
          user: order.buyerId,
          title: 'Payment Awaiting Verification',
          message: `Your payment for order ${order.orderNumber} is awaiting verification.`,
          type: 'info',
        });
        await notif.save();
      } catch (notifErr) {
        console.error('Error creating in-app notification:', notifErr);
      }
    }

    try {
      const io = req.app.get('io');
      emitDashboardEvent(io, 'event_update', order.eventId?._id, {
        type: 'PAYMENT_SUBMITTED',
        eventId: order.eventId?._id,
        orderId: order._id,
        paymentMethod: 'bank_transfer',
        paymentStatus: order.paymentStatus,
      });
    } catch (socketErr) {
      console.error('Error broadcasting payment submission event:', socketErr);
    }

    res.status(201).json({
      message: 'Payment submitted successfully',
      data: {
        submissionId: submission._id,
        orderNumber: order.orderNumber,
        verificationStatus: 'pending',
      },
    });
  } catch (error) {
    console.error('Error submitting payment receipt:', error);
    res.status(500).json({ message: 'Failed to submit payment', error: error.message });
  }
};

// Get pending payment submissions for organizers
exports.getPendingPayments = async (req, res) => {
  try {
    const { status, eventId } = req.query;
    const user = req.user;
    
    const filter = { verificationStatus: status || 'pending' };
    
    // Apply permission-based filtering for Sub Organizers
    if (user.role === 'SubOrganiser') {
      // Sub Organizers can only see payments for their assigned events and ticket categories
      const userEventIds = user.assignedEvents || [];
      const userTicketCategories = user.assignedTicketCategories || [];
      
      // Get orders that match the user's assignments
      const orderFilter = {};
      if (userEventIds.length > 0) {
        orderFilter.eventId = { $in: userEventIds };
      }
      
      // Find orders that the Sub Organizer has access to
      const accessibleOrders = await Order.find(orderFilter).select('_id');
      const accessibleOrderIds = accessibleOrders.map(o => o._id);
      
      if (accessibleOrderIds.length > 0) {
        filter.orderId = { $in: accessibleOrderIds };
      } else {
        // If no accessible orders, return empty results
        return res.status(200).json({ data: [] });
      }
    } else if (user.role === 'MainOrganiser') {
      // Main Organizers can see payments for their assigned events
      const userEventIds = user.assignedEvents || [];
      if (userEventIds.length > 0) {
        const accessibleOrders = await Order.find({ eventId: { $in: userEventIds } }).select('_id');
        const accessibleOrderIds = accessibleOrders.map(o => o._id);
        if (accessibleOrderIds.length > 0) {
          filter.orderId = { $in: accessibleOrderIds };
        }
      }
    }
    
    // Additional eventId filter from query params
    if (eventId) {
      const eventOrders = await Order.find({ eventId }).select('_id');
      const eventOrderIds = eventOrders.map(o => o._id);
      
      if (filter.orderId && filter.orderId.$in) {
        // Intersection of existing filter and event filter
        filter.orderId = { $in: filter.orderId.$in.filter(id => eventOrderIds.includes(id)) };
      } else {
        filter.orderId = { $in: eventOrderIds };
      }
    }

    const submissions = await PaymentSubmission.find(filter)
      .populate({
        path: 'orderId',
        populate: {
          path: 'eventId',
          select: 'name startDate venue'
        }
      })
      .populate('verifiedBy', 'name email')
      .sort({ submittedAt: -1 });

    res.status(200).json({ data: submissions });
  } catch (error) {
    console.error('Error getting pending payments:', error);
    res.status(500).json({ message: 'Failed to get payments', error: error.message });
  }
};

// Approve payment
exports.approvePayment = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { notes } = req.body;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ message: 'Invalid submission ID.' });
    }

    const paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId');
    
    if (!paymentSubmission) {
      return res.status(404).json({ message: 'Payment submission not found.' });
    }

    if (paymentSubmission.verificationStatus === 'approved') {
      return res.status(400).json({ message: 'Payment is already approved.' });
    }

    // Update payment submission
    paymentSubmission.verificationStatus = 'approved';
    paymentSubmission.verifiedBy = user._id;
    paymentSubmission.verifiedAt = new Date();
    paymentSubmission.notes = notes || paymentSubmission.notes;
    await paymentSubmission.save();
    
    // Update order status
    const order = await Order.findById(paymentSubmission.orderId._id)
      .populate('eventId');
    
    if (order) {
      order.status = 'CONFIRMED';
      order.paymentStatus = 'success';
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
        
        // Generate QR code if not exists
        if (!ticket.qrCode) {
          ticket.qrCode = await QRCode.toDataURL(ticket.ticketNumber);
          await ticket.save();
        }
      }
      
      // Send notifications - Order Confirmation Email after payment approval
      try {
        // Send bank transfer payment approved email
        await sendBankTransferPaymentApproved(order, order.eventId);

        // Send buyer order summary after confirmation email
        await sendBuyerPurchaseSummaryEmail({ order, event: order.eventId });
        
        // Send SMS notification - Payment Approved
        if (order.buyerPhone) {
          try {
            await sendSMS(
              order.buyerPhone,
              `EventGate: Your payment has been approved. Your order ${order.orderNumber} is confirmed. Please complete your attendee details through your EventGate account.`
            );
          } catch (smsErr) {
            console.error('Error sending approval SMS:', smsErr);
          }
        }
        
        // Create in-app notification
        await Notification.create({
          user: order.buyerEmail,
          title: 'Payment Approved - Order Confirmed',
          message: `Your payment for order ${order.orderNumber} has been approved. Your tickets are now confirmed and you can access all ticket features.`,
          type: 'success',
          metadata: {
            orderId: order._id,
            submissionId: paymentSubmission._id,
          },
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
        // Continue even if notifications fail
      }
      
      // Log activity
      await logActivity({
        req,
        action: 'payment_approval',
        eventId: order.eventId?._id,
        details: {
          message: `Payment approved for order ${order.orderNumber}`,
          submissionId: paymentSubmission._id,
          amount: paymentSubmission.amountPaid,
          approvedBy: user.name,
        },
      });
      
      // Emit dashboard event
      const io = req.app.get('io');
      emitDashboardEvent(io, 'payment_approved', order.eventId?._id, {
        orderId: order._id,
        submissionId: paymentSubmission._id,
        amount: paymentSubmission.amountPaid,
      });
      emitDashboardEvent(io, 'event_update', order.eventId?._id, {
        type: 'PAYMENT_APPROVED',
        eventId: order.eventId?._id,
        orderId: order._id,
        submissionId: paymentSubmission._id,
      });
    }
    
    res.status(200).json({
      message: 'Payment approved successfully',
      data: {
        submissionId: paymentSubmission._id,
        orderNumber: order.orderNumber,
        verificationStatus: 'approved',
      },
    });
  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(500).json({ message: 'Failed to approve payment', error: error.message });
  }
};

// Reject payment
exports.rejectPayment = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { rejectionReason } = req.body;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ message: 'Invalid submission ID.' });
    }

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({ message: 'Rejection reason is required.' });
    }

    const paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId');
    
    if (!paymentSubmission) {
      return res.status(404).json({ message: 'Payment submission not found.' });
    }

    if (paymentSubmission.verificationStatus === 'rejected') {
      return res.status(400).json({ message: 'Payment is already rejected.' });
    }

    // Update payment submission
    paymentSubmission.verificationStatus = 'rejected';
    paymentSubmission.verifiedBy = user._id;
    paymentSubmission.verifiedAt = new Date();
    paymentSubmission.rejectionReason = rejectionReason.trim();
    await paymentSubmission.save();
    
    // Update order status
    const order = await Order.findById(paymentSubmission.orderId._id)
      .populate('eventId');
    
    if (order) {
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
        await Notification.create({
          user: order.buyerEmail,
          title: 'Payment Rejected',
          message: `Your payment for order ${order.orderNumber} has been rejected. Reason: ${rejectionReason}`,
          type: 'error',
          metadata: {
            orderId: order._id,
            submissionId: paymentSubmission._id,
            rejectionReason,
          },
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }
      
      // Log activity
      await logActivity({
        req,
        action: 'payment_rejection',
        eventId: order.eventId?._id,
        details: {
          message: `Payment rejected for order ${order.orderNumber}`,
          submissionId: paymentSubmission._id,
          amount: paymentSubmission.amountPaid,
          rejectedBy: user.name,
          rejectionReason,
        },
      });
      
      // Emit dashboard events
      const io = req.app.get('io');
      emitDashboardEvent(io, 'payment_rejected', order.eventId?._id, {
        orderId: order._id,
        submissionId: paymentSubmission._id,
        amount: paymentSubmission.amountPaid,
        rejectionReason,
      });
      emitDashboardEvent(io, 'event_update', order.eventId?._id, {
        type: 'PAYMENT_REJECTED',
        eventId: order.eventId?._id,
        orderId: order._id,
        submissionId: paymentSubmission._id,
      });
    }
    
    res.status(200).json({
      message: 'Payment rejected successfully',
      data: {
        submissionId: paymentSubmission._id,
        orderNumber: order.orderNumber,
        verificationStatus: 'rejected',
        rejectionReason,
      },
    });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    res.status(500).json({ message: 'Failed to reject payment', error: error.message });
  }
};

// Request more information
exports.requestMoreInfo = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { message } = req.body;
    const user = req.user;

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ message: 'Invalid submission ID.' });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const paymentSubmission = await PaymentSubmission.findById(submissionId)
      .populate('orderId');
    
    if (!paymentSubmission) {
      return res.status(404).json({ message: 'Payment submission not found.' });
    }

    // Update payment submission
    paymentSubmission.verificationStatus = 'needs_info';
    paymentSubmission.notes = message.trim();
    await paymentSubmission.save();
    
    // Send notification
    const order = await Order.findById(paymentSubmission.orderId._id)
      .populate('eventId');
    
    if (order) {
      try {
        await Notification.create({
          user: order.buyerEmail,
          title: 'Payment Information Requested',
          message: `Additional information is required for your payment for order ${order.orderNumber}: ${message}`,
          type: 'info',
          metadata: {
            orderId: order._id,
            submissionId: paymentSubmission._id,
          },
        });
      } catch (notificationError) {
        console.error('Notification error:', notificationError);
      }
      
      // Log activity
      await logActivity({
        req,
        action: 'payment_info_request',
        eventId: order.eventId?._id,
        details: {
          message: `Information requested for order ${order.orderNumber}`,
          submissionId: paymentSubmission._id,
          requestedBy: user.name,
          infoRequest: message,
        },
      });
      
      // Emit dashboard events for real-time synchronization
      const io = req.app.get('io');
      emitDashboardEvent(io, 'payment_info_requested', order.eventId?._id, {
        orderId: order._id,
        submissionId: paymentSubmission._id,
        infoRequest: message,
        requestedBy: user.name,
      });
      emitDashboardEvent(io, 'event_update', order.eventId?._id, {
        type: 'PAYMENT_INFO_REQUESTED',
        eventId: order.eventId?._id,
        orderId: order._id,
        submissionId: paymentSubmission._id,
      });
    }
    
    res.status(200).json({
      message: 'Information request sent successfully',
      data: {
        submissionId: paymentSubmission._id,
        verificationStatus: 'needs_info',
      },
    });
  } catch (error) {
    console.error('Error requesting more info:', error);
    res.status(500).json({ message: 'Failed to request information', error: error.message });
  }
};

// Get bank accounts (for admin)
exports.getBankAccounts = async (req, res) => {
  try {
    const bankAccounts = await BankAccount.find().sort({ createdAt: -1 });
    res.status(200).json({ data: bankAccounts });
  } catch (error) {
    console.error('Error getting bank accounts:', error);
    res.status(500).json({ message: 'Failed to get bank accounts', error: error.message });
  }
};

// Create bank account (for admin)
exports.createBankAccount = async (req, res) => {
  try {
    const {
      bankName,
      accountName,
      accountNumber,
      branch,
      swiftCode,
      qrCode,
    } = req.body;

    const bankAccount = new BankAccount({
      bankName,
      accountName,
      accountNumber,
      branch,
      swiftCode,
      qrCode,
      createdBy: req.user._id,
    });

    await bankAccount.save();

    res.status(201).json({
      message: 'Bank account created successfully',
      data: bankAccount,
    });
  } catch (error) {
    console.error('Error creating bank account:', error);
    res.status(500).json({ message: 'Failed to create bank account', error: error.message });
  }
};

// Update bank account (for admin)
exports.updateBankAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const updates = req.body;

    const bankAccount = await BankAccount.findByIdAndUpdate(
      accountId,
      { ...updates, updatedAt: new Date() },
      { new: true }
    );

    if (!bankAccount) {
      return res.status(404).json({ message: 'Bank account not found' });
    }

    res.status(200).json({
      message: 'Bank account updated successfully',
      data: bankAccount,
    });
  } catch (error) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ message: 'Failed to update bank account', error: error.message });
  }
};

// Delete bank account (for admin)
exports.deleteBankAccount = async (req, res) => {
  try {
    const { accountId } = req.params;

    const bankAccount = await BankAccount.findByIdAndDelete(accountId);
    if (!bankAccount) {
      return res.status(404).json({ message: 'Bank account not found' });
    }

    res.status(200).json({ message: 'Bank account deleted successfully' });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    res.status(500).json({ message: 'Failed to delete bank account', error: error.message });
  }
};
