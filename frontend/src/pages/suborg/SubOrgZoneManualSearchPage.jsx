import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightStartOnRectangleIcon,
  CheckCircleIcon,
  UserIcon,
  ArrowLeftIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import SearchBar from '../../components/staff/SearchBar';
import ActivityList from '../../components/staff/ActivityList';
import { getSubZones, scanSubZone } from '../../api/sub';
import { searchStaffAttendees } from '../../api/staff';
import { useAuth } from '../../context/AuthContext';
import { buildAssetUrl } from '../staff/staffUtils';
import { filterZonesForUser } from './suborgUtils';
import toast from 'react-hot-toast';
import { getZoneLogs } from '../../api/zone';

const SubOrgZoneManualSearchPage = () => {
  const { user } = useAuth();
  const [zones, setZones] = useState([]);
  const [zoneName, setZoneName] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [currentEventId, setCurrentEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );

  const loadZones = (eventId = currentEventId) => {
    getSubZones(eventId ? { eventId } : undefined)
      .then((response) => {
        const nextZones = filterZonesForUser(
          response.data?.data?.zones || [],
          user
        );
        setZones(nextZones);
        setZoneName((prev) => {
          const stillValid = nextZones.some(
            (z) => String(z.id || z.name) === String(prev)
          );
          if (stillValid) return prev;
          return nextZones[0]?.id || nextZones[0]?.name || '';
        });
      })
      .catch(() => {
        setZones([]);
        setZoneName('');
      });
  };

  useEffect(() => {
    loadZones(currentEventId);

    const handleEventSelect = (event) => {
      const nextId = event.detail ? String(event.detail) : '';
      if (!nextId || nextId === 'undefined') return;
      setCurrentEventId(nextId);
      localStorage.setItem('lastSelectedEventId', nextId);
      setResults([]);
      setSearch('');
      loadZones(nextId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, [user, currentEventId]);

  const refreshLogs = useCallback(async () => {
    if (!currentEventId || !zoneName) return;
    try {
      const response = await getZoneLogs({
        eventId: currentEventId,
        zoneId: zoneName,
        limit: 10,
      });
      setLogs(
        (response.data?.data?.logs || []).map((item) => ({
          id: item._id,
          attendeeName:
            item.attendee?.fullName ||
            item.snapshot?.fullName ||
            item.attendeeSnapshot?.fullName,
          zoneName: item.zoneName,
          action: item.accessGranted
            ? item.action === 'EXIT'
              ? 'Exited zone'
              : 'Entered zone'
            : item.denialReason || 'Denied',
          status: item.accessGranted ? 'success' : 'error',
          timestamp: item.timestamp,
        }))
      );
    } catch {
      setLogs([]);
    }
  }, [currentEventId, zoneName]);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  useEffect(() => {
    if (!currentEventId || search.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await searchStaffAttendees({
          eventId: currentEventId,
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
  }, [search, currentEventId]);

  const handleZoneAction = async (attendee, action) => {
    if (!zoneName) {
      toast.error('Please select a zone first.');
      return;
    }

    const key = `${attendee._id}-${action}`;
    setActionLoading(key);
    try {
      await scanSubZone({
        qrToken: attendee.qrToken,
        zoneId: zoneName,
        eventId: currentEventId,
        action,
      });
      const activeZoneObj = zones.find(
        (z) => z.id === zoneName || z.name === zoneName
      );
      const activeZoneName = activeZoneObj ? activeZoneObj.name : zoneName;
      toast.success(
        `${attendee.fullName} ${
          action === 'ENTRY' ? 'entered' : 'exited'
        } ${activeZoneName}.`
      );
      refreshLogs();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          `Manual zone ${action.toLowerCase()} failed.`
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-3 sm:space-y-6 pb-20">
        {/* Header */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-3 sm:gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/suborg/dashboard"
                    className="inline-flex items-center gap-1 rounded-lg px-1 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-teal-600 active:bg-teal-50 hover:text-teal-700 touch-manipulation"
                  >
                    <ArrowLeftIcon className="h-3.5 w-3.5" />
                    Dashboard
                  </Link>
                  <span className="text-slate-300">·</span>
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Zone Search
                  </p>
                </div>
                <h1 className="mt-1.5 sm:mt-2.5 text-xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                  Manual zone entry / exit
                </h1>
                <p className="mt-1 sm:mt-2 max-w-2xl text-xs sm:text-sm text-slate-500 leading-snug">
                  Search by name, phone, NIC, or passport.
                </p>
              </div>
              <div className="flex sm:block rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 sm:px-4 sm:py-3 sm:min-w-[100px] text-center shrink-0">
                <div className="flex items-center justify-between sm:block gap-3 w-full sm:w-auto">
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Zones
                  </p>
                  <p className="sm:mt-0.5 text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
                    {zones.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-3 sm:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          {/* Search panel */}
          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-3.5 sm:p-5">
            <div className="grid gap-3 grid-cols-1 lg:grid-cols-[0.4fr_1fr]">
              <div>
                <label className="mb-1.5 block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                  Zone
                </label>
                <select
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
                >
                  {zones.length === 0 && <option value="">No zones</option>}
                  {zones.map((zone) => (
                    <option
                      key={zone.id || zone.name}
                      value={zone.id || zone.name}
                    >
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                  Search
                </label>
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Name, phone, NIC, passport…"
                  autoFocus
                />
              </div>
            </div>

            <div className="mt-4 sm:mt-5 space-y-2.5 sm:space-y-3">
              {searching && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-6 sm:py-8 text-center text-sm text-slate-500">
                  Searching attendees…
                </div>
              )}

              {!searching &&
                search.trim().length >= 2 &&
                results.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-8 sm:py-12 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      No matches
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Try another name, phone, or ID number.
                    </p>
                  </div>
                )}

              {!searching &&
                search.trim().length < 2 &&
                results.length === 0 && (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-8 sm:py-12 text-center">
                    <div className="mb-2.5 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                      <MapPinIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      Start typing to search
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      At least 2 characters required.
                    </p>
                  </div>
                )}

              {results.map((attendee) => {
                const entryKey = `${attendee._id}-ENTRY`;
                const exitKey = `${attendee._id}-EXIT`;

                return (
                  <div
                    key={attendee._id}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      {attendee.photo ? (
                        <img
                          src={buildAssetUrl(attendee.photo)}
                          alt={attendee.fullName}
                          className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-500">
                          <UserIcon className="h-7 w-7 sm:h-8 sm:w-8" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {attendee.fullName}
                        </p>
                        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 truncate">
                          {attendee.phone || 'No phone'} ·{' '}
                          {attendee.categoryName || 'Unknown category'}
                        </p>
                        <div className="mt-1.5 sm:mt-2">
                          <Badge
                            color={
                              attendee.confirmationStatus === 'confirmed'
                                ? 'green'
                                : 'amber'
                            }
                          >
                            {attendee.confirmationStatus || 'Pending'}
                          </Badge>
                        </div>
                      </div>
                      {/* Side-by-side on mobile for faster gate use */}
                      <div className="flex w-full sm:w-auto sm:flex-col gap-2 sm:shrink-0 sm:w-36">
                        <Button
                          size="sm"
                          className="flex-1 sm:flex-none min-h-[44px] bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white touch-manipulation"
                          onClick={() => handleZoneAction(attendee, 'ENTRY')}
                          disabled={!!actionLoading}
                        >
                          <CheckCircleIcon className="mr-1.5 h-4 w-4" />
                          {actionLoading === entryKey ? '…' : 'Entry'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 sm:flex-none min-h-[44px] border-teal-200 text-teal-700 active:bg-teal-50 hover:bg-teal-50 touch-manipulation"
                          onClick={() => handleZoneAction(attendee, 'EXIT')}
                          disabled={!!actionLoading}
                        >
                          <ArrowRightStartOnRectangleIcon className="mr-1.5 h-4 w-4" />
                          {actionLoading === exitKey ? '…' : 'Exit'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Activity */}
          <ActivityList
            title="Recent zone actions"
            items={logs.slice(0, 8)}
            emptyMessage="Manual zone logs will appear here."
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SubOrgZoneManualSearchPage;