import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDashboardPathForRole } from '../../config/roleNavigation';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const PublicLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  // Auto-close on route change
  useEffect(() => {
    closeMenu();
  }, [location.pathname]);

  // Close on Escape key
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isMenuOpen]);

  // Prevent background scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/');
    closeMenu();
  };

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-slate-50">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Brand */}
            <Link
              to="/"
              className="flex items-center gap-2.5 transition hover:opacity-90"
              onClick={closeMenu}
            >
              <img
                src="/brand/eventgate-logo.svg"
                alt="EventGate"
                className="h-10 w-48 rounded-md bg-white object-contain"
              />
              
            </Link>

            {/* Desktop links */}
            <div className="hidden items-center gap-5 sm:flex">
              <Link
                to="/events"
                className="text-sm font-semibold text-slate-300 transition hover:text-white"
              >
                Upcoming Events
              </Link>

              <div className="h-5 w-px bg-slate-700" />

              {user ? (
                <div className="flex items-center gap-4">
                  <Link
                    to={getDashboardPathForRole(user.role)}
                    className="text-sm font-semibold text-teal-400 transition hover:text-teal-300"
                  >
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-sm font-semibold text-slate-400 transition hover:text-slate-200"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500"
                >
                  Partner Sign In
                </Link>
              )}
            </div>

            {/* Mobile: right-side actions */}
            <div className="flex items-center gap-2 sm:hidden">
              {/* Compact dashboard chip for logged-in users */}
              {user && (
                <Link
                  to={getDashboardPathForRole(user.role)}
                  className="rounded-lg border border-teal-500/30 bg-teal-600/20 px-3 py-1.5 text-xs font-semibold text-teal-400 transition hover:bg-teal-600/30 active:scale-95"
                >
                  Dashboard
                </Link>
              )}

              {/* Hamburger toggle */}
              <button
                type="button"
                onClick={() => setIsMenuOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white transition hover:bg-white/10 active:scale-95"
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? (
                  <XMarkIcon className="h-5 w-5" />
                ) : (
                  <Bars3Icon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile slide-down drawer ── */}
        <div
          style={{
            maxHeight: isMenuOpen ? '480px' : '0px',
            opacity: isMenuOpen ? 1 : 0,
            transition: 'max-height 0.3s ease, opacity 0.25s ease',
          }}
          className="overflow-hidden border-t border-white/10 bg-slate-900 sm:hidden"
          aria-hidden={!isMenuOpen}
        >
          <div className="px-3 py-3">
            <Link
              to="/events"
              onClick={closeMenu}
              className="block rounded-lg px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Upcoming Events
            </Link>

            <div className="my-2 h-px bg-white/10" />

            {user ? (
              <>
                {/* User profile row */}
                <div className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white leading-tight">
                      {user.name || user.email}
                    </p>
                    <p className="text-[11px] text-slate-500 leading-tight">{user.role}</p>
                  </div>
                </div>

                <Link
                  to={getDashboardPathForRole(user.role)}
                  onClick={closeMenu}
                  className="block rounded-lg px-3 py-3 text-sm font-medium text-teal-400 transition hover:bg-white/5 hover:text-teal-300"
                >
                  Dashboard
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="block w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={closeMenu}
                className="mt-1 block w-full rounded-lg bg-teal-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-teal-500 active:scale-[0.98]"
              >
                Partner Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Dark backdrop to close mobile menu */}
      <div
        onClick={closeMenu}
        className="fixed inset-0 z-40 bg-black/50 sm:hidden"
        aria-hidden="true"
        style={{
          opacity: isMenuOpen ? 1 : 0,
          pointerEvents: isMenuOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Content */}
      <main className="flex flex-1 flex-col">{children}</main>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950 text-slate-400">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
              <div className="flex items-center gap-2.5">
                <img
                  src="/brand/eventgate-logo.svg"
                  alt="EventGate"
                  className="h-8 w-8 object-contain opacity-80"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="leading-tight">
                  <span className="text-base font-bold tracking-tight text-slate-200">
                    Event<span className="text-teal-400">Gate</span>
                  </span>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Event Access Management
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} EventGate. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;