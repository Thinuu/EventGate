import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasRolePower, getCanonicalRole } from '../utils/rbac';

export const usePermissions = () => {
  const { user } = useAuth();
  const canonicalRole = getCanonicalRole(user?.role);

  const permissions = useMemo(() => {
    const hasPower = (requiredRole) => hasRolePower(user?.role, requiredRole);
    const hasCustom = (permKey) => {
      // Check both permissions object and direct flags
      return !!user?.permissions?.[permKey] || !!user?.[permKey];
    };

    return {
      // Basic permissions
      canViewDashboard: hasPower('Attendee') || hasCustom('canViewDashboard'),
      canViewOwnProfile: true, // All users can view their own profile
      
      // Event permissions
      canViewEvents: hasPower('Attendee') || hasCustom('canViewEvents'),
      canCreateEvents: hasPower('MainOrganiser') || hasCustom('canCreateEvents'),
      canEditEvents: hasPower('MainOrganiser') || hasCustom('canEditEvents'),
      canDeleteEvents: hasPower('MainAdmin') || hasCustom('canDeleteEvents'),
      
      // Attendee permissions
      canViewAttendees: hasPower('SubOrganiser') || hasCustom('canViewAttendees'),
      canEditAttendees: hasPower('MainOrganiser') || hasCustom('canEditAttendees'),
      canDeleteAttendees: hasPower('MainAdmin') || hasCustom('canDeleteAttendees'),
      canInviteAttendees: hasPower('MainOrganiser') || hasCustom('canInviteAttendees'),
      canBulkUpload: hasPower('SubOrganiser') || hasCustom('canBulkUpload'),
      canAddAttendees: hasCustom('canAddAttendees'),
      canPhotoVerification: hasPower('MainOrganiser') || hasCustom('canPhotoVerification'),
      canSendInvitations: hasPower('MainOrganiser') || hasCustom('canSendInvitations'),
      canExcelBulkImports: hasCustom('canExcelBulkImports'),
      canGateScanAccess: hasCustom('canGateScanAccess') || hasCustom('canEntryAccess') || (hasPower('SubOrganiser') && (user?.assignedZones?.length > 0 || user?.assignedGates?.length > 0)),
      canEntryAccess: hasCustom('canEntryAccess') || hasCustom('canGateScanAccess') || (hasPower('SubOrganiser') && (user?.assignedZones?.length > 0 || user?.assignedGates?.length > 0)),
      // Event permissions
      canViewEvents: hasCustom('canViewEvents'),
      canEditEvents: hasCustom('canEditEvents'),
      // Additional attendee permissions
      canViewTickets: hasCustom('canViewTickets'),
      canEditTickets: hasCustom('canEditTickets'),
      canScanTickets: hasCustom('canScanTickets'),
      // Zone permissions
      canViewZones: hasCustom('canViewZones'),
      canManageZones: hasCustom('canManageZones'),
      // Report permissions
      canViewReports: hasCustom('canViewReports'),
      canExportReports: hasCustom('canExportReports'),
      // Notification permissions
      canSendNotifications: hasCustom('canSendNotifications'),
      
      // Ticket permissions
      canViewTickets: hasPower('Staff') || canonicalRole === 'Volunteer' || hasCustom('canViewTickets'),
      canCreateTickets: hasPower('MainOrganiser') || hasCustom('canCreateTickets'),
      canEditTickets: hasPower('MainOrganiser') || hasCustom('canEditTickets'),
      canDeleteTickets: hasPower('MainAdmin') || hasCustom('canDeleteTickets'),
      canScanTickets: hasPower('Staff') || canonicalRole === 'Volunteer' || hasCustom('canScanTickets'),
      
      // Verification permissions
      canViewVerifications: hasPower('SubOrganiser') || hasCustom('canViewVerifications'),
      canVerifyPhotos: hasPower('SubOrganiser') || hasCustom('canVerifyPhotos'),
      canApproveVerifications: hasPower('MainOrganiser') || hasCustom('canApproveVerifications'),
      canRejectVerifications: hasPower('SubOrganiser') || hasCustom('canRejectVerifications'),
      
      // Zone permissions
      canViewZones: hasPower('Staff') || canonicalRole === 'Volunteer' || hasCustom('canViewZones'),
      canManageZones: hasPower('SubOrganiser') || hasCustom('canManageZones'),
      canCreateZones: hasPower('MainOrganiser') || hasCustom('canCreateZones'),
      canEditZones: hasPower('SubOrganiser') || hasCustom('canEditZones'),
      canDeleteZones: hasPower('MainAdmin') || hasCustom('canDeleteZones'),
      
      // Scanning permissions
      canScanEntry: hasPower('Staff') || canonicalRole === 'Volunteer' || hasCustom('canScanEntry') || hasCustom('canEntryAccess') || hasCustom('canGateScanAccess'),
      canScanZones: hasPower('Staff') || canonicalRole === 'Volunteer' || hasCustom('canScanZones') || hasCustom('canEntryAccess') || hasCustom('canGateScanAccess') || (user?.assignedZones?.length > 0) || (user?.responsibilities?.zoneIds?.length > 0),
      canScanZone: hasPower('Staff') || canonicalRole === 'Volunteer' || hasCustom('canScanZones') || hasCustom('canScanZone') || hasCustom('canEntryAccess') || hasCustom('canGateScanAccess') || (user?.assignedZones?.length > 0) || (user?.responsibilities?.zoneIds?.length > 0),
      canManualSearch: hasPower('Staff') || canonicalRole === 'Volunteer' || hasCustom('canManualSearch') || hasCustom('canEntryAccess'),
      
      // Reports permissions
      canViewReports: hasPower('Auditor') || hasCustom('canViewReports'),
      canExportReports: hasPower('Auditor') || hasCustom('canExportReports'),
      canGenerateReports: hasPower('MainOrganiser') || hasCustom('canGenerateReports'),
      
      // User management permissions
      canViewUsers: hasPower('MainOrganiser') || hasCustom('canViewUsers'),
      canCreateUsers: hasPower('MainAdmin') || hasCustom('canCreateUsers'),
      canEditUsers: hasPower('MainAdmin') || hasCustom('canEditUsers'),
      canDeleteUsers: hasPower('MainAdmin') || hasCustom('canDeleteUsers'),
      canAssignRoles: hasPower('MainAdmin') || hasCustom('canAssignRoles'),
      
      // Organiser permissions
      canViewOrganisers: hasPower('MainAdmin') || hasCustom('canViewOrganisers'),
      canCreateOrganisers: hasPower('MainAdmin') || hasCustom('canCreateOrganisers'),
      canEditOrganisers: hasPower('MainAdmin') || hasCustom('canEditOrganisers'),
      canDeleteOrganisers: hasPower('MainAdmin') || hasCustom('canDeleteOrganisers'),
      
      // System permissions
      canViewSystemLogs: hasPower('MainAdmin') || hasCustom('canViewSystemLogs'),
      canManageSettings: hasPower('MainAdmin') || hasCustom('canManageSettings'),
      canViewSystemHealth: hasPower('MainAdmin') || hasCustom('canViewSystemHealth'),
      canManageNotifications: hasPower('MainOrganiser') || hasCustom('canManageNotifications'),
      
      // Activity permissions
      canViewActivityLogs: hasPower('SubOrganiser') || hasCustom('canViewActivityLogs'),
      canViewEntryLogs: hasPower('Staff') || canonicalRole === 'Volunteer' || hasCustom('canViewEntryLogs'),
      canViewZoneActivity: hasPower('SubOrganiser') || hasCustom('canViewZoneActivity'),
      
      // Financial permissions
      canViewRevenue: hasPower('MainOrganiser') || hasCustom('canViewRevenue'),
      canViewOrders: hasPower('MainOrganiser') || hasCustom('canViewOrders'),
      canProcessRefunds: hasPower('MainAdmin') || hasCustom('canProcessRefunds'),
      canCollectCash: hasCustom('canCollectCash'),
      canConfirmCashPayments: hasCustom('canConfirmCashPayments'),
      canApproveBankTransfer: hasPower('MainOrganiser') || hasCustom('canApproveBankTransfer'),
      canViewPayments: hasPower('MainOrganiser') || hasCustom('canViewPayments'),
      canManagePaymentMethods: hasPower('MainOrganiser') || hasCustom('canManagePaymentMethods'),
      canViewPaymentHistory: hasPower('MainOrganiser') || hasCustom('canViewPaymentHistory'),
      canHandlePaymentDisputes: hasPower('MainOrganiser') || hasCustom('canHandlePaymentDisputes'),
      canGeneratePaymentReports: hasPower('MainOrganiser') || hasCustom('canGeneratePaymentReports'),
      
      // Communication permissions
      canSendNotifications: hasPower('MainOrganiser') || hasCustom('canSendNotifications'),
      canSendEmails: hasPower('MainOrganiser') || hasCustom('canSendEmails'),
      canSendSMS: hasPower('MainOrganiser') || hasCustom('canSendSMS'),
    };
  }, [user?.role, user?.permissions, user?.assignedZones, user?.assignedGates, user?.responsibilities, canonicalRole]);

  const hasPermission = (permission) => {
    return permissions[permission] || false;
  };

  const hasAnyPermission = (permissionList) => {
    return permissionList.some(permission => permissions[permission] || false);
  };

  const hasAllPermissions = (permissionList) => {
    return permissionList.every(permission => permissions[permission] || false);
  };

  const canAccessRoute = (route) => {
    // Route-based permission checking
    const routePermissions = {
      '/admin/dashboard': ['canViewDashboard'],
      '/organiser/dashboard': ['canViewDashboard'],
      '/suborg/dashboard': ['canViewDashboard'],
      '/staff/scan': ['canScanEntry'],
      '/auditor/dashboard': ['canViewReports'],
      '/events': ['canViewEvents'],
      '/events/create': ['canCreateEvents'],
      '/attendees': ['canViewAttendees'],
      '/verification': ['canViewVerifications'],
      '/zones': ['canViewZones'],
      '/reports': ['canViewReports'],
      '/users': ['canViewUsers'],
      '/settings': ['canManageSettings'],
    };

    const requiredPermissions = routePermissions[route];
    if (!requiredPermissions) return true; // Default to allowed if no specific permissions required
    
    return hasAllPermissions(requiredPermissions);
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
    role: canonicalRole,
    isAdmin: canonicalRole === 'MainAdmin',
    isOrganiser: ['MainOrganiser', 'SubOrganiser'].includes(canonicalRole),
    isStaff: ['Staff', 'Volunteer'].includes(canonicalRole),
    isAuditor: canonicalRole === 'Auditor',
    isAttendee: canonicalRole === 'Attendee',
  };
};

export default usePermissions;
