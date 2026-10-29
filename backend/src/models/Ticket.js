const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  attendee: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendee' },

  categoryId: { type: String },
  categoryName: { type: String, required: true },
  allowedZones: [{ type: String }],
  price: { type: Number, default: 0 },
  slotIndex: { type: Number, required: true }, // 1-based index within the order

  status: {
    type: String,
    enum: ['PENDING', 'PENDING_VERIFICATION', 'ASSIGNED', 'INVITED', 'CONFIRMED', 'CANCELLED', 'RESERVED', 'SOLD'],
    default: 'PENDING',
  },

  // QR activation flag for cash at entrance payments
  qrActive: { type: Boolean, default: false },

  refundStatus: {
    type: String,
    enum: ['none', 'refunded'],
    default: 'none',
  },
  refundAmount: { type: Number, default: 0 },
  refundedAt: { type: Date },
  invalidatedAt: { type: Date },
  invalidationReason: { type: String },

  // Invite tracking
  inviteEmail: { type: String },
  invitePhone: { type: String },
  inviteToken: { type: String, default: () => require('uuid').v4() },
  inviteStatus: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'DECLINED'],
    default: 'PENDING',
  },
  inviteSentAt: { type: Date },
  inviteExpiresAt: { type: Date },
  inviteRespondedAt: { type: Date },
  inviteUsedAt: { type: Date },

  ticketNumber: { type: String, unique: true },
}, {
  timestamps: true,
});

ticketSchema.pre('save', function (next) {
  if (!this.ticketNumber) {
    this.ticketNumber = 'TKT-' + Date.now() + '-' + this.slotIndex;
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);
