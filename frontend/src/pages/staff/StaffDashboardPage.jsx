import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import DashboardLayout from '../../components/layout/DashboardLayout';
import {
  QrCodeIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  SignalIcon,
  SignalSlashIcon,
  BanknotesIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import { getAssignedGateLabel, getAssignedZoneLabel } from './staffUtils';
import { getMyEvents } from '../../api/events';
import { getEntryStats } from '../../api/entry';

const MetricCard = ({ title, value, subtitle, accent = 'blue' }) => {
  const valueColor = {
    blue: 'text-teal-600',
    green: 'text-emerald-600',
    rose: 'text-rose-600',
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white px-3 py-3.5 shadow-sm sm:px-5 sm:py-5 active:scale-[0.98] transition-transform">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px] leading-tight">
        {title}
      </p>
      <p
        className={`mt-1 text-xl font-bold tracking-tight sm:mt-2 sm:text-3xl tabular-nums ${
          valueColor[accent] || 'text-slate-900'
        }`}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 truncate text-[9px] text-slate-500 sm:mt-1 sm:text-xs">
          {subtitle}
        </p>
      )}
    </div>
  );
};

const StaffDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeEvent, setActiveEvent] = useState(null);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const initDashboard = useCallback(async () => {
    if (!user) return;
    try {
      const eventsRes = await getMyEvents();
      const nextEvents = eventsRes.data?.data?.events || [];
      const lastEventId =
        localStorage.getItem('lastSelectedEventId') || nextEvents[0]?._id;
      const current =
        nextEvents.find((e) => e._id === lastEventId) || nextEvents[0];

      if (current) {
        setActiveEvent(current);
        // Use event-specific gates intersected with assigned gates, or fallback to event gates or default
        const eventGates = current?.gates || [];
        const assignedGates = user?.assignedGates || [];
        
        let gate;
        if (assignedGates.length > 0) {
          // If user has assigned gates, find intersection with event gates
          if (eventGates.length > 0) {
            const intersection = assignedGates.filter(g => eventGates.includes(g));
            // If intersection is empty, use event gates (user's assigned gates don't match this event)
            gate = intersection.length > 0 ? intersection[0] : eventGates[0];
          } else {
            gate = assignedGates[0];
          }
        } else {
          // If no assigned gates, use event gates or default
          gate = eventGates.length > 0 ? eventGates[0] : 'Gate A';
        }
        
        const statsRes = await getEntryStats({
          eventId: current._id,
          gateId: gate,
        });
        const data = statsRes.data?.data?.today || {};
        setStats({
          total: data.totalScanned || 0,
          success: data.successfulEntries || 0,
          failed: data.deniedEntries || 0,
        });
      }
    } catch (err) {
      console.warn('Unable to load initial dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useAutoRefresh(initDashboard, {
    enabled: !!user,
    interval: 15000,
    immediate: true,
    deps: [user],
  });

  // Listen for event changes from the header
  useEffect(() => {
    const handleEventSelect = () => {
      initDashboard();
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, [initDashboard]);

  const actions = [
    {
      title: 'Ticket Scanner',
      desc: 'QR check-in / check-out at your assigned gate.',
      icon: QrCodeIcon,
      path: '/staff/scan',
      badge: getAssignedGateLabel(user),
      active:
        user?.permissions?.canEntryAccess === true ||
        (user?.assignedGates?.length > 0),
    },
    {
      title: 'RFID Assignment',
      desc: 'Scan attendee QR and assign RFID wristbands/tags.',
      icon: IdentificationIcon,
      path: '/staff/rfid-assign',
      badge: 'QR → RFID',
      active: true,
    },
    {
      title: 'Restricted Zones',
      desc: 'Validate access for VIP, backstage, and internal zones.',
      icon: ShieldCheckIcon,
      path: '/staff/zone-access',
      badge: getAssignedZoneLabel(user),
      active:
        user?.assignedZones?.length > 0 ||
        user?.responsibilities?.zoneIds?.length > 0,
    },
    {
      title: 'Registry Override',
      desc: 'Manual lookup by name, phone, NIC, or passport.',
      icon: MagnifyingGlassIcon,
      path: '/staff/search',
      badge: 'Manual lookup',
      active: true,
    },
    {
      title: 'Validation Ledger',
      desc: 'Entry audits and recent gate activity.',
      icon: ClockIcon,
      path: '/staff/activity',
      badge: 'Audit log',
      active: true,
    },
    {
      title: 'Cash Collection',
      desc: 'Confirm entrance cash for reserved ticket orders.',
      icon: BanknotesIcon,
      path: '/staff/cash-collection',
      badge: 'Cash desk',
      active:
        ['MainAdmin', 'MainOrganiser', 'SubOrganiser'].includes(user?.role) ||
        user?.canCollectCash === true ||
        user?.permissions?.canCollectCash === true,
    },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-4 px-3 pb-24 sm:space-y-6 sm:px-6 lg:px-8">
        {/* ========== HEADER ========== */}
        <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-4 sm:px-7 sm:py-7">
            {/* Status row with event selector */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.25em] text-slate-400">
                  Staff Terminal
                </p>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    isOnline
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'animate-pulse border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {isOnline ? (
                    <>
                      <SignalIcon className="h-3 w-3" />
                      Online
                    </>
                  ) : (
                    <>
                      <SignalSlashIcon className="h-3 w-3" />
                      Offline
                    </>
                  )}
                </span>
              </div>
            </div>

            <h1 className="mt-2.5 sm:mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-3xl leading-tight">
              Welcome,{' '}
              <span className="text-teal-600">
                {user?.name || 'Operator'}
              </span>
            </h1>

            <p className="mt-1 max-w-2xl text-xs text-slate-500 sm:mt-2 sm:text-sm leading-snug">
              Manage entry, zones, and validation from this terminal.
            </p>

            {/* Active event + station – stacked & clearer on mobile */}
            {activeEvent && (
              <div className="mt-4 sm:mt-5 flex flex-col gap-2 border-t border-slate-100 pt-3.5 sm:pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-1">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-[10px] sm:text-xs text-slate-400 shrink-0 mt-0.5">
                    Event
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                    {activeEvent.name}
                  </span>
                </div>
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-[10px] sm:text-xs text-slate-400 shrink-0 mt-0.5">
                    Station
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                    {getAssignedGateLabel(user)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========== METRICS ========== */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <MetricCard
            title="Gate Actions"
            value={loading ? '—' : stats.total}
            subtitle="Scans today"
            accent="blue"
          />
          <MetricCard
            title="Valid"
            value={loading ? '—' : stats.success}
            subtitle="Allowed"
            accent="green"
          />
          <MetricCard
            title="Denied"
            value={loading ? '—' : stats.failed}
            subtitle="Blocked"
            accent="rose"
          />
        </div>

        {/* ========== OPERATIONS ========== */}
        <div>
          <p className="mb-2.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:mb-3">
            Operations
          </p>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4">
            {actions.map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.path}
                  type="button"
                  disabled={!act.active}
                  onClick={() => act.active && navigate(act.path)}
                  className={`group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3.5 text-left shadow-sm transition touch-manipulation sm:items-start sm:gap-4 sm:p-5 ${
                    act.active
                      ? 'hover:border-teal-200 hover:shadow-md active:bg-slate-50 cursor-pointer'
                      : 'opacity-45 cursor-not-allowed'
                  }`}
                >
                  {/* Icon – slightly larger hit area feel on mobile */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition sm:h-11 sm:w-11 ${
                      act.active
                        ? 'bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <h3 className="text-sm sm:text-[15px] font-semibold text-slate-900 leading-snug">
                        {act.title}
                      </h3>
                      {act.badge && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium text-slate-500 truncate max-w-[120px] sm:max-w-none">
                          {act.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-sm leading-snug text-slate-500 line-clamp-2">
                      {act.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffDashboardPage;