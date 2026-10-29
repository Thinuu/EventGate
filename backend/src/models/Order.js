const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    default: function() {
      return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    },
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  buyerName: {
    type: String,
    required: true,
    trim: true,
  },
  buyerEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  buyerPhone: {
    type: String,
    trim: true,
  },
  notificationChannel: {
    type: String,
    enum: ['email', 'sms', 'both'],
    default: 'email',
  },
  tickets: [{
    categoryName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: ['PENDING', 'PENDING_PAYMENT', 'PENDING_VERIFICATION', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'RESERVED'],
    default: 'PENDING',
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'cash_on_entrance', 'cash_at_entrance'],
    default: 'card',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'pending_verification', 'paid', 'rejected', 'expired', 'awaiting_payment', 'success', 'failed'],
    default: 'pending',
  },
  paymentDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  reservationExpiry: {
    type: Date,
  },
  confirmationToken: {
    type: String,
    default: () => uuidv4(),
  },
  allAssigned: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for efficient lookups
orderSchema.index({ eventId: 1, createdAt: -1 });

// Refund fields
orderSchema.add({
  refundStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected', 'completed'],
    default: 'none'
  },
  refundReason: String,
  refundRequestedAt: Date,
  refundProcessedAt: Date,
  refundedAmount: Number,
  cancelReason: String,
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

  // Gateway tracking fields
  orderSchema.add({
    gatewayUsed: {
      type: String,
      enum: ['stripe', 'payhere', null],
      default: null,
    },
    stripeSessionId: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    paymentDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  });

module.exports = mongoose.model('Order', orderSchema);
