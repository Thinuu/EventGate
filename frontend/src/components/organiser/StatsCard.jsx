import React from 'react';

const StatsCard = ({ label, value, accent = 'bg-teal-600' }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      </div>
      <div className={`h-10 w-10 rounded-xl ${accent}`} />
    </div>
  </div>
);

export default StatsCard;
