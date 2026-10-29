/**
 * EventGate Role-Based Access Control (RBAC) System
 * Implements Section 6 Hierarchy and Inheritance
 */

const ROLES = {
  MAIN_ADMIN: 'MainAdmin',
  MAIN_ORGANISER: 'MainOrganiser',
  SUB_ORGANISER: 'SubOrganiser',
  STAFF: 'Staff',
  VOLUNTEER: 'Volunteer',
  AUDITOR: 'Auditor',
  ATTENDEE: 'Attendee',
};

// Hierarchy definition: higher number = more privilege
// inheritance: higher roles automatically pass checks for lower roles
const ROLE_LEVELS = {
  [ROLES.MAIN_ADMIN]: 100,
  [ROLES.MAIN_ORGANISER]: 80,
  [ROLES.SUB_ORGANISER]: 60,
  [ROLES.STAFF]: 40,
  [ROLES.VOLUNTEER]: 20,
  [ROLES.AUDITOR]: 10,
  [ROLES.ATTENDEE]: 1,
};

/**
 * Normalizes role string to match canonical ROLES
 */
const normalizeRole = (role) => {
  if (!role) return ROLES.ATTENDEE;
  const r = String(role).trim();
  
  // Mapping for legacy or case-insensitive matches
  const mapping = {
    'admin': ROLES.MAIN_ADMIN,
    'mainadmin': ROLES.MAIN_ADMIN,
    'super_admin': ROLES.MAIN_ADMIN,
    'main_admin': ROLES.MAIN_ADMIN,
    'mainorganiser': ROLES.MAIN_ORGANISER,
    'main_organiser': ROLES.MAIN_ORGANISER,
    'suborganiser': ROLES.SUB_ORGANISER,
    'sub_organiser': ROLES.SUB_ORGANISER,
    'staff': ROLES.STAFF,
    'volunteer': ROLES.VOLUNTEER,
    'auditor': ROLES.AUDITOR,
    'attendee': ROLES.ATTENDEE,
    'user': ROLES.ATTENDEE,
    'buyer': ROLES.ATTENDEE,
  };

  return mapping[r.toLowerCase()] || r;
};

/**
 * Checks if a user's role has sufficient weight for an action
 * Handles INHERITANCE: MainAdmin passes check for Staff, etc.
 */
const hasRolePower = (userRole, requiredRole) => {
  const userRoleNorm = normalizeRole(userRole);
  const reqRoleNorm = normalizeRole(requiredRole);

  const userLevel = ROLE_LEVELS[userRoleNorm] || 0;
  const reqLevel = ROLE_LEVELS[reqRoleNorm] || 0;

  return userLevel >= reqLevel;
};

/**
 * Legacy support for existing middlewares
 */
const checkRoleMatch = (userRole, allowedRoles) => {
  const userRoleNorm = normalizeRole(userRole);
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const normalizedAllowed = allowed.map(normalizeRole);

  // Check direct match OR inheritance
  return normalizedAllowed.some(role => hasRolePower(userRoleNorm, role));
};

const getCanonicalRole = (userRole) => {
  return normalizeRole(userRole);
};

module.exports = {
  ROLES,
  ROLE_LEVELS,
  normalizeRole,
  hasRolePower,
  checkRoleMatch,
  getCanonicalRole,
};
