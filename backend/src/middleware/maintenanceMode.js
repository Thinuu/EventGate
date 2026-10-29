const SystemConfig = require('../models/SystemConfig');

/**
 * Middleware to check if the system is in maintenance mode
 * Allows bypass for authenticated admin users
 * Returns 503 Service Unavailable for other requests
 */
const maintenanceMode = async (req, res, next) => {
  try {
    // Skip maintenance check for these paths (admin endpoints, auth endpoints, config endpoints)
    const bypassPaths = [
      '/api/auth',
      '/admin',
      '/api/config',
      '/api/super-admin',
      '/api/admin',
      '/api/events/config/public', // Public config endpoint should work in maintenance
    ];

    const isBypassPath = bypassPaths.some(path => req.path.startsWith(path));
    if (isBypassPath) return next();

    // Get system config
    const config = await SystemConfig.findOne({ key: 'global' }).lean();
    
    // If system is in maintenance mode, return 503 for non-admin paths
    if (config?.general?.systemStatus === 'Maintenance') {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'The website is currently under maintenance. Please try again later.',
        maintenanceMode: true,
      });
    }

    next();
  } catch (error) {
    // If there's an error checking maintenance mode, allow the request to proceed
    console.error('Maintenance mode check error:', error);
    next();
  }
};

module.exports = maintenanceMode;
