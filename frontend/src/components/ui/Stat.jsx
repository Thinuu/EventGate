import React from 'react';

const Stat = ({ label, value, sub, color = 'blue', icon }) => {
  const colors = { blue: 'text-teal-600 bg-teal-50', green: 'text-green-600 bg-green-50', purple: 'text-purple-600 bg-purple-50', orange: 'text-orange-600 bg-orange-50', red: 'text-red-600 bg-red-50' };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {icon && <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>{icon}</div>}
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
};
export default Stat;
