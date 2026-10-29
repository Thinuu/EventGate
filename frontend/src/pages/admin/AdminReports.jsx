import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import Card, { CardHeader } from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';
import { exportAdminReport, getAdminWorkspace } from '../../api/admin';

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const AdminReports = () => {
  const [workspace, setWorkspace] = useState(null);
  const [filters, setFilters] = useState({ type: 'attendees', format: 'csv' });

  useEffect(() => {
    getAdminWorkspace()
      .then((response) => setWorkspace(response.data?.data || null))
      .catch(() => toast.error('Failed to load reports data'));
  }, []);

  const handleExport = async () => {
    try {
      const response = await exportAdminReport(filters);
      downloadBlob(response.data, `${filters.type}.${filters.format === 'xlsx' ? 'xlsx' : 'csv'}`);
      toast.success('Report exported');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-semibold">Analytics</p>
            <h1 className="text-3xl font-bold text-slate-900">Reports & Exports</h1>
            <p className="text-sm text-slate-500">Generate attendee, entry log, and zone access extracts from the admin layer.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" value={filters.type} onChange={(e) => setFilters((current) => ({ ...current, type: e.target.value }))}>
              <option value="attendees">Attendee List</option>
              <option value="entry_logs">Entry Logs</option>
              <option value="zone_access">Zone Access</option>
            </select>
            <select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" value={filters.format} onChange={(e) => setFilters((current) => ({ ...current, format: e.target.value }))}>
              <option value="csv">CSV</option>
              <option value="xlsx">Excel</option>
            </select>
            <Button className="bg-teal-600 hover:bg-teal-500" onClick={handleExport}>Export Report</Button>
          </div>
        </div>

        <Card>
          <CardHeader title="Report Snapshot" subtitle="Preview of current operational volume before export" />
          <Table>
            <thead>
              <tr>
                <Th>Metric</Th>
                <Th>Value</Th>
              </tr>
            </thead>
            <tbody>
              <Tr><Td>Total events</Td><Td>{workspace?.overview?.totalEvents || 0}</Td></Tr>
              <Tr><Td>Total tickets sold</Td><Td>{workspace?.overview?.totalTicketsSold || 0}</Td></Tr>
              <Tr><Td>Confirmed attendees</Td><Td>{workspace?.overview?.confirmedAttendees || 0}</Td></Tr>
              <Tr><Td>Checked in users</Td><Td>{workspace?.overview?.checkedInUsers || 0}</Td></Tr>
              <Tr><Td>Denied entries</Td><Td>{workspace?.overview?.deniedEntries || 0}</Td></Tr>
            </tbody>
          </Table>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminReports;
