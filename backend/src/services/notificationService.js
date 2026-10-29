const {
  sendOrderConfirmation,
  sendAttendeeInvite,
  sendBuyerFinalSummary,
  sendConfirmationReminder,
  sendSubOrganiserInvite,
  sendStatusChange,
  sendBuyerPhotoRejection,
  sendBuyerTicketProgressUpdate,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendTempPasswordEmail,
  sendAttendeePendingVerification,
} = require('../utils/email');
const { createShortLink } = require('./shortLinkService');
const { sendSMS } = require('./smsService');
const { sendWhatsApp } = require('./whatsappService');
const { deliverAttendeeTicketEmail, sendBuyerPurchaseSummaryEmail } = require('./ticketDeliveryService');
const SystemConfig = require('../models/SystemConfig');
const Notification = require('../models/Notification');
const User = require('../models/User');

const parseChannels = async (notificationChannel, event = null) => {
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const channels = [];

  // Email: only include if global email sending is enabled
  const emailGloballyEnabled = config.email?.enabled !== false; // default true
  if (emailGloballyEnabled) channels.push('email');

  // SMS Logic: Check Global config and Event settings
  const smsGloballyEnabled = config.sms?.enabled || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  const smsEventEnabled = event ? (event.settings?.communicationChannels?.sms ?? false) : true;
  if (smsGloballyEnabled && smsEventEnabled) {
    channels.push('sms');
  }

  if (config.whatsapp?.enabled) {
    channels.push('whatsapp');
  }

  if (notificationChannel === 'email') return channels.filter(c => c === 'email');
  if (notificationChannel === 'sms') return channels.filter(c => c === 'sms');
  if (notificationChannel === 'whatsapp') return channels.filter(c => c === 'whatsapp');

  return channels;
};

// Helper function to create persistent notifications
const createNotification = async (userId, title, message, type = 'info', metadata = {}) => {
  try {
    // Ensure userId is valid
    if (!userId) return null;
    
    const notification = new Notification({
      user: userId,
      title,
      message,
      type,
      metadata,
    });
    
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};


const templateReplace = (template, data) => {
  if (!template) return '';
  return template.replace(/{{(\w+)}}/g, (match, key) => {
    return data[key] || match;
  });
};

const buildShortUrl = async (targetPath, label) => {
  const shortLink = await createShortLink({ targetPath, label });
  return `${process.env.FRONTEND_URL || 'http://localhost:3000'}/t/${shortLink.code}`;
};

const notifyOrderConfirmation = async ({ order, event, buyerPhone, notificationChannel, strictDelivery = false }) => {
  // Skip bank transfer orders - they will receive confirmation after payment approval
  if (order.paymentMethod === 'bank_transfer') {
    console.log(`SKIPPING immediate confirmation for bank transfer order ${order.orderNumber} - will be sent after payment approval`);
    return;
  }
  
  const channels = await parseChannels(notificationChannel, event);
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const tasks = [];

  if (channels.includes('email')) {
    tasks.push(sendBuyerPurchaseSummaryEmail({ order, event }).catch((error) => {
      console.error('ORDER EMAIL ERROR:', error); if (strictDelivery) throw error;
    }));
  }

  const shortUrl = await buildShortUrl(`/order/${order.confirmationToken}/confirm`, 'order-confirmation');
  const data = { eventName: event.name, orderNumber: order.orderNumber, shortUrl, buyerName: order.buyerName };

  if (channels.includes('sms') && buyerPhone) {
    const template = config.sms?.templates?.confirmation || 'EventGate: Order confirmed for {{eventName}}. Confirm tickets here: {{shortUrl}}';
    tasks.push(sendSMS(buyerPhone, templateReplace(template, data), { rateKey: `order:${buyerPhone}` })
      .catch((error) => { console.error('ORDER SMS ERROR:', error); if (strictDelivery) throw error; }));
  }

  if (channels.includes('whatsapp') && buyerPhone) {
    const template = config.whatsapp?.templates?.confirmation || 'Hello! Your order for {{eventName}} is confirmed. Confirm here: {{shortUrl}}';
    tasks.push(sendWhatsApp(buyerPhone, templateReplace(template, data))
      .catch((error) => { console.error('ORDER WHATSAPP ERROR:', error); if (strictDelivery) throw error; }));
  }

  await Promise.all(tasks);
};

const notifyInvite = async ({ attendee, event, phone, email, notificationChannel }) => {
  const channels = await parseChannels(notificationChannel, event);
  const tasks = [];

  const inviteData = {
    attendee,
    event,
    ticketDetails: {
      categoryName: attendee.categoryName,
      price: attendee.price || 'N/A', // Assume price might be passed or exists on attendee
    }
  };

  // Create persistent notification for attendee
  if (attendee?.userId || attendee?._id) {
    const userId = attendee.userId || attendee._id;
    await createNotification(
      userId,
      `Ticket Invitation - ${event.name}`,
      `You are invited to ${event.name} (${attendee.categoryName}). Please confirm your attendance.`,
      'info',
      { attendeeId: attendee._id, eventId: event._id, confirmationToken: attendee.confirmationToken }
    );
  }

  if (channels.includes('email') && email) {
    tasks.push(sendAttendeeInvite(inviteData).catch((error) => {
      console.error('INVITE EMAIL ERROR:', error);
    }));
  }

  if (channels.includes('sms') && phone) {
    tasks.push((async () => {
      try {
        const shortUrl = await buildShortUrl(`/invite/${attendee.confirmationToken}`, 'invite-link');
        await sendSMS(
          phone,
          `EventGate: You're invited to ${event.name} (${attendee.categoryName}). Confirm here: ${shortUrl}`,
          { rateKey: `invite:${phone}` }
        );
      } catch (error) {
        console.error('INVITE SMS ERROR:', error);
      }
    })());
  }

  await Promise.all(tasks);
};

const notifyFinalTicket = async ({ attendee, event, phone, notificationChannel, force = false }) => {
  const channels = await parseChannels(notificationChannel, event);
  let deliveryResult = { delivered: false, skipped: false, reason: null };

  // Create persistent notification for attendee
  if (attendee?.userId || attendee?._id) {
    const userId = attendee.userId || attendee._id;
    await createNotification(
      userId,
      `Ticket Confirmed - ${event.name}`,
      `Your ticket for ${event.name} has been confirmed! Your PDF ticket has been sent to your email.`,
      'success',
      { attendeeId: attendee._id, eventId: event._id }
    );
  }

  if (channels.includes('email')) {
    try {
      deliveryResult = await deliverAttendeeTicketEmail({
        attendee,
        event,
        force,
      });
    } catch (error) {
      console.error('FINAL EMAIL ERROR:', error);
      deliveryResult = { delivered: false, error: error.message };
    }
  }

  // Decoupled SMS: Send SMS if requested, even if email was skipped (e.g. already_sent)
  // Only skip SMS if there was a hard failure in email that suggests we shouldn't proceed
  if (channels.includes('sms') && phone) {
    try {
      await sendSMS(
        phone,
        `EventGate Ticket Confirmed: ${event.name || 'Event'}. Your PDF ticket has been sent to your email.`,
        { rateKey: `final:${phone}` }
      );
    } catch (error) {
      console.error('FINAL SMS ERROR:', error);
    }
  }

  return deliveryResult;
};

const notifyBuyerFinalSummary = async ({ order, event, attendees }) => {
  const channels = await parseChannels('both', event);
  const tasks = [];
  const buyerPhone = order.buyerPhone;

  if (channels.includes('email')) {
    tasks.push(sendBuyerFinalSummary({
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      orderNumber: order.orderNumber,
      event,
      attendees,
    }).catch((error) => {
      console.error('BUYER SUMMARY EMAIL ERROR:', error);
    }));
  }

  if (channels.includes('sms') && buyerPhone) {
    tasks.push((async () => {
      try {
        const shortUrl = await buildShortUrl(`/order/${order.confirmationToken}/confirm`, 'order-confirmation');
        await sendSMS(
          buyerPhone,
          `EventGate: All attendees confirmed for ${event.name}. View summary: ${shortUrl}`,
          { rateKey: `buyer-summary:${buyerPhone}` }
        );
      } catch (error) {
        console.error('BUYER SUMMARY SMS ERROR:', error);
      }
    })());
  }

  await Promise.all(tasks);
};

const notifyConfirmationReminder = async ({ attendee, event, phone, email }) => {
  const channels = await parseChannels('both', event);
  const tasks = [];
  if (channels.includes('email') && email) {
    tasks.push(sendConfirmationReminder(attendee, event).catch((error) => {
      console.error('REMINDER EMAIL ERROR:', error);
    }));
  }
  if (channels.includes('sms') && phone) {
    tasks.push((async () => {
      try {
        const shortUrl = await buildShortUrl(`/invite/${attendee.confirmationToken}`, 'invite-reminder');
        await sendSMS(
          phone,
          `EventGate reminder: Please confirm your ticket for ${event.name}: ${shortUrl}`,
          { rateKey: `reminder:${phone}` }
        );
      } catch (error) {
        console.error('REMINDER SMS ERROR:', error);
      }
    })());
  }
  await Promise.all(tasks);
};

const notifySubOrganiserInvite = async ({ user, event, phone, email }) => {
  const channels = await parseChannels('both', event);
  const tasks = [];
  if (channels.includes('email') && email) {
    tasks.push(sendSubOrganiserInvite(user, event).catch((error) => {
      console.error('SUB-ORG INVITE EMAIL ERROR:', error);
    }));
  }
  if (channels.includes('sms') && phone) {
    tasks.push((async () => {
      try {
        await sendSMS(
          phone,
          `EventGate: You have been invited as Sub-Organiser${event?.name ? ` for ${event.name}` : ''}. Check your email for details.`,
          { rateKey: `suborg:${phone}` }
        );
      } catch (error) {
        console.error('SUB-ORG INVITE SMS ERROR:', error);
      }
    })());
  }
  await Promise.all(tasks);
};

const notifyStatusChange = async ({ attendee, event, status, message }) => {
  const channels = await parseChannels('both', event);
  const tasks = [];
  
  // Create persistent notification for attendee if user exists
  if (attendee?.userId || attendee?.email) {
    const userId = attendee.userId || attendee._id;
    await createNotification(
      userId,
      `Ticket Status Update`,
      `Your ticket status has been updated to: ${status}. ${message || ''}`.trim(),
      'info',
      { attendeeId: attendee._id, eventId: event._id, status }
    );
  }
  
  if (channels.includes('email') && attendee.email) {
    tasks.push(sendStatusChange(attendee, event, status, message).catch((error) => {
      console.error('STATUS EMAIL ERROR:', error);
    }));
  }
  if (channels.includes('sms') && attendee.phone) {
    tasks.push(sendSMS(
      attendee.phone,
      `EventGate update: ${status}. ${message || ''}`.trim(),
      { rateKey: `status:${attendee.phone}` }
    ).catch((error) => {
      console.error('STATUS SMS ERROR:', error);
    }));
  }
  await Promise.all(tasks);
};

const notifyPhotoRejection = async ({ attendee, reason, resubmitToken }) => {
  const channels = ['email', 'sms']; // Always send both for rejections
  const tasks = [];
  const event = attendee.event;

  if (channels.includes('email') && attendee.email) {
    const { sendPhotoRejection } = require('../utils/email');
    const resubmitLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/resubmit/${resubmitToken}`;
    tasks.push(sendPhotoRejection(attendee, event, reason, resubmitLink).catch((error) => {
      console.error('REJECTION EMAIL ERROR:', error);
    }));
  }

  if (channels.includes('sms') && attendee.phone) {
    tasks.push((async () => {
      try {
        const shortUrl = await buildShortUrl(`/resubmit/${resubmitToken}`, 'photo-resubmit');
        await sendSMS(
          attendee.phone,
          `EventGate: Your photo was rejected. Reason: ${reason}. Please re-upload here: ${shortUrl}`,
          { rateKey: `reject:${attendee.phone}` }
        );
      } catch (error) {
        console.error('REJECTION SMS ERROR:', error);
      }
    })());
  }

  await Promise.all(tasks);
};

const notifyPhotoRejectionNotification = async ({ attendee, event, reason }) => {
  if (!attendee?.resubmitToken) {
    return;
  }

  const resubmitToken = attendee.resubmitToken;
  await notifyPhotoRejection({ attendee, reason, resubmitToken });

  // Removed buyer notification - only send to attendee
};

const notifyBuyerTicketProgress = async ({
  order,
  attendee,
  event,
  ticket,
  stage,
}) => {
  if (!order?.buyerEmail || !stage) return;

  // Create persistent notification for buyer
  if (order.buyerId) {
    const stageMessages = {
      'invited': `Attendee invitation sent for ${attendee?.fullName || 'Attendee'}`,
      'confirmed': `Ticket confirmed for ${attendee?.fullName || 'Attendee'}`,
      'verified': `Photo verified for ${attendee?.fullName || 'Attendee'}`,
      'completed': `All tickets confirmed and ready!`,
    };
    
    await createNotification(
      order.buyerId,
      `Ticket Progress Update - ${event.name}`,
      stageMessages[stage] || `Ticket status updated: ${stage}`,
      'info',
      { orderId: order._id, attendeeId: attendee?._id, eventId: event._id, stage }
    );
  }

  await sendBuyerTicketProgressUpdate({
    buyer: {
      name: order.buyerName,
      email: order.buyerEmail,
      phone: order.buyerPhone,
    },
    event,
    attendee,
    ticket,
    order,
    stage,
  }).catch((error) => {
    console.error('BUYER PROGRESS EMAIL ERROR:', error);
  });
};

const notifyTicketInvalidationRefund = async ({
  attendee,
  ticket,
  order,
  event,
  refundAmount,
  reason,
  inventoryReleased = false,
}) => {
  const { sendTicketInvalidationRefund } = require('../utils/email');
  const buyer = order ? {
    name: order.buyerName,
    email: order.buyerEmail,
    phone: order.buyerPhone,
  } : null;

  await sendTicketInvalidationRefund({
    buyer,
    attendee,
    event,
    ticket,
    order,
    refundAmount,
    reason,
    inventoryReleased,
  }).catch((error) => {
    console.error('TICKET INVALIDATION REFUND EMAIL ERROR:', error);
  });

  if (order?.buyerId) {
    await createNotification(
      order.buyerId,
      'Ticket Invalidated & Refund Initiated',
      `Ticket #${ticket?.ticketNumber || ''} was invalidated after maximum photo resubmissions. Refund of ${event?.settings?.currency || 'LKR'} ${Number(refundAmount || 0).toLocaleString()} initiated.`,
      'warning',
      { orderId: order._id, ticketId: ticket?._id, attendeeId: attendee?._id, eventId: event?._id },
    );
  }

  if (attendee?.email && attendee.email !== buyer?.email) {
    await sendTicketInvalidationRefund({
      buyer: { name: attendee.fullName, email: attendee.email, phone: attendee.phone },
      attendee,
      event,
      ticket,
      order,
      refundAmount,
      reason,
      inventoryReleased,
    }).catch((error) => {
      console.error('ATTENDEE INVALIDATION REFUND EMAIL ERROR:', error);
    });
  }
};

const notifyUserCredentials = async (user, tempPassword) => {
  console.log(`NOTIFY: Sending credentials to ${user.email} with temp password ${tempPassword}`);
  const tasks = [];
  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

  const emailResult = await sendTempPasswordEmail(user, tempPassword, loginUrl);

  if (user.phone) {
    tasks.push(sendSMS(
      user.phone,
      `EventGate: Your account has been created. Temp Password: ${tempPassword}. Login at: ${loginUrl}`,
      { rateKey: `creds:${user.phone}` }
    ).catch(err => console.error('CREDENTIALS SMS ERROR:', err)));
  }

  await Promise.all(tasks);
  return { email: emailResult, smsQueued: tasks.length > 0 };
};

const notifyVerification = async (user, verifyUrl) => {
  await sendVerificationEmail(user, verifyUrl).catch(err => console.error('VERIFICATION EMAIL ERROR:', err));
};

const notifyPasswordReset = async (user, resetUrl) => {
  await sendPasswordResetEmail(user, resetUrl).catch(err => console.error('RESET EMAIL ERROR:', err));
};

const notifyOTP = async (phone, otp) => {
  await sendSMS(
    phone,
    `EventGate: Your security code is ${otp}. It expires in 5 minutes.`,
    { rateKey: `otp:${phone}` }
  );
};

const notifyRoleAssignment = async (user, newRole, assignedEvents = []) => {
  await require('../utils/email').sendRoleAssignmentEmail(user, newRole, assignedEvents).catch(err => console.error('ROLE EMAIL ERROR:', err));
  
  if (user.phone) {
    await sendSMS(
      user.phone,
      `EventGate: Your account role has been updated to ${newRole}. Log in to view changes.`,
      { rateKey: `role:${user.phone}` }
    ).catch(err => console.error('ROLE SMS ERROR:', err));
  }
};

const notifyAttendeePendingVerification = async ({ attendee, event }) => {
  if (!attendee?.email) return;

  // Send email to attendee
  await sendAttendeePendingVerification(attendee, event).catch((error) => {
    console.error('ATTENDEE PENDING VERIFICATION EMAIL ERROR:', error);
  });
};

// ──────────────────────────────────────────────
// Cash at Entrance notification helpers
// ──────────────────────────────────────────────
const { sendWithProvider, baseTemplate } = require('../utils/email');
const { generateOrderSummaryPDF } = require('./pdfService');

const sendCashReservationEmail = async (buyer, order, event) => {
  const html = baseTemplate(`
    <h2>Your Tickets Have Been Reserved</h2>
    <p>Dear ${buyer.name},</p>
    <p>Your reservation for order <strong>#${order.orderNumber}</strong> has been successfully placed.</p>
    <div style="margin: 20px 0; padding: 15px; background-color: #f1f5f9; border-radius: 8px;">
      <strong>Order Number:</strong> ${order.orderNumber}<br/>
      <strong>Event:</strong> ${event.name}<br/>
      <strong>Amount Due:</strong> ${order.totalAmount}<br/>
      <strong>Payment Method:</strong> Cash at Entrance<br/>
      <strong>Status:</strong> Reserved
    </div>
    <h3>Payment Instructions</h3>
    <p>Payment will be collected at the venue entrance.</p>
    <p><strong>Arrival Instructions:</strong> Please arrive at the venue <strong>30–60 minutes before the event</strong> to complete payment and collect your tickets.</p>
    <p style="color: #dc2626; font-weight: bold;">Your tickets are currently reserved. Ticket confirmation and attendee verification will begin only after payment has been completed at the venue.</p>
    <p>Your reservation will expire if payment is not collected at the venue.</p>
  `, 'Your Tickets Have Been Reserved');

  const pdfBuffer = await generateOrderSummaryPDF(order, event);

  await sendWithProvider({
    to: buyer.email,
    subject: `Your Tickets Have Been Reserved - #${order.orderNumber}`,
    html,
    attachments: [{
      content: pdfBuffer.toString('base64'),
      filename: `Reservation-Summary-${order.orderNumber}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment'
    }]
  });
};

const sendCashReservationSMS = async (phone, order) => {
  await sendSMS(
    phone,
    `EventGate: Your reservation #${order.orderNumber} has been placed. Please arrive 30–60 minutes before the event to complete payment and collect your tickets.`,
    { rateKey: `cash-res:${phone}` }
  );
};

const sendCashPaymentConfirmedEmail = async (buyer, order) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const html = baseTemplate(`
    <h2>Payment Received – Tickets Confirmed!</h2>
    <p>Dear ${buyer.name},</p>
    <p>Your cash payment for order <strong>#${order.orderNumber}</strong> has been received and your tickets are now confirmed.</p>
    <div style="margin: 20px 0; padding: 15px; background-color: #f1f5f9; border-radius: 8px;">
      <strong>Order Number:</strong> ${order.orderNumber}<br/>
      <strong>Amount Paid:</strong> ${order.totalAmount}<br/>
      <strong>Status:</strong> Confirmed
    </div>
    <p>Your QR codes are now active. You can now complete your attendee details and download your tickets from your dashboard.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${frontendUrl}/order/${order.confirmationToken}" style="background-color: #078f92; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Order Details</a>
    </div>
    <div style="text-align: center; margin: 15px 0;">
      <a href="${frontendUrl}/buyer/tickets" style="background-color: #10b981; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Complete Your Pass</a>
    </div>
  `, 'Payment Confirmed');

  await sendWithProvider({
    to: buyer.email,
    subject: `Payment Confirmed - #${order.orderNumber}`,
    html,
  });
};

module.exports = {
  notifyOrderConfirmation,
  notifyInvite,
  notifyFinalTicket,
  notifyBuyerFinalSummary,
  notifyConfirmationReminder,
  notifySubOrganiserInvite,
  notifyStatusChange,
  notifyPhotoRejection,
  notifyPhotoRejectionNotification,
  notifyBuyerTicketProgress,
  notifyTicketInvalidationRefund,
  notifyUserCredentials,
  notifyVerification,
  notifyPasswordReset,
  notifyOTP,
  notifyRoleAssignment,
  notifyAttendeePendingVerification,
  sendCashReservationEmail,
  sendCashReservationSMS,
  sendCashPaymentConfirmedEmail,
  notifySponsorWelcome: async (user, tempPassword, event, pkg, confirmationToken) => {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
    // 1. Send Login Credentials Email
    await sendTempPasswordEmail(user, tempPassword, loginUrl);
    
    if (confirmationToken) {
      await notifyInvite({
        attendee: { fullName: user.name, email: user.email, confirmationToken, categoryName: `${pkg.name} Pass` },
        event,
        email: user.email,
        notificationChannel: 'email'
      });
    }
  },
  notifySponsorPassInvite: async (attendee, event, pkg) => {
    await notifyInvite({
      attendee,
      event,
      email: attendee.email,
      phone: attendee.phone,
      notificationChannel: 'both'
    });
  },
  parseChannels,
  createNotification,
};

