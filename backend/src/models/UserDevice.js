const mongoose = require('mongoose');

const userDeviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  deviceId: {
    type: String,
    required: true,
    index: true,
  },
  deviceName: {
    type: String,
    default: 'Unknown Device',
  },
  browser: {
    type: String,
  },
  os: {
    type: String,
  },
  ipAddress: {
    type: String,
  },
  location: {
    type: String,
    default: 'Unknown Location',
  },
  isApproved: {
    type: Boolean,
    default: true,
  },
  status: {
    type: String,
    enum: ['Active', 'Blocked'],
    default: 'Active',
  },
  refreshToken: {
    type: String,
    index: true,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Compound index for efficient user device lookups
userDeviceSchema.index({ userId: 1, deviceId: 1 });

module.exports = mongoose.model('UserDevice', userDeviceSchema);
