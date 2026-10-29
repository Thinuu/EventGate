const mongoose = require('mongoose');
const { FORMATS } = require('../utils/readerCodec');
const schema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 80 },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  transport: { type: String, enum: ['keyboard', 'serial-bridge', 'http-bridge', 'nfc-bridge'], required: true },
  format: { type: String, enum: FORMATS, default: 'numeric10' },
  prefix: { type: String, maxlength: 32, default: '' },
  suffix: { type: String, maxlength: 32, default: '' },
  gateName: { type: String, maxlength: 80, default: '' },
  enabled: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
module.exports = mongoose.model('Reader', schema);
