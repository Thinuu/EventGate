const mongoose = require('mongoose');

const tokenBlocklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  reason: {
    type: String,
    enum: ['logout', 'password_change', 'token_refresh', 'admin_revoke'],
    default: 'logout',
  },
}, {
  timestamps: true,
});

// TTL index to automatically delete expired tokens
tokenBlocklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to check if a token is blocked
tokenBlocklistSchema.statics.isTokenBlocked = async function(token) {
  const blocked = await this.findOne({ token });
  return !!blocked;
};

// Static method to block a token
tokenBlocklistSchema.statics.blockToken = async function(token, userId, reason = 'logout') {
  const jwt = require('jsonwebtoken');
  let expiresAt = new Date();
  
  try {
    // Decode token to get actual expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expiresAt = new Date(decoded.exp * 1000);
  } catch (err) {
    // If token is invalid/expired, set a short expiry for cleanup
    expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  }

  await this.create({
    token,
    userId,
    expiresAt,
    reason,
  });
};

module.exports = mongoose.model('TokenBlocklist', tokenBlocklistSchema);