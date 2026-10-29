const mongoose = require('mongoose');

const requestLogSchema = new mongoose.Schema({
  method: { type: String, required: true },
  path: { type: String, required: true },
  statusCode: { type: Number, required: true },
  durationMs: { type: Number, default: 0 },
  ipAddress: { type: String },
  userAgent: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userRole: { type: String },
  errorMessage: { type: String },
  metadata: {
    query: { type: Map, of: String },
  },
  createdAt: { type: Date, default: Date.now },
}, {
  timestamps: false,
});

requestLogSchema.index({ createdAt: -1 });
requestLogSchema.index({ statusCode: 1, createdAt: -1 });
requestLogSchema.index({ path: 1, createdAt: -1 });

module.exports = mongoose.model('RequestLog', requestLogSchema);
