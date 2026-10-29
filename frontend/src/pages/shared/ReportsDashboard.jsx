import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getMyEvents } from '../../api/events';
import { getDashboardStats, getDashboardDenied, exportDashboard } from '../../api/dashboard';
import { exportAuditReport, getAuditReports } from '../../api/audit';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';
import { UserGroupIcon, ClipboardDocumentListIcon, XCircleIcon } from '@heroicons/react/24/solid';

/* ─── helpers ─────────────────────────────────────────────────── */
const downloadBlob = (data, filename, mime = 'text/csv') => {
  const blob = new Blob([data], { type: `${mime};charset=utf-8;` });
  const url  = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  window.URL.revokeObjectURL(url);
};

const actionColors = { check_in: 'blue', check_out: 'indigo', zone_entry: 'purple', zone_exit: 'gray', denied: 'red' };

const TABS = [
  { id: 'attendees',   label: 'Attendee Report', icon: UserGroupIcon },
  { id: 'entry_logs',  label: 'Entry Log Report', icon: ClipboardDocumentListIcon },
  { id: 'denied',      label: 'Denied Access', icon: XCircleIcon },
];

/* ─── attendee report tab ─────────────────────────────────────── */
const AttendeeReport = ({ selectedEvent, events, readOnly }) => {
  const [rows, setRows]       = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const selectedEventData = events.find(e => e._id === selectedEvent);

  useEffect(() => {
    if (!selectedEvent) return;
    setLoading(true);
    getAuditReports({ eventId: selectedEvent, categoryId: catFilter || undefined })
      .then(r => {
        setSummary(r.data?.data?.summary || {});
        setRows(r.data?.data?.attendanceReport || []);
      }).finally(() => setLoading(false));
  }, [selectedEvent, catFilter]);

  const filtered = statusFilter ? rows.filter(r => r._id === statusFilter) : rows;

  const handleExport = async (fmt) => {
    setExporting(fmt);
    try {
      const r = await exportDashboard({ eventId: selectedEvent, report: 'attendees', format: fmt });
      downloadBlob(r.data, `attendees.${fmt}`, fmt === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv');
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
    finally { setExporting(''); }
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Total Attendees',   value: summary.totalAttendees     || 0, color: 'bg-teal-50   text-teal-800   border-teal-200' },
          { label: 'Confirmed',         value: summary.confirmedAttendees || 0, color: 'bg-teal-50   text-teal-800   border-teal-200'   },
          { label: 'Checked In',        value: summary.checkedInCount     || 0, color: 'bg-violet-50  text-violet-800  border-violet-200' },
          { label: 'Denied Entries',    value: summary.deniedEntries      || 0, color: 'bg-rose-50    text-rose-800    border-rose-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-xs font-semibold uppercase tracking-widest mt-1 opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + Export */}
      <div className="flex flex-wrap gap-3 items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-wrap gap-3">
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white">
            <option value="">All Categories</option>
            {(selectedEventData?.categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')}  loading={exporting === 'csv'}>Export CSV</Button>
            <Button variant="outline" onClick={() => handleExport('xlsx')} loading={exporting === 'xlsx'}>Export Excel</Button>
          </div>
        )}
      </div>

      <Table>
        <thead><tr>
          <Th>Category</Th><Th>Total</Th><Th>Confirmed</Th><Th>Checked In</Th>
        </tr></thead>
        <tbody>
          {filtered.map(row => (
            <Tr key={row._id || 'uncategorised'}>
              <Td><span className="font-medium">{row._id || 'Uncategorised'}</span></Td>
              <Td>{row.totalAttendees}</Td>
              <Td>{row.confirmedAttendees}</Td>
              <Td>{row.checkedInCount}</Td>
            </Tr>
          ))}
          {!loading && filtered.length === 0 && (
            <tr><td colSpan="4" className="py-10 text-center text-sm text-gray-400">No data matches current filters</td></tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

/* ─── entry log report tab ────────────────────────────────────── */
const EntryLogReport = ({ selectedEvent, events, readOnly }) => {
  const [logs, setLogs]     = useState([]);
  const [total, setTotal]   = useState(0);
  const [pages, setPages]   = useState(1);
  const [page, setPage]     = useState(1);
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');
  const [zone, setZone]     = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');

  const selectedEventData = events.find(e => e._id === selectedEvent);

  useEffect(() => { setPage(1); }, [selectedEvent, from, to, zone]);

  useEffect(() => {
    if (!selectedEvent) return;
    setLoading(true);
    import('../../api/audit').then(({ getAuditLogs }) => {
      getAuditLogs({ eventId: selectedEvent, type: 'entry', from: from || undefined, to: to || undefined, zone: zone || undefined, page, limit: 20 })
        .then(r => {
          setLogs(r.data?.data?.logs || []);
          setTotal(r.data?.data?.total || 0);
          setPages(r.data?.data?.pages || 1);
        }).finally(() => setLoading(false));
    });
  }, [selectedEvent, from, to, zone, page]);

  const handleExport = async (fmt) => {
    setExporting(fmt);
    try {
      const r = await exportDashboard({ eventId: selectedEvent, report: 'entry_logs', format: fmt, from: from || undefined, to: to || undefined, zone: zone || undefined });
      downloadBlob(r.data, `entry-logs.${fmt}`);
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
    finally { setExporting(''); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-wrap gap-3">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white" />
          <input type="date" value={to}   onChange={e => setTo(e.target.value)}   className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white" />
          <select value={zone} onChange={e => setZone(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white">
            <option value="">All Zones</option>
            {(selectedEventData?.zones || []).map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')}  loading={exporting === 'csv'}>Export CSV</Button>
            <Button variant="outline" onClick={() => handleExport('xlsx')} loading={exporting === 'xlsx'}>Export Excel</Button>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500">{total} total records</p>
      <Table>
        <thead><tr>
          <Th>Timestamp</Th><Th>Attendee</Th><Th>Category</Th><Th>Gate / Zone</Th><Th>Action</Th><Th>Access</Th>
        </tr></thead>
        <tbody>
          {logs.map(log => {
            const name = log.snapshot?.fullName || log.attendee?.fullName || '-';
            const cat  = log.snapshot?.categoryName || log.attendee?.categoryName || '-';
            const loc  = [log.gateName || log.gateId, log.zoneName].filter(Boolean).join(' / ') || '-';
            return (
              <Tr key={log._id}>
                <Td className="text-xs">{log.timestamp ? format(new Date(log.timestamp), 'MMM d, HH:mm:ss') : '-'}</Td>
                <Td><span className="font-medium">{name}</span></Td>
                <Td>{cat}</Td>
                <Td>{loc}</Td>
                <Td><Badge color={actionColors[log.action] || 'gray'}>{String(log.action).replace('_',' ')}</Badge></Td>
                <Td><Badge color={log.accessGranted ? 'blue' : 'red'}>{log.accessGranted ? 'Granted' : 'Denied'}</Badge></Td>
              </Tr>
            );
          })}
          {!loading && logs.length === 0 && (
            <tr><td colSpan="6" className="py-10 text-center text-sm text-gray-400">No logs match current filters</td></tr>
          )}
        </tbody>
      </Table>
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Page {page} of {pages}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1}     onClick={() => setPage(p => Math.max(p-1,1))}>Previous</Button>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage(p => Math.min(p+1,pages))}>Next</Button>
        </div>
      </div>
    </div>
  );
};

/* ─── denied access tab ───────────────────────────────────────── */
const DeniedReport = ({ selectedEvent, readOnly }) => {
  const [logs, setLogs]     = useState([]);
  const [total, setTotal]   = useState(0);
  const [pages, setPages]   = useState(1);
  const [page, setPage]     = useState(1);
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');

  useEffect(() => { setPage(1); }, [selectedEvent, from, to]);

  useEffect(() => {
    if (!selectedEvent) return;
    setLoading(true);
    getDashboardDenied({ eventId: selectedEvent, from: from || undefined, to: to || undefined, page, limit: 20 })
      .then(r => {
        setLogs(r.data?.data?.logs || []);
        setTotal(r.data?.data?.total || 0);
        setPages(r.data?.data?.pages || 1);
      }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedEvent, from, to, page]);

  const handleExport = async (fmt) => {
    setExporting(fmt);
    try {
      const r = await exportDashboard({ eventId: selectedEvent, report: 'denied', format: fmt, from: from || undefined, to: to || undefined });
      downloadBlob(r.data, `denied-access.${fmt}`);
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
    finally { setExporting(''); }
  };

  return (
    <div className="space-y-5">
      {/* Summary pill */}
      {total > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-rose-100 text-rose-500 mr-1 flex-shrink-0">
          <XCircleIcon className="h-8 w-8" />
        </div>
          <div>
            <p className="text-xl font-black text-rose-800">{total} denied entries</p>
            <p className="text-sm text-rose-600">All gate and zone denials within selected timeframe</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-wrap gap-3">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white" />
          <input type="date" value={to}   onChange={e => setTo(e.target.value)}   className="rounded-xl border border-gray-300 px-3 py-2 text-sm bg-white" />
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')}  loading={exporting === 'csv'}>Export CSV</Button>
            <Button variant="outline" onClick={() => handleExport('xlsx')} loading={exporting === 'xlsx'}>Export Excel</Button>
          </div>
        )}
      </div>

      <Table>
        <thead><tr>
          <Th>Timestamp</Th><Th>Attendee</Th><Th>Category</Th><Th>Gate</Th><Th>Reason</Th><Th>Processed By</Th>
        </tr></thead>
        <tbody>
          {logs.map(log => {
            const name = log.attendee?.fullName || log.snapshot?.fullName || '-';
            const cat  = log.attendee?.categoryName || log.snapshot?.categoryName || '-';
            return (
              <Tr key={log._id}>
                <Td className="text-xs">{log.timestamp ? format(new Date(log.timestamp), 'MMM d, HH:mm:ss') : '-'}</Td>
                <Td><span className="font-medium text-rose-700">{name}</span></Td>
                <Td>{cat}</Td>
                <Td>{log.gateName || log.gateId || '-'}</Td>
                <Td><span className="rounded-full bg-rose-100 text-rose-700 text-xs px-2 py-0.5 font-medium">{log.denialReason || 'No reason given'}</span></Td>
                <Td>{log.processedBy?.name || '-'}</Td>
              </Tr>
            );
          })}
          {!loading && logs.length === 0 && (
            <tr><td colSpan="6" className="py-10 text-center text-sm text-gray-400">No denied access records</td></tr>
          )}
        </tbody>
      </Table>
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">Page {page} of {pages}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page <= 1}     onClick={() => setPage(p => Math.max(p-1,1))}>Previous</Button>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage(p => Math.min(p+1,pages))}>Next</Button>
        </div>
      </div>
    </div>
  );
};

/* ─── main component ──────────────────────────────────────────── */
const ReportsDashboard = ({ readOnly = false }) => {
  const [events, setEvents]   = useState([]);
  const [selected, setSelected] = useState('');
  const [activeTab, setActiveTab] = useState('attendees');

  useEffect(() => {
    getMyEvents().then(r => {
      const evs = r.data?.data?.events || [];
      setEvents(evs);
      if (evs.length) setSelected(evs[0]._id);
    });
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Reports
              {readOnly && <span className="ml-2 text-xs rounded-full bg-teal-100 text-teal-700 px-2 py-0.5 font-semibold">READ-ONLY</span>}
            </h1>
            <p className="text-sm text-gray-500">Attendee, entry, and denied access reports with Excel/CSV export</p>
          </div>
          {events.length > 1 && (
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {events.map(ev => <option key={ev._id} value={ev._id}>{ev.name}</option>)}
            </select>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl border border-gray-200 bg-gray-100 p-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
            </button>
          )})}
        </div>

        {/* Tab content */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          {activeTab === 'attendees'  && <AttendeeReport  selectedEvent={selected} events={events} readOnly={readOnly} />}
          {activeTab === 'entry_logs' && <EntryLogReport  selectedEvent={selected} events={events} readOnly={readOnly} />}
          {activeTab === 'denied'     && <DeniedReport    selectedEvent={selected} readOnly={readOnly} />}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportsDashboard;
