const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { protect, restrictTo, requireEventAccess } = require('../middleware/auth');
const Order = require('../models/Order');
const Attendee = require('../models/Attendee');
router.post('/event-summary', protect, restrictTo('MainAdmin', 'MainOrganiser'), requireEventAccess,
  rateLimit({ store: new (require('../middleware/mongoRateStore'))('ai'), windowMs: 60000, max: 3, keyGenerator: req => String(req.user._id) }), async (req, res, next) => {
    if (process.env.AI_ENABLED !== 'true' || !process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
      return res.status(503).json({ success: false, message: 'AI summaries are disabled or unconfigured' });
    }
    try {
      const eventId = req.resolvedEventId;
      // Only aggregate counts leave the server. No photos, credentials or attendee details.
      const [orders, paidOrders, attendees, checkedIn] = await Promise.all([
        Order.countDocuments({ eventId }), Order.countDocuments({ eventId, paymentStatus: { $in: ['paid', 'success'] } }),
        Attendee.countDocuments({ event: eventId }), Attendee.countDocuments({ event: eventId, checkedIn: true }),
      ]);
      const metrics = { orders, paidOrders, attendees, checkedIn };
      const result = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST', signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL, store: false, max_output_tokens: 500,
          instructions: 'Summarize these event operation counts in plain language. Identify missing information and suggest up to three operational checks. Do not infer fraud, identities, safety or payment approval. You are advisory only.',
          input: JSON.stringify(metrics) }),
      });
      if (!result.ok) return res.status(502).json({ success: false, message: 'AI provider unavailable' });
      const response = await result.json();
      const summary = (response.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n');
      if (!summary) return res.status(502).json({ success: false, message: 'AI returned no summary' });
      res.json({ success: true, data: { summary, metrics, advisory: true } });
    } catch (e) { next(e); }
  });
module.exports = router;
