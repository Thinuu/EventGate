const RequestLog = require('../models/RequestLog');

const requestLogger = (req, res, next) => {
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }

  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;

    RequestLog.create({
      method: req.method,
      path: typeof req.route?.path === 'string' ? `${req.baseUrl}${req.route.path}` : '/unmatched',
      statusCode: res.statusCode,
      durationMs,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?._id,
      userRole: req.user?.role,
      errorMessage: res.locals.errorMessage,
      metadata: {},
    }).catch(() => {});
  });

  next();
};

module.exports = requestLogger;
