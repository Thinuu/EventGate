import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getMyEvents } from '../../api/events';
import { exportAuditReport, getAuditReports } from '../../api/audit';
import toast from 'react-hot-toast';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const AuditorReportsPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zone, setZone] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalAttendees: 0,
    confirmedAttendees: 0,
    checkedInCount: 0,
    deniedEntries: 0,
  });
  const [attendanceReport, setAttendanceReport] = useState([]);
  const [zoneMovementReport, setZoneMovementReport] = useState([]);
  const [exporting, setExporting] = useState('');

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
    if (!selectedEventId) return;
    setLoading(true);
    getAuditReports({
      eventId: selectedEventId,
      from: from || undefined,
      to: to || undefined,
      zone: zone || undefined,
      categoryId: categoryId || undefined,
    })
      .then((response) => {
        setSummary(response.data?.data?.summary || {});
        setAttendanceReport(response.data?.data?.attendanceReport || []);
        setZoneMovementReport(response.data?.data?.zoneMovementReport || []);
      })
      .finally(() => setLoading(false));
  }, [selectedEventId, from, to, zone, categoryId]);

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

  const handleExport = async (report) => {
    if (!selectedEventId) return;
    setExporting(report);
    try {
      const response = await exportAuditReport({
        eventId: selectedEventId,
        report,
        from: from || undefined,
        to: to || undefined,
        zone: zone || undefined,
        categoryId: categoryId || undefined,
      });
      const blob = new Blob([response.data], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export failed');
    } finally {
      setExporting('');
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-24 sm:px-6">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-teal-500 ring-4 ring-teal-500/20" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Audit Workspace
                </p>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Audit Reports
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Read-only attendance and zone movement reporting for the
                selected event.
              </p>
            </div>
            {loading && (
              <p className="text-sm font-medium text-slate-400">
                Refreshing reports...
              </p>
            )}
          </div>
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
              {(selectedEvent?.zones || []).map((item) => (
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
              {(selectedEvent?.categories || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Total Attendees',
              value: summary.totalAttendees || 0,
              color: 'text-slate-900',
            },
            {
              label: 'Confirmed',
              value: summary.confirmedAttendees || 0,
              color: 'text-emerald-600',
            },
            {
              label: 'Checked In',
              value: summary.checkedInCount || 0,
              color: 'text-teal-600',
            },
            {
              label: 'Denied Entries',
              value: summary.deniedEntries || 0,
              color: 'text-rose-600',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {stat.label}
              </p>
              <p className={`mt-2 text-3xl font-bold tracking-tight ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Reports */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {/* Attendance Report */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Attendance Report
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Category-level attendance and check-in counts
                </p>
              </div>
              <button
                onClick={() => handleExport('attendance')}
                disabled={exporting === 'attendance'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                {exporting === 'attendance' ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Category
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Total
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Confirmed
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Checked In
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceReport.map((row) => (
                    <tr key={row._id || 'uncategorised'} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {row._id || 'Uncategorised'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {row.totalAttendees}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {row.confirmedAttendees}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {row.checkedInCount}
                      </td>
                    </tr>
                  ))}
                  {!loading && attendanceReport.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-12 text-center text-sm text-slate-500"
                      >
                        No attendance rows match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Zone Movement Report */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Zone Movement Report
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Entries, exits, and net movement by zone
                </p>
              </div>
              <button
                onClick={() => handleExport('zone_movement')}
                disabled={exporting === 'zone_movement'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                {exporting === 'zone_movement' ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Zone
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Entries
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Exits
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Net
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {zoneMovementReport.map((row) => (
                    <tr key={row.zoneName} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {row.zoneName}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {row.entries}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {row.exits}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">
                        {row.netMovement}
                      </td>
                    </tr>
                  ))}
                  {!loading && zoneMovementReport.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-12 text-center text-sm text-slate-500"
                      >
                        No zone movement rows match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditorReportsPage;