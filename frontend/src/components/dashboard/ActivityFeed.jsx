import React from 'react';
import { formatDistanceToNow } from 'date-fns';

const ActivityFeed = ({ items = [] }) => (
  <div className="rounded-2xl bg-white p-6 shadow-sm">
    <div className="mb-5 text-left">
      <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
      <p className="mt-1 text-sm text-gray-500">Latest entry and zone actions.</p>
    </div>
    {items.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
        No data available
      </div>
    ) : (
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-gray-100 px-4 py-3">
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
              <p className="mt-1 text-sm text-gray-500">{item.action}</p>
            </div>
            <span className="shrink-0 text-xs text-gray-400">
              {item.timestamp ? formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }) : '-'}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ActivityFeed;
