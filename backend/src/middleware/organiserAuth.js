const { protect } = require('./auth');
const { normalizeRole, ROLES } = require('../utils/rbac');

const organiserOnly = (req, res, next) => {
  const role = normalizeRole(req.user?.role);
  if (role !== ROLES.MAIN_ORGANISER) {
    return res.status(403).json({ success: false, message: 'Main Organiser access required.' });
  }
  const assignedEvent = (req.user.assignedEvents && req.user.assignedEvents[0]);
  if (!assignedEvent) {
    return res.status(403).json({ success: false, message: 'No assigned event found for this organiser.' });
  }
  return next();
};

module.exports = [protect, organiserOnly];
