export const ROLES = {
  MAIN_ADMIN: 'MainAdmin',
  MAIN_ORGANISER: 'MainOrganiser',
  SUB_ORGANISER: 'SubOrganiser',
  STAFF: 'Staff',
  VOLUNTEER: 'Volunteer',
  AUDITOR: 'Auditor',
  ATTENDEE: 'Attendee',
};

const ROLE_LEVELS = {
  [ROLES.MAIN_ADMIN]: 100,
  [ROLES.MAIN_ORGANISER]: 80,
  [ROLES.SUB_ORGANISER]: 60,
  [ROLES.STAFF]: 40,
  [ROLES.VOLUNTEER]: 20,
  [ROLES.AUDITOR]: 10,
  [ROLES.ATTENDEE]: 1,
};

export const normalizeRole = (role) => {
  if (!role) return ROLES.ATTENDEE;
  const r = String(role).trim();
  
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

export const hasRolePower = (userRole, requiredRole) => {
  const userRoleNorm = normalizeRole(userRole);
  const reqRoleNorm = normalizeRole(requiredRole);
  return (ROLE_LEVELS[userRoleNorm] || 0) >= (ROLE_LEVELS[reqRoleNorm] || 0);
};

export const hasAnyRole = (userRole, allowedRoles = []) => {
  const userRoleNorm = normalizeRole(userRole);
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return allowed.map(normalizeRole).some(role => hasRolePower(userRoleNorm, role));
};

export const getCanonicalRole = (userRole) => normalizeRole(userRole);
