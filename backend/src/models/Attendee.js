const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const attendeeSchema = new mongoose.Schema({
  // Identity
  fullName: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  dateOfBirth: { type: Date },
  nationalId: { type: String, trim: true },
  passportNumber: { type: String, trim: true },
  nationality: { type: String, trim: true },
  photo: { type: String }, // S3 URL or file path
  photoS3Key: { type: String }, // S3 object key for deletion/tracking
  photoUploadedAt: { type: Date },
  rfidTag: { type: String, trim: true, index: true },
  photoHash: { type: String, index: true },
  customFieldValues: { type: Map, of: String },

  // Ticket linkage
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
  },
  categoryId: { type: String },
  categoryName: { type: String },
  isPass: { type: Boolean, default: false },
  sponsorPackageId: { type: String },
  sponsorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sponsor' },
  allowedZones: [{ type: String }],

  // QR code
  qrCode: { type: String }, // base64 or file path
  qrToken: {
    type: String,
    unique: true,
    default: () => uuidv4(),
  },

  // Confirmation
  confirmationStatus: {
    type: String,
    enum: ['pending', 'invited', 'confirmed', 'rejected'],
    default: 'pending',
  },
  isConfirmed: { type: Boolean, default: false },
  confirmationToken: { type: String, default: () => uuidv4() },
  confirmedAt: { type: Date },
  confirmedBy: {
    type: String,
    enum: ['self', 'organiser', 'sub_organiser', 'online_invite'],
  },

  // Checkout option
  checkoutOption: {
    type: String,
    enum: ['standard', 'vip', 'premium', 'group', 'corporate', 'early_bird'],
    default: 'standard',
  },

  // Photo verification
  photoVerificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'Pending', 'Verified', 'Rejected'],
    default: 'pending',
  },
  photoVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  photoVerifiedAt: { type: Date },
  photoRejectionReason: { type: String },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: { type: Date },
  faceDescriptor: { type: [Number], default: [] },
  photoValidationMetrics: {
    faceCount: { type: Number, default: 0 },
    faceConfidence: { type: Number, default: 0 },
    brightness: { type: Number, default: 0 },
    sharpness: { type: Number, default: 0 },
    faceMatchDistance: { type: Number, default: 0 },
    faceMatchSimilarity: { type: Number, default: 0 },
    faceMatchThreshold: { type: Number, default: 0.5 },
  },
  resubmitToken: { type: String },
  resubmitCount: { type: Number, default: 0 },

  // Source of attendee record
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  addedVia: {
    type: String,
    enum: ['self_purchase', 'manual', 'bulk_upload', 'invite', 'sponsor'],
    default: 'self_purchase',
  },

  // Wristband
  wristbandId: { type: String },
  wristbandIssuedAt: { type: Date },
  wristbandIssuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Email tracking
  inviteEmailSent: { type: Boolean, default: false },
  confirmationEmailSent: { type: Boolean, default: false },
  confirmationSentAt: { type: Date },

  notes: { type: String },
  checkedIn: { type: Boolean, default: false },
  checkedInAt: { type: Date },
  isActive: { type: Boolean, default: true },
  isDisabled: { type: Boolean, default: false },
}, {
  timestamps: true,
});

attendeeSchema.index({ event: 1, email: 1 });
attendeeSchema.index({ confirmationToken: 1 });
// RFID identifiers are reusable across different events, but unique within one event.
attendeeSchema.index({ event: 1, rfidTag: 1 }, { unique: true, partialFilterExpression: { rfidTag: { $type: 'string' } } });

module.exports = mongoose.model('Attendee', attendeeSchema);
