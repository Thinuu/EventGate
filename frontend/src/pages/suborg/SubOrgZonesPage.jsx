import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ZoneCard from '../../components/suborg/ZoneCard';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { getSubZones } from '../../api/sub';
import toast from 'react-hot-toast';
import {
  MapPinIcon,
  UsersIcon,
  CheckBadgeIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const MetricCard = ({ title, value, subtitle, icon: Icon }) => (
  <Card className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white shadow-sm p-3 sm:p-5">
    <div className="flex items-start justify-between gap-2 sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 leading-none">
          {title}
        </p>
        <p className="mt-1 sm:mt-2 text-lg sm:text-3xl font-bold tracking-tight text-slate-900 truncate leading-tight">
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
            {subtitle}
          </p>
        )}
      </div>
      {Icon && (
        <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  </Card>
);

const SubOrgZonesPage = () => {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState({ event: null, zones: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentEventId, setCurrentEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );

  const load = (eventId = currentEventId) => {
    setLoading(true);
    getSubZones({ eventId })
      .then((response) => {
        const data = response.data?.data || { event: null, zones: [] };
        setWorkspace({
          event: data.event || null,
          zones: Array.isArray(data.zones) ? data.zones : [],
        });
        setLoadError('');

        if (data.event?._id && String(data.event._id) !== String(eventId)) {
          setCurrentEventId(String(data.event._id));
          localStorage.setItem('lastSelectedEventId', String(data.event._id));
        }
      })
      .catch((error) => {
        const status = error.response?.status;
        if (status === 404 || status === 403) {
          localStorage.removeItem('lastSelectedEventId');
          setCurrentEventId('');
        }
        const message =
          error.response?.data?.message || 'Unable to load assigned zones.';
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(currentEventId);

    const handleEventSelect = (e) => {
      const newId = e.detail ? String(e.detail) : '';
      if (!newId || newId === 'undefined') return;
      setCurrentEventId(newId);
      localStorage.setItem('lastSelectedEventId', newId);
      load(newId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const zones = workspace.zones || [];
  const totalCapacity = zones.reduce(
    (sum, z) => sum + (Number(z.capacity) || 0),
    0
  );
  const totalCheckedIn = zones.reduce(
    (sum, z) =>
      sum + (Number(z.checkedInCount || z.checkedIn || z.occupancy) || 0),
    0
  );

  return (
    <DashboardLayout>
      <div className="space-y-3 sm:space-y-6 pb-20">
        {/* Header — compact on mobile */}
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
                    My Zones
                  </p>
                </div>
                <h1 className="mt-1.5 sm:mt-2.5 text-xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate leading-tight">
                  {workspace.event?.name || 'Assigned Event'}
                </h1>
                <p className="mt-1 sm:mt-2 max-w-2xl text-xs sm:text-sm text-slate-500 leading-snug">
                  Zones in your scope — capacity and occupancy at a glance.
                </p>
              </div>
              <div className="flex gap-2 sm:gap-3 shrink-0">
                <div className="flex-1 sm:flex-none rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 sm:px-4 sm:py-3 sm:min-w-[100px] text-center">
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Zones
                  </p>
                  <p className="mt-0.5 text-base sm:text-xl font-bold text-slate-900 tabular-nums">
                    {loading ? '—' : zones.length}
                  </p>
                </div>
                <div className="flex-1 sm:flex-none rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 sm:px-4 sm:py-3 sm:min-w-[100px] text-center">
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Capacity
                  </p>
                  <p className="mt-0.5 text-base sm:text-xl font-bold text-slate-900 tabular-nums">
                    {loading ? '—' : totalCapacity || '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* KPI — 3-col on mobile (compact) */}
        <section className="grid grid-cols-3 gap-2 sm:gap-4">
          <MetricCard
            title="Zones"
            value={loading ? '—' : zones.length}
            subtitle="Assigned"
            icon={MapPinIcon}
          />
          <MetricCard
            title="Capacity"
            value={loading ? '—' : totalCapacity || 0}
            subtitle="Total"
            icon={UsersIcon}
          />
          <MetricCard
            title="In"
            value={loading ? '—' : totalCheckedIn}
            subtitle={
              totalCapacity > 0
                ? `${Math.min(
                    100,
                    Math.round((totalCheckedIn / totalCapacity) * 100)
                  )}%`
                : 'No cap'
            }
            icon={CheckBadgeIcon}
          />
        </section>

        {loadError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:px-5 sm:py-4 text-xs sm:text-sm text-amber-800">
            {loadError}
          </div>
        )}

        {/* Zone grid */}
        {loading ? (
          <div className="grid gap-3 sm:gap-5 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-40 sm:h-52 animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
              />
            ))}
          </div>
        ) : zones.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-12 sm:px-6 sm:py-16 text-center">
            <div className="mb-3 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              <MapPinIcon className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <p className="text-sm sm:text-base font-semibold text-slate-800">
              No zones assigned yet
            </p>
            <p className="mt-1 max-w-sm text-xs sm:text-sm text-slate-500 leading-snug">
              Ask the main organiser to assign at least one zone to your
              account.
            </p>
            <Button
              size="sm"
              className="mt-4 sm:mt-5 w-full sm:w-auto bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white touch-manipulation"
              onClick={() => navigate('/suborg')}
            >
              Back to dashboard
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-5 lg:grid-cols-2">
            {zones.map((zone) => (
              <ZoneCard
                key={zone.id || zone._id || zone.name}
                zone={zone}
                onViewAttendees={() =>
                  navigate(
                    `/suborg/attendees?zone=${encodeURIComponent(
                      zone.id || zone._id || zone.name
                    )}`
                  )
                }
                onMonitor={() =>
                  navigate(
                    `/suborg/zone-scan?zone=${encodeURIComponent(
                      zone.id || zone._id || zone.name
                    )}`
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubOrgZonesPage;