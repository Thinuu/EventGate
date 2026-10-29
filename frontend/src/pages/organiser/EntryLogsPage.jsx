import React, { useEffect, useState } from 'react';
import OrganiserLayout from '../../layouts/OrganiserLayout';
import { getOrganiserEntryLogs } from '../../api/organiser';
import Button from '../../components/ui/Button';

const EntryLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ zone: '', action: '', from: '', to: '' });
  const [live, setLive] = useState(true);

  const load = () => {
    setLoading(true);
    getOrganiserEntryLogs({ limit: 50, ...filters })
      .then((res) => setLogs(res.data?.data?.logs || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (live) load();
    }, 15000);
    return () => clearInterval(interval);
  }, [filters, live]);

  return (
    <OrganiserLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Entry Logs</h1>
            <p className="text-sm text-slate-500">Live check-in / check-out activity.</p>
          </div>
          <Button variant="outline" onClick={load}>Refresh</Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Zone" value={filters.zone} onChange={(e) => setFilters((f) => ({ ...f, zone: e.target.value }))} />
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}>
            <option value="">All Actions</option>
            <option value="check_in">Check-in</option>
            <option value="check_out">Check-out</option>
            <option value="denied">Denied</option>
          </select>
          <input type="date" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          <input type="date" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          Live Mode
        </label>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Attendee</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Gate/Zone</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="border-t">
                  <td className="px-4 py-3">{log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3">{log.attendee?.fullName || '-'}</td>
                  <td className="px-4 py-3">{log.action}</td>
                  <td className="px-4 py-3">{log.gateName || log.zoneName || '-'}</td>
                </tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-slate-400">No logs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </OrganiserLayout>
  );
};

export default EntryLogsPage;
