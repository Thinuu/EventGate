import React, { useMemo } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BottomNav from '../layout/BottomNav';
import {
  HomeIcon,
  TicketIcon,
  CalendarIcon,
  UserCircleIcon,
  BellIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

const AttendeeLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(() => ([
    { to: '/attendee/dashboard', label: 'Home', icon: HomeIcon, end: true },
    { to: '/attendee/tickets', label: 'Tickets', icon: TicketIcon },
    { to: '/attendee/events', label: 'Event', icon: CalendarIcon },
    { to: '/attendee/profile', label: 'Profile', icon: UserCircleIcon },
  ]), []);

  const headerTitle = useMemo(() => {
    const found = items.find((i) => location.pathname === i.to || (!i.end && location.pathname.startsWith(i.to)));
    return found?.label || 'Attendee';
  }, [items, location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-main">EventGate</p>
            <h1 className="text-lg font-bold text-slate-900">{headerTitle}</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex h-10 w-10 sm:w-auto items-center justify-center rounded-2xl bg-white sm:px-4 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              title="Public Home"
            >
              <HomeIcon className="h-5 w-5 sm:hidden" />
              <span className="hidden sm:inline">Public Home</span>
            </Link>
            <NavLink
              to="/attendee/notifications"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              title="Notifications"
            >
              <BellIcon className="h-5 w-5" />
            </NavLink>
            <button
              onClick={handleLogout}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-brand-dark px-3 sm:px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-accent"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        <div className="mx-auto hidden max-w-4xl gap-2 px-4 pb-4 md:flex md:px-6">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (
                `rounded-2xl px-4 py-2 text-sm font-semibold transition ` +
                (isActive ? 'bg-brand-dark text-white' : 'bg-white text-slate-700 hover:bg-slate-100')
              )}
            >
              {item.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center px-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{user?.name || 'Attendee'}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-3 xs:px-4 pb-24 pt-5 md:px-6 md:pb-8">
        {children}
      </main>

      <BottomNav items={items} />
    </div>
  );
};

export default AttendeeLayout;
