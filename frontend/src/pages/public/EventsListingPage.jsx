import React, { useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import PublicLayout from '../../components/layout/PublicLayout';
import { getEvents } from '../../api/events';
import { io } from '../../utils/realtime';
import { getSocketUrl } from '../../utils/backend';
import PublicEventCard from '../../components/events/PublicEventCard';

const EventsListingPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    date: '',
    category: '',
  });
  const [availableCategories, setAvailableCategories] = useState([]);

  const fetchEvents = () => {
    setLoading(true);
    getEvents({
      limit: 50,
      search: filters.search || undefined,
      date: filters.date || undefined,
      category: filters.category || undefined,
    })
      .then((res) => {
        const fetched = res.data?.data?.events || [];
        setEvents(fetched);

        if (filters.category === '' && filters.search === '' && filters.date === '') {
          const types = [
            ...new Set(
              fetched
                .map((e) =>
                  e.eventType === 'other' && e.customEventType
                    ? e.customEventType
                    : e.eventType
                )
                .filter(Boolean)
            ),
          ];
          setAvailableCategories(
            types.length > 0 ? types : ['Cricket Match', 'Tournament', 'VIP Event']
          );
        }
      })
      .catch((err) => {
        console.error('FETCH_EVENTS_ERROR:', err);
        setEvents([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchEvents();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  useEffect(() => {
    const socket = io(getSocketUrl());
    socket.emit('join_listings');

    const handleUpdate = () => {
      fetchEvents();
    };

    socket.on('event_update', handleUpdate);
    socket.on('events_updated', handleUpdate);

    return () => {
      socket.emit('leave_listings');
      socket.disconnect();
    };
  }, []);

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ search: '', date: '', category: '' });
  };

  return (
    <PublicLayout>
      {/* Header */}
      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-teal-400 mb-3">
              Official Calendar
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
              Match Fixtures
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
              Browse upcoming matches. Filter by date or type to find your perfect experience.
            </p>
          </div>
        </div>
      </section>

      {/* Filters + Listing */}
      <section className="bg-slate-50 min-h-screen pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Filter Bar */}
          <div className="-mt-7 rounded-[28px] border border-slate-200 bg-white p-4 sm:p-5 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search events, teams, or venues..."
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                />
              </div>

              {/* Date */}
              <div className="lg:w-48">
                <input
                  type="date"
                  value={filters.date}
                  onChange={(e) => updateFilter('date', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                />
              </div>

              {/* Category */}
              <div className="lg:w-48">
                <select
                  value={filters.category}
                  onChange={(e) => updateFilter('category', e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 px-4 text-sm font-medium text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 appearance-none"
                >
                  <option value="">All Types</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear */}
              {(filters.search || filters.date || filters.category) && (
                <button
                  onClick={clearFilters}
                  className="rounded-2xl bg-slate-100 hover:bg-slate-200 px-5 py-3.5 text-sm font-semibold text-slate-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Results count */}
          <div className="mt-10 mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {loading
                ? 'Searching...'
                : `${events.length} Event${events.length !== 1 ? 's' : ''} Found`}
            </h2>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-80 rounded-[28px] border border-slate-200 bg-white animate-pulse"
                />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white py-20 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 mb-5">
                <MagnifyingGlassIcon className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-lg font-semibold text-slate-900">
                No events matched your search.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Try adjusting your filters or date range.
              </p>
              <button
                onClick={clearFilters}
                className="mt-6 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <PublicEventCard key={event._id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
};

export default EventsListingPage;