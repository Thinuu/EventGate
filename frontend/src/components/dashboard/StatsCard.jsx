import React from 'react';

const toneStyles = {
  primary: 'bg-teal-50 text-teal-600',
  success: 'bg-emerald-50 text-emerald-600',
  danger: 'bg-red-50 text-red-600',
};

const StatsCard = ({ title, value, subtitle, icon: Icon, tone = 'primary' }) => (
  <div className="flex h-full flex-col justify-between rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md">
    <div className="flex items-start justify-between gap-4">
      <div className="text-left">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      </div>
      {Icon ? (
        <div className={`rounded-xl p-3 ${toneStyles[tone] || toneStyles.primary}`}>
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
    </div>
    <p className="mt-4 text-left text-sm text-gray-500">{subtitle}</p>
  </div>
);

export default StatsCard;
