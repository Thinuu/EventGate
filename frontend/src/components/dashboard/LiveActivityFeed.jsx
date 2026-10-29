import React from 'react';
import Card, { CardHeader } from '../ui/Card';

const statusClasses = (accessGranted) => (
  accessGranted
    ? 'border-teal-200 bg-teal-50 text-teal-700'
    : 'border-red-200 bg-red-50 text-red-700'
);

const LiveActivityFeed = ({ logs, onExport }) => (
  <Card className="h-full">
    <CardHeader
      title="Live Activity Feed"
      subtitle="Recent entry and zone scans"
      action={(
        <button
          type="button"
          onClick={onExport}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Export CSV
        </button>
      )}
    />
    <div className="space-y-3">
      {logs.length === 0 && (
        <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No activity found for the selected filters.
        </div>
      )}
      {logs.map((log) => (
        <div key={`${log.source}-${log._id}`} className="rounded-xl border border-slate-100 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">{log.name || 'Unknown attendee'}</p>
              <p className="mt-1 text-sm text-slate-500">{log.zoneName || 'Main Entry'}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(log.accessGranted)}`}>
              {log.action}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>
        </div>
      ))}
    </div>
  </Card>
);

export default LiveActivityFeed;
