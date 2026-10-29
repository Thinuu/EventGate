const nodemailer = require('nodemailer');
const { createSendgridTransport } = require('../services/sendgridTransport');
const SystemConfig = require('../models/SystemConfig');

const renderTemplate = (template, data = {}) => {
  if (!template) return '';
  return String(template).replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    const v = data[key.trim()];
    return v == null ? '' : v;
  });
};

const createTransporter = async (config) => {
  const smtpHost = config?.email?.smtpHost || process.env.SMTP_HOST;
  const smtpPort = config?.email?.smtpPort || process.env.SMTP_PORT || 587;
  const smtpUser = config?.email?.smtpUser || process.env.SMTP_USER;
  const smtpPassword = config?.email?.smtpPassword || process.env.SMTP_PASS;
  const provider = config?.email?.provider || (process.env.SMTP_HOST ? 'smtp' : 'mock');

  if (provider === 'mock') {
    if (process.env.NODE_ENV === 'production') throw new Error('Configure a real email provider');
    console.log('EMAIL: Using Development Transporter (Console Log only)');
    return {
      sendMail: (opts) => {
        console.log('[EMAIL - dev mode, not sent]');
        console.log('To:', opts.to);
        console.log('Subject:', opts.subject);
        return Promise.resolve({ messageId: 'dev-' + Date.now() });
      },
    };
  }

  if (smtpHost && smtpPassword) {
    console.log('EMAIL: Using SMTP Transporter:', smtpHost);
    return nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      auth: { user: smtpUser, pass: smtpPassword },
      secure: Number(smtpPort) === 465,
      requireTLS: Number(smtpPort) !== 465,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      disableFileAccess: true, disableUrlAccess: true,
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' }
    });
  }
  
  return null;
};

const getSendGridClient = (config) => {
  const apiKey = config?.email?.sendgridApiKey || config?.integrations?.sendgridApiKey || process.env.SENDGRID_API_KEY;
  if (!apiKey) return null;
  return createSendgridTransport(apiKey);
};

const sendWithProvider = async ({ to, subject, html, templateId, dynamicTemplateData, attachments = [] }) => {
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  if (config.email?.enabled === false) {
    console.log('EMAIL_BLOCKED: Global email sending is disabled by SystemConfig.email.enabled=false');
    throw new Error('Global email sending is disabled');
  }
  const from = process.env.EMAIL_FROM || config.email?.senderEmail || config.general?.supportEmail || 'noreply@entrynex.lk';
  const preferredProvider = config.email?.provider || (process.env.SENDGRID_API_KEY ? 'sendgrid' : 'smtp');
  const templateMode = config.email?.templateMode || 'code';
  
  console.log(`EMAIL_SEND: Attempting send to ${to} from ${from} (Provider: ${preferredProvider}, Mode: ${templateMode})`);
  
  const sendGrid = getSendGridClient(config);

  // Add Logo as CID attachment for all emails
  const path = require('path');
  const fs = require('fs');
  const logoPath = path.join(__dirname, '../assets/eventgate-logo.png');
  let logoAttachment = null;
  
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoAttachment = {
      content: logoBuffer.toString('base64'),
      filename: 'logo.png',
      type: 'image/png',
      disposition: 'inline',
      contentId: 'logo',
      content_id: 'logo',
    };
    attachments.push(logoAttachment);
  }

  const sendViaSendGrid = async () => {
    if (!sendGrid) return false;
    try {
      const msg = {
        to,
        from,
        subject,
        html,
        attachments,
      };

      // Use SendGrid Dynamic Template only if mode is 'sendgrid' AND templateId exists
      if (templateMode === 'sendgrid' && templateId) {
        msg.templateId = templateId;
        msg.dynamicTemplateData = dynamicTemplateData;
        delete msg.html; // SendGrid ignores subject/html if templateId is present
        console.log(`EMAIL_INFO: Using SendGrid Dynamic Template ${templateId}`);
      } else {
        console.log(`EMAIL_INFO: Using Local Code Template with SendGrid provider`);
      }

      await sendGrid.send(msg);
      console.log(`EMAIL_SUCCESS: Sent via SendGrid to ${to}`);
      return true;
    } catch (error) {
      console.error('EMAIL_SENDGRID_ERROR: Falling back to SMTP if available', error);
      return false;
    }
  };

  if (preferredProvider === 'sendgrid' && await sendViaSendGrid()) {
    return { provider: 'sendgrid' };
  }

  const transporter = await createTransporter(config);
  if (transporter) {
    try {
      const smtpAttachments = attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        encoding: attachment.content && typeof attachment.content === 'string' ? 'base64' : attachment.encoding,
        cid: attachment.contentId || attachment.cid,
        contentType: attachment.type || attachment.contentType,
        disposition: attachment.disposition,
      }));
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
        attachments: smtpAttachments,
      });
      console.log(`EMAIL_SUCCESS: Sent via SMTP to ${to}`);
      return { provider: preferredProvider === 'mock' ? 'mock' : 'smtp' };
    } catch (error) {
      console.error(`EMAIL_SMTP_ERROR: Failed to send to ${to}`, error);
    }
  }

  if (preferredProvider !== 'sendgrid' && await sendViaSendGrid()) {
    return { provider: 'sendgrid' };
  }

  if (process.env.NODE_ENV !== 'production') {
    const mockTransporter = await createTransporter({ email: { provider: 'mock' } });
    await mockTransporter.sendMail({ from, to, subject, html, attachments: [] });
    return { provider: 'mock' };
  }

  const error = new Error(`No email provider available for ${to}. Configure SMTP or SendGrid.`);
  console.error('EMAIL_FATAL:', error.message);
  throw error;
};

const baseTemplate = (content, scenarioTitle = '', eventOrganiser = 'Authorized Event Organizer') => `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style type="text/css">
    body { margin: 0; padding: 0; min-width: 100%; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; }
    table { border-spacing: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; }
    td { padding: 0; }
    img { border: 0; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding-bottom: 40px; }
    .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    .header { padding: 32px; background-color: #0a1128; color: #ffffff; text-align: left; }
    .subtitle { font-size: 14px; font-weight: 700; color: #cbd5e1; margin-top: 8px; letter-spacing: 0.05em; text-transform: uppercase; }
    .content-body { padding: 40px 32px; line-height: 1.6; }
    .footer { background-color: #f1f5f9; padding: 24px 32px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
    .btn { display: inline-block; background-color: #2684ff; color: #ffffff !important; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; margin: 24px 0; }
    .info-row { padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
    .info-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; display: block; }
    .info-value { font-size: 16px; font-weight: 600; color: #162b49; }
    .badge { display: inline-block; background-color: #cce3fd; color: #0a1128; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin: 2px; }
    .qr-section { text-align: center; padding: 32px; background-color: #f8fafc; border-radius: 24px; border: 2px dashed #e2e8f0; margin: 24px 0; }
    .alert { background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; border-radius: 8px; margin-bottom: 24px; color: #166534; font-weight: 500; }
    .h2 { font-size: 20px; font-weight: 700; color: #162b49; margin-top: 0; margin-bottom: 16px; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc;">
  <center class="wrapper">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding-top: 20px; padding-bottom: 20px;">
      <tr>
        <td align="center" valign="top">
          <!--[if (gte mso 9)|(IE)]>
          <table width="600" align="center" border="0" cellspacing="0" cellpadding="0">
          <tr>
          <td align="center" valign="top">
          <![endif]-->
          <table class="main" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; margin: 0 auto;">
            <tr>
              <td class="header" style="background-color: #0a1128; padding: 32px; border-top-left-radius: 16px; border-top-right-radius: 16px;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="72" valign="middle" style="padding-right: 16px;">
                      <table width="72" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; text-align: center;">
                        <tr>
                          <td align="center" valign="middle" style="padding: 8px; height: 72px;">
                            <img src="cid:logo" alt="EventGate" style="width: 168px; max-height: 72px; display: block; border: 0;" width="168" />
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td valign="middle">
                      <div style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 0; line-height: 1.2;">EventGate</div>
                      ${scenarioTitle ? `<div class="subtitle" style="font-size: 14px; font-weight: 700; color: #cbd5e1; margin-top: 4px; text-transform: uppercase; line-height: 1.4;">${scenarioTitle}</div>` : ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="content-body" style="padding: 40px 32px; color: #1e293b; line-height: 1.6;">
                ${content}
              </td>
            </tr>
            <tr>
              <td class="footer" style="background-color: #f1f5f9; padding: 24px 32px; font-size: 12px; color: #64748b; text-align: center; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px;">
                <p style="margin: 0 0 8px 0; font-weight: 600; color: #475569;">Event Organizer: ${eventOrganiser}</p>
                <p style="margin: 0 0 12px 0; color: #64748b;">Support Contact: support@entrynex.lk</p>
                <p style="margin: 0 0 16px 0; font-size: 10px; color: #94a3b8; line-height: 1.4;">QR Validation Notice: This QR code is secure and will be validated at the venue gates.</p>
                <div style="font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.1em; text-transform: uppercase;">Powered by EventGate</div>
              </td>
            </tr>
          </table>
          <!--[if (gte mso 9)|(IE)]>
          </td>
          </tr>
          </table>
          <![endif]-->
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;

const sendOrderConfirmation = async (order, event, options = {}) => {
  const { pdfBuffer, stage = 'paid' } = options;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const confirmUrl = `${frontendUrl}/order/${order.confirmationToken}/confirm`;
  const ticketSummary = (order.tickets || [])
    .map((item) => `${item.quantity} x ${item.categoryName}`)
    .join(', ');
    
  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';

  const isPaid = stage === 'paid';
  const title = isPaid ? 'Order Confirmed!' : 'Order Received!';
  const alert = isPaid
    ? 'Your payment has been confirmed! Next step: Fill attendee names and upload photo verification to activate your tickets.'
    : 'Your order has been created successfully. Complete payment to continue ticket activation.';
  const currency = event?.settings?.currency || 'LKR';
  const intro = isPaid
    ? `Thank you for choosing EventGate for <strong>${event.name}</strong>. Your payment of <strong>${currency} ${order.totalAmount.toLocaleString()}</strong> has been processed.`
    : `Thank you for choosing EventGate for <strong>${event.name}</strong>. Your order for <strong>${currency} ${order.totalAmount.toLocaleString()}</strong> has been created and is waiting for payment confirmation.`;
  const cta = isPaid ? 'Fill Attendee Details & Upload Photo' : 'View Order Details';
  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const templateMode = config.email?.templateMode || 'code';
  const templateId = templateMode === 'sendgrid' ? config.email?.templateIds?.order : null;

  

  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';
  const html = baseTemplate(`
    <h2 class="h2">${title}</h2>
    <div class="alert">${alert}</div>
    
    <p>Dear <strong>${order.buyerName}</strong>,</p>
    <p>${intro}</p>
    
    <div class="info-row"><span class="info-label">Order Reference</span><span class="info-value">#${order.orderNumber}</span></div>
    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event.name}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span class="info-value">${event.venue?.name || 'TBD'}, ${event.venue?.city || ''}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span class="info-value">${eventDate}</span></div>
    <div class="info-row"><span class="info-label">Tickets Purchased</span><span class="info-value">${ticketSummary || 'N/A'}</span></div>
    
    <div style="text-align: center; margin-top: 32px;">
      <p style="font-size: 14px; color: #475569; margin-bottom: 16px;">${isPaid ? 'Assign attendees to activate tickets:' : 'You can review your order here:'}</p>
      <a class="btn" href="${confirmUrl}">${cta}</a>
    </div>
    
    <p style="font-size:12px; color: #94a3b8; text-align: center; margin-top: 24px;">
      ${isPaid
        ? 'Note: Each ticket holder must provide their details and photo for verification before entry is granted.'
        : 'Note: Ticket assignment and attendee confirmation continue after payment is completed.'}
    </p>
  `, 'EventGate Event Confirmation', orgName);

  const dynamicTemplateData = {
    title,
    alert,
    buyerName: order.buyerName,
    intro,
    orderNumber: order.orderNumber,
    eventName: event.name,
    venueName: event.venue?.name || 'TBD',
    eventDate,
    ticketSummary,
    confirmUrl,
    cta,
    isPaid
  };

  const subjectTemplate = config.email?.templates?.ticketSubject;
  const subject = renderTemplate(subjectTemplate, dynamicTemplateData) || (isPaid
    ? `Order Confirmed - ${event.name} (${order.orderNumber})`
    : `Order Received - ${event.name} (${order.orderNumber})`);

  await sendWithProvider({
    to: order.buyerEmail,
    subject,
    html,
    templateId,
    dynamicTemplateData,
    attachments: pdfBuffer ? [{
      content: pdfBuffer.toString('base64'),
      filename: `purchase-summary-${order.orderNumber}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment',
    }] : [],
  });
};

const sendAttendeeInvite = async ({ attendee, event, ticketDetails }) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const confirmUrl = `${frontendUrl}/invite/${attendee.confirmationToken}`;
  
  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';
  const eventTime = event?.startDate
    ? new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'TBD';

  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const templateMode = config.email?.templateMode || 'code';
  const templateId = templateMode === 'sendgrid' ? config.email?.templateIds?.invite : null;

  let scenarioTitle = 'EventGate Event Entry Confirmation';
  const catName = String(ticketDetails?.categoryName || '').toLowerCase();
  if (catName.includes('pass') || catName.includes('vip') || catName.includes('sponsor') || catName.includes('access') || catName.includes('staff')) {
    scenarioTitle = 'Your EventGate Access Details';
  }
  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';

  const html = baseTemplate(`
    <h2 class="h2">You've Been Invited!</h2>
    <p>Great news! You have been invited to attend <strong>${event.name}</strong>.</p>
    <div class="alert">Please confirm your identity and upload your photo to receive your entry ticket.</div>
    
    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event.name}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span class="info-value">${event.venue?.name || 'TBD'}, ${event.venue?.city || ''}</span></div>
    <div class="info-row"><span class="info-label">Date & Time</span><span class="info-value">${eventDate} at ${eventTime}</span></div>
    
    <div style="margin-top: 24px; padding: 20px; background: #f1f5f9; border-radius: 12px;">
      <h3 style="margin-top:0; font-size: 14px; color: #475569;">TICKET DETAILS</h3>
      <div style="font-size: 18px; font-weight: 700; color: #0a1128;">${ticketDetails.categoryName}</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Assigned to: ${attendee.email}</div>
    </div>
    
    <div style="text-align: center;">
      <a class="btn" href="${confirmUrl}">Confirm My Identity</a>
    </div>
    
    <p style="font-size:13px;color:#64748b; margin-top: 24px; text-align: center;">
      You will need to provide your full name, ID details, and a clear photo for verification.
    </p>
  `, scenarioTitle, orgName);

  const dynamicTemplateData = {
    attendeeEmail: attendee.email,
    eventName: event.name,
    venueName: event.venue?.name || 'TBD',
    eventDate,
    eventTime,
    ticketCategory: ticketDetails.categoryName,
    confirmUrl
  };

  const inviteSubjectTemplate = config.email?.templates?.inviteSubject;
  const inviteSubject = renderTemplate(inviteSubjectTemplate, dynamicTemplateData) || `Invitation: ${event.name} - Action Required`;

  await sendWithProvider({
    to: attendee.email,
    subject: inviteSubject,
    html,
    templateId,
    dynamicTemplateData,
  });
};

const sendFinalConfirmation = async (payload) => {
  const {
    attendee,
    event,
    ticketCategory,
    packageDescription,
    zoneAccessList,
    pdfBuffer,
    supportEmail,
    supportPhone,
  } = payload;

  const zonesHtml = (zoneAccessList || []).map((z) => `<span class="badge">${z}</span>`).join('');
  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';
  const eventTime = event?.startDate
    ? new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'TBD';

  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const templateMode = config.email?.templateMode || 'code';
  const templateId = templateMode === 'sendgrid' ? config.email?.templateIds?.ticket : null;

  let qrDataUrl = attendee.qrCode;
  if (!qrDataUrl && attendee.qrToken) {
    const QRCode = require('qrcode');
    qrDataUrl = await QRCode.toDataURL(attendee.qrToken);
  }

  let scenarioTitle = 'EventGate Event Entry Confirmation';
  const catName = String(ticketCategory || attendee.categoryName || '').toLowerCase();
  if (catName.includes('pass') || catName.includes('vip') || catName.includes('sponsor') || catName.includes('access') || catName.includes('staff')) {
    scenarioTitle = 'Your EventGate Access Details';
  }
  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';

  const html = baseTemplate(`
    <h2 class="h2">Your Ticket is Ready!</h2>
    <div class="alert">Your ticket is confirmed. Please present this email or the attached PDF with the QR code at entry.</div>
    <p>Dear <strong>${attendee.fullName}</strong>,</p>
    <p>Your ticket for <strong>${event.name}</strong> is now fully confirmed.</p>
    
    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event.name}</span></div>
    <div class="info-row"><span class="info-label">Date & Time</span><span class="info-value">${eventDate} at ${eventTime}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span class="info-value">${event.venue?.name || 'TBD'}, ${event.venue?.city || ''}</span></div>
    <div class="info-row"><span class="info-label">Attendee Name</span><span class="info-value">${attendee.fullName}</span></div>
    <div class="info-row"><span class="info-label">Category</span><span class="info-value">${ticketCategory || attendee.categoryName}</span></div>
    <div class="info-row"><span class="info-label">Zones</span><span class="info-value">${zonesHtml || 'General Access'}</span></div>
    
    <div class="qr-section">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Entry QR Code" style="width: 180px; height: 180px; margin-bottom: 16px;" />` : ''}
      <p style="font-weight:700; color: #0a1128; margin-bottom:8px;">ENTRY QR CODE</p>
      <p style="font-size:12px; color: #64748b; margin-top:8px;">Present this QR code at the entrance for scanning. A PDF copy is also attached for your convenience.</p>
    </div>
    
    <div style="margin-top: 32px; padding: 20px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #64748b; text-align: center;">
      Need help? Contact us at <br>
      <strong>${supportEmail || 'support@entrynex.lk'}</strong> ${supportPhone ? `| <strong>${supportPhone}</strong>` : ''}
    </div>
  `, scenarioTitle, orgName);

  const dynamicTemplateData = {
    attendeeName: attendee.fullName,
    eventName: event.name,
    eventDate,
    eventTime,
    venue: `${event.venue?.name || ''}, ${event.venue?.city || ''}`.trim(),
    ticketCategory: ticketCategory || attendee.categoryName,
    packageDescription: packageDescription || 'Standard access package',
    zoneAccessList: (zoneAccessList || []).join(', '),
    supportEmail: supportEmail || 'support@entrynex.lk',
    supportPhone: supportPhone || 'N/A',
  };
  const finalSubjectTemplate = config.email?.templates?.ticketSubject;
  const finalSubject = renderTemplate(finalSubjectTemplate, dynamicTemplateData) || `Confirmed: Your entry ticket for ${event.name}`;

  await sendWithProvider({
    to: attendee.email,
    subject: finalSubject,
    html,
    templateId: templateId || process.env.SENDGRID_FINAL_CONFIRMATION_TEMPLATE_ID,
    dynamicTemplateData,
    attachments: pdfBuffer
      ? [{
          content: pdfBuffer.toString('base64'),
          filename: `ticket-${(attendee.fullName || 'attendee').replace(/\s+/g, '-').toLowerCase()}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment',
        }]
      : [],
  });
};

const sendBuyerFinalSummary = async ({
  buyerName,
  buyerEmail,
  orderNumber,
  event,
  attendees,
  supportEmail,
  supportPhone,
}) => {
  const rows = (attendees || [])
    .map((a) => `<li>${a.fullName} - ${a.categoryName} (${a.email})</li>`)
    .join('');

  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';
  const html = baseTemplate(`
    <h2>All Attendees Verified</h2>
    <p>Dear <strong>${buyerName || 'Buyer'}</strong>,</p>
    <p>All ticket slots in your order are now verified for <strong>${event.name}</strong>.</p>
    <div class="info-row"><span class="info-label">Order Number</span><span>${orderNumber}</span></div>
    <div class="info-row"><span class="info-label">Event</span><span>${event.name}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span>${event.venue?.name}, ${event.venue?.city}</span></div>
    <p style="margin-top:16px;font-weight:bold">Confirmed Attendees</p>
    <ul>${rows || '<li>No attendees found.</li>'}</ul>
    <p style="font-size:13px;color:#555;">Support: ${supportEmail || 'support@entrynex.lk'} | ${supportPhone || 'N/A'}</p>
  `, 'EventGate Event Confirmation', orgName);

  await sendWithProvider({
    to: buyerEmail,
    subject: `Attendee Verification Complete - ${event.name}`,
    html,
    templateId: process.env.SENDGRID_BUYER_SUMMARY_TEMPLATE_ID,
    dynamicTemplateData: {
      buyerName: buyerName || 'Buyer',
      orderNumber,
      eventName: event.name,
      attendeeCount: (attendees || []).length,
      attendees: attendees || [],
      supportEmail: supportEmail || 'support@entrynex.lk',
      supportPhone: supportPhone || 'N/A',
    },
  });
};

const sendPhotoRejection = async (attendee, event, reason, resubmitLink) => {
  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';
  const html = baseTemplate(`
    <h2 class="h2">Photo Verification Failed</h2>
    <div class="alert" style="background:#fef2f2; border-left-color:#ef4444; color:#991b1b;">Your photo was not accepted for verification.</div>
    
    <p>Dear <strong>${attendee.fullName}</strong>,</p>
    <p>Unfortunately, your photo for <strong>${event?.name || 'the event'}</strong> was not accepted for the following reason:</p>
    
    <div style="margin: 24px 0; padding: 20px; background: #fff1f2; border-radius: 12px; border: 1px solid #fecaca;">
      <span class="info-label">REASON FOR REJECTION</span>
      <div style="font-size: 16px; font-weight: 600; color: #b91c1c;">${reason}</div>
    </div>
    
    <p>To receive your entry ticket, please re-upload a clear photo that meets our requirements:</p>
    <ul style="color: #475569; font-size: 14px;">
      <li>Clear face visible with no obstruction</li>
      <li>Good lighting (no shadows or glare)</li>
      <li>Neutral background preferred</li>
      <li>Recent photo (no filters)</li>
    </ul>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${resubmitLink}" class="btn">Resubmit My Photo</a>
    </div>
    
    <p style="font-size:13px; color:#64748b; margin-top: 24px; text-align: center;">
      If you have any questions, please contact the event organiser.
    </p>
  `, 'EventGate Event Entry Confirmation', orgName);
  await sendWithProvider({
    to: attendee.email,
    subject: `Photo Rejected - Resubmit for ${event.name}`,
    html,
  });
};

const sendConfirmationReminder = async (attendee, event) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const confirmUrl = `${frontendUrl}/invite/${attendee.confirmationToken}`;
  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';
  const html = baseTemplate(`
    <h2>Action Required: Confirm Your Identity</h2>
    <p>Dear <strong>${attendee.fullName || 'Attendee'}</strong>,</p>
    <p>This is a reminder to complete your identity confirmation for <strong>${event.name}</strong>.</p>
    <a class="btn" href="${confirmUrl}">Confirm My Identity</a>
    <p style="font-size:13px;color:#888;">Please complete before the deadline to avoid ticket cancellation.</p>
  `, 'EventGate Event Entry Confirmation', orgName);
  await sendWithProvider({
    to: attendee.email,
    subject: `Reminder - Confirm your ticket for ${event.name}`,
    html,
  });
};

const sendSubOrganiserInvite = async (user, event) => {
  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';
  const html = baseTemplate(`
    <h2 class="h2">Sub-Organiser Invitation</h2>
    <div class="alert">You have been selected to help manage event operations.</div>
    
    <p>Dear <strong>${user.name || 'Organizer'}</strong>,</p>
    <p>You have been invited to manage operations${event?.name ? ` for <strong>${event.name}</strong>` : ''}.</p>
    
    <div style="margin: 24px 0; padding: 20px; background: #f1f5f9; border-radius: 12px; border: 1px solid #e2e8f0;">
      <h3 style="margin-top:0; font-size: 14px; color: #475569;">EVENT DETAILS</h3>
      <div style="font-size: 18px; font-weight: 700; color: #0a1128;">${event?.name || 'Assigned Event'}</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Role: Sub-Organiser</div>
    </div>

    <p>Please log in to your EventGate account using your registered email address to view your assignments and start managing the event.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login">Log In to Dashboard</a>
    </div>
  `, 'Your EventGate Access Details', orgName);
  await sendWithProvider({
    to: user.email,
    subject: `EventGate: Sub-Organiser Invite ${event?.name ? `- ${event.name}` : ''}`,
    html,
  });
};

const sendStatusChange = async (attendee, event, status, message) => {
  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';
  const html = baseTemplate(`
    <h2 class="h2">Ticket Status Updated</h2>
    <div class="alert" style="background: #eff6ff; border-left-color: #3b82f6; color: #087477;">The status of your ticket for ${event?.name || 'the event'} has changed.</div>
    
    <p>Dear <strong>${attendee.fullName || 'Attendee'}</strong>,</p>
    
    <div style="margin: 24px 0; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <span class="info-label">NEW STATUS</span>
      <div style="font-size: 18px; font-weight: 700; color: #0a1128; text-transform: uppercase;">${status}</div>
    </div>

    ${message ? `
    <div style="margin-top: 16px;">
      <h3 style="font-size: 14px; color: #475569; margin-bottom: 8px;">Message from Organiser:</h3>
      <p style="padding: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; color: #475569;">${message}</p>
    </div>` : ''}

    <p style="margin-top: 24px;">Please visit the EventGate portal to view your updated ticket details.</p>
  `, 'EventGate Event Entry Confirmation', orgName);
  await sendWithProvider({
    to: attendee.email,
    subject: `EventGate: Ticket Status Update - ${event?.name || 'Event'}`,
    html,
  });
};

const sendBuyerPhotoRejection = async (buyer, event, attendee, reason, resubmitLink) => {
  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';
  const html = baseTemplate(`
    <h2 class="h2">Attendee Photo Rejected</h2>
    <div class="alert" style="background:#fef2f2; border-left-color:#ef4444; color:#991b1b;">An attendee in your order has their photo rejected.</div>
    
    <p>Dear <strong>${buyer.name || 'Buyer'}</strong>,</p>
    <p>The attendee photo for <strong>${event?.name || 'your event'}</strong> was rejected by the verification team.</p>
    
    <div class="info-row"><span class="info-label">ATTENDEE</span><span class="info-value">${attendee.fullName || attendee.email}</span></div>
    <div class="info-row"><span class="info-label">REASON</span><span class="info-value" style="color: #b91c1c;">${reason}</span></div>
    
    <p style="margin-top: 24px;">We have notified the attendee directly, but you may also share this link with them to speed up the process:</p>
    
    <div style="text-align: center; margin-top: 16px;">
      <a href="${resubmitLink}" class="btn" style="background: #dc2626;">Resubmit Photo Link</a>
    </div>
  `, 'EventGate Event Confirmation', orgName);
  await sendWithProvider({
    to: buyer.email,
    subject: `EventGate: Photo Rejected for ${attendee.fullName || 'Attendee'} - ${event?.name || 'Event'}`,
    html,
  });
};

const sendBuyerTicketProgressUpdate = async ({
  buyer,
  event,
  attendee,
  ticket,
  order,
  stage,
}) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const orderUrl = order?.confirmationToken ? `${frontendUrl}/order/${order.confirmationToken}/confirm` : `${frontendUrl}/buyer/orders`;
  const attendeeLabel = attendee?.fullName || attendee?.email || 'Attendee';
  const ticketCategory = ticket?.categoryName || attendee?.categoryName || 'Ticket';

  const stageConfig = {
    invited: {
      subject: `Invite Sent - ${event?.name || 'Event'}`,
      title: 'Invite Sent To Attendee',
      alert: 'The attendee invitation has been sent successfully.',
      message: `${attendeeLabel} has been invited for ${ticketCategory}. We are now waiting for them to confirm their identity.`,
    },
    pending_verification: {
      subject: `Verification Pending - ${event?.name || 'Event'}`,
      title: 'Attendee Submitted Details',
      alert: 'The attendee has completed confirmation. Verification is now pending.',
      message: `${attendeeLabel} has submitted their details for ${ticketCategory}. The ticket will be issued after verification is completed.`,
    },
  };

  const config = stageConfig[stage];
  if (!config || !buyer?.email) return;

  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';
  const html = baseTemplate(`
    <h2 class="h2">${config.title}</h2>
    <div class="alert">${config.alert}</div>

    <p>Dear <strong>${buyer.name || 'Buyer'}</strong>,</p>
    <p>${config.message}</p>

    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event?.name || 'Event'}</span></div>
    <div class="info-row"><span class="info-label">Attendee</span><span class="info-value">${attendeeLabel}</span></div>
    <div class="info-row"><span class="info-label">Ticket Category</span><span class="info-value">${ticketCategory}</span></div>
    <div class="info-row"><span class="info-label">Current Status</span><span class="info-value">${stage === 'invited' ? 'Waiting for attendee confirmation' : 'Waiting for organiser verification'}</span></div>

    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${orderUrl}">View Ticket Progress</a>
    </div>
  `, 'EventGate Event Confirmation', orgName);

  await sendWithProvider({
    to: buyer.email,
    subject: config.subject,
    html,
  });
};

const sendPasswordResetEmail = async (user, resetUrl) => {
  const html = baseTemplate(`
    <h2 class="h2">Password Reset Request</h2>
    <p>Dear <strong>${user.name}</strong>,</p>
    <p>You are receiving this email because you (or someone else) have requested to reset the password for your account.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${resetUrl}">Reset My Password</a>
    </div>
    
    <p style="font-size:13px; color: #64748b; margin-top: 24px;">
      This link is valid for **1 hour**. If you did not request this, please ignore this email and your password will remain unchanged.
    </p>
  `, 'Your EventGate Access Details');

  const config = await SystemConfig.findOne({ key: 'global' }).lean() || {};
  const resetSubjectTemplate = config.email?.templates?.resetSubject;
  const resetSubject = renderTemplate(resetSubjectTemplate, { userName: user.name }) || 'EventGate: Password Reset Request';

  await sendWithProvider({
    to: user.email,
    subject: resetSubject,
    html,
  });
};

const sendVerificationEmail = async (user, verifyUrl) => {
  const html = baseTemplate(`
    <h2 class="h2">Verify Your Email</h2>
    <p>Dear <strong>${user.name}</strong>,</p>
    <p>Thank you for registering with EventGate. Please confirm your email address to activate your account.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${verifyUrl}">Verify Email Address</a>
    </div>
    
    <p style="font-size:13px; color: #64748b; margin-top: 24px;">
      This link is valid for **24 hours**. If you did not create an account, please ignore this email.
    </p>
  `, 'Your EventGate Access Details');

  await sendWithProvider({
    to: user.email,
    subject: 'EventGate: Please verify your email address',
    html,
  });
};

const sendTempPasswordEmail = async (user, tempPassword, loginUrl) => {
  const html = baseTemplate(`
    <h2 class="h2">Welcome to EventGate</h2>
    <p>Dear <strong>${user.name}</strong>,</p>
    <p>An administrator has created an account for you on the Event Access Management System.</p>
    
    <div style="margin: 24px 0; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
      <span class="info-label">YOUR TEMPORARY PASSWORD</span>
      <div style="font-size: 20px; font-weight: 700; color: #0a1128; letter-spacing: 2px;">${tempPassword}</div>
    </div>
    
    <p>Please log in using your email address and the temporary password above. <strong>You will be required to change your password upon your first login.</strong></p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${loginUrl}">Log In Now</a>
    </div>
  `, 'Your EventGate Access Details');

  return sendWithProvider({
    to: user.email,
    subject: 'EventGate: Your Dashboard Login Details',
    html,
  });
};

const sendRoleAssignmentEmail = async (user, newRole, assignedEvents = []) => {
  const eventNames = assignedEvents.map(e => e.name || 'Assigned Event').join(', ');
  const html = baseTemplate(`
    <h2 class="h2">Account Authority Updated</h2>
    <div class="alert">Your system access level or event assignments have been updated.</div>
    
    <p>Dear <strong>${user.name}</strong>,</p>
    <p>An administrator has updated your account permissions on EventGate.</p>
    
    <div style="margin: 24px 0; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
      <div class="info-row"><span class="info-label">NEW ROLE</span><span class="info-value">${newRole}</span></div>
      <div class="info-row"><span class="info-label">ASSIGNED EVENTS</span><span class="info-value">${eventNames || 'None / Global'}</span></div>
    </div>
    
    <p>You can now log in to the dashboard to access your updated features and management tools.</p>
    
    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login">Go to Dashboard</a>
    </div>
  `, 'Your EventGate Access Details');

  await sendWithProvider({
    to: user.email,
    subject: `EventGate: Account Permissions Updated - ${newRole}`,
    html,
  });
};

const sendAttendeeVerificationConfirmation = async (attendee, event) => {
  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';
  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';
  
  const html = baseTemplate(`
    <h2 class="h2">Details Received - Verification in Progress</h2>
    <div class="alert">Thank you for submitting your details! Your ticket is being verified.</div>

    <p>Dear <strong>${attendee.fullName || 'Attendee'}</strong>,</p>
    <p>We have successfully received your identity details and photo for <strong>${event?.name || 'the event'}</strong>. Thank you!</p>

    <div style="margin-top: 24px; padding: 20px; background: #f1f5f9; border-radius: 12px; border: 1px solid #e2e8f0;">
      <span class="info-label">WHAT'S NEXT?</span>
      <p style="margin-top: 8px; color: #475569;">
        Our event team is now verifying your submitted details. Once your information is approved, you will receive your entry ticket with QR code via email.
      </p>
      <p style="margin-top: 16px; font-size: 12px; color: #64748b;">
        <strong>Note:</strong> Typical verification time is 24-48 hours. You can check your ticket status in the event portal.
      </p>
    </div>

    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event?.name || 'Event'}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span class="info-value">${eventDate}</span></div>
    <div class="info-row"><span class="info-label">Category</span><span class="info-value">${attendee.categoryName || 'Ticket'}</span></div>

    <div style="margin-top: 32px; padding: 20px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
      <h3 style="margin-top: 0; color: #166534; font-size: 14px;">✓ REQUIREMENTS MET</h3>
      <ul style="margin: 8px 0; padding-left: 20px; color: #166534; font-size: 13px;">
        <li>Personal information submitted</li>
        <li>ID details provided</li>
        <li>Photo uploaded successfully</li>
      </ul>
    </div>

    <p style="font-size: 12px; color: #64748b; margin-top: 24px; text-align: center;">
      If you have any questions, please contact the event organizer.
    </p>
  `, 'EventGate Event Entry Confirmation', orgName);

  await sendWithProvider({
    to: attendee.email,
    subject: `We've Received Your Details - ${event?.name || 'Event'}`,
    html,
  });
};

const sendAttendeePendingVerification = async (attendee, event) => {
  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';
  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';

  const html = baseTemplate(`
    <h2 class="h2">Details Received - Verification Pending</h2>
    <div class="alert">Thank you for submitting your information. Your details are now being reviewed by the event organizers.</div>
    
    <p>Dear <strong>${attendee.fullName}</strong>,</p>
    <p>We've received your confirmation details for <strong>${event?.name || 'the event'}</strong>. Your information has been submitted successfully and is now pending verification by the event organizers.</p>
    
    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event?.name || 'Event'}</span></div>
    <div class="info-row"><span class="info-label">Date</span><span class="info-value">${eventDate}</span></div>
    <div class="info-row"><span class="info-label">Category</span><span class="info-value">${attendee.categoryName || 'Ticket'}</span></div>
    <div class="info-row"><span class="info-label">Status</span><span class="info-value">Pending Verification</span></div>

    <div style="margin-top: 32px; padding: 20px; background: #fef3c7; border-radius: 12px; border: 1px solid #f59e0b;">
      <h3 style="margin-top: 0; color: #92400e; font-size: 14px;">⏳ WHAT HAPPENS NEXT?</h3>
      <ul style="margin: 8px 0; padding-left: 20px; color: #92400e; font-size: 13px;">
        <li>Event organizers will review your photo and details</li>
        <li>You will receive an email once verification is complete</li>
        <li>Your final ticket with QR code will be sent after approval</li>
      </ul>
    </div>

    <p style="font-size: 12px; color: #64748b; margin-top: 24px; text-align: center;">
      If you have any questions, please contact the event organizer.
    </p>
  `, 'EventGate Event Entry Confirmation', orgName);

  await sendWithProvider({
    to: attendee.email,
    subject: `Details Submitted - ${event?.name || 'Event'}`,
    html,
  });
};

const sendTicketInvalidationRefund = async ({
  buyer,
  attendee,
  event,
  ticket,
  order,
  refundAmount,
  reason,
  inventoryReleased = false,
}) => {
  const currency = event?.settings?.currency || 'LKR';
  const formattedAmount = `${currency} ${Number(refundAmount || 0).toLocaleString()}`;
  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';
  const recipientEmail = buyer?.email || attendee?.email;
  if (!recipientEmail) return;

  const html = baseTemplate(`
    <h2 class="h2">Ticket Invalidated & Refund Initiated</h2>
    <div class="alert" style="background:#fef2f2; border-left-color:#ef4444; color:#991b1b;">
      This ticket is no longer valid because the maximum number of photo resubmissions was reached.
    </div>

    <p>Dear <strong>${buyer?.name || attendee?.fullName || 'Customer'}</strong>,</p>
    <p>Your ticket for <strong>${event?.name || 'the event'}</strong> has been invalidated after repeated photo verification failures.</p>

    <div class="info-row"><span class="info-label">Ticket</span><span class="info-value">#${ticket?.ticketNumber || 'N/A'}</span></div>
    <div class="info-row"><span class="info-label">Category</span><span class="info-value">${ticket?.categoryName || attendee?.categoryName || 'Ticket'}</span></div>
    <div class="info-row"><span class="info-label">Refund Amount</span><span class="info-value" style="color:#15803d;">${formattedAmount}</span></div>
    <div class="info-row"><span class="info-label">Order</span><span class="info-value">${order?.orderNumber || 'N/A'}</span></div>
    <div class="info-row"><span class="info-label">Reason</span><span class="info-value">${reason}</span></div>
    ${inventoryReleased ? '<p style="margin-top:16px;">The ticket has been returned to public availability for this category.</p>' : ''}

    <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
      Refunds are processed back to the original payment method. Please allow a few business days for the amount to appear.
    </p>
  `, 'EventGate Ticket Refund', orgName);

  await sendWithProvider({
    to: recipientEmail,
    subject: `EventGate: Ticket Invalidated & Refund - ${event?.name || 'Event'}`,
    html,
  });
};

const sendCashReservationEmail = async (order, event) => {
  if (!order || !event) return;
  
  const recipientEmail = order.buyerEmail;
  if (!recipientEmail) return;

  const currency = event?.settings?.currency || 'LKR';
  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';
  const formattedAmount = `${currency} ${Number(order.totalAmount || 0).toLocaleString()}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const confirmUrl = `${frontendUrl}/cash-entrance/instructions/${order.confirmationToken}`;
  
  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';
  const eventTime = event?.startDate
    ? new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'TBD';
  
  let ticketsHtml = '';
  if (order.tickets && order.tickets.length > 0) {
    ticketsHtml = `
      <div style="margin: 16px 0; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; font-size: 11px; color: #64748b; font-weight: 700; tracking: 0.05em;">
            <th style="padding: 12px 16px; text-align: left;">Category</th>
            <th style="padding: 12px 16px; text-align: center;">Qty</th>
            <th style="padding: 12px 16px; text-align: right;">Price</th>
          </tr>
          ${order.tickets.map(t => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px 16px; font-size: 13px; color: #334155; font-weight: 500;">${t.categoryName}</td>
              <td style="padding: 12px 16px; font-size: 13px; color: #475569; text-align: center;">${t.quantity}</td>
              <td style="padding: 12px 16px; font-size: 13px; color: #475569; text-align: right;">${currency} ${Number(t.price).toLocaleString()}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
  }

  const html = baseTemplate(`
    <h2 class="h2">Your Reservation Has Been Successfully Placed</h2>
    
    <p>Dear <strong>${order.buyerName || 'Customer'}</strong>,</p>
    <p>Thank you for choosing EventGate for <strong>${event.name}</strong>.</p>

    <div class="info-row"><span class="info-label">Order Number</span><span class="info-value" style="font-weight: 800; color: #162b49;">${order.orderNumber}</span></div>
    <div class="info-row"><span class="info-label">Event Name</span><span class="info-value">${event.name}</span></div>
    <div class="info-row"><span class="info-label">Event Date & Time</span><span class="info-value">${eventDate} at ${eventTime}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span class="info-value">${event.venue?.name || 'TBD'}, ${event.venue?.city || ''}</span></div>
    <div class="info-row"><span class="info-label">Ticket Summary</span><span class="info-value">${order.tickets.map(t => `${t.quantity} x ${t.categoryName}`).join(', ')}</span></div>
    <div class="info-row"><span class="info-label">Quantity</span><span class="info-value">${order.tickets.reduce((sum, t) => sum + t.quantity, 0)}</span></div>
    <div class="info-row"><span class="info-label">Total Amount to Pay</span><span class="info-value" style="color:#0284c7; font-weight: 800;">${formattedAmount}</span></div>
    <div class="info-row"><span class="info-label">Payment Method</span><span class="info-value">Cash at Entrance</span></div>
    <div class="info-row"><span class="info-label">Reservation Status</span><span class="info-value" style="color: #ea580c; font-weight: 700;">Reserved</span></div>
    <div class="info-row"><span class="info-label">Payment Status</span><span class="info-value" style="color: #dc2626; font-weight: 700;">Awaiting Payment</span></div>
    
    ${ticketsHtml}

    <div style="margin: 24px 0; padding: 20px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #991b1b; font-size: 16px; font-weight: 700;">IMPORTANT NOTICE</h3>
      <p style="margin: 8px 0; color: #7f1d1d; line-height: 1.6;">
        <strong>Your tickets have been reserved but have NOT been issued yet.</strong>
      </p>
      <p style="margin: 8px 0; color: #7f1d1d; line-height: 1.6;">
        Your tickets will only be issued after payment has been successfully completed at the event entrance or designated payment counter.
      </p>
    </div>

    <div style="margin: 24px 0; padding: 20px; background: #fff7ed; border-left: 4px solid #ea580c; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #9a3412; font-size: 16px; font-weight: 700;">ARRIVAL TIME RECOMMENDATION</h3>
      <p style="margin: 8px 0; color: #7c2d12; line-height: 1.6;">
        Please arrive <strong>30–60 minutes before the event starts</strong> to complete your payment and collect your tickets. Late arrival may result in delays or reservation cancellation according to the event policy.
      </p>
    </div>

    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${confirmUrl}">View Reservation Instructions</a>
    </div>

    <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <h3 style="margin-top: 0; color: #162b49; font-size: 15px;">Venue Instructions</h3>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.6;">
        <li>Payment will be collected at the designated entrance desk.</li>
        <li><strong style="color: #dc2626;">Tickets will be issued after the payments are completed at the counter.</strong></li>
        <li>Your tickets will remain inactive until payment is received.</li>
        <li>Failure to arrive on time may result in your reservation being cancelled.</li>
      </ul>
    </div>
  `, 'EventGate Event Reservation', orgName);

  const { generateReservationPDF } = require('../services/pdfService');
  const pdfBuffer = await generateReservationPDF(order, event);

  await sendWithProvider({
    to: recipientEmail,
    subject: `Your Reservation Has Been Successfully Placed - ${event.name}`,
    html,
    attachments: [{
      content: pdfBuffer.toString('base64'),
      filename: `Reservation-Confirmation-${order.orderNumber}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment'
    }]
  });
};

const sendCashPaymentConfirmationEmail = async (order, event, attendees = []) => {
  if (!order || !event) return;
  
  const recipientEmail = order.buyerEmail;
  if (!recipientEmail) return;

  const currency = event?.settings?.currency || 'LKR';
  const orgName = event?.organiserName || event?.organiser?.name || 'Authorized Event Organizer';
  const formattedAmount = `${currency} ${Number(order.totalAmount || 0).toLocaleString()}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const confirmUrl = `${frontendUrl}/order/${order.confirmationToken}/confirm`;
  
  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';
  const eventTime = event?.startDate
    ? new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'TBD';
  
  let ticketsHtml = '';
  if (order.tickets && order.tickets.length > 0) {
    ticketsHtml = `
      <div style="margin: 16px 0; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; font-size: 11px; color: #64748b; font-weight: 700; tracking: 0.05em;">
            <th style="padding: 12px 16px; text-align: left;">Category</th>
            <th style="padding: 12px 16px; text-align: center;">Qty</th>
            <th style="padding: 12px 16px; text-align: right;">Price</th>
          </tr>
          ${order.tickets.map(t => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px 16px; font-size: 13px; color: #334155; font-weight: 500;">${t.categoryName}</td>
              <td style="padding: 12px 16px; font-size: 13px; color: #475569; text-align: center;">${t.quantity}</td>
              <td style="padding: 12px 16px; font-size: 13px; color: #475569; text-align: right;">${currency} ${Number(t.price).toLocaleString()}</td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
  }

  const html = baseTemplate(`
    <h2 class="h2">Payment Confirmed – Your Tickets Have Been Issued</h2>
    <div class="alert">Your payment has been received. Your tickets are now confirmed and ready for use.</div>

    <p>Dear <strong>${order.buyerName || 'Customer'}</strong>,</p>
    <p>Thank you for your payment for <strong>${event.name}</strong>. Your tickets have been successfully issued.</p>

    <div class="info-row"><span class="info-label">Order Number</span><span class="info-value" style="font-weight: 800; color: #162b49;">${order.orderNumber}</span></div>
    <div class="info-row"><span class="info-label">Event Name</span><span class="info-value">${event.name}</span></div>
    <div class="info-row"><span class="info-label">Event Date & Time</span><span class="info-value">${eventDate} at ${eventTime}</span></div>
    <div class="info-row"><span class="info-label">Venue</span><span class="info-value">${event.venue?.name || 'TBD'}, ${event.venue?.city || ''}</span></div>
    <div class="info-row"><span class="info-label">Payment Amount</span><span class="info-value" style="color:#16a34a; font-weight: 800;">${formattedAmount}</span></div>
    <div class="info-row"><span class="info-label">Payment Status</span><span class="info-value" style="color: #16a34a; font-weight: 700;">Paid</span></div>
    <div class="info-row"><span class="info-label">Order Status</span><span class="info-value" style="color: #16a34a; font-weight: 700;">Confirmed</span></div>
    
    ${ticketsHtml}

    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${confirmUrl}">Download Ticket</a>
      <div style="margin-top: 16px;">
        <a class="btn" href="${confirmUrl}" style="background: #64748b;">Complete Your Pass</a>
      </div>
      ${attendees.length > 1 ? `
      <div style="margin-top: 16px;">
        <a class="btn" href="${confirmUrl}" style="background: #64748b;">Invite Guests</a>
      </div>
      ` : ''}
      <div style="margin-top: 16px;">
        <a class="btn" href="${confirmUrl}" style="background: #64748b;">View Order Details</a>
      </div>
    </div>

    <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <h3 style="margin-top: 0; color: #166534; font-size: 15px;">What's Next?</h3>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.6;">
        <li>Your tickets are now active and ready for entry.</li>
        <li>Download your tickets or access them via the EventGate app.</li>
        <li>Present your QR code at the venue entrance for scanning.</li>
        <li>Complete attendee details if not already done.</li>
      </ul>
    </div>
  `, 'EventGate Event Confirmation', orgName);

  await sendWithProvider({
    to: recipientEmail,
    subject: `Payment Confirmed – Your Tickets Have Been Issued - ${event.name}`,
    html,
  });
};

// ============================================
// DIRECT BANK TRANSFER EMAIL TEMPLATES
// ============================================

/**
 * Email 1: Payment Submission Received
 * Sent immediately after buyer submits bank transfer details
 */
const sendBankTransferPaymentSubmitted = async (order, event, paymentSubmission) => {
  if (!order || !event) return;
  
  const recipientEmail = order.buyerEmail;
  if (!recipientEmail) return;

  const currency = event?.settings?.currency || 'LKR';
  const orgName = event?.organiserName || event?.organiser?.name || 'Event Organizer';
  const formattedAmount = `${currency} ${Number(order.totalAmount || 0).toLocaleString()}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const confirmUrl = `${frontendUrl}/bank-transfer/instructions/${order.confirmationToken}`;

  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';
  const eventTime = event?.startDate
    ? new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'TBD';

  const html = baseTemplate(`
    <h2 class="h2">We've Received Your Payment Submission</h2>
    
    <p>Dear <strong>${order.buyerName || 'Customer'}</strong>,</p>
    <p>Thank you for submitting your bank transfer payment for <strong>${event.name}</strong>.</p>
    <p>We have successfully received your payment details and uploaded receipt.</p>

    <div class="info-row"><span class="info-label">Order Number</span><span class="info-value" style="font-weight: 800; color: #162b49;">${order.orderNumber}</span></div>
    <div class="info-row"><span class="info-label">Payment Method</span><span class="info-value">Direct Bank Transfer</span></div>
    <div class="info-row"><span class="info-label">Payment Status</span><span class="info-value" style="color: #ea580c; font-weight: 700;">Pending Verification</span></div>
    <div class="info-row"><span class="info-label">Order Status</span><span class="info-value" style="color: #ea580c; font-weight: 700;">On Hold</span></div>
    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event.name}</span></div>
    <div class="info-row"><span class="info-label">Event Date</span><span class="info-value">${eventDate} at ${eventTime}</span></div>
    <div class="info-row"><span class="info-label">Amount</span><span class="info-value" style="color:#0284c7; font-weight: 800;">${formattedAmount}</span></div>

    <div style="margin: 24px 0; padding: 20px; background: #fff7ed; border-left: 4px solid #ea580c; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #9a3412; font-size: 16px; font-weight: 700;">What's Next?</h3>
      <p style="margin: 8px 0; color: #7c2d12; line-height: 1.6;">
        Our team will verify your payment within <strong>48 hours</strong>.
      </p>
      <p style="margin: 8px 0; color: #7c2d12; line-height: 1.6;">
        Once approved, you will receive another email confirming your order and providing access to your tickets.
      </p>
    </div>

    <div style="margin: 24px 0; padding: 20px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #991b1b; font-size: 16px; font-weight: 700;">Current Status</h3>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #7f1d1d; font-size: 13px; line-height: 1.8;">
        <li>Your tickets are reserved but not yet active.</li>
        <li>Ticket confirmation has not yet been completed.</li>
        <li>QR Codes are not yet active.</li>
        <li>Ticket management features are temporarily unavailable.</li>
      </ul>
    </div>

    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${confirmUrl}">View Payment Details</a>
    </div>

    <p style="margin-top: 24px; color: #64748b; font-size: 13px; line-height: 1.6;">
      If you have any questions, please contact the event organizer or our support team.
    </p>
  `, 'EventGate - Payment Submitted', orgName);

  await sendWithProvider({
    to: recipientEmail,
    subject: `We've Received Your Payment Submission - ${order.orderNumber}`,
    html,
  });
};

/**
 * Email 2: Payment Approved / Order Confirmed
 * Sent after organizer approves the bank transfer payment
 */
const sendBankTransferPaymentApproved = async (order, event) => {
  if (!order || !event) return;
  
  const recipientEmail = order.buyerEmail;
  if (!recipientEmail) return;

  const currency = event?.settings?.currency || 'LKR';
  const orgName = event?.organiserName || event?.organiser?.name || 'Event Organizer';
  const formattedAmount = `${currency} ${Number(order.totalAmount || 0).toLocaleString()}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const orderUrl = `${frontendUrl}/order/${order.confirmationToken}/confirm`;
  const assignUrl = `${frontendUrl}/buyer/orders/${order._id}`;

  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';
  const eventTime = event?.startDate
    ? new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : 'TBD';

  const html = baseTemplate(`
    <h2 class="h2">Your Order Has Been Confirmed – Your Tickets Are Ready</h2>
    
    <p>Dear <strong>${order.buyerName || 'Customer'}</strong>,</p>
    <p style="font-size: 18px; color: #166534; font-weight: 600;">Great news!</p>
    <p>Your bank transfer has been successfully verified by the event management team.</p>
    <p>Your order has now been <strong style="color: #166534;">confirmed</strong>.</p>

    <div class="info-row"><span class="info-label">Order Number</span><span class="info-value" style="font-weight: 800; color: #162b49;">${order.orderNumber}</span></div>
    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event.name}</span></div>
    <div class="info-row"><span class="info-label">Event Date</span><span class="info-value">${eventDate} at ${eventTime}</span></div>
    <div class="info-row"><span class="info-label">Payment Status</span><span class="info-value" style="color: #166534; font-weight: 700;">Paid</span></div>
    <div class="info-row"><span class="info-label">Order Status</span><span class="info-value" style="color: #166534; font-weight: 700;">Confirmed</span></div>
    <div class="info-row"><span class="info-label">Amount Paid</span><span class="info-value" style="color:#0284c7; font-weight: 800;">${formattedAmount}</span></div>

    <div style="margin: 24px 0; padding: 20px; background: #f0fdf4; border-left: 4px solid #166534; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #166534; font-size: 16px; font-weight: 700;">Action Required: Fill Attendee Details & Photos</h3>
      <p style="margin: 8px 0; color: #166534; line-height: 1.6;">
        Your tickets are ready for activation! Please click below to assign each ticket to its attendee and upload required verification photos.
      </p>
    </div>

    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" style="background: #166534;" href="${orderUrl}">Fill Attendee Details & Upload Photo</a>
    </div>

    <p style="margin-top: 24px; color: #64748b; font-size: 13px; line-height: 1.6;">
      Note: Each attendee must have their name and verified photo uploaded before entry badges or QR access passes are issued.
    </p>
  `, 'EventGate - Order Confirmed', orgName);

  const { generateOrderSummaryPDF } = require('../services/pdfService');
  let attachments = [];
  try {
    const pdfBuffer = await generateOrderSummaryPDF(order, event);
    if (pdfBuffer) {
      attachments.push({
        content: pdfBuffer.toString('base64'),
        filename: `Order-Confirmation-${order.orderNumber}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment'
      });
    }
  } catch (pdfErr) {
    console.error('[sendBankTransferPaymentApproved] Error generating PDF attachment:', pdfErr);
  }

  await sendWithProvider({
    to: recipientEmail,
    subject: `Your Order Has Been Confirmed – Your Tickets Are Ready - ${order.orderNumber}`,
    html,
    attachments,
  });
};

/**
 * Email 3: Payment Rejected
 * Sent when organizer rejects the bank transfer payment
 */
const sendBankTransferPaymentRejected = async (order, event, rejectionReason) => {
  if (!order || !event) return;
  
  const recipientEmail = order.buyerEmail;
  if (!recipientEmail) return;

  const currency = event?.settings?.currency || 'LKR';
  const orgName = event?.organiserName || event?.organiser?.name || 'Event Organizer';
  const formattedAmount = `${currency} ${Number(order.totalAmount || 0).toLocaleString()}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resubmitUrl = `${frontendUrl}/bank-transfer/submit/${order._id}`;
  const contactUrl = `mailto:?subject=Order ${order.orderNumber} - Payment Issue`;

  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';

  const html = baseTemplate(`
    <h2 class="h2">Payment Verification Unsuccessful</h2>
    
    <p>Dear <strong>${order.buyerName || 'Customer'}</strong>,</p>
    <p>Unfortunately, we were unable to verify your submitted bank transfer.</p>

    <div class="info-row"><span class="info-label">Order Number</span><span class="info-value" style="font-weight: 800; color: #162b49;">${order.orderNumber}</span></div>
    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event.name}</span></div>
    <div class="info-row"><span class="info-label">Event Date</span><span class="info-value">${eventDate}</span></div>
    <div class="info-row"><span class="info-label">Amount</span><span class="info-value" style="color:#0284c7; font-weight: 800;">${formattedAmount}</span></div>

    <div style="margin: 24px 0; padding: 20px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #991b1b; font-size: 16px; font-weight: 700;">Reason</h3>
      <p style="margin: 8px 0; color: #7f1d1d; line-height: 1.6;">${rejectionReason || 'Payment details could not be verified.'}</p>
    </div>

    <div style="margin: 24px 0; padding: 20px; background: #fff7ed; border-left: 4px solid #ea580c; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #9a3412; font-size: 16px; font-weight: 700;">Your Order Status</h3>
      <p style="margin: 8px 0; color: #7c2d12; line-height: 1.6;">
        Your tickets are still on hold. Your order will remain pending until a valid payment has been received and approved.
      </p>
    </div>

    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${resubmitUrl}">Upload New Receipt</a>
      <div style="margin-top: 12px;">
        <a class="btn" href="${contactUrl}" style="background: #64748b;">Contact Organizer</a>
      </div>
    </div>
  `, 'EventGate - Payment Not Verified', orgName);

  await sendWithProvider({
    to: recipientEmail,
    subject: `Payment Verification Unsuccessful - ${order.orderNumber}`,
    html,
  });
};

/**
 * Email 4: More Information Required
 * Sent when organizer requests additional payment information
 */
const sendBankTransferMoreInfoRequired = async (order, event, message) => {
  if (!order || !event) return;
  
  const recipientEmail = order.buyerEmail;
  if (!recipientEmail) return;

  const currency = event?.settings?.currency || 'LKR';
  const orgName = event?.organiserName || event?.organiser?.name || 'Event Organizer';
  const formattedAmount = `${currency} ${Number(order.totalAmount || 0).toLocaleString()}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resubmitUrl = `${frontendUrl}/bank-transfer/submit/${order._id}`;

  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'TBD';

  const html = baseTemplate(`
    <h2 class="h2">Additional Information Required for Your Payment</h2>
    
    <p>Dear <strong>${order.buyerName || 'Customer'}</strong>,</p>
    <p>The event management team requires additional information before your payment can be verified.</p>

    <div class="info-row"><span class="info-label">Order Number</span><span class="info-value" style="font-weight: 800; color: #162b49;">${order.orderNumber}</span></div>
    <div class="info-row"><span class="info-label">Event</span><span class="info-value">${event.name}</span></div>
    <div class="info-row"><span class="info-label">Event Date</span><span class="info-value">${eventDate}</span></div>
    <div class="info-row"><span class="info-label">Amount</span><span class="info-value" style="color:#0284c7; font-weight: 800;">${formattedAmount}</span></div>

    ${message ? `
    <div style="margin: 24px 0; padding: 20px; background: #eff6ff; border-left: 4px solid #078f92; border-radius: 8px;">
      <h3 style="margin-top: 0; color: #087477; font-size: 16px; font-weight: 700;">Message from Organizer</h3>
      <p style="margin: 8px 0; color: #1e3a8a; line-height: 1.6;">${message}</p>
    </div>
    ` : ''}

    <div style="text-align: center; margin-top: 32px;">
      <a class="btn" href="${resubmitUrl}">Update Payment Details</a>
    </div>
  `, 'EventGate - Additional Information Required', orgName);

  await sendWithProvider({
    to: recipientEmail,
    subject: `Additional Information Required for Your Payment - ${order.orderNumber}`,
    html,
  });
};

module.exports = {
  sendOrderConfirmation,
  sendAttendeeInvite,
  sendFinalConfirmation,
  sendBuyerFinalSummary,
  sendConfirmationReminder,
  sendSubOrganiserInvite,
  sendStatusChange,
  sendBuyerPhotoRejection,
  sendBuyerTicketProgressUpdate,
  sendPhotoRejection,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendTempPasswordEmail,
  sendRoleAssignmentEmail,
  sendAttendeeVerificationConfirmation,
  sendAttendeePendingVerification,
  sendTicketInvalidationRefund,
  sendCashReservationEmail,
  sendCashPaymentConfirmationEmail,
  // Direct Bank Transfer Email Templates
  sendBankTransferPaymentSubmitted,
  sendBankTransferPaymentApproved,
  sendBankTransferPaymentRejected,
  sendBankTransferMoreInfoRequired,
};
