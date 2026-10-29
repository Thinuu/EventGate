import React from 'react';
import PublicLayout from '../../components/layout/PublicLayout';
import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';

const MaintenancePage = () => {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100">
          <WrenchScrewdriverIcon className="h-8 w-8 text-amber-600" />
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-600 mb-3">
          System Update
        </p>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
          Scheduled Maintenance
        </h1>

        <p className="mt-4 text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
          The EventGate platform is currently undergoing scheduled maintenance or system updates.
          We’ll be back online shortly.
        </p>

        <div className="mt-8 inline-flex items-center gap-2.5 rounded-2xl bg-slate-50 border border-slate-200 px-5 py-2.5">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Status: Undergoing Updates
          </span>
        </div>
      </div>
    </PublicLayout>
  );
};

export default MaintenancePage;