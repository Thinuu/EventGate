const schedule = require('node-schedule');
const Order = require('../models/Order');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const PaymentSubmission = require('../models/PaymentSubmission');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendWithProvider, baseTemplate } = require('./email');
const { sendSMS } = require('../services/smsService');

let schedulerJob = null;

const checkPendingPaymentsAndReservations = async (io) => {
  try {
    const now = new Date();

    const expired = await require('../jobs/reservationMaintenance').runReservationMaintenance(25);

    // 2. Send 24h reminders
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const pendingOrdersForReminder = await Order.find({
      paymentMethod: 'bank_transfer',
      paymentStatus: 'pending',
      status: 'PENDING_PAYMENT',
      createdAt: { $lt: oneDayAgo },
      'paymentDetails.reminderSent': { $ne: true }
    }).limit(25);

    for (const order of pendingOrdersForReminder) {
      console.log(`[Scheduler] Sending 24h reminder for Order #${order.orderNumber}`);
      
      // Update order to avoid repeated reminders
      order.paymentDetails = { ...(order.paymentDetails || {}), reminderSent: true };
      order.markModified('paymentDetails');
      await order.save();

      // Send reminder email
      try {
        const emailHtml = baseTemplate(`
          <h2>Action Required: Complete Your Payment</h2>
          <p>Dear ${order.buyerName},</p>
          <p>This is a reminder that we are awaiting payment for your ticket reservation order <strong>#${order.orderNumber}</strong>.</p>
          <p>Please transfer the total amount of <strong>${order.eventId?.settings?.currency || order.currency || 'LKR'} ${order.totalAmount.toLocaleString()}</strong> and submit your transfer receipt before the reservation expires.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a class="btn" href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/bank-transfer/instructions/${order._id}">View Payment Instructions</a>
          </div>
        `, 'Payment Reminder');

        await sendWithProvider({
          to: order.buyerEmail,
          subject: `Reminder: Complete payment for your reservation - #${order.orderNumber}`,
          html: emailHtml,
        });
      } catch (err) {
        console.error(`[Scheduler] Reminder email error for ${order.buyerEmail}:`, err.message);
      }

      // Send SMS
      if (order.buyerPhone) {
        try {
          await sendSMS(
            order.buyerPhone,
            `EventGate: Reminder to complete your bank transfer payment for Order #${order.orderNumber} before expiry.`
          );
        } catch (smsErr) {
          console.error('[Scheduler] Reminder SMS error:', smsErr);
        }
      }
    }

    // 3. Escalate verifications pending past 48h
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const delayedSubmissions = await PaymentSubmission.find({
      verificationStatus: 'pending',
      submittedAt: { $lt: fortyEightHoursAgo },
      escalated: { $ne: true }
    }).limit(25).populate('orderId');

    for (const sub of delayedSubmissions) {
      console.log(`[Scheduler] Escalating Submission ID: ${sub._id}`);
      sub.escalated = true;
      await sub.save();

      const order = sub.orderId;
      if (!order) continue;

      // Find all event organisers & admins to notify
      const event = await Event.findById(order.eventId).select('createdBy mainOrganisers assignedOrganisers').lean();
      const owners = [event?.createdBy, ...(event?.mainOrganisers || []), ...(event?.assignedOrganisers || [])].filter(Boolean);
      const organizers = await User.find({ $or: [{ role: 'MainAdmin' }, { role: 'MainOrganiser', _id: { $in: owners } }] });
      for (const org of organizers) {
        // Create in-app notification
        try {
          const notif = new Notification({
            user: org._id,
            title: '⚠️ SLA Escalation: Payment Verification Overdue',
            message: `Payment verification for Order #${order.orderNumber} (LKR ${sub.amountPaid}) has been pending for over 48 hours.`,
            type: 'warning',
          });
          await notif.save();
        } catch (notifErr) {
          console.error('[Scheduler] Escalation Notification error:', notifErr);
        }
      }
    }
  } catch (error) {
    console.error('[Scheduler] Bank Transfer Scheduler Job Error:', error);
    throw error;
  }
};

const initializeBankTransferScheduler = (io) => {
  try {
    // Run job every hour
    const scheduleInterval = '0 * * * *';
    
    schedulerJob = schedule.scheduleJob(scheduleInterval, () => {
      console.log('[Scheduler] Running hourly Bank Transfer check...');
      checkPendingPaymentsAndReservations(io);
    });

    console.log(`[Scheduler] Bank Transfer scheduler initialized (Running at: ${scheduleInterval})`);
  } catch (error) {
    console.error('[Scheduler] Failed to start Bank Transfer scheduler:', error);
  }
};

const stopBankTransferScheduler = () => {
  if (schedulerJob) {
    schedulerJob.cancel();
    console.log('[Scheduler] Bank Transfer scheduler stopped');
  }
};

module.exports = {
  initializeBankTransferScheduler,
  stopBankTransferScheduler,
  checkPendingPaymentsAndReservations,
};
