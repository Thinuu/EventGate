import React from 'react';

export const Table = ({ children, className = '', wrapperClassName = '' }) => (
  <div className={`overflow-x-auto ${wrapperClassName}`}>
    <table className={`min-w-full divide-y divide-slate-100 ${className}`}>
      {children}
    </table>
  </div>
);

export const Th = ({ children, className = '' }) => (
  <th
    className={`bg-slate-50/80 px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${className}`}
  >
    {children}
  </th>
);

export const Td = ({ children, className = '' }) => (
  <td className={`px-5 py-4 text-sm text-slate-600 ${className}`}>
    {children}
  </td>
);

export const Tr = ({ children, className = '', onClick }) => (
  <tr
    className={`border-b border-slate-50 transition-colors last:border-0 ${
      onClick ? 'cursor-pointer hover:bg-slate-50/80' : ''
    } ${className}`}
    onClick={onClick}
  >
    {children}
  </tr>
);