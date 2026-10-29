import React from 'react';
import { Link } from 'react-router-dom';
import { formatTimezoneDisplay } from '../../utils/timezone';
import { CalendarDaysIcon, MapPinIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getAssetUrl } from '../../utils/backend';

const PublicEventCard = ({ event }) => {
  if (!event) return null;

  const categories = event.categories || [];
  const prices = categories.map((c) => Number(c.price) || 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const hasFree = prices.some((p) => p === 0);
  const timezoneDisplay = formatTimezoneDisplay(event.timezone);
  const isSoldOut =
    categories.length > 0 && categories.every((c) => (c.sold || 0) >= (c.capacity || 0));

  const eventImage =
    event.branding?.bannerImage || event.coverImage || event.bannerImage || null;

  const logoImage = event.branding?.logoImage || null;

  const eventTypeLabel =
    event.eventType === 'other' && event.customEventType
      ? event.customEventType
      : event.eventType || 'Experience';

  const currency = event.settings?.currency || event.currency || 'LKR';

  // Safer date formatting
  const formatEventDate = () => {
    if (!event.startDate) return 'Date to be announced';

    try {
      const options = {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: event.timezone || 'Asia/Colombo',
      };

      const formatted = new Date(event.startDate).toLocaleDateString('en-US', options);
      return `${formatted} (${timezoneDisplay})`;
    } catch {
      return new Date(event.startDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: event.timezone || 'Asia/Colombo',
      });
    }
  };

  return (
    <Link
      to={`/events/${event.slug || event._id}`}
      className="group flex h-full flex-col overflow-hidden rounded-[40px] border border-slate-100 bg-white transition-all duration-500 hover:border-brand-main/30 hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.12)]"
    >
      {/* Image Section */}
      <div className="relative aspect-[16/11] overflow-hidden bg-slate-50">
        {eventImage ? (
          <img
            src={getAssetUrl(eventImage)}
            alt={event.name || 'Event'}
            className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-900 text-6xl font-black uppercase text-slate-700">
            {(event.name || 'EV').substring(0, 2)}
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-60 transition-opacity group-hover:opacity-80" />

        {/* Event Type Badge */}
        <div className="absolute left-6 top-6">
          <span className="rounded-full border border-white/20 bg-white/10 px-5 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-white backdrop-blur-md">
            {eventTypeLabel}
          </span>
        </div>

        {/* Sold Out Badge */}
        {isSoldOut && (
          <div className="absolute right-6 top-6">
            <span className="rounded-full bg-rose-500 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-rose-500/30">
              Sold Out
            </span>
          </div>
        )}

        {/* Bottom overlay: Logo + Price */}
        <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
          {logoImage ? (
            <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white p-2.5 shadow-2xl transition-transform duration-500 group-hover:-translate-y-2">
              <img
                src={getAssetUrl(logoImage)}
                alt={`${event.name} logo`}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="w-16" />
          )}

          <div className="text-right">
            <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.3em] text-white/60">
              Admission from
            </span>
            <span className="block text-2xl font-black tracking-tighter text-white">
              {minPrice > 0
                ? `${currency} ${minPrice.toLocaleString()}`
                : hasFree
                  ? 'FREE'
                  : 'TBD'}
            </span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex flex-1 flex-col p-8">
        <h3 className="line-clamp-2 min-h-[4.5rem] text-2xl font-black leading-[1.1] text-slate-900 transition-colors group-hover:text-brand-main md:text-3xl">
          {event.name || 'Untitled Event'}
        </h3>

        <div className="mt-8 flex flex-col gap-4">
          {/* Date */}
          <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-brand-main transition-colors group-hover:border-brand-main/20 group-hover:bg-brand-main/5">
              <CalendarDaysIcon className="h-5 w-5" />
            </div>
            <span className="text-slate-600">{formatEventDate()}</span>
          </div>

          {/* Venue */}
          <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-brand-main transition-colors group-hover:border-brand-main/20 group-hover:bg-brand-main/5">
              <MapPinIcon className="h-5 w-5" />
            </div>
            <span className="line-clamp-1 text-slate-600">
              {event.venue?.name || 'Venue to be confirmed'}
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 border-t border-slate-50 pt-8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 transition-colors group-hover:text-brand-main">
              Secure Tickets
            </span>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white transition-all duration-500 group-hover:scale-110 group-hover:bg-brand-main group-hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <ChevronRightIcon className="h-5 w-5 transition-transform duration-500 group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default PublicEventCard;