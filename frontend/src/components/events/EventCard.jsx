import React from 'react';
import { formatTimezoneDisplay } from '../../utils/timezone';

const EventCard = ({ event, onViewDetails }) => {
  const eventImage =
    event.coverImage ||
    event.bannerImage ||
    event.branding?.bannerImage ||
    '/placeholder-event.jpg';

  const startingPrice =
    event.categories?.length > 0
      ? Math.min(...event.categories.map((cat) => Number(cat.price) || 0))
      : null;

  const currency = event.settings?.currency || 'LKR';
  const timezoneDisplay = formatTimezoneDisplay(event.timezone);

  const formatDate = (date) => {
    if (!date) return 'Date TBA';
    const formatted = new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: event.timezone || 'Asia/Colombo',
    });
    return `${formatted} (${timezoneDisplay})`;
  };

  const handleClick = () => {
    onViewDetails?.(event.slug || event._id);
  };

  return (
    <div className="group overflow-hidden rounded-xl bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      {/* Image */}
      <div className="relative h-48 overflow-hidden bg-slate-100">
        <img
          src={eventImage}
          alt={event.name || 'Event'}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.src = '/placeholder-event.jpg';
          }}
        />

        {/* Optional badge (e.g. status) */}
        {event.status && (
          <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {event.status}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col p-5">
        <h3 className="line-clamp-2 text-lg font-semibold text-slate-900">
          {event.name || 'Untitled Event'}
        </h3>

        <div className="mt-3 space-y-1.5 text-sm text-slate-600">
          <p className="flex items-center gap-1.5">
            <CalendarIcon />
            {formatDate(event.startDate)}
          </p>

          {event.venue?.name && (
            <p className="flex items-center gap-1.5">
              <MapPinIcon />
              <span className="line-clamp-1">{event.venue.name}</span>
            </p>
          )}

          <p className="flex items-center gap-1.5 font-medium text-slate-800">
            <TicketIcon />
            {startingPrice !== null
              ? `From ${currency} ${startingPrice.toLocaleString()}`
              : 'Price TBA'}
          </p>
        </div>

        {/* Button */}
        <button
          onClick={handleClick}
          className="mt-5 w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        >
          View Details
        </button>
      </div>
    </div>
  );
};

/* Simple inline icons (you can replace with Heroicons if preferred) */
const CalendarIcon = () => (
  <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const MapPinIcon = () => (
  <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const TicketIcon = () => (
  <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
  </svg>
);

export default EventCard;