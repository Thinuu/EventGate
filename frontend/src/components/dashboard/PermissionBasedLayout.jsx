import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import PermissionGuard from '../auth/PermissionGuard';

const PermissionBasedLayout = ({ children, layoutConfig = {} }) => {
  const { permissions, role } = usePermissions();

  const renderLayoutSection = (sectionKey, sectionConfig) => {
    const { 
      component: Component, 
      permission, 
      permissions = [], 
      requireAll = false,
      fallback = null,
      ...props 
    } = sectionConfig;

    if (!Component) return null;

    return (
      <PermissionGuard
        key={sectionKey}
        permission={permission}
        permissions={permissions}
        requireAll={requireAll}
        fallback={fallback}
      >
        <Component {...props} />
      </PermissionGuard>
    );
  };

  return (
    <div className="permission-based-layout">
      {Object.entries(layoutConfig).map(([sectionKey, sectionConfig]) =>
        renderLayoutSection(sectionKey, sectionConfig)
      )}
      {children}
    </div>
  );
};

export const AdminLayout = ({ children }) => {
  const layoutConfig = {
    header: {
      component: AdminHeader,
      permission: 'canViewDashboard'
    },
    sidebar: {
      component: AdminSidebar,
      permission: 'canViewDashboard'
    },
    main: {
      component: ({ children }) => children,
      permission: 'canViewDashboard'
    }
  };

  return (
    <PermissionBasedLayout layoutConfig={layoutConfig}>
      {children}
    </PermissionBasedLayout>
  );
};

export const OrganiserLayout = ({ children }) => {
  const layoutConfig = {
    header: {
      component: OrganiserHeader,
      permission: 'canViewDashboard'
    },
    sidebar: {
      component: OrganiserSidebar,
      permission: 'canViewDashboard'
    },
    main: {
      component: ({ children }) => children,
      permission: 'canViewDashboard'
    }
  };

  return (
    <PermissionBasedLayout layoutConfig={layoutConfig}>
      {children}
    </PermissionBasedLayout>
  );
};

export const StaffLayout = ({ children }) => {
  const layoutConfig = {
    header: {
      component: StaffHeader,
      permission: 'canScanEntry'
    },
    sidebar: {
      component: StaffSidebar,
      permission: 'canScanEntry'
    },
    main: {
      component: ({ children }) => children,
      permission: 'canScanEntry'
    }
  };

  return (
    <PermissionBasedLayout layoutConfig={layoutConfig}>
      {children}
    </PermissionBasedLayout>
  );
};

// Example layout components
const AdminHeader = () => (
  <header className="bg-white border-b border-slate-200 px-6 py-4">
    <div className="flex justify-between items-center">
      <h1 className="text-xl font-semibold text-slate-900">Admin Dashboard</h1>
      <div className="flex items-center space-x-4">
        {/* Admin-specific header content */}
      </div>
    </div>
  </header>
);

const AdminSidebar = () => (
  <aside className="w-64 bg-slate-900 text-white">
    {/* Admin-specific sidebar content */}
  </aside>
);

const OrganiserHeader = () => (
  <header className="bg-white border-b border-slate-200 px-6 py-4">
    <div className="flex justify-between items-center">
      <h1 className="text-xl font-semibold text-slate-900">Organiser Dashboard</h1>
      <div className="flex items-center space-x-4">
        {/* Organiser-specific header content */}
      </div>
    </div>
  </header>
);

const OrganiserSidebar = () => (
  <aside className="w-64 bg-slate-900 text-white">
    {/* Organiser-specific sidebar content */}
  </aside>
);

const StaffHeader = () => (
  <header className="bg-white border-b border-slate-200 px-6 py-4">
    <div className="flex justify-between items-center">
      <h1 className="text-xl font-semibold text-slate-900">Staff Operations</h1>
      <div className="flex items-center space-x-4">
        {/* Staff-specific header content */}
      </div>
    </div>
  </header>
);

const StaffSidebar = () => (
  <aside className="w-64 bg-slate-900 text-white">
    {/* Staff-specific sidebar content */}
  </aside>
);

export default PermissionBasedLayout;
