const mongoose = require('mongoose');

const shortLinkSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  targetPath: { type: String, required: true },
  label: { type: String },
  expiresAt: { type: Date },
  clicks: { type: Number, default: 0 },
  lastAccessedAt: { type: Date },
}, {
  timestamps: true,
});

shortLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $exists: true } } });

module.exports = mongoose.model('ShortLink', shortLinkSchema);
