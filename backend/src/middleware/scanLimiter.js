const rateLimit = require('express-rate-limit');
module.exports = rateLimit({ store: new (require('./mongoRateStore'))('scan-user'), windowMs: 60000, max: 300, keyGenerator: req => String(req.user._id), standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Scanner rate limit exceeded' } });
