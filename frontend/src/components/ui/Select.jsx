import React from 'react';

const Select = React.forwardRef(
  ({ label, error, options = [], placeholder, className = '', ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={`block w-full rounded-2xl border bg-slate-50/50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 appearance-none ${
          error ? 'border-red-300 focus:border-red-400 focus:ring-red-500/10' : 'border-slate-200'
        } ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
);

Select.displayName = 'Select';
export default Select;