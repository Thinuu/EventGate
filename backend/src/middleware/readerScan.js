const Reader = require('../models/Reader');
const { decodeCredential } = require('../utils/readerCodec');
// Used after user authentication. A reader ID is configuration, never authority.
module.exports = async (req, res, next) => {
  if (!req.body.readerId) return next();
  try {
    const reader = await Reader.findById(req.body.readerId).lean();
    if (!reader?.enabled) return res.status(403).json({ success: false, message: 'Reader unavailable' });
    if (req.body.eventId && String(req.body.eventId) !== String(reader.eventId)) return res.status(403).json({ success: false, message: 'Reader belongs to another event' });
    if (req.body.qrToken) return res.status(400).json({ success: false, message: 'Send one RFID scan only' });
    req.body.rfidId = decodeCredential(req.body.scan ?? req.body.rfidId, reader);
    req.body.eventId = String(reader.eventId);
    req.body.deviceId = String(reader._id);
    if (reader.gateName) req.body.gateName = reader.gateName;
    next();
  } catch (e) { res.status(400).json({ success: false, message: 'Invalid reader or scan format' }); }
};
