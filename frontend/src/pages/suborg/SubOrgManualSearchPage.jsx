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
import { checkInAttendee, checkOutAttendee } from '../../api/entry';
import { getMyEvents } from '../../api/events';
import { getSubDashboard, searchSubOrgAttendees } from '../../api/sub';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { buildAssetUrl } from '../staff/staffUtils';
import toast from 'react-hot-toast';

const SubOrgManualSearchPage = () => {
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
      const response = await getSubDashboard({ eventId: selectedEventId });
      const activity = response.data?.data?.activity || [];
      setLogs(activity.slice(0, 20).map((item) => ({
        id: item.id || item._id,
        attendeeName: item.message || item.attendee?.fullName,
        zoneName: item.zone || 'Entry',
        action: item.action || 'Manual Action',
        status: item.success !== false ? 'success' : 'error',
        timestamp: item.createdAt || item.timestamp,
      })));
    } catch {
      setLogs([]);
    }
  }, [selectedEventId]);

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
        const response = await searchSubOrgAttendees({
          eventId: selectedEventId,
          q: search.trim(),
          limit: 12,
        });
        setResults(response.data?.data?.attendees || response.data?.data || []);
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
        gateId: 'SubOrg Manual',
        gateName: 'Sub-Organiser Manual',
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
        gateId: 'SubOrg Manual',
        gateName: 'Sub-Organiser Manual',
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
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-24 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/suborg/dashboard')}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Exit Console
          </button>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-teal-500 ring-4 ring-teal-500/20" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Search Operations
            </p>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Manual Lookup
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Search attendees in your scope and perform manual check-in / check-out.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          {/* LEFT — Search + Results */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
              {/* Filters */}
              <div className="grid gap-4 sm:grid-cols-[0.4fr_1fr]">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Select Event
                  </label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => handleEventChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                  >
                    {events.map((event) => (
                      <option key={event._id} value={event._id}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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

              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500">
                <MagnifyingGlassIcon className="h-4 w-4 text-teal-600" />
                Scope: <span className="font-semibold text-slate-800">Your Assigned Zones</span>
              </div>

              {/* Results */}
              <div className="mt-6 space-y-3">
                {searching && (
                  <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-10 text-sm font-medium text-slate-500">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" />
                    Searching registry...
                  </div>
                )}

                {!searching && search.trim().length >= 2 && results.length === 0 && (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-500">
                      No matches found
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Double-check the name or confirmation details
                    </p>
                  </div>
                )}

                {!searching && search.trim().length < 2 && (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-12 text-center">
                    <IdentificationIcon className="h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">
                      Awaiting search query
                    </p>
                    <p className="text-xs text-slate-400">
                      Type at least 2 characters to search
                    </p>
                  </div>
                )}

                {results.map((attendee) => (
                  <div
                    key={attendee._id}
                    className="rounded-2xl border border-slate-200/70 bg-white p-4 transition hover:border-teal-200 hover:shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-18 sm:w-18">
                          {attendee.photo ? (
                            <img
                              src={buildAssetUrl(attendee.photo)}
                              alt={attendee.fullName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <UserIcon className="h-7 w-7 text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                            {attendee.fullName}
                          </p>
                          <p className="mt-0.5 text-sm font-medium text-slate-500">
                            {attendee.categoryName || 'General Category'}
                          </p>

                          <div className="mt-2.5 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                                attendee.confirmationStatus === 'confirmed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {attendee.confirmationStatus || 'Pending'}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                                attendee.checkedIn
                                  ? 'bg-teal-50 text-teal-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {attendee.checkedIn
                                ? 'Checked In'
                                : 'Not Checked In'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[180px]">
                        <button
                          type="button"
                          onClick={() => handleCheckIn(attendee)}
                          disabled={attendee.checkedIn}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Check-In
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCheckOut(attendee)}
                          disabled={!attendee.checkedIn}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
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
              <div className="space-y-4">
                <ActivityList
                  title={`Recent Manual Actions (Page ${logsPage})`}
                  items={pagedLogs}
                  emptyMessage="No manual actions logged today."
                />

                {logs.length > 0 && (
                  <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white px-5 py-4 shadow-sm sm:flex-row">
                    <p className="text-xs font-medium text-slate-500">
                      Showing{' '}
                      {logs.length === 0
                        ? 0
                        : (logsPage - 1) * pageSize + 1}
                      –{Math.min(logsPage * pageSize, logs.length)} of{' '}
                      {logs.length}
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={logsPage <= 1}
                        onClick={() =>
                          setLogsPage((c) => Math.max(1, c - 1))
                        }
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <div className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
                        {logsPage} / {totalPages}
                      </div>
                      <button
                        type="button"
                        disabled={logsPage >= totalPages}
                        onClick={() =>
                          setLogsPage((c) => Math.min(totalPages, c + 1))
                        }
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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

export default SubOrgManualSearchPage;