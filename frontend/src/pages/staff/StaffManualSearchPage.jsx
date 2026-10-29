import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightStartOnRectangleIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  UserIcon,
  IdentificationIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import DashboardLayout from '../../components/layout/DashboardLayout';
import SearchBar from '../../components/staff/SearchBar';
import ActivityList from '../../components/staff/ActivityList';
import { checkInAttendee, checkOutAttendee, getEntryLogs } from '../../api/entry';
import { getMyEvents } from '../../api/events';
import { searchStaffAttendees } from '../../api/staff';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { buildAssetUrl, getAssignedGateLabel } from './staffUtils';
import toast from 'react-hot-toast';

const StaffManualSearchPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [searching, setSearching] = useState(false);

  const gateName = useMemo(
    () => (user?.assignedGates || [])[0] || 'Main Gate',
    [user]
  );

  useEffect(() => {
    getMyEvents().then((response) => {
      const nextEvents = response.data?.data?.events || [];
      setEvents(nextEvents);
      const isValidEvent = nextEvents.some((e) => e._id === selectedEventId);
      const fallbackEventId =
        (isValidEvent ? selectedEventId : nextEvents[0]?._id) || '';
      if (fallbackEventId) {
        setSelectedEventId(fallbackEventId);
        localStorage.setItem('lastSelectedEventId', fallbackEventId);
      }
    });
  }, [selectedEventId]);

  useEffect(() => {
    const handleEventSelect = (event) => {
      setSelectedEventId(event.detail || '');
    };
    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    setLogsPage(1);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(
      new CustomEvent('entrynex:event-select', { detail: nextId })
    );
  };

  const refreshLogs = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const response = await getEntryLogs({
        eventId: selectedEventId,
        gateId: gateName,
        limit: 50,
      });
      setLogs(
        (response.data?.data?.logs || []).map((item) => ({
          id: item._id,
          attendeeName: item.attendee?.fullName || item.snapshot?.fullName,
          zoneName: item.gateName || item.zoneName,
          action: item.accessGranted
            ? item.action === 'check_out'
              ? 'Checked out'
              : 'Checked in'
            : item.denialReason || 'Denied',
          status: item.accessGranted ? 'success' : 'error',
          timestamp: item.timestamp,
        }))
      );
    } catch {
      setLogs([]);
    }
  }, [selectedEventId, gateName]);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  useEffect(() => {
    if (!selectedEventId || search.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await searchStaffAttendees({
          eventId: selectedEventId,
          q: search.trim(),
          limit: 12,
        });
        setResults(response.data?.data?.attendees || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [search, selectedEventId]);

  const handleCheckIn = async (attendee) => {
    try {
      await checkInAttendee({
        attendeeId: attendee._id,
        gateId: gateName,
        gateName,
        method: 'manual',
      });
      toast.success(`${attendee.fullName} checked in.`);
      setResults((current) =>
        current.map((item) =>
          item._id === attendee._id ? { ...item, checkedIn: true } : item
        )
      );
      refreshLogs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Manual check-in failed.');
    }
  };

  const handleCheckOut = async (attendee) => {
    try {
      await checkOutAttendee({
        attendeeId: attendee._id,
        gateId: gateName,
        gateName,
        method: 'manual',
      });
      toast.success(`${attendee.fullName} checked out.`);
      setResults((current) =>
        current.map((item) =>
          item._id === attendee._id ? { ...item, checkedIn: false } : item
        )
      );
      refreshLogs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Manual check-out failed.');
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-3 px-3 pb-24 sm:space-y-5 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/staff/dashboard')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 active:bg-slate-100 touch-manipulation"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span className="hidden xs:inline">Exit</span>
          </button>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-sm sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-teal-500 ring-4 ring-teal-500/20" />
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Search Operations
            </p>
            <span className="text-[10px] font-medium text-slate-300">•</span>
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 truncate">
              {gateName}
            </p>
          </div>

          <h1 className="mt-1.5 sm:mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-3xl leading-tight">
            Manual Lookup
          </h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500 leading-snug">
            Search by name, phone, or email — then check in / out.
          </p>
        </div>

        <div className="grid gap-3 sm:gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          {/* LEFT — Search + Results */}
          <div className="space-y-3 sm:space-y-5">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
              {/* Filters — stacked on mobile */}
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-[0.4fr_1fr]">
                <div className="space-y-1.5">
                  <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Select Event
                  </label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => handleEventChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 sm:px-4 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white touch-manipulation"
                  >
                    {events.map((event) => (
                      <option key={event._id} value={event._id}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Search Query
                  </label>
                  <SearchBar
                    value={search}
                    onChange={setSearch}
                    placeholder="Name, phone, email..."
                    autoFocus
                  />
                </div>
              </div>

              <div className="mt-3 sm:mt-4 flex items-center gap-2 text-[11px] sm:text-xs font-medium text-slate-500">
                <MagnifyingGlassIcon className="h-4 w-4 text-teal-600 shrink-0" />
                Gate:{' '}
                <span className="font-semibold text-slate-800 truncate">
                  {getAssignedGateLabel(user)}
                </span>
              </div>

              {/* Results */}
              <div className="mt-4 sm:mt-6 space-y-2.5 sm:space-y-3">
                {searching && (
                  <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-8 sm:py-10 text-sm font-medium text-slate-500">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" />
                    Searching...
                  </div>
                )}

                {!searching &&
                  search.trim().length >= 2 &&
                  results.length === 0 && (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 px-4 py-10 sm:py-12 text-center">
                      <p className="text-sm font-medium text-slate-500">
                        No matches found
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Double-check the name or details
                      </p>
                    </div>
                  )}

                {!searching && search.trim().length < 2 && (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-10 sm:py-12 text-center">
                    <IdentificationIcon className="h-7 w-7 sm:h-8 sm:w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">
                      Awaiting search
                    </p>
                    <p className="text-xs text-slate-400">
                      Type at least 2 characters
                    </p>
                  </div>
                )}

                {results.map((attendee) => (
                  <div
                    key={attendee._id}
                    className="rounded-2xl border border-slate-200/70 bg-white p-3.5 transition active:bg-slate-50/50 sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      {/* Attendee info */}
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          {attendee.photo ? (
                            <img
                              src={buildAssetUrl(attendee.photo)}
                              alt={attendee.fullName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <UserIcon className="h-6 w-6 sm:h-7 sm:w-7 text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm sm:text-base font-semibold text-slate-900 sm:text-lg">
                            {attendee.fullName}
                          </p>
                          <p className="mt-0.5 truncate text-xs sm:text-sm font-medium text-slate-500">
                            {attendee.categoryName || 'General'}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider ${
                                attendee.confirmationStatus === 'confirmed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {attendee.confirmationStatus || 'Pending'}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider ${
                                attendee.checkedIn
                                  ? 'bg-teal-50 text-teal-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {attendee.checkedIn ? 'In' : 'Out'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions — full width on mobile, side-by-side */}
                      <div className="flex w-full gap-2 sm:w-auto sm:min-w-[160px] sm:flex-col">
                        <button
                          type="button"
                          onClick={() => handleCheckIn(attendee)}
                          disabled={attendee.checkedIn}
                          className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3 py-3 sm:px-4 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-white transition active:bg-teal-700 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                        >
                          <CheckCircleIcon className="h-4 w-4 shrink-0" />
                          Check-In
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCheckOut(attendee)}
                          disabled={!attendee.checkedIn}
                          className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-4 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-700 transition active:bg-slate-100 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                        >
                          <ArrowRightStartOnRectangleIcon className="h-4 w-4 shrink-0" />
                          Check-Out
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Activity Logs */}
          {(() => {
            const pageSize = 5;
            const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
            const pagedLogs = logs.slice(
              (logsPage - 1) * pageSize,
              logsPage * pageSize
            );

            return (
              <div className="space-y-3 sm:space-y-4">
                <ActivityList
                  title={`Recent Actions (Page ${logsPage})`}
                  items={pagedLogs}
                  emptyMessage="No manual actions logged today."
                />

                {logs.length > 0 && (
                  <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-sm sm:flex-row sm:px-5 sm:py-4">
                    <p className="text-xs font-medium text-slate-500 order-2 sm:order-1">
                      Showing{' '}
                      {logs.length === 0
                        ? 0
                        : (logsPage - 1) * pageSize + 1}
                      –{Math.min(logsPage * pageSize, logs.length)} of{' '}
                      {logs.length}
                    </p>

                    <div className="flex items-center gap-2 order-1 sm:order-2">
                      <button
                        type="button"
                        disabled={logsPage <= 1}
                        onClick={() =>
                          setLogsPage((c) => Math.max(1, c - 1))
                        }
                        className="min-h-[44px] min-w-[64px] rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition active:bg-slate-100 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                      >
                        Prev
                      </button>
                      <div className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-700 tabular-nums">
                        {logsPage} / {totalPages}
                      </div>
                      <button
                        type="button"
                        disabled={logsPage >= totalPages}
                        onClick={() =>
                          setLogsPage((c) => Math.min(totalPages, c + 1))
                        }
                        className="min-h-[44px] min-w-[64px] rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition active:bg-slate-100 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffManualSearchPage;