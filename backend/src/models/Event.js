const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  capacity: { type: Number, default: 0 },
  color: { type: String, default: '#3B82F6' },
  assignedSubOrganiser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  accessRules: {
    allowedRoles: [{ type: String }],
    timeStart: { type: String },
    timeEnd: { type: String },
    notes: { type: String, default: '' },
  },
}, { _id: false });

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true, min: 0 },
  capacity: { type: Number, required: true, min: 1 },
  sold: { type: Number, default: 0 },
  color: { type: String, default: '#3B82F6' },
  allowedZones: [{ type: String }], // zone ids
  benefits: [{ type: String }],
  customFields: [{
    name: { type: String },
    type: { type: String, enum: ['text', 'number', 'date', 'select', 'file'], default: 'text' },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
    label: { type: String },
    placeholder: { type: String },
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  }],
  // Private Ticket System fields
  isPrivate: { type: Boolean, default: false },
  isVisible: { type: Boolean, default: true }, // Whether to show in public list
  accessCode: { type: String },
  accessCodeHash: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedSubOrganisers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  usageCount: { type: Number, default: 0 },
  maxUsage: { type: Number },
}, { _id: false });

const sponsorPackageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  level: { type: String, enum: ['Platinum', 'Gold', 'Silver', 'Custom'], default: 'Custom' },
  description: { type: String },
  capacity: { type: Number, default: 1 }, // Number of Passes (NOP) per sponsor
  price: { type: Number, default: 0 },
  zones: [{ type: String }],
  benefits: [{ type: String }],
  contactNumber: { type: String },
  isVisible: { type: Boolean, default: true },
  expiryDate: { type: Date },
}, { _id: false, timestamps: true });

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Event name is required'],
    trim: true,
  },
  slug: { type: String, unique: true, lowercase: true },
  description: { type: String },
  eventType: {
    type: String,
    enum: ['cricket', 'concert', 'conference', 'other'],
    default: 'cricket',
  },
  customEventType: { type: String },
  venue: {
    name: { type: String, required: true },
    address: { type: String },
    city: { type: String },
    country: { type: String },
    mapUrl: { type: String },
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  gatesOpenTime: { type: Date },
  status: {
    type: String,
    enum: ['draft', 'published', 'ongoing', 'completed', 'cancelled', 'archived'],
    default: 'draft',
  },
  timezone: { type: String, default: 'Asia/Colombo' },
  coverImage: { type: String },
  bannerImage: { type: String },
  logoImage: { type: String },
  branding: {
    themeColor: { type: String, default: '#078f92' },
    logoImage: { type: String, default: '' },
    bannerImage: { type: String, default: '' },
    coverImage: { type: String, default: '' },
  },

  // Ticket categories (e.g., VIP, General, School, Media)
  categories: [categorySchema],

  // Sponsor packages
  sponsorPackages: [sponsorPackageSchema],

  // Physical zones inside the venue
  zones: [zoneSchema],

  // Main entry gates for the event
  gates: [String],

  // Custom fields to collect per attendee
  customFields: [{
    name: { type: String },
    type: { type: String, enum: ['text', 'number', 'date', 'select'], default: 'text' },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
  }],

  // Assigned personnel
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  mainOrganisers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  subOrganisers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  volunteers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  auditors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],

  // Settings
  settings: {
    currency: { type: String, default: 'LKR' },
    requirePhotoVerification: { type: Boolean, default: true },
    allowSelfConfirmation: { type: Boolean, default: true },
    confirmationDeadlineHours: { type: Number, default: 48 },
    maxTicketsPerOrder: { type: Number, default: 10 },
    rfidEnabled: { type: Boolean, default: false },
    inviteLimitPerAttendee: { type: Number, default: 3 },
    paymentMethods: {
      card: { type: Boolean, default: false },
      bank_transfer: { type: Boolean, default: false },
      cash: { type: Boolean, default: false },
    },
    emailTemplates: {
      invite: { type: String, default: '' },
      confirmation: { type: String, default: '' },
      rejection: { type: String, default: '' },
    },
    smsTemplates: {
      invite: { type: String, default: '' },
      confirmation: { type: String, default: '' },
      rejection: { type: String, default: '' },
    },
    inviteSystemEnabled: { type: Boolean, default: true },
    manualApprovalEnabled: { type: Boolean, default: false },
    autoConfirmEnabled: { type: Boolean, default: false },
    communicationChannels: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    // New feature flags
    mfaEnforced: { type: Boolean, default: false },
    sponsorModuleEnabled: { type: Boolean, default: true },
    publicRegistrationEnabled: { type: Boolean, default: true },
    ticketTransfersEnabled: { type: Boolean, default: false },
    paymentMethods: {
      card: { type: Boolean, default: true },
      bank_transfer: { type: Boolean, default: true },
      cash: { type: Boolean, default: true },
    },
    accessRules: {
      whoCanEnter: [{ type: String }],
      entryWindowStart: { type: String, default: '' },
      entryWindowEnd: { type: String, default: '' },
      restrictedZones: [{ type: String }],
    },
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  revenue: { type: Number, default: 0 },
  publishedAt: { type: Date },
}, {
  timestamps: true,
  minimize: false,
});

// Auto-generate slug from name
eventSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now();
  }
  next();
});

module.exports = mongoose.model('Event', eventSchema);
