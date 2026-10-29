import React from 'react';
import { formatDistanceToNow } from 'date-fns';

const ActivityItem = ({ item }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <p className="text-sm font-semibold text-slate-900">{item.message}</p>
    <p className="text-xs text-slate-400 mt-1">
      {item.time ? formatDistanceToNow(new Date(item.time), { addSuffix: true }) : 'Just now'}
    </p>
  </div>
);

export default ActivityItem;
