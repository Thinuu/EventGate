import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyEvents } from '../api/events';

const navItems = [
  { to: '/organiser/dashboard', label: 'Dashboard Overview' },
  { to: '/organiser/attendees', label: 'Attendees' },
  { to: '/organiser/suborganisers', label: 'Sub Organisers' },
  { to: '/organiser/entry-logs', label: 'Entry Logs' },
  { to: '/organiser/reports', label: 'Reports' },
  { to: '/organiser/settings', label: 'Settings' },
];

const OrganiserLayout = ({ children }) => {
  const { user } = useAuth();
  const [eventName, setEventName] = useState('');

  useEffect(() => {
    getMyEvents()
      .then((res) => setEventName(res.data?.data?.events?.[0]?.name || 'Assigned Event'))
      .catch(() => setEventName('Assigned Event'));
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-brand-dark text-white flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <p className="text-xs uppercase tracking-widest text-slate-400">EventGate</p>
          <p className="text-lg font-bold">Main Organiser</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-xl px-3 py-2 text-sm ${
                  isActive ? 'bg-brand-main/20 text-brand-light border border-brand-main/30' : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-4 py-4 text-xs text-slate-400">
          Logged in as {user?.name || 'Organiser'}
        </div>
      </aside>
      <main className="flex-1">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Managing</p>
            <p className="text-lg font-bold text-slate-900">{eventName}</p>
          </div>
          <span className="rounded-full bg-brand-light/20 px-3 py-1 text-xs font-semibold text-brand-accent">Main Organiser</span>
        </div>
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
    </div>
  );
};

export default OrganiserLayout;
