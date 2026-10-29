const { protect } = require('./auth');
const { normalizeRole, ROLES } = require('../utils/rbac');

const adminOnly = (req, res, next) => {
  const role = normalizeRole(req.user?.role);
  if (role !== ROLES.MAIN_ADMIN) {
    return res.status(403).json({ success: false, message: 'Main Admin access required.' });
  }
  return next();
};

module.exports = [protect, adminOnly];
