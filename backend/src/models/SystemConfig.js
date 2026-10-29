const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'global',
  },
  general: {
    platformName: { type: String, default: 'EventGate' },
    supportEmail: { type: String, default: 'support@entrynex.lk' },
    systemStatus: { type: String, enum: ['Active', 'Maintenance'], default: 'Active' },
    defaultRoles: { type: [String], default: ['Attendee'] },
  },
  branding: {
    logoUrl: { type: String, default: '' },
    faviconUrl: { type: String, default: '' },
    primaryColor: { type: String, default: '#078f92' },
    secondaryColor: { type: String, default: '#4f46e5' },
    applyToEmails: { type: Boolean, default: true },
    applyToTickets: { type: Boolean, default: true },
    applyToUi: { type: Boolean, default: true },
  },
  email: {
    enabled: { type: Boolean, default: true },
    provider: { type: String, enum: ['smtp', 'sendgrid', 'mock'], default: 'smtp' },
    templateMode: { type: String, enum: ['code', 'sendgrid'], default: 'code' },
    smtpHost: { type: String, default: '' },
    smtpPort: { type: Number, default: 587 },
    smtpUser: { type: String, default: '' },
    smtpPassword: { type: String, default: '' },
    sendgridApiKey: { type: String, default: '' },
    senderName: { type: String, default: 'EventGate' },
    templates: {
      inviteSubject: { type: String, default: "You're Invited - {{eventName}}" },
      ticketSubject: { type: String, default: 'Confirmed - Your ticket for {{eventName}}' },
      resetSubject: { type: String, default: 'Password Reset Request' },
    },
    templateIds: {
      invite: { type: String, default: '' },
      ticket: { type: String, default: '' },
      reset: { type: String, default: '' },
      order: { type: String, default: '' },
    }
  },
  sms: {
    provider: { type: String, enum: ['mock', 'twilio', 'localApi'], default: 'mock' },
    apiKey: { type: String, default: '' },
    apiSecret: { type: String, default: '' },
    enabled: { type: Boolean, default: false },
    templates: {
      confirmation: { type: String, default: 'Confirmed: Your ticket for {{eventName}} is ready. Show this at entry.' },
      rejection: { type: String, default: 'Notice: Your verification for {{eventName}} was not successful. Please contact support.' },
    },
  },
  whatsapp: {
    provider: { type: String, enum: ['none', 'twilio', 'meta'], default: 'none' },
    apiKey: { type: String, default: '' },
    apiSecret: { type: String, default: '' },
    enabled: { type: Boolean, default: false },
    templates: {
      confirmation: { type: String, default: 'Hello! Your ticket for {{eventName}} is confirmed. 🎫' },
    },
  },
  payment: {
    enabled: { type: Boolean, default: false },
    defaultGateway: { type: String, enum: ['stripe', 'payhere'], default: 'stripe' },
    defaultCurrency: { type: String, default: 'LKR' },
    multiGatewayEnabled: { type: Boolean, default: true },
    gateways: {
      stripe: {
        enabled: { type: Boolean, default: false },
        publishableKey: { type: String, default: '' },
        secretKey: { type: String, default: '' }
      },
      payhere: {
        enabled: { type: Boolean, default: false },
        merchantId: { type: String, default: '' },
        merchantSecret: { type: String, default: '' }
      }
    },
    cashAtEntrance: {
      enabled: { type: Boolean, default: true },
      reservationExpiryHours: { type: Number, default: 48 },
      terms: { type: String, default: 'Please arrive 30–60 minutes before the event to complete payment and collect your tickets.' },
    },
    bankTransfer: {
      enabled: { type: Boolean, default: true },
      accounts: { type: String, default: '' },
      verificationSlaHours: { type: Number, default: 48 },
      receiptUploadLimitMb: { type: Number, default: 5 },
    },
  },
  security: {
    jwtTtlHours: { type: Number, default: 24 },
    minPasswordLength: { type: Number, default: 8 },
    requirePasswordComplexity: { type: Boolean, default: false },
    loginRateLimit: { type: Number, default: 5 },
    emailVerificationRequired: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    oneActiveDeviceLimit: { type: Boolean, default: false },
    deviceApprovalRequired: { type: Boolean, default: false },
  },
  ticketing: {
    qrEnabled: { type: Boolean, default: true },
    pdfEnabled: { type: Boolean, default: true },
    autoSendOnConfirm: { type: Boolean, default: true },
    accessCodeToggle: { type: Boolean, default: true },
  },
  regional: {
    defaultCurrency: { type: String, default: 'LKR' },
    timezone: { type: String, default: 'Asia/Colombo' },
    dateFormat: { type: String, default: 'MM/DD/YYYY' },
    multiCurrency: { type: Boolean, default: false },
  },
  integrations: {
    storageProvider: { type: String, enum: ['local', 'azure', 'cloudinary'], default: 'local' },
    azureConnectionString: { type: String, default: '' },
    azureContainer: { type: String, default: '' },
    mapsApiKey: { type: String, default: '' },
    aiServiceKey: { type: String, default: '' },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
