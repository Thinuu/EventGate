const SystemLog = require('../models/SystemLog');

const logActivity = async ({ req, userId, userEmail, userRole, action, eventId, details = {} }) => {
  try {
    let resolvedUserId = userId;
    let resolvedUserEmail = userEmail;
    let resolvedUserRole = userRole;
    let resolvedIpAddress = '';
    let resolvedEventId = eventId;

    if (req) {
      if (!resolvedUserId && req.user) {
        resolvedUserId = req.user._id;
      }
      if (!resolvedUserEmail && req.user) {
        resolvedUserEmail = req.user.email;
      }
      if (!resolvedUserRole && req.user) {
        resolvedUserRole = req.user.role;
      }
      resolvedIpAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      
      if (!resolvedEventId) {
        resolvedEventId = req.params.eventId || req.body.eventId || req.query.eventId;
      }
    }

    // Clean IP Address format if local
    if (resolvedIpAddress === '::1' || resolvedIpAddress === '::ffff:127.0.0.1') {
      resolvedIpAddress = '127.0.0.1';
    }

    await SystemLog.create({
      userId: resolvedUserId || undefined,
      userEmail: resolvedUserEmail,
      userRole: resolvedUserRole,
      action,
      eventId: resolvedEventId || undefined,
      details,
      ipAddress: resolvedIpAddress,
    });
  } catch (err) {
    console.error('Failed to write SystemLog:', err);
  }
};

module.exports = {
  logActivity,
};
