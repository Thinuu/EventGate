import React from 'react';
import OrganiserLayout from '../../layouts/OrganiserLayout';

const OrganiserSettings = () => (
  <OrganiserLayout>
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Event Settings</h1>
      <p className="text-sm text-slate-500 mt-2">Settings for your assigned event will appear here.</p>
    </div>
  </OrganiserLayout>
);

export default OrganiserSettings;
