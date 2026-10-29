// src/components/layout/Sidebar.jsx
import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeftOnRectangleIcon,
  GlobeAltIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/solid';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { getRoleLabel, ROLE_NAVIGATION } from '../../config/roleNavigation';
import { getCanonicalRole } from '../../utils/rbac';

const Sidebar = ({ isMobileOpen, onClose, onOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const navigation =
    ROLE_NAVIGATION[getCanonicalRole(user?.role)] || { sections: [] };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentSearchParams = new URLSearchParams(location.search);
  const currentSection = currentSearchParams.get('section') || '';

  const isItemActive = (to) => {
    const [targetPath, rawQuery = ''] = to.split('?');
    const targetParams = new URLSearchParams(rawQuery);
    const targetSection = targetParams.get('section') || '';

    if (location.pathname !== targetPath) return false;
    if (targetSection) return currentSection === targetSection;
    return currentSection === '';
  };

  const filteredSections = navigation.sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (['Verification'].includes(item.label)) {
          return (
            user?.permissions?.canVerifyPhotos === true ||
            ['MainAdmin', 'MainOrganiser', 'SubOrganiser'].includes(
              getCanonicalRole(user?.role)
            )
          );
        }
        if (
          ['Entry Scanner', 'Scan Entry', 'Manual Search'].includes(item.label)
        ) {
          return (
            user?.permissions?.canEntryAccess === true ||
            ['MainAdmin', 'MainOrganiser'].includes(
              getCanonicalRole(user?.role)
            ) ||
            (user?.assignedGates?.length > 0 && getCanonicalRole(user?.role) !== 'SubOrganiser')
          );
        }
        if (
          [
            'Zone Scanner',
            'Zone Access',
            'My Zones',
            'Zone Manual Search',
          ].includes(item.label)
        ) {
          return (
            user?.assignedZones?.length > 0 ||
            ['MainAdmin', 'MainOrganiser', 'SubOrganiser'].includes(
              getCanonicalRole(user?.role)
            )
          );
        }
        if (['Bulk Upload'].includes(item.label)) {
          return (
            user?.permissions?.canBulkUpload === true ||
            ['MainAdmin', 'MainOrganiser', 'SubOrganiser'].includes(
              getCanonicalRole(user?.role)
            )
          );
        }
        if (['Cash Collection'].includes(item.label)) {
          return (
            user?.permissions?.canCollectCash === true ||
            ['MainAdmin', 'MainOrganiser', 'SubOrganiser'].includes(
              getCanonicalRole(user?.role)
            )
          );
        }
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800/80 bg-slate-950 transition-all duration-300 ease-in-out lg:static lg:translate-x-0',
          collapsed ? 'w-[4.5rem]' : 'w-64 sm:w-72',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Brand */}
        <div
          className={`flex h-16 items-center border-b border-slate-800/80 ${
            collapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
              <img
                src="/brand/eventgate-mark.svg"
                alt="EventGate"
                className="h-full w-full object-contain p-1"
                onError={(e) => {
                  e.target.src = 'https://placehold.co/100x100?text=EX';
                }}
              />
            </div>
            {!collapsed && (
              <span className="truncate text-base font-bold tracking-tight text-white">
                Event<span className="text-teal-400">Gate</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white lg:block"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronDoubleRightIcon className="h-4 w-4" />
            ) : (
              <ChevronDoubleLeftIcon className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5 custom-scrollbar">
          {filteredSections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    title={collapsed ? item.label : undefined}
                    className={[
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                      collapsed ? 'justify-center' : '',
                      active
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white',
                    ].join(' ')}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="space-y-1 border-t border-slate-800/80 p-3">
          {!collapsed && (
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {user?.name}
                </p>
                <p className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  {getRoleLabel(user?.role)}
                </p>
              </div>
            </div>
          )}

          <NavLink
            to="/"
            onClick={onClose}
            title={collapsed ? 'Public Portal' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <GlobeAltIcon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Public Portal</span>}
          </NavLink>

          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? 'Sign Out' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <ArrowLeftOnRectangleIcon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation (only visible on mobile) */}
      <div className="fixed bottom-0 left-0 z-30 flex w-full justify-around border-t border-slate-200/80 bg-white px-2 py-2 pb-safe shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.05)] lg:hidden">
        {filteredSections
          .flatMap((s) => s.items)
          .filter((item) => !item.label.toLowerCase().includes('manual search'))
          .slice(0, 4)
          .map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition min-w-[4rem] ${
                  active ? 'text-teal-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-6 w-6 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                <span className="text-[10px] font-semibold text-center leading-tight truncate w-full">{item.label}</span>
              </NavLink>
            );
          })}

        <button
          onClick={onOpen}
          className="flex flex-col items-center justify-center gap-1 rounded-xl p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 min-w-[4rem]"
        >
          <Bars3Icon className="h-6 w-6 text-slate-400" />
          <span className="text-[10px] font-semibold text-center leading-tight">Menu</span>
        </button>
      </div>
    </>
  );
};

export default Sidebar;