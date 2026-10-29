import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';

const AccessDenied = ({ message = 'You do not have permission to view this content.' }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center shadow-sm">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <ShieldExclamationIcon className="h-6 w-6" />
    </div>
    <h3 className="mt-4 text-sm font-bold text-slate-900">Access Denied</h3>
    <p className="mt-1.5 max-w-xs text-xs text-slate-500">{message}</p>
  </div>
);

const PermissionGuard = ({
  children,
  permission,
  permissions = [],
  requireAll = false,
  fallback = null,
  role = null,
}) => {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    role: userRole,
  } = usePermissions();

  if (role && userRole !== role) {
    return fallback;
  }

  if (permission && !hasPermission(permission)) {
    return fallback;
  }

  if (permissions.length > 0) {
    const hasAccess = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);

    if (!hasAccess) {
      return fallback;
    }
  }

  return children;
};

export const withPermission = (Component, permission, options = {}) => {
  return (props) => (
    <PermissionGuard
      permission={permission}
      {...options}
      fallback={options.fallback || <AccessDenied />}
    >
      <Component {...props} />
    </PermissionGuard>
  );
};

export const withRole = (Component, role, options = {}) => {
  return (props) => (
    <PermissionGuard
      role={role}
      {...options}
      fallback={options.fallback || <AccessDenied />}
    >
      <Component {...props} />
    </PermissionGuard>
  );
};

export { AccessDenied };
export default PermissionGuard;