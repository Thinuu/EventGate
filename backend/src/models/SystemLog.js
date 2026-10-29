const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  userEmail: {
    type: String,
  },
  userRole: {
    type: String,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'payment_received',
      'payment_approval',
      'payment_rejection',
      'payment_info_request',
      'ticket_creation',
      'ticket_scan',
      'event_update',
      'user_creation',
      'qr_verification',
      'sponsor_action',
      'mfa_activity',
    ],
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
  },
  ipAddress: {
    type: String,
  },
}, {
  timestamps: true,
});

systemLogSchema.index({ eventId: 1, action: 1 });
systemLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SystemLog', systemLogSchema);
