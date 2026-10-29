import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { formatTimezoneDisplay } from '../../utils/timezone';

const EventCard = ({ event }) => {
  const timezoneDisplay = formatTimezoneDisplay(event.timezone);
  
  const formatDate = (date) => {
    if (!date) return '';
    const formatted = new Date(date).toLocaleDateString('en-US', {
      timeZone: event.timezone || 'Asia/Colombo',
    });
    return `${formatted} (${timezoneDisplay})`;
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-widest text-slate-400">Upcoming Event</p>
      <h3 className="text-lg font-bold text-slate-900">{event.name}</h3>
      <p className="text-sm text-slate-500">{event.venue?.name}</p>
      <p className="text-xs text-slate-400 mt-1">{formatDate(event.startDate)}</p>
      <Link to="/events" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors">
        Browse Tickets <ChevronRightIcon className="h-3 w-3" />
      </Link>
    </div>
  );
};

export default EventCard;
