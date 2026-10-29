import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getRfidAccessLogs } from '../../api/rfid';
import { getAllEventsAdmin } from '../../api/events';
import toast from 'react-hot-toast';

const AdminRfidAccessLogsPage = ({ embedded = false }) => {
  const [logs, setLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });

  // Filters
  const [resultFilter, setResultFilter] = useState('ALL');
  const [eventFilter, setEventFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Summary counts
  const counts = useMemo(() => {
    let granted = 0;
    let denied = 0;
    logs.forEach((log) => {
      if (log.result === 'GRANTED') granted++;
      else if (log.result === 'DENIED') denied++;
    });
    return { total: pagination.total || logs.length, granted, denied };
  }, [logs, pagination.total]);

  const fetchLogs = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 25 };
      if (resultFilter !== 'ALL') params.result = resultFilter;
      if (eventFilter !== 'ALL') params.eventId = eventFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await getRfidAccessLogs(params);
      if (res.data?.success) {
        setLogs(res.data.data.logs || []);
        setPagination(res.data.data.pagination || { page: 1, limit: 25, total: 0, pages: 1 });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load RFID access logs');
    } finally {
      setLoading(false);
    }
  }, [resultFilter, eventFilter, searchTerm]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  useEffect(() => {
    getAllEventsAdmin({ limit: 1000 })
      .then((res) => {
        const evList = res.data?.data?.events || [];
        setEvents(evList);
      })
      .catch(() => {});
  }, []);

  const hasActiveFilters = searchTerm !== '' || resultFilter !== 'ALL' || eventFilter !== 'ALL';

  const clearFilters = () => {
    setSearchTerm('');
    setResultFilter('ALL');
    setEventFilter('ALL');
  };

  const content = (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Navigation Tabs - when viewed on standalone route */}
      {!embedded && (
        <div className="flex border-b border-slate-200">
          <Link
            to="/admin/rfid"
            className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:border-slate-300"
          >
            Physical Tag Inventory
          </Link>
          <Link
            to="/admin/rfid-assignments"
            className="border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:border-slate-300"
          >
            Tag Assignments
          </Link>
          <Link
            to="/admin/rfid-access-logs"
            className="border-b-2 border-teal-600 px-4 py-2.5 text-sm font-semibold text-teal-600"
          >
            RFID Access Logs
          </Link>
        </div>
      )}

      {/* Summary KPI Cards - Exact same styling as Inventory */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Total Scans', counts.total, 'text-slate-900'],
          ['Granted', counts.granted, 'text-emerald-600'],
          ['Denied', counts.denied, 'text-red-600'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table Container */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Table header + filter bar */}
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-slate-900">RFID Access Logs</span>
            <span className="text-xs font-normal text-slate-500">
              {pagination.total} total scan events
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {/* Search */}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by RFID identifier..."
              className="flex-1 min-w-[180px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
            {/* Result filter */}
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            >
              <option value="ALL">All Results</option>
              <option value="GRANTED">Granted</option>
              <option value="DENIED">Denied</option>
            </select>
            {/* Event filter */}
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            >
              <option value="ALL">All Events</option>
              {events.map((ev) => (
                <option key={ev._id} value={ev._id}>
                  {ev.name}
                </option>
              ))}
            </select>
            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">RFID</th>
                <th className="px-5 py-3">Result</th>
                <th className="px-5 py-3">Attendee</th>
                <th className="px-5 py-3">Event / Location</th>
                <th className="px-5 py-3">Reason / Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                    Loading scan events...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                    {hasActiveFilters ? 'No logs match the current filters.' : 'No RFID scan logs recorded.'}
                  </td>
                </tr>
              ) : (
                logs.map((item) => (
                  <tr key={item._id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : '-'}
                    </td>
                    <td className="px-5 py-3 font-mono font-medium text-slate-900">{item.rfidIdentifierSnapshot}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          item.result === 'GRANTED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {item.result}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{item.attendee?.fullName || 'Unassigned'}</div>
                      <div className="text-xs text-slate-400">{item.attendee?.email || ''}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      <div className="font-medium text-slate-800">{item.event?.name || '-'}</div>
                      <div className="text-slate-400">{item.gateName || item.zoneName || 'Main Entry'}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {item.denialReason ? (
                        <span className="font-medium text-red-600">{item.denialReason}</span>
                      ) : (
                        <span className="text-slate-400">Granted entry</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {pagination.pages > 1 && (
          <div className="border-t border-slate-100 px-5 py-3 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <div>
              Page {pagination.page} of {pagination.pages}
            </div>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchLogs(pagination.page - 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchLogs(pagination.page + 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default AdminRfidAccessLogsPage;
