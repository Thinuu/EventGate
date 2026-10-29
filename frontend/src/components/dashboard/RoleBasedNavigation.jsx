import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLE_NAVIGATION, ROLE_LABELS } from '../../config/roleNavigation';
import {
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  SignalIcon,
  GlobeAltIcon,
  UsersIcon,
  ArrowLeftOnRectangleIcon,
} from '@heroicons/react/24/outline';

const RoleBasedNavigation = ({ className = '' }) => {
  const { role, permissions } = usePermissions();
  const location = useLocation();

  const navigationConfig = ROLE_NAVIGATION[role] || { sections: [] };

  const isActiveRoute = (path) => {
    if (path === location.pathname) return true;
    if (path.includes('?')) {
      const basePath = path.split('?')[0];
      return location.pathname.startsWith(basePath);
    }
    return false;
  };

  const NavItem = ({ to, label, icon: Icon, disabled = false, badge = null }) => {
    const active = isActiveRoute(to);

    if (disabled) {
      return (
        <div className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-400 opacity-50">
          <Icon className="h-5 w-5 shrink-0" />
          <span className="truncate">{label}</span>
          {badge && <span className="ml-auto shrink-0">{badge}</span>}
        </div>
      );
    }

    return (
      <Link
        to={to}
        className={[
          'flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition',
          active
            ? 'bg-teal-600 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        ].join(' ')}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="truncate">{label}</span>
        {badge != null && (
          <span
            className={[
              'ml-auto flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-md px-1.5 text-[10px] font-bold',
              active
                ? 'bg-white/20 text-white'
                : 'bg-teal-50 text-teal-700',
            ].join(' ')}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const renderNavigationSection = (section, sectionIndex) => {
    const filteredItems = section.items.filter((item) => {
      if (item.to === '/admin/dashboard' && !permissions.canViewDashboard)
        return false;
      if (item.to === '/organiser/dashboard' && !permissions.canViewDashboard)
        return false;
      if (item.to === '/suborg/dashboard' && !permissions.canViewDashboard)
        return false;
      if (item.to === '/staff/scan' && !permissions.canScanEntry) return false;
      if (item.to === '/auditor/dashboard' && !permissions.canViewReports)
        return false;
      if (item.label === 'Attendees' && !permissions.canViewAttendees)
        return false;
      if (item.label === 'Verification' && !permissions.canViewVerifications)
        return false;
      if (item.label === 'Zones & Areas' && !permissions.canViewZones)
        return false;
      if (item.label === 'Reports' && !permissions.canViewReports) return false;
      if (item.label === 'Users' && !permissions.canViewUsers) return false;
      if (item.label === 'Events' && !permissions.canViewEvents) return false;
      if (item.label === 'Settings' && !permissions.canManageSettings)
        return false;
      if (item.label === 'Notifications' && !permissions.canManageNotifications)
        return false;
      if (item.label === 'Invites' && !permissions.canInviteAttendees)
        return false;
      if (item.label === 'Bulk Upload' && !permissions.canBulkUpload)
        return false;
      if (item.label === 'Entry Scanner' && !permissions.canScanEntry)
        return false;
      if (item.label === 'Zone Scanner' && !permissions.canScanZones)
        return false;
      if (item.label === 'Manual Search' && !permissions.canManualSearch)
        return false;
      if (item.label === 'Activity Log' && !permissions.canViewActivityLogs)
        return false;
      if (item.label === 'Entry Logs' && !permissions.canViewEntryLogs)
        return false;
      if (item.label === 'Zone Activity' && !permissions.canViewZoneActivity)
        return false;
      if (item.label === 'System Settings' && !permissions.canManageSettings)
        return false;
      if (item.label === 'Create Event' && !permissions.canCreateEvents)
        return false;

      return true;
    });

    if (filteredItems.length === 0) return null;

    return (
      <div key={sectionIndex} className="space-y-1.5">
        <h3 className="mb-2 px-3.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {section.title}
        </h3>
        {filteredItems.map((item, itemIndex) => (
          <NavItem
            key={`${item.to}-${itemIndex}`}
            to={item.to}
            label={item.label}
            icon={item.icon}
            badge={item.badge}
          />
        ))}
      </div>
    );
  };

  return (
    <nav className={`space-y-7 ${className}`}>
      {/* Role header */}
      <div className="px-1">
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-3">
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15" />
          <span className="truncate text-sm font-semibold text-slate-800">
            {ROLE_LABELS[role] || role}
          </span>
        </div>
      </div>

      {/* Sections */}
      {navigationConfig.sections.map(renderNavigationSection)}

      {/* Quick actions */}
      {(permissions.canScanEntry ||
        permissions.canVerifyPhotos ||
        permissions.canManageZones) && (
        <div className="space-y-1.5 border-t border-slate-200/80 pt-5">
          <h3 className="mb-2 px-3.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Quick Actions
          </h3>
          {permissions.canScanEntry && (
            <NavItem
              to="/scan"
              label="Quick Scan"
              icon={MagnifyingGlassIcon}
            />
          )}
          {permissions.canVerifyPhotos && (
            <NavItem
              to="/verification/queue"
              label="Verification Queue"
              icon={ShieldCheckIcon}
              badge="3"
            />
          )}
          {permissions.canManageZones && (
            <NavItem
              to="/zones/monitor"
              label="Zone Monitor"
              icon={SignalIcon}
            />
          )}
        </div>
      )}

      {/* Public */}
      <div className="space-y-1.5 border-t border-slate-200/80 pt-5">
        <h3 className="mb-2 px-3.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Public
        </h3>
        <NavItem to="/" label="Public Site" icon={GlobeAltIcon} />
        <NavItem to="/profile" label="My Profile" icon={UsersIcon} />
        <NavItem
          to="/logout"
          label="Logout"
          icon={ArrowLeftOnRectangleIcon}
        />
      </div>
    </nav>
  );
};

export default RoleBasedNavigation;