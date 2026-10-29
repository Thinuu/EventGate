import React from 'react';

const Card = ({ children, className = '', padding = true }) => (
  <div
    className={`bg-white rounded-[28px] border border-slate-200 shadow-sm ${
      padding ? 'p-5 sm:p-6' : ''
    } ${className}`}
  >
    {children}
  </div>
);

export const CardHeader = ({ title, subtitle, action, className = '' }) => (
  <div className={`flex items-start justify-between gap-4 mb-5 ${className}`}>
    <div>
      <h3 className="text-base sm:text-lg font-semibold text-slate-900">{title}</h3>
      {subtitle && (
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      )}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
);

export default Card;