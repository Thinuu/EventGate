import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getMyEvents } from '../../api/events';
import { getSystemLogs } from '../../api/audit';
import toast from 'react-hot-toast';

const actionStyles = {
  login: 'bg-emerald-50 text-emerald-700',
  logout: 'bg-slate-100 text-slate-600',
  ticket_creation: 'bg-teal-50 text-teal-700',
  ticket_scan: 'bg-teal-50 text-teal-700',
  event_update: 'bg-amber-50 text-amber-700',
  user_creation: 'bg-teal-50 text-teal-700',
  qr_verification: 'bg-emerald-50 text-emerald-700',
  sponsor_action: 'bg-violet-50 text-violet-700',
  mfa_activity: 'bg-rose-50 text-rose-700',
};

const AuditorSystemLogsPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [sysLogsData, setSysLogsData] = useState({
    logs: [],
    total: 0,
    pages: 1,
  });
  const [sysLoading, setSysLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

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

  useEffect(() => {
    setPage(1);
  }, [selectedEventId, search, action, from, to]);

  const loadSystemLogs = async () => {
    if (!selectedEventId) return;
    setSysLoading(true);
    try {
      const response = await getSystemLogs({
        eventId: selectedEventId,
        search: search || undefined,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: 15,
      });
      setSysLogsData(response.data?.data || { logs: [], total: 0, pages: 1 });
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to fetch activity logs'
      );
    } finally {
      setSysLoading(false);
    }
  };

  useEffect(() => {
    loadSystemLogs();
  }, [selectedEventId, search, action, from, to, page]);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(
      new CustomEvent('entrynex:event-select', { detail: nextId })
    );
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-24 sm:px-6">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-teal-500 ring-4 ring-teal-500/20" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Auditor Telemetry
            </p>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            System Audit Logs
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Full read-only access to track security audits, user creations,
            configuration updates, and MFA events.
          </p>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <select
              value={selectedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
            >
              {events.map((event) => (
                <option key={event._id} value={event._id}>
                  {event.name}
                </option>
              ))}
            </select>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:bg-white"
            />

            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
            >
              <option value="">All action types</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="ticket_creation">Ticket Creation</option>
              <option value="ticket_scan">Ticket Scan</option>
              <option value="event_update">Event Update</option>
              <option value="user_creation">User Creation</option>
              <option value="qr_verification">QR Photo Verification</option>
              <option value="sponsor_action">Sponsor Action</option>
              <option value="mfa_activity">MFA Activity</option>
            </select>

            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
            />

            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Logs table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Audit Actions Grid
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {sysLogsData?.total || 0} results
              </p>
            </div>
            {sysLoading && (
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Refreshing...
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Timestamp
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Operator
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Role
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Action
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Details
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    IP Address
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sysLogsData?.logs?.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">
                      {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      {log.userEmail || 'system'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        {log.userRole || 'System'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                          actionStyles[log.action] ||
                          'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {String(log.action).replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="max-w-xs px-5 py-3.5 text-slate-700">
                      <p className="truncate">
                        {log.details?.message || '—'}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
                {!sysLoading &&
                  (!sysLogsData?.logs || sysLogsData.logs.length === 0) && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-sm text-slate-500"
                      >
                        No activity logs match the current filters.
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row">
            <p className="text-xs font-medium text-slate-500">
              Page {page} of {sysLogsData?.pages || 1}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((c) => Math.max(c - 1, 1))}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= (sysLogsData?.pages || 1)}
                onClick={() =>
                  setPage((c) => Math.min(c + 1, sysLogsData.pages))
                }
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditorSystemLogsPage;