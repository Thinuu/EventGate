import React from 'react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import {
  MapPinIcon,
  UsersIcon,
  CheckBadgeIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';

const ZoneCard = ({ zone, onViewAttendees, onMonitor }) => {
  const capacity = Number(zone?.capacity) || 0;
  const checkedIn = Number(
    zone?.checkedInCount ?? zone?.checkedIn ?? zone?.occupancy ?? 0
  );
  const fillPct =
    capacity > 0 ? Math.min(100, Math.round((checkedIn / capacity) * 100)) : 0;

  return (
    <div className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:border-teal-200 hover:shadow-md">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
            <MapPinIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 truncate">
                {zone?.name || 'Unnamed zone'}
              </h3>
              {zone?.isActive === false && <Badge color="gray">Inactive</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-500 line-clamp-2">
              {zone?.description || 'Operational zone for entry and scans.'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-teal-100/70 bg-teal-50/80 px-3 py-3">
            <div className="flex items-center gap-1.5">
              <UsersIcon className="h-3.5 w-3.5 text-teal-600/80" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600/80">
                Capacity
              </p>
            </div>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {capacity > 0 ? capacity : '∞'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-1.5">
              <CheckBadgeIcon className="h-3.5 w-3.5 text-slate-500" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Checked in
              </p>
            </div>
            <p className="mt-1 text-xl font-bold text-slate-900">{checkedIn}</p>
          </div>
        </div>

        {capacity > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-500">Occupancy</span>
              <span className="font-semibold text-slate-700">{fillPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-600 transition-all duration-500"
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="flex-1 bg-teal-600 hover:bg-teal-500 text-white"
            onClick={onMonitor}
          >
            <QrCodeIcon className="mr-1.5 h-4 w-4" />
            Monitor / Scan
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-teal-200 text-teal-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
            onClick={onViewAttendees}
          >
            <UsersIcon className="mr-1.5 h-4 w-4" />
            Attendees
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ZoneCard;