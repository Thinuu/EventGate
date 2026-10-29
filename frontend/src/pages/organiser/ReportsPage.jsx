import React, { useEffect, useState } from 'react';
import OrganiserLayout from '../../layouts/OrganiserLayout';
import { getOrganiserZonesReport, exportOrganiserEventData, getOrganiserEvent } from '../../api/organiser';
import Button from '../../components/ui/Button';

const ReportsPage = () => {
  const [zones, setZones] = useState([]);
  const [event, setEvent] = useState(null);

  useEffect(() => {
    getOrganiserEvent().then((res) => {
      const ev = res.data?.data?.event;
      setEvent(ev);
      if (ev?._id) {
        getOrganiserZonesReport(ev._id).then((r) => setZones(r.data?.data?.zoneOccupancy || []));
      }
    });
  }, []);

  const handleExport = async (type) => {
    if (!event?._id) return;
    const response = await exportOrganiserEventData(event._id, { type });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${type}-${event._id}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <OrganiserLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
            <p className="text-sm text-slate-500">Zone-wise attendance and exports.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleExport('attendees')}>Export Attendees</Button>
            <Button variant="outline" onClick={() => handleExport('logs')}>Export Logs</Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Zone-wise Attendance</h2>
          <div className="mt-4 space-y-3">
            {zones.map((z) => (
              <div key={z.zoneName} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span>{z.zoneName}</span>
                <span className="font-semibold text-slate-900">{z.occupancy}</span>
              </div>
            ))}
            {zones.length === 0 && <div className="text-sm text-slate-400">No zone data yet.</div>}
          </div>
        </div>
      </div>
    </OrganiserLayout>
  );
};

export default ReportsPage;
