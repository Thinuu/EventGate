const { normalizeRole, ROLES } = require('../utils/rbac');

function getAssignedZones(user) {
    return [
        ...(user.assignedZones || []),
        ...(user.responsibilities?.zoneIds || [])
    ].map(String);
}

function hasZoneAccess(user, attendee) {

    const role = normalizeRole(user.role);

    if (
        role === ROLES.MAIN_ADMIN ||
        role === ROLES.MAIN_ORGANISER
    ) {
        return true;
    }

    if (role !== ROLES.SUB_ORGANISER)
        return false;

    const assignedZones = getAssignedZones(user);

    if (!assignedZones.length)
        return false;

    const attendeeZones = (attendee.allowedZones || []).map(String);

    return attendeeZones.some(zone =>
        assignedZones.includes(zone)
    );
}

module.exports = {
    hasZoneAccess,
    getAssignedZones
};