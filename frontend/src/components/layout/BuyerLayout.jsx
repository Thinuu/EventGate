import React, { useMemo } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BottomNav from './BottomNav';
import {
  HomeIcon,
  TicketIcon,
  UserCircleIcon,
  BellIcon,
  ArrowRightOnRectangleIcon,
  GlobeAltIcon,
  CreditCardIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

const BuyerLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const items = useMemo(
    () => [
      { to: '/buyer/home', label: 'Home', icon: HomeIcon, end: true },
      { to: '/buyer/orders', label: 'Orders', icon: ClipboardDocumentListIcon },
      { to: '/buyer/tickets', label: 'Tickets', icon: TicketIcon },
      { to: '/buyer/payment-history', label: 'Payments', icon: CreditCardIcon },
      { to: '/buyer/invites', label: 'Invites', icon: BellIcon },
      { to: '/buyer/profile', label: 'Profile', icon: UserCircleIcon },
    ],
    []
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Brand + desktop nav */}
          <div className="flex min-w-0 items-center gap-4 lg:gap-6">
            <Link
              to="/buyer/home"
              className="flex shrink-0 items-center gap-2.5 transition hover:opacity-90"
            >
              <img
                src="/brand/eventgate-mark.svg"
                alt="EventGate"
                className="h-8 w-8 object-contain"
              />
              <div className="hidden sm:block">
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-teal-600">
                  EventGate
                </p>
                <h1 className="text-xs font-bold leading-tight text-slate-900">
                  Buyer Dashboard
                </h1>
              </div>
            </Link>

            {/* Desktop nav — lg+ only */}
            <nav className="hidden items-center gap-0.5 border-l border-slate-200 pl-4 lg:flex lg:pl-6">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition',
                        isActive
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      ].join(' ')
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="hidden xl:inline">{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <Link
              to="/"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition sm:px-3.5"
              title="Public Portal"
            >
              <GlobeAltIcon className="h-4 w-4 text-slate-500" />
              <span className="hidden sm:inline">Public Portal</span>
            </Link>

            <div className="hidden text-right md:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Hi, {user?.name?.split(' ')[0] || 'Buyer'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 transition sm:px-3"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tablet nav only — md to lg (not mobile, not desktop) */}
        <div className="hidden border-t border-slate-100 md:block lg:hidden">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6 scrollbar-none">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap',
                      isActive
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100',
                    ].join(' ')
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main content — extra bottom padding only on mobile for bottom nav */}
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6 sm:pt-6 md:pb-10">
        {children}
      </main>

      {/* Mobile bottom nav — below md only */}
      <BottomNav items={items} />
    </div>
  );
};

export default BuyerLayout;