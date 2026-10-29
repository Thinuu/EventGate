const mongoose = require('mongoose');

// Status timeline entry schema
const statusTimelineEntrySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'needs_info', 'submitted', 'assigned'],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  description: String,
}, { _id: true });

// Audit log entry schema
const auditLogEntrySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: [
      'payment_submitted',
      'receipt_uploaded',
      'assigned_to_organizer',
      'under_review',
      'needs_info_requested',
      'payment_approved',
      'payment_rejected',
      'payment_reassigned',
      'email_sent',
      'sms_sent',
      'receipt_viewed',
      'receipt_downloaded',
      'timeline_viewed',
    ],
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  userName: String,
  userRole: String,
  previousStatus: String,
  newStatus: String,
  details: String,
  ipAddress: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

// Submission history for tracking all status changes
const submissionHistoryEntrySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'needs_info'],
    required: true,
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  changedByName: String,
  changedByRole: String,
  reason: String,
  previousStatus: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const paymentSubmissionSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  payerName: { 
    type: String, 
    required: true,
    trim: true, 
  },
  payerEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  payerPhone: {
    type: String,
    required: true,
    trim: true,
  },
  payerNicPassport: {
    type: String,
    trim: true,
  },
  bankUsed: {
    type: String,
    required: true,
    trim: true,
  },
  transferDate: {
    type: Date,
    required: true,
  },
  transferTime: {
    type: String,
    required: true,
  },
  referenceNumber: {
    type: String,
    required: true,
    trim: true,
  },
  amountPaid: {
    type: Number,
    required: true,
    min: 0,
  },
  receiptFile: {
    type: String,
    required: true,
  },
  receiptFileType: {
    type: String,
    enum: ['image', 'pdf'],
  },
  notes: {
    type: String,
    trim: true,
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'needs_info'],
    default: 'pending',
  },
  rejectionReason: {
    type: String,
    trim: true,
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  verifiedAt: {
    type: Date,
  },
  // Approval hierarchy fields
  assignedSubOrganizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedMainOrganizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Audit trail fields
  submissionHistory: [submissionHistoryEntrySchema],
  statusTimeline: [statusTimelineEntrySchema],
  auditLog: [auditLogEntrySchema],
  // Payment reassignment
  reassignedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reassignedReason: String,
  // Additional metadata
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash_at_entrance', 'card'],
    default: 'bank_transfer',
  },
  transactionId: {
    type: String,
    trim: true,
  },
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  approvedDate: {
    type: Date,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for efficient lookups
paymentSubmissionSchema.index({ orderId: 1, createdAt: -1 });
paymentSubmissionSchema.index({ verificationStatus: 1, createdAt: -1 });
paymentSubmissionSchema.index({ assignedSubOrganizer: 1, verificationStatus: 1 });
paymentSubmissionSchema.index({ assignedMainOrganizer: 1, verificationStatus: 1 });
paymentSubmissionSchema.index({ 'auditLog.timestamp': -1 });

// Method to add audit log entry
paymentSubmissionSchema.methods.addAuditEntry = function(entry) {
  this.auditLog.push({
    ...entry,
    timestamp: new Date(),
  });
  return this.save();
};

// Method to update status timeline
paymentSubmissionSchema.methods.addStatusTimeline = function(status, description) {
  this.statusTimeline.push({
    status,
    description,
    timestamp: new Date(),
  });
  return this.save();
};

module.exports = mongoose.model('PaymentSubmission', paymentSubmissionSchema);
