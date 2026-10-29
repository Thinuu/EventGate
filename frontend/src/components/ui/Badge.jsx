import React from 'react';

const colors = {
  blue: 'bg-teal-100 text-teal-800 ring-1 ring-teal-200',
  indigo: 'bg-teal-100 text-teal-800 ring-1 ring-teal-200',
  sky: 'bg-teal-100 text-teal-800 ring-1 ring-teal-200',
  green: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  yellow: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  orange: 'bg-orange-100 text-orange-800 ring-1 ring-orange-200',
  amber: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  red: 'bg-red-100 text-red-800 ring-1 ring-red-200',
  purple: 'bg-purple-100 text-purple-800 ring-1 ring-purple-200',
  gray: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200',
  outline: 'border border-slate-300 bg-white text-slate-700',
  slate: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
};

const Badge = ({ color = 'gray', variant, children, className = '' }) => {
  const tone = variant || color;
  const toneClass = colors[tone] || colors.gray;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium leading-4 ${toneClass} ${className}`.trim()}>
      {children}
    </span>
  );
};

export default Badge;
