import React from 'react';
import { formatTimezoneDisplay } from '../../utils/timezone';

const EventHeader = ({ event }) => {
  const eventImage = event.coverImage || event.bannerImage || event.branding?.bannerImage || '/placeholder-event.jpg';
  const timezoneDisplay = formatTimezoneDisplay(event.timezone);

  const formatDate = (date) => {
    const formatted = new Date(date).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: event.timezone || 'Asia/Colombo',
    });
    return `${formatted} (${timezoneDisplay})`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <img
        src={eventImage}
        alt={event.name}
        className="w-full h-64 object-cover"
      />
      <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{event.name}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Date & Time</h3>
            <p className="text-lg text-gray-900">{formatDate(event.startDate)}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Venue</h3>
            <p className="text-lg text-gray-900">{event.venue?.name}</p>
            {event.venue?.address && (
              <p className="text-sm text-gray-600">{event.venue.address}</p>
            )}
          </div>
        </div>
        {event.description && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">About This Event</h3>
            <p className="text-gray-700 leading-relaxed">{event.description}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventHeader;
