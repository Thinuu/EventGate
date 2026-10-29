import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  LockClosedIcon,
  LockOpenIcon,
} from '@heroicons/react/24/outline';
import PublicLayout from '../../components/layout/PublicLayout';
import { getEvent, validateEventAccessCode } from '../../api/events';
import { io } from '../../utils/realtime';
import { getSocketUrl, getAssetUrl } from '../../utils/backend';
import { formatTimezoneDisplay } from '../../utils/timezone';

const getCategoryId = (category) => category?.id || category?._id || category?.name;
const getZoneId = (zone) => zone?.id || zone?._id || zone?.name;

const resolveEventDetailKind = (eventType = '', customEventType = '') => {
  const raw = `${eventType || ''} ${customEventType || ''}`.toLowerCase().trim();
  // Sports / Match
  if (
    /cricket|match|sports?|football|soccer|rugby|tennis|hockey|basketball|game|tournament|league|fixture/.test(
      raw
    )
  ) {
    return 'match';
  }
  // Concert / Music
  if (
    /concert|music|musical|show|live|festival|gig|band|artist|performance|dj|singer|orchestra/.test(
      raw
    )
  ) {
    return 'concert';
  }
  // Workshop
  if (/workshop|class|course|training|bootcamp/.test(raw)) {
    return 'workshop';
  }
  // Conference / Business
  if (
    /conference|summit|seminar|meetup|talks?|expo|forum|convention|webinar|symposium/.test(
      raw
    )
  ) {
    return 'conference';
  }
  return null;
};

const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState({});
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [unlockedCategories, setUnlockedCategories] = useState([]);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [accessCode, setAccessCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [codeError, setCodeError] = useState('');

  const fetchEvent = () => {
    getEvent(id)
      .then((res) => {
        const fetchedEvent = res.data?.data?.event || res.data?.event;
        console.log('FETCHED EVENT:', fetchedEvent);
        setEvent(fetchedEvent);
        setIsExpired(res.data?.data?.isExpired || false);
      })
      .catch((err) => {
        console.error('FETCH_EVENT_ERROR:', err);
        setEvent(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // No debug logging needed
  }, [event]);

  useEffect(() => {
    fetchEvent();
  }, [id]);

  useEffect(() => {
    if (!event?._id) return undefined;
    const socket = io(getSocketUrl(), {
      path: '/socket.io',
      transports: ['websocket'],
    });
    const eventId = event._id.toString();
    socket.emit('join_event', { eventId });
    socket.on('event_update', () => fetchEvent());
    return () => {
      socket.emit('leave_event', { eventId });
      socket.disconnect();
    };
  }, [event?._id]);

  const handleQuantityChange = (categoryId, quantity) => {
    setSelectedTickets((prev) => ({
      ...prev,
      [categoryId]: Math.max(0, quantity),
    }));
  };

  const handleValidateCode = async (e) => {
    e.preventDefault();
    if (!accessCode.trim()) return;
    setIsValidating(true);
    setCodeError('');
    try {
      const response = await validateEventAccessCode(event.slug || event._id, {
        categoryId: activeCategoryId,
        accessCode: accessCode.trim(),
      });
      const data = response.data;
      if (data.success) {
        setUnlockedCategories((prev) => [...prev, activeCategoryId]);
        setIsCodeModalOpen(false);
        setAccessCode('');
      } else {
        setCodeError(data.message || 'Invalid access code.');
      }
    } catch (err) {
      setCodeError(
        err.response?.data?.message || 'Failed to validate code. Please try again.'
      );
    } finally {
      setIsValidating(false);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-teal-600 border-t-transparent" />
        </div>
      </PublicLayout>
    );
  }

  if (!event) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-teal-600">
            Event unavailable
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            We could not find that event
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-slate-500">
            The event may have been removed, sold out, or the URL might be incorrect.
          </p>
          <div className="mt-8">
            <Link
              to="/events"
              className="inline-flex rounded-2xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition hover:bg-teal-700"
            >
              Back to fixtures
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const allZones = event.zones || [];
  const categories = (event.categories || []).filter((c) => c.isVisible !== false);
  const totalTickets = Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0);
  const totalPrice = categories.reduce((sum, category) => {
    return sum + Number(category.price || 0) * (selectedTickets[getCategoryId(category)] || 0);
  }, 0);
  const selectedCategories = categories.filter(
    (category) => selectedTickets[getCategoryId(category)] > 0
  );
  const heroImage =
    event.branding?.bannerImage || event.coverImage || event.bannerImage;

  const detailKind = resolveEventDetailKind(event.eventType, event.customEventType);

  const match = event.match || {};
  const concert = event.concert || {};
  const conference = event.conference || {};
  const workshop = event.workshop || {};

  const timezoneDisplay = formatTimezoneDisplay(event.timezone);

  // Helper to determine if an object contains any meaningful value
  const hasValues = (obj) =>
    obj &&
    Object.values(obj).some((v) => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v.trim().length > 0;
      return v !== undefined && v !== null && v !== '';
    });




  const formatCurrency = (value) =>
    value === 0
      ? 'Free'
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: event.settings?.currency || event.currency || 'LKR',
          maximumFractionDigits: 0,
        }).format(value);

  let eventDate = 'TBD';
  try {
    if (event.startDate) {
      const options = {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: event.timezone || 'Asia/Colombo',
      };
      eventDate = new Date(event.startDate).toLocaleDateString('en-US', options);
    }
  } catch {
    eventDate = event.startDate
      ? new Date(event.startDate).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: event.timezone || 'Asia/Colombo',
        })
      : 'TBD';
  }

  let eventTime = 'TBD';
  try {
    if (event.startDate) {
      const options = { hour: '2-digit', minute: '2-digit', timeZone: event.timezone || 'Asia/Colombo' };
      eventTime = new Date(event.startDate).toLocaleTimeString('en-US', options);
    }
  } catch {
    eventTime = event.startDate
      ? new Date(event.startDate).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: event.timezone || 'Asia/Colombo',
        })
      : 'TBD';
  }

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        {heroImage && (
          <img
            src={getAssetUrl(heroImage)}
            alt={event.name}
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950" />

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div
            className={`grid grid-cols-1 gap-10 ${
              isExpired ? '' : 'lg:grid-cols-[1fr_320px] lg:items-end'
            }`}
          >
            <div>
              <Link
                to="/events"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to listings
              </Link>

              <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center">
                {event.branding?.logoImage && (
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg">
                    <img
                      src={getAssetUrl(event.branding.logoImage)}
                      alt="logo"
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {event.name}
                </h1>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-semibold text-white">
                  {event.eventType === 'other' && event.customEventType
                    ? event.customEventType
                    : event.eventType || 'Event'}
                </span>
                {isExpired ? (
                  <span className="rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-400">
                    Expired
                  </span>
                ) : (
                  <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
                    Tickets Available
                  </span>
                )}
              </div>

              {event.description && (
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300">
                  {event.description}
                </p>
              )}

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="mb-1.5 flex items-center gap-2 text-teal-400">
                    <CalendarDaysIcon className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Date</span>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {eventDate}{' '}
                    <span className="text-xs text-slate-300">
                      ({timezoneDisplay})
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="mb-1.5 flex items-center gap-2 text-teal-400">
                    <ClockIcon className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Time</span>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {eventTime}{' '}
                    <span className="text-xs text-slate-400">
                      ({timezoneDisplay})
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="mb-1.5 flex items-center gap-2 text-teal-400">
                    <MapPinIcon className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Venue</span>
                  </div>
                  <p className="line-clamp-1 text-sm font-medium text-white">
                    {event.venue?.name || 'TBD'}
                  </p>
                  {(event.venue?.city || event.venue?.country) && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {[event.venue?.city, event.venue?.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {event.venue?.mapUrl && (
                    <a
                      href={event.venue.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-teal-400 hover:underline"
                    >
                      View on map
                    </a>
                  )}
                </div>
              </div>
            </div>

            {!isExpired && (
              <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 backdrop-blur-md sm:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-400">
                  Official Tickets
                </p>
                <h2 className="mt-3 text-xl font-semibold leading-snug text-white sm:text-2xl">
                  Secure your access today
                </h2>
                <p className="mt-3 text-sm text-slate-400">
                  Select your preferred ticket category to view pricing and confirm your
                  reservation.
                </p>
                <button
                  type="button"
                  onClick={() => setIsTicketModalOpen(true)}
                  className="mt-6 w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/40 transition hover:bg-teal-500 active:scale-[0.98]"
                >
                  Choose Tickets
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="min-h-screen bg-slate-50 pb-20 pt-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 xl:grid-cols-[1fr_340px]">
            <div className="space-y-10">
              {/* Match details */}
              {detailKind === 'match' && (match?.teamA?.name || match?.teamB?.name || match?.matchType || match?.tournament) && (
                <div className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm sm:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">
                    Match Details
                  </p>
                  
                  {/* VS Banner Layout */}
                  <div className="mt-4 mb-6 rounded-xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-5 text-center text-white shadow-sm">
                    <div className="flex flex-col items-center justify-around gap-4 sm:flex-row">
                      {/* Team A */}
                      <div className="flex-1">
                        <p className="text-lg font-bold text-white sm:text-xl">
                          {match?.teamA?.name || 'TBA'}
                        </p>
                        {match?.teamA?.shortName && (
                          <span className="mt-1 inline-block rounded bg-teal-600/30 px-2 py-0.5 text-xs font-semibold text-teal-400">
                            {match.teamA.shortName}
                          </span>
                        )}
                      </div>

                      {/* VS Divider */}
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white ring-2 ring-slate-900 shadow-sm">
                        VS
                      </div>

                      {/* Team B */}
                      <div className="flex-1">
                        <p className="text-lg font-bold text-white sm:text-xl">
                          {match?.teamB?.name || 'TBA'}
                        </p>
                        {match?.teamB?.shortName && (
                          <span className="mt-1 inline-block rounded bg-teal-600/30 px-2 py-0.5 text-xs font-semibold text-teal-400">
                            {match.teamB.shortName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Metadata Fields (Shown only if present) */}
                  <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4">
                    {[
                      { label: 'Match Type', value: match?.matchType },
                      { label: 'Series / Tournament', value: match?.tournament },
                      { label: 'Match Number', value: match?.matchNumber },
                    ]
                      .filter((item) => item.value)
                      .map((item) => (
                        <div key={item.label}>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {item.label}
                          </p>
                          <p className="text-base font-semibold text-slate-900">{item.value}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Concert / musical */}
              {detailKind === 'concert' && (concert?.artistOrPerformer || concert?.mainArtist || concert?.supportingArtist || concert?.supportingBands || concert?.genre || concert?.performanceType || concert?.ageRestriction) && (
                <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm sm:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600">
                    Concert Details
                  </p>
                  
                  {(concert?.artistOrPerformer || concert?.mainArtist) && (
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {concert.artistOrPerformer || concert.mainArtist}
                    </h2>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4">
                    {[
                      { label: 'Artist / Performer', value: concert?.artistOrPerformer || concert?.mainArtist },
                      { label: 'Supporting Artist', value: concert?.supportingArtist || (Array.isArray(concert?.supportingBands) ? concert.supportingBands.join(', ') : concert?.supportingBands) },
                      { label: 'Genre', value: concert?.genre },
                      { label: 'Performance Type', value: concert?.performanceType },
                      { label: 'Age Restriction', value: concert?.ageRestriction },
                    ]
                      .filter((item) => item.value)
                      .map((item) => (
                        <div key={item.label}>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {item.label}
                          </p>
                          <p className="text-base font-semibold text-slate-900">{item.value}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Conference */}
              {detailKind === 'conference' && (conference?.conferenceName || conference?.theme || conference?.speakers || conference?.keynoteSpeaker || conference?.sessionType || conference?.organizerName || conference?.registrationInfo) && (
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                    Conference Details
                  </p>
                  
                  {(conference?.conferenceName || conference?.theme) && (
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {conference.conferenceName || conference.theme}
                    </h2>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4">
                    {[
                      { label: 'Conference Name', value: conference?.conferenceName || conference?.theme },
                      { label: 'Speaker(s)', value: Array.isArray(conference?.speakers) ? conference.speakers.join(', ') : conference?.speakers },
                      { label: 'Keynote Speaker', value: conference?.keynoteSpeaker },
                      { label: 'Session Type', value: conference?.sessionType },
                      { label: 'Organizer', value: conference?.organizerName },
                      { label: 'Registration Info', value: conference?.registrationInfo || conference?.scheduleUrl },
                    ]
                      .filter((item) => item.value)
                      .map((item) => (
                        <div key={item.label}>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {item.label}
                          </p>
                          <p className="text-base font-semibold text-slate-900">{item.value}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Workshop */}
              {detailKind === 'workshop' && (workshop?.instructor || workshop?.topic || workshop?.duration || workshop?.skillLevel || workshop?.materialsRequired) && (
                <div className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm sm:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                    Workshop Details
                  </p>
                  
                  {workshop?.topic && (
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {workshop.topic}
                    </h2>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4">
                    {[
                      { label: 'Instructor', value: workshop?.instructor },
                      { label: 'Workshop Topic', value: workshop?.topic },
                      { label: 'Duration', value: workshop?.duration },
                      { label: 'Skill Level', value: workshop?.skillLevel },
                      { label: 'Materials Required', value: workshop?.materialsRequired },
                    ]
                      .filter((item) => item.value)
                      .map((item) => (
                        <div key={item.label}>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {item.label}
                          </p>
                          <p className="text-base font-semibold text-slate-900">{item.value}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Ticket Categories — unchanged from your version */}
              {!isExpired && (
                <>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                      Ticket Categories
                    </h2>
                    <div className="mt-2 h-1 w-12 rounded-full bg-teal-600" />
                    <p className="mt-3 max-w-2xl text-sm text-slate-500">
                      Review packages below to see pricing and the zones they grant access to.
                    </p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    {categories.map((category) => {
                      const categoryId = getCategoryId(category);
                      const remaining = category.capacity - (category.sold || 0);
                      return (
                        <article
                          key={categoryId}
                          className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                        >
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Category
                          </p>
                          <h3 className="mb-2 text-xl font-semibold text-slate-900">
                            {category.name}
                          </h3>
                          <p className="mb-5 text-2xl font-bold text-teal-600">
                            {formatCurrency(category.price)}
                          </p>
                          <div className="border-t border-slate-100 pt-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                                <CheckCircleIcon className="h-4 w-4 text-teal-600" />
                                Included Zones
                              </h4>
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                  remaining <= 0
                                    ? 'bg-red-50 text-red-600'
                                    : remaining < 50
                                    ? 'bg-amber-50 text-amber-600'
                                    : 'bg-emerald-50 text-emerald-600'
                                }`}
                              >
                                {remaining <= 0 ? 'Sold Out' : `${remaining} left`}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {category.allowedZones?.length > 0 ? (
                                category.allowedZones.map((zoneId) => {
                                  const matched = allZones.find((z) => getZoneId(z) === zoneId);
                                  return (
                                    <span
                                      key={zoneId}
                                      className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                                    >
                                      {matched ? matched.name : zoneId}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-sm italic text-slate-400">
                                  Standard Admission
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {allZones.length > 0 && categories.length > 0 && (
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                        Access Matrix
                      </h2>
                      <div className="mb-5 mt-2 h-1 w-12 rounded-full bg-teal-600" />
                      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-900">
                              <tr>
                                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-300">
                                  Stadium Zone
                                </th>
                                {categories.map((category) => (
                                  <th
                                    key={getCategoryId(category)}
                                    className="px-5 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-300"
                                  >
                                    {category.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {allZones.map((zone) => (
                                <tr key={getZoneId(zone)} className="hover:bg-slate-50/80">
                                  <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-900">
                                    {zone.name}
                                  </td>
                                  {categories.map((category) => {
                                    const zoneId = getZoneId(zone);
                                    const categoryId = getCategoryId(category);
                                    const hasAccess = category.allowedZones?.includes(zoneId);
                                    return (
                                      <td
                                        key={`${zoneId}-${categoryId}`}
                                        className="px-5 py-4 text-center"
                                      >
                                        {hasAccess ? (
                                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                                            <CheckCircleIcon className="h-4 w-4" />
                                          </span>
                                        ) : (
                                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-400">
                                            —
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Sponsors — same as your code */}
              {(event.sponsorPackages || []).filter((p) => p.isVisible).length > 0 && (
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Sponsor Packages
                  </h2>
                  <div className="mb-3 mt-2 h-1 w-12 rounded-full bg-amber-500" />
                  <p className="mb-6 max-w-2xl text-sm text-slate-500">
                    Join us as a partner. These packages offer exclusive benefits and high-impact
                    brand visibility.
                  </p>
                  <div className="grid gap-5 md:grid-cols-2">
                    {event.sponsorPackages
                      .filter((p) => p.isVisible)
                      .map((pkg) => (
                        <article
                          key={pkg.id || pkg._id}
                          className="rounded-[28px] border border-amber-100 bg-white p-6 shadow-sm"
                        >
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                            Sponsorship
                          </p>
                          <h3 className="mb-4 text-xl font-semibold text-slate-900">
                            {pkg.name}
                          </h3>
                          {pkg.benefits?.length > 0 && (
                            <ul className="mb-6 space-y-2">
                              {pkg.benefits.map((benefit, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 text-sm text-slate-600"
                                >
                                  <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                                  <span>{benefit}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="border-t border-slate-100 pt-5">
                            <p className="mb-3 text-xs font-medium text-slate-400">
                              To purchase this package
                            </p>
                            <a
                              href={`tel:${pkg.contactNumber || event.organiser?.phone}`}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-amber-600"
                            >
                              Contact Organizer
                            </a>
                            {pkg.contactNumber && (
                              <p className="mt-2 text-center text-sm font-medium text-slate-700">
                                {pkg.contactNumber}
                              </p>
                            )}
                          </div>
                        </article>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside>
              <div className="sticky top-24 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-600">
                  Event Snapshot
                </p>
                <h2 className="mb-5 text-lg font-semibold leading-snug text-slate-900">
                  {event.name}
                </h2>
                <div className="mb-6 space-y-4 text-sm text-slate-600">
                  <div className="flex items-start gap-3">
                    <CalendarDaysIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-600" />
                    <span>
                      {eventDate}{' '}
                      <span className="text-xs text-slate-400">
                        ({timezoneDisplay})
                      </span>
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <ClockIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-600" />
                    <span>
                      {eventTime}{' '}
                      <span className="text-xs text-slate-400">
                        ({timezoneDisplay})
                      </span>
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPinIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-600" />
                    <div>
                      <span className="block">{event.venue?.name || 'TBD'}</span>
                      {event.venue?.mapUrl && (
                        <a
                          href={event.venue.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:underline"
                        >
                          View on Map <ChevronRightIcon className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                {!isExpired && (
                  <button
                    type="button"
                    onClick={() => setIsTicketModalOpen(true)}
                    className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Buy Tickets
                  </button>
                )}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Ticket modal + access code modal — same as your original */}
      {isTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-slate-50 shadow-2xl sm:max-w-5xl sm:rounded-[28px]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-teal-600">
                  Ticket Selection
                </p>
                <h2 className="text-lg font-semibold text-slate-900">{event.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsTicketModalOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
              <div className="flex-1 space-y-3 overflow-y-auto p-5 sm:p-6">
                {categories.map((category) => {
                  const categoryId = getCategoryId(category);
                  const remaining = Math.max(0, category.capacity - (category.sold || 0));
                  const maxSelectable = Math.min(10, remaining);
                  const selected = selectedTickets[categoryId] || 0;
                  const isLocked =
                    category.isPrivate && !unlockedCategories.includes(categoryId);

                  return (
                    <div
                      key={categoryId}
                      className={`flex flex-col gap-4 rounded-2xl border p-4 transition sm:flex-row sm:items-center sm:justify-between sm:p-5 ${
                        isLocked
                          ? 'border-slate-200 bg-slate-50/70'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={`text-base font-semibold ${
                              isLocked ? 'text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {category.name}
                          </h3>
                          {category.isPrivate && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                isLocked
                                  ? 'bg-slate-200 text-slate-500'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {isLocked ? (
                                <LockClosedIcon className="h-3 w-3" />
                              ) : (
                                <LockOpenIcon className="h-3 w-3" />
                              )}
                              {isLocked ? 'Private' : 'Unlocked'}
                            </span>
                          )}
                        </div>
                        <p
                          className={`mt-1 text-xl font-bold ${
                            isLocked ? 'text-slate-300' : 'text-teal-600'
                          }`}
                        >
                          {formatCurrency(category.price)}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-slate-400">
                          Availability: {remaining} / {category.capacity}
                        </p>
                      </div>
                      <div>
                        {isLocked ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCategoryId(categoryId);
                              setIsCodeModalOpen(true);
                            }}
                            className="w-full rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
                          >
                            Enter Code
                          </button>
                        ) : remaining <= 0 ? (
                          <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-2.5 text-center">
                            <span className="text-sm font-semibold text-red-600">Sold Out</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(categoryId, selected - 1)}
                              disabled={selected === 0}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-semibold text-slate-800 hover:border-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              −
                            </button>
                            <div className="w-8 text-center text-lg font-semibold text-slate-900">
                              {selected}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuantityChange(
                                  categoryId,
                                  Math.min(selected + 1, maxSelectable)
                                )
                              }
                              disabled={selected >= maxSelectable}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-semibold text-slate-800 hover:border-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col justify-between border-t border-slate-200 bg-white p-5 sm:p-6 lg:w-80 lg:border-l lg:border-t-0">
                <div>
                  <h3 className="mb-4 text-base font-semibold text-slate-900">Order Summary</h3>
                  {selectedCategories.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                      <p className="text-sm text-slate-500">No tickets selected yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedCategories.map((category) => (
                        <div
                          key={getCategoryId(category)}
                          className="flex items-start justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {category.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {selectedTickets[getCategoryId(category)]} ×{' '}
                              {formatCurrency(category.price)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              selectedTickets[getCategoryId(category)] * category.price
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 hidden border-t border-slate-100 pt-5 lg:block">
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                    <span>Total Tickets</span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-900">
                      {totalTickets}
                    </span>
                  </div>
                  <div className="mb-5 flex items-end justify-between">
                    <span className="text-base font-semibold text-slate-900">Total</span>
                    <span className="text-2xl font-bold text-teal-600">
                      {formatCurrency(totalPrice)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={totalTickets === 0}
                    onClick={() => {
                      setIsTicketModalOpen(false);
                      navigate('/checkout', {
                        state: {
                          selectedTickets,
                          eventId: event._id || event.id,
                          event,
                        },
                      });
                    }}
                    className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Proceed to Checkout
                  </button>
                </div>

                <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] lg:hidden">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Total
                      </p>
                      <p className="text-lg font-bold text-slate-900">
                        {formatCurrency(totalPrice)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Tickets
                      </p>
                      <p className="text-base font-bold text-slate-900">{totalTickets}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={totalTickets === 0}
                    onClick={() => {
                      setIsTicketModalOpen(false);
                      navigate('/checkout', {
                        state: {
                          selectedTickets,
                          eventId: event._id || event.id,
                          event,
                        },
                      });
                    }}
                    className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:opacity-50"
                  >
                    Checkout Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCodeModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-5">
              <div>
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-teal-600">
                  Security Check
                </p>
                <h3 className="text-lg font-semibold text-slate-900">Unlock Private Access</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCodeModalOpen(false);
                  setAccessCode('');
                  setCodeError('');
                }}
                className="rounded-full border border-slate-100 bg-white p-2 text-slate-400 shadow-sm hover:text-slate-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleValidateCode} className="p-6">
              <p className="mb-5 text-sm text-slate-500">
                This ticket category is restricted. Enter the official access code provided by the
                organizer.
              </p>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="accessCode"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    Access Code
                  </label>
                  <input
                    type="text"
                    id="accessCode"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder="E.G. VIP-12345"
                    autoFocus
                    className={`w-full rounded-2xl border-2 px-4 py-3.5 text-center text-base font-semibold uppercase tracking-widest outline-none transition ${
                      codeError
                        ? 'border-red-200 bg-red-50 text-red-900 focus:border-red-400'
                        : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10'
                    }`}
                  />
                  {codeError && (
                    <p className="mt-2 text-center text-xs font-medium text-red-600">
                      {codeError}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!accessCode.trim() || isValidating}
                  className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isValidating ? 'Validating…' : 'Unlock Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PublicLayout>
  );
};

export default EventDetailPage;