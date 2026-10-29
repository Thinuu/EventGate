import React from 'react';

const Input = React.forwardRef(({ label, error, hint, className = '', ...props }, ref) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
    <input
      ref={ref}
      className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'} ${className}`}
      {...props}
    />
    {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    {error && <p className="text-xs text-red-600">{error}</p>}
  </div>
));
Input.displayName = 'Input';
export default Input;
