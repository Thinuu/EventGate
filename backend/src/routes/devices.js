const express = require('express');
const router = express.Router();
const UserDevice = require('../models/UserDevice');
const { protect, restrictTo } = require('../middleware/auth');
const { ROLES } = require('../utils/rbac');

// All routes require authentication
router.use(protect);

/**
 * GET /api/devices
 * Retrieve all registered devices for the current logged-in user.
 */
router.get('/', async (req, res, next) => {
  try {
    const devices = await UserDevice.find({ userId: req.user._id }).sort({ lastActive: -1 });
    res.json({ success: true, data: { devices } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/devices/logout
 * Terminate a session on another device (remote logout) by deviceId.
 */
router.post('/logout', async (req, res, next) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'deviceId is required' });
    }

    const device = await UserDevice.findOne({ userId: req.user._id, deviceId });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device session not found' });
    }

    device.refreshToken = null;
    device.status = 'Blocked'; // Force logout state
    await device.save();

    res.json({ success: true, message: 'Device session terminated successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/devices/admin
 * Admin endpoint to list all devices or filter by userId/approval state.
 */
router.get('/admin', restrictTo(ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER), async (req, res, next) => {
  try {
    const { userId, isApproved, status } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';
    if (status) filter.status = status;

    const devices = await UserDevice.find(filter)
      .populate('userId', 'name email role')
      .sort({ lastActive: -1 });

    res.json({ success: true, data: { devices } });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/devices/admin/:id/approve
 * Admin endpoint to approve a device.
 */
router.patch('/admin/:id/approve', restrictTo(ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER), async (req, res, next) => {
  try {
    const device = await UserDevice.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    device.isApproved = true;
    device.status = 'Active';
    await device.save();

    res.json({ success: true, message: 'Device approved successfully.', data: { device } });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/devices/admin/:id/block
 * Admin endpoint to block/suspend a device.
 */
router.patch('/admin/:id/block', restrictTo(ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER), async (req, res, next) => {
  try {
    const device = await UserDevice.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    device.status = 'Blocked';
    device.refreshToken = null; // Terminate active session
    await device.save();

    res.json({ success: true, message: 'Device blocked successfully.', data: { device } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/devices/admin/:id
 * Admin endpoint to delete a device registration.
 */
router.delete('/admin/:id', restrictTo(ROLES.MAIN_ADMIN), async (req, res, next) => {
  try {
    const device = await UserDevice.findByIdAndDelete(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    res.json({ success: true, message: 'Device registration deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
