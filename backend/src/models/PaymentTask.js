const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  status: { type: String, enum: ['pending', 'processing', 'done', 'failed'], default: 'pending', index: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  lockedUntil: Date,
  completedAt: Date,
  lastError: String,
}, { timestamps: true });
module.exports = mongoose.model('PaymentTask', schema);
