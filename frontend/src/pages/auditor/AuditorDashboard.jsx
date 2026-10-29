import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  EyeIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getMyEvents } from '../../api/events';
import { getAuditReports } from '../../api/audit';

const quickLinks = [
  {
    to: '/auditor/logs',
    title: 'Audit Logs',
    description:
      'Review entry and zone activity with read-only filters and pagination.',
    icon: ClipboardDocumentListIcon,
  },
  {
    to: '/auditor/reports',
    title: 'Audit Reports',
    description:
      'Inspect attendance and zone movement reports with export support.',
    icon: ChartBarIcon,
  },
];

const statCards = [
  {
    key: 'totalAttendees',
    label: 'Total Attendees',
    icon: UserGroupIcon,
    valueColor: 'text-slate-900',
  },
  {
    key: 'confirmedAttendees',
    label: 'Confirmed',
    icon: ShieldCheckIcon,
    valueColor: 'text-emerald-600',
  },
  {
    key: 'checkedInCount',
    label: 'Checked In',
    icon: EyeIcon,
    valueColor: 'text-teal-600',
  },
  {
    key: 'deniedEntries',
    label: 'Denied Entries',
    icon: ClipboardDocumentListIcon,
    valueColor: 'text-rose-600',
  },
];

const AuditorDashboard = () => {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [summary, setSummary] = useState({
    totalAttendees: 0,
    confirmedAttendees: 0,
    checkedInCount: 0,
    deniedEntries: 0,
  });

  useEffect(() => {
    getMyEvents().then((response) => {
      const nextEvents = response.data?.data?.events || [];
      setEvents(nextEvents);
      const isValidEvent = nextEvents.some((e) => e._id === selectedEventId);
      const fallbackEventId =
        (isValidEvent ? selectedEventId : nextEvents[0]?._id) || '';
      if (fallbackEventId) {
        setSelectedEventId(fallbackEventId);
        localStorage.setItem('lastSelectedEventId', fallbackEventId);
      }
    });
  }, [selectedEventId]);

  useEffect(() => {
    const handleEventSelect = (event) => {
      setSelectedEventId(event.detail || '');
    };
    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const loadSummary = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const response = await getAuditReports({ eventId: selectedEventId });
      setSummary(response.data?.data?.summary || {});
    } catch (error) {
      console.warn('Failed to refresh audit summary:', error);
    }
  }, [selectedEventId]);

  useAutoRefresh(loadSummary, {
    enabled: !!selectedEventId,
    interval: 15000,
    immediate: true,
    deps: [selectedEventId],
  });

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(
      new CustomEvent('entrynex:event-select', { detail: nextId })
    );
  };

  const selectedEvent = useMemo(
    () => events.find((event) => event._id === selectedEventId),
    [events, selectedEventId]
  );

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-24 sm:px-6">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-teal-500 ring-4 ring-teal-500/20" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Audit Workspace
                </p>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Auditor Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Read-only visibility into attendance, access activity, and event
                evidence trails. Access follows event assignments granted by
                organisers.
              </p>
            </div>

            <div className="w-full max-w-xs">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Audited Event
              </p>
              <select
                value={selectedEventId}
                onChange={(e) => handleEventChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
              >
                {events.map((event) => (
                  <option key={event._id} value={event._id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Current scope notice */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Current Scope
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {selectedEvent?.name || 'Select an event'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                This workspace stays synchronized with the global event selector
                and remains strictly read-only.
              </p>
            </div>
            <div className="rounded-xl bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700">
              Auditor access only · No editing
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map(({ key, label, icon: Icon, valueColor }) => (
            <div
              key={key}
              className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {label}
                  </p>
                  <p
                    className={`mt-2 text-3xl font-bold tracking-tight ${valueColor}`}
                  >
                    {summary[key] || 0}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 text-slate-500">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="group rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600 transition group-hover:bg-teal-600 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  {item.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditorDashboard;