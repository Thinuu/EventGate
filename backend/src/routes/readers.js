const router = require('express').Router();
const Reader = require('../models/Reader');
const { protect, restrictTo, requireEventAccess } = require('../middleware/auth');
const { decodeCredential } = require('../utils/readerCodec');
router.use(protect);
router.use((req, res, next) => {
  if (!(req.body?.eventId || req.query.eventId)) return res.status(400).json({ success: false, message: 'Event ID required' });
  next();
});
router.get('/', requireEventAccess, async (req, res, next) => {
  try { res.json({ success: true, data: await Reader.find({ eventId: req.resolvedEventId }).sort({ name: 1 }).lean() }); } catch (e) { next(e); }
});
router.post('/', restrictTo('MainAdmin', 'MainOrganiser'), requireEventAccess, async (req, res, next) => {
  try {
    const { name, transport, format, prefix, suffix, gateName } = req.body;
    const reader = await Reader.create({ name, transport, format, prefix, suffix, gateName, eventId: req.resolvedEventId, createdBy: req.user._id });
    res.status(201).json({ success: true, data: reader });
  } catch (e) { next(e); }
});
router.patch('/:id', restrictTo('MainAdmin', 'MainOrganiser'), requireEventAccess, async (req, res, next) => {
  try {
    if (typeof req.body.enabled !== 'boolean') return res.status(400).json({ success: false, message: 'enabled must be boolean' });
    const reader = await Reader.findOneAndUpdate({ _id: req.params.id, eventId: req.resolvedEventId }, { $set: { enabled: req.body.enabled } }, { new: true, runValidators: true });
    if (!reader) return res.sendStatus(404);
    res.json({ success: true, data: reader });
  } catch (e) { next(e); }
});
router.post('/preview', requireEventAccess, async (req, res, next) => {
  try {
    const reader = await Reader.findOne({ _id: req.body.readerId, eventId: req.resolvedEventId, enabled: true }).lean();
    if (!reader) return res.sendStatus(404);
    res.json({ success: true, data: { credential: decodeCredential(req.body.scan, reader) } });
  } catch (e) { if (!e.statusCode && e.name === 'Error') e.statusCode = 400; next(e); }
});
module.exports = router;
