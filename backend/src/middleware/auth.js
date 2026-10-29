const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TokenBlocklist = require('../models/TokenBlocklist');
const mongoose = require('mongoose');
const { checkRoleMatch, getCanonicalRole, normalizeRole, ROLES } = require('../utils/rbac');
const UserDevice = require('../models/UserDevice');
const SystemConfig = require('../models/SystemConfig');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorised. No token.' });
    }

    // Check if token is in blocklist
    const isBlocked = await TokenBlocklist.isTokenBlocked(token);
    if (isBlocked) {
      return res.status(401).json({ success: false, message: 'Token has been invalidated.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded.tokenType !== 'access' || decoded.isTemp) {
      return res.status(401).json({ success: false, message: 'Access token required. Please log in again.' });
    }
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }
    const status = String(user.status || 'Active');
    if (status !== 'Active') {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }

    
    // Normalize role for robust RBAC
    user.rbacRole = getCanonicalRole(user.role);
    req.user = user;
    // Session control: verify device legitimacy
    const deviceId = req.headers['x-device-id'];
    const securityConfig = await SystemConfig.findOne({ key: 'global' }).lean();
    if (securityConfig?.security?.deviceApprovalRequired && !deviceId) {
      return res.status(401).json({ success: false, message: 'Device ID required.' });
    }
    if (deviceId) {
      const device = await UserDevice.findOne({ deviceId });
      if (!device) {
        return res.status(401).json({ success: false, message: 'Device not recognized.' });
      }
      if (device.status !== 'Active') {
        return res.status(401).json({ success: false, message: 'Device is blocked.' });
      }
      // Check if device approval is required per system config
      const sysConfig = await SystemConfig.findOne({});
      if (sysConfig?.security?.deviceApprovalRequired && !device.isApproved) {
        return res.status(401).json({ success: false, message: 'Device not approved.' });
      }
      // Ensure device belongs to the authenticated user
      if (device.userId.toString() !== user._id.toString()) {
        return res.status(401).json({ success: false, message: 'Device does not belong to the authenticated user.' });
      }
    }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

/**
 * RBAC middleware: restrictTo('Staff')
 * Handles Inheritance: MainAdmin passes Staff check.
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });

    if (!checkRoleMatch(req.user.role, roles)) {
      return res.status(403).json({
        success: false,
        message: `Your authority level (${req.user.role}) is insufficient for this operational command.`,
      });
    }
    next();
  };
};

/**
 * Checks if user is authorized for a specific event
 * MainAdmin bypasses all event checks.
 */
const requireEventAccess = async (req, res, next) => {
  try {
    const { user } = req;
    const rawId = req.params.eventId || req.body.eventId || req.query.eventId;
    const requestedEventProvided = rawId !== undefined && rawId !== null && rawId !== '' && rawId !== 'undefined';
    let eventId = requestedEventProvided ? rawId : null;

    // Root Authority bypass (MainAdmin only has global scope)
    const canonicalRole = normalizeRole(user.role);
    if (canonicalRole === ROLES.MAIN_ADMIN) {
      // MainAdmin can access any event
      if (!eventId) {
        // Try to get any event for context
        const Event = require('../models/Event');
        const fallback = await Event.findOne().select('_id').lean();
        if (fallback) {
          req.resolvedEventId = String(fallback._id);
          req.query.eventId = String(fallback._id);
        }
      } else {
        req.resolvedEventId = eventId;
      }
      return next();
    }

    // MainOrganiser: must verify they are assigned to the event
    if (canonicalRole === ROLES.MAIN_ORGANISER) {
      if (!eventId) {
        return res.status(400).json({ success: false, message: 'Event ID required.' });
      }

      // Verify the event exists and user is in event.mainOrganisers OR event.createdBy
      const Event = require('../models/Event');
      const event = await Event.findById(eventId).select('createdBy mainOrganisers assignedOrganisers');
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found.' });
      }

      const isCreator = event.createdBy?.toString() === user._id.toString();
      const isMainOrganiser = event.mainOrganisers?.some(id => id.toString() === user._id.toString());
      const isAssigned = event.assignedOrganisers?.some(id => id.toString() === user._id.toString());

      if (!isCreator && !isMainOrganiser && !isAssigned) {
        console.warn(`MainOrganiser ${user._id} attempted unauthorized access to event ${eventId}`);
        return res.status(403).json({ success: false, message: 'You are not authorized for this event.' });
      }

      req.resolvedEventId = eventId;
      return next();
    }

    if (eventId && !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }

    // If no ID provided, fallback to first assigned event (if any)
    if (!eventId) {
      eventId = user.assignedEvents && user.assignedEvents[0];
      if (eventId) req.resolvedEventId = eventId;
    }

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID required for scoped operation.' });
    }

    // Validate format again
    const isValid = mongoose.Types.ObjectId.isValid(eventId);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }

    // If the client explicitly requested an eventId but the user is not assigned
    // to it and is not the creator/main organiser, reject with 403 instead
    // of silently falling back to another event.
    if (requestedEventProvided) {
      if (user.assignedEvents && user.assignedEvents.some(e => e.toString() === eventId.toString())) {
        req.resolvedEventId = eventId;
        return next();
      }
    }

    // Check creator status (for organisers who haven't been 'assigned' yet)
    const Event = require('../models/Event');
    const event = await Event.findById(eventId).select('createdBy mainOrganisers');
    if (event && (event.createdBy?.toString() === user._id.toString() || event.mainOrganisers?.some(id => id.toString() === user._id.toString()))) {
      req.resolvedEventId = eventId;
      return next();
    }

    // If we reach here, the requested ID is outside the user's scope.
    // If the client explicitly asked for this ID, reject with 403.
    if (requestedEventProvided) {
      return res.status(403).json({ success: false, message: 'Target event is outside your authorized scope.' });
    }

    // If no event was requested, and user has an assigned event, use that.
    const finalFallback = user.assignedEvents && user.assignedEvents[0];
    if (finalFallback && finalFallback.toString() !== eventId.toString()) {
      req.resolvedEventId = finalFallback;
      req.query.eventId = finalFallback; // Inject fallback for downstream handlers
      return next();
    }

    return res.status(403).json({ success: false, message: 'Target event is outside your authorized scope.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Check fine-grained permissions stored in the User JSON.
 * High-level roles (Admin/Organiser) usually have full permissions by default.
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    const role = normalizeRole(req.user.role);
    
    // Full authority roles bypass specific flag checks
    if ([ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER].includes(role)) return next();
    
    // Check specific JSON flag (supports string or array of strings)
    const permissionsToCheck = Array.isArray(permission) ? permission : [permission];
    const hasPermission = permissionsToCheck.some(p => req.user.permissions && req.user.permissions[p]);
    
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Target operation requires specific clearance: ${permissionsToCheck.join(' or ')}`,
      });
    }
    next();
  };
};

// Legacy Support: some routes still use checkRole as an alias for restrictTo
const checkRole = restrictTo;

module.exports = { 
  protect, 
  restrictTo, 
  checkRole,
  requireEventAccess, 
  requirePermission 
};
