import React, { useEffect, useState } from 'react';
import {
  BellIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notifications';
import { getMyEvents } from '../../api/events';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const Header = ({ onMenuClick }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );

  const isOrganiserWorkspace = ['MainOrganiser', 'SubOrganiser'].includes(
    user?.role
  );
  const isSuperAdminWorkspace = user?.role === 'MainAdmin';
  const isStaffWorkspace = ['Staff', 'Volunteer'].includes(user?.role);
  const assignedGateText = (user?.assignedGates || []).filter(Boolean).join(', ');
  const getEventObjectId = (event) => event?._id || event?.id || '';

  const workspaceTitle = isOrganiserWorkspace
    ? 'Command Center'
    : isSuperAdminWorkspace
    ? 'Global Control'
    : isStaffWorkspace
    ? 'Operations'
    : 'Console';

  const workspaceTitleShort = isOrganiserWorkspace
    ? 'Command'
    : isSuperAdminWorkspace
    ? 'Global'
    : isStaffWorkspace
    ? 'Ops'
    : 'Console';

  const getNotificationAge = (item) => {
    const rawDate = item?.timestamp || item?.createdAt || item?.updatedAt;
    const date = rawDate ? new Date(rawDate) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Just now';
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const loadNotifications = async () => {
    try {
      const response = await getNotifications({ limit: 10 });
      setItems(response.data?.data?.notifications || []);
      setUnreadCount(response.data?.data?.unreadCount || 0);
    } catch {
      toast.error('Failed to load notifications');
    }
  };

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!isOrganiserWorkspace && !isStaffWorkspace) return;
    getMyEvents()
      .then((response) => {
        const nextEvents = response.data?.data?.events || [];
        setEvents(nextEvents);
        const storedEventId =
          localStorage.getItem('lastSelectedEventId') || selectedEventId;
        const storedEventExists = nextEvents.some(
          (event) => getEventObjectId(event) === storedEventId
        );
        const fallbackEventId = storedEventExists
          ? storedEventId
          : getEventObjectId(nextEvents[0]);
        if (fallbackEventId) {
          setSelectedEventId(fallbackEventId);
          localStorage.setItem('lastSelectedEventId', fallbackEventId);
          if (fallbackEventId !== storedEventId) {
            window.dispatchEvent(
              new CustomEvent('entrynex:event-select', {
                detail: fallbackEventId,
              })
            );
          }
        } else {
          localStorage.removeItem('lastSelectedEventId');
        }
      })
      .catch(() => {});
  }, [isOrganiserWorkspace, isStaffWorkspace]);

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleItemClick = async (item) => {
    if (item.read) return;
    try {
      await markNotificationRead(item._id);
      setItems((prev) =>
        prev.map((n) => (n._id === item._id ? { ...n, read: true } : n))
      );
      setUnreadCount((count) => Math.max(count - 1, 0));
    } catch {
      toast.error('Failed to update notification');
    }
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    window.dispatchEvent(new CustomEvent('entrynex:search', { detail: value }));
  };

  const handleEventChange = (value) => {
    setSelectedEventId(value);
    localStorage.setItem('lastSelectedEventId', value);
    window.dispatchEvent(
      new CustomEvent('entrynex:event-select', { detail: value })
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {/* Left: menu + brand */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 transition lg:hidden"
            aria-label="Open menu"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="/brand/eventgate-mark.svg"
              alt="EventGate"
              className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
            />
            <div className="min-w-0">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 sm:block">
                System Dashboard
              </p>
              <p className="truncate text-sm font-bold tracking-tight text-slate-900 sm:text-base">
                <span className="sm:hidden">{workspaceTitleShort}</span>
                <span className="hidden sm:inline">{workspaceTitle}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Event selector (organiser and staff) */}
          {(isOrganiserWorkspace || isStaffWorkspace) && events.length > 0 && (
            <select
              value={selectedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
              className="hidden max-w-[180px] truncate rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 transition md:block lg:max-w-[220px]"
            >
              {events.map((event) => (
                <option key={getEventObjectId(event)} value={getEventObjectId(event)}>
                  {event.name}
                </option>
              ))}
            </select>
          )}

          {/* Search (non-staff, desktop) */}
          {!isStaffWorkspace && (
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-400 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-500/20 transition lg:flex">
              <MagnifyingGlassIcon className="h-4 w-4 shrink-0" />
              <input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Quick search…"
                className="w-40 bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 xl:w-52"
              />
            </div>
          )}

          {/* Staff gate badge */}
          {isStaffWorkspace && (
            <span className="hidden rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-700 sm:inline-flex">
              {assignedGateText || 'General Gate'}
            </span>
          )}

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 transition"
              aria-label="Notifications"
            >
              <BellIcon className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-md bg-teal-600 px-1 text-[9px] font-bold text-white shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {open && (
              <>
                {/* Backdrop for mobile tap-outside */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setOpen(false)}
                />
                <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-bold text-slate-900">
                      Notifications
                    </p>
                    <button
                      type="button"
                      onClick={handleMarkAll}
                      className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 transition"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-80 space-y-1 overflow-auto p-2">
                    {items.length > 0 ? (
                      items.map((item) => (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => handleItemClick(item)}
                          className={`w-full rounded-xl p-3 text-left transition ${
                            item.read
                              ? 'hover:bg-slate-50'
                              : 'bg-teal-50/70 hover:bg-teal-50'
                          }`}
                        >
                          <p
                            className={`text-sm font-semibold ${
                              item.read ? 'text-slate-600' : 'text-slate-900'
                            }`}
                          >
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                            {item.message}
                          </p>
                          <p className="mt-1.5 text-[10px] font-medium text-slate-400">
                            {getNotificationAge(item)}
                          </p>
                        </button>
                      ))
                    ) : (
                      <div className="py-10 text-center">
                        <p className="text-sm text-slate-400">No new alerts</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile event selector (organiser and staff) */}
      {(isOrganiserWorkspace || isStaffWorkspace) && events.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-2 md:hidden">
          <select
            value={selectedEventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"
          >
            {events.map((event) => (
              <option key={getEventObjectId(event)} value={getEventObjectId(event)}>
                {event.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </header>
  );
};

export default Header;