const express = require('express');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// GET /api/notifications
router.get('/', async (req, res, next) => {
  try {
    const { unreadOnly, limit = 20 } = req.query;
    const filter = { user: req.user._id };
    if (unreadOnly === 'true') filter.read = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 20, 50));

    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });

    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    res.json({ success: true, data: { notification } });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/mark-all-read
router.patch('/mark-all-read', async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) { next(err); }
});

module.exports = router;
