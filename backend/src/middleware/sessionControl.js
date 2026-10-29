const UserDevice = require('../models/UserDevice');
const SystemConfig = require('../models/SystemConfig');

/**
 * Session control middleware
 * Ensures that the request originates from a recognized, active, and approved device.
 * Checks:
 *   - x-device-id header present
 *   - Device exists in UserDevice collection
 *   - Device belongs to the authenticated user (req.user set by auth protect)
 *   - Device status is 'Active'
 *   - If system config requires device approval, the device must be approved.
 */
module.exports = async (req, res, next) => {
  try {
    // Auth middleware should have populated req.user; if not, skip
    if (!req.user) return next();
    const deviceId = req.headers['x-device-id'];
    if (!deviceId) {
      return res.status(401).json({ success: false, message: 'Device ID header missing.' });
    }
    const device = await UserDevice.findOne({ deviceId });
    if (!device) {
      return res.status(401).json({ success: false, message: 'Device not recognized.' });
    }
    if (device.status !== 'Active') {
      return res.status(401).json({ success: false, message: 'Device is blocked.' });
    }
    // Verify ownership
    if (device.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ success: false, message: 'Device does not belong to the authenticated user.' });
    }
    // Check system-wide approval requirement
    const sysConfig = await SystemConfig.findOne({});
    if (sysConfig?.security?.deviceApprovalRequired && !device.isApproved) {
      return res.status(401).json({ success: false, message: 'Device not approved.' });
    }
    // Passed all checks
    next();
  } catch (err) {
    console.error('Session control error:', err);
    res.status(401).json({ success: false, message: 'Invalid session.' });
  }
};
