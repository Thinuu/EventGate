import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getMyEvents } from '../../api/events';
import { exportAuditReport, getAuditLogs } from '../../api/audit';
import toast from 'react-hot-toast';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const actionStyles = {
  check_in: 'bg-emerald-50 text-emerald-700',
  check_out: 'bg-teal-50 text-teal-700',
  zone_entry: 'bg-teal-50 text-teal-700',
  zone_exit: 'bg-slate-100 text-slate-600',
  denied: 'bg-rose-50 text-rose-700',
  ENTRY: 'bg-emerald-50 text-emerald-700',
  EXIT: 'bg-slate-100 text-slate-600',
};

const AuditorLogsPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [logType, setLogType] = useState('entry');
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zone, setZone] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

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
  }, [selectedEventId, logType, from, to, zone, categoryId, search]);

  useEffect(() => {
    if (!selectedEventId) return;

    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      getAuditLogs({
        eventId: selectedEventId,
        type: logType,
        from: from || undefined,
        to: to || undefined,
        zone: zone || undefined,
        categoryId: categoryId || undefined,
        search: search.trim() || undefined,
        page,
        limit: 10,
      })
        .then((response) => {
          setLogs(response.data?.data?.logs || []);
          setTotal(response.data?.data?.total || 0);
          setPages(response.data?.data?.pages || 1);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [selectedEventId, logType, from, to, zone, categoryId, search, page]);

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

  const handleExport = async () => {
    if (!selectedEventId) return;
    setExporting(true);
    try {
      const response = await exportAuditReport({
        eventId: selectedEventId,
        report: logType === 'zone' ? 'zone_logs' : 'entry_logs',
        from: from || undefined,
        to: to || undefined,
        zone: zone || undefined,
        categoryId: categoryId || undefined,
        search: search.trim() || undefined,
      });
      const blob = new Blob([response.data], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${logType}-audit-logs.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const zoneOptions = selectedEvent?.zones || [];
  const categoryOptions = selectedEvent?.categories || [];

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-24 sm:px-6">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-teal-500 ring-4 ring-teal-500/20" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Audit Workspace
                </p>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Audit Logs
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Review read-only entry and zone logs with export-ready filters.
              </p>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
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

            <select
              value={logType}
              onChange={(e) => setLogType(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
            >
              <option value="entry">Entry logs</option>
              <option value="zone">Zone logs</option>
            </select>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search attendee..."
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:bg-white"
            />

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

            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
            >
              <option value="">All zones</option>
              {zoneOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
            >
              <option value="">All categories</option>
              {categoryOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Logs table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {logType === 'zone' ? 'Zone Log Records' : 'Entry Log Records'}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">{total} results</p>
            </div>
            {loading && (
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
                    Attendee
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Category
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {logType === 'zone' ? 'Zone' : 'Gate / Zone'}
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Action
                  </th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Access
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const attendeeName =
                    logType === 'zone'
                      ? log.attendeeSnapshot?.fullName ||
                        log.attendeeId?.fullName
                      : log.snapshot?.fullName || log.attendee?.fullName;
                  const categoryName =
                    logType === 'zone'
                      ? log.attendeeSnapshot?.categoryName
                      : log.snapshot?.categoryName;
                  const access = log.accessGranted ? 'Granted' : 'Denied';
                  const location =
                    logType === 'zone'
                      ? log.zoneName
                      : [log.gateName || log.gateId, log.zoneName]
                          .filter(Boolean)
                          .join(' / ');

                  return (
                    <tr key={log._id} className="hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">
                        {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {attendeeName || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {categoryName || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {location || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                            actionStyles[log.action] ||
                            'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {String(log.action).replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                            log.accessGranted
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {access}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!loading && logs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No logs match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row">
            <p className="text-xs font-medium text-slate-500">
              Page {page} of {pages}
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
                disabled={page >= pages}
                onClick={() => setPage((c) => Math.min(c + 1, pages))}
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

export default AuditorLogsPage;