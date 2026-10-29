import React from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';

const formatTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

const ActivityList = ({
  title = 'Recent activity',
  items = [],
  emptyMessage = 'No activity yet.',
  maxHeight = true,
}) => {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/40 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
            <ClockIcon className="h-4.5 w-4.5 h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">
              {items.length} recent action{items.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      <div
        className={`p-4 space-y-2 ${
          maxHeight ? 'max-h-[28rem] overflow-y-auto' : ''
        }`}
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-12 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              <ClockIcon className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {emptyMessage}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Actions will show up after scans or manual entry/exit.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const isSuccess =
              item.status === 'success' ||
              item.status === 'allowed' ||
              item.accessGranted === true;
            const isError =
              item.status === 'error' ||
              item.status === 'denied' ||
              item.accessGranted === false;

            return (
              <div
                key={item.id || `${item.attendeeName}-${item.timestamp}`}
                className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 transition hover:border-teal-100 hover:bg-teal-50/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {item.attendeeName || 'Unknown'}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {item.action}
                      {item.zoneName ? (
                        <span className="text-slate-400">
                          {' '}
                          · {item.zoneName}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {formatTime(item.timestamp)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      isSuccess
                        ? 'bg-emerald-100 text-emerald-700'
                        : isError
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isSuccess ? 'OK' : isError ? 'Denied' : item.status || '—'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActivityList;