import React from 'react';

const ChartCard = ({ title, subtitle, children, empty }) => (
  <div className="rounded-2xl bg-white p-6 shadow-sm">
    <div className="mb-5 text-left">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
    </div>
    {empty ? (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
        No data available
      </div>
    ) : (
      children
    )}
  </div>
);

export default ChartCard;
