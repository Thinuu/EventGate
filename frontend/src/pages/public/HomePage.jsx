import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDaysIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import PublicLayout from '../../components/layout/PublicLayout';
import { getEvents } from '../../api/events';
import PublicEventCard from '../../components/events/PublicEventCard';

const HomePage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents({ limit: 3 })
      .then((res) => {
        setEvents(res.data?.data?.events || []);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PublicLayout>
      {/* Hero Section */}
      <div className="relative min-h-[80vh] flex items-center overflow-hidden bg-slate-950 text-white">
        {/* Subtle ambient lighting */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-600/10 rounded-full blur-[140px]" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-slate-700/20 rounded-full blur-[120px]" />
        </div>

        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[11px] font-medium tracking-wide text-slate-300 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
            Next-Gen Event Experience
          </div>

          {/* Main Heading – clean & realistic */}
          <h1 className="mt-8 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.15]">
            Live the Moment
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base sm:text-lg text-slate-400 leading-relaxed">
            EventGate secures your seats for exclusive events — from stadium matches
            to premium conferences. We handle the access.
          </p>

          <div className="mt-10 flex justify-center">
            <Link
              to="/events"
              className="group inline-flex items-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98]"
            >
              Secure Tickets
              <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Featured Events */}
      <div
        id="events"
        className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-6 py-16 sm:py-20 md:py-24"
      >
        {/* Section Header */}
        <div className="flex flex-col items-center text-center mb-12 sm:mb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-teal-600 mb-3">
            Discovery
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Featured Experiences
          </h2>
          <div className="mt-5 h-1 w-16 rounded-full bg-teal-600" />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-[400px] rounded-[28px] border border-slate-200 bg-white animate-pulse"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center rounded-[28px] border border-dashed border-slate-200 bg-white">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 text-slate-300">
              <CalendarDaysIcon className="h-8 w-8" />
            </div>
            <p className="mt-5 text-lg font-semibold text-slate-900">Stay Tuned</p>
            <p className="mt-1.5 text-sm text-slate-500">
              New experiences are being curated as we speak.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <PublicEventCard key={event._id} event={event} />
            ))}
          </div>
        )}

        {events.length > 0 && (
          <div className="mt-14 text-center">
            <Link
              to="/events"
              className="group inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:border-teal-200 hover:bg-slate-50 transition-all"
            >
              Explore all events
              <ChevronRightIcon className="h-4 w-4 text-teal-600 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

export default HomePage;