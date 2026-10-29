import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import {
  getSubDashboard,
  createSubTicket,
  updateSubTicket,
  deleteSubTicket,
  regenerateTicketCode,
} from '../../api/sub';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import { listSubOrganisers } from '../../api/organiser';
import PermissionGuard from '../../components/auth/PermissionGuard';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  UsersIcon,
  CheckBadgeIcon,
  ClockIcon,
  MapPinIcon,
  TicketIcon,
  BanknotesIcon,
  UserPlusIcon,
  PhotoIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
  DocumentTextIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';

/* ───────────────────── Helpers ───────────────────── */

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

const CapabilityCard = ({
  permission,
  title,
  description,
  linkTo,
  linkLabel,
  icon: Icon,
  tone = 'blue',
  enabledTitle,
  enabledDesc,
}) => {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-teal-50 text-teal-600',
    purple: 'bg-purple-50 text-purple-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <PermissionGuard permission={permission} fallback={null}>
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl ${toneMap[tone]}`}
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-500 leading-snug">
              {description}
            </p>
            <div className="mt-2.5 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
              <p className="text-[11px] sm:text-xs font-semibold text-slate-700">
                {enabledTitle}
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 leading-snug">
                {enabledDesc}
              </p>
            </div>
            <div className="mt-3">
              <Link to={linkTo} className="block sm:inline-block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto border-slate-200 text-slate-700 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 active:bg-teal-50 touch-manipulation"
                >
                  {linkLabel}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </PermissionGuard>
  );
};

const OpLinkCard = ({ to, title, description, badgeTitle, badgeDesc, icon: Icon, tone }) => {
  const toneMap = {
    emerald: {
      icon: 'bg-emerald-50 text-emerald-600',
      badge: 'bg-emerald-50 border-emerald-100 text-emerald-700',
      badgeSub: 'text-emerald-600',
    },
    purple: {
      icon: 'bg-purple-50 text-purple-600',
      badge: 'bg-purple-50 border-purple-100 text-purple-700',
      badgeSub: 'text-purple-600',
    },
    blue: {
      icon: 'bg-teal-50 text-teal-600',
      badge: 'bg-teal-50 border-teal-100 text-teal-700',
      badgeSub: 'text-teal-600',
    },
    amber: {
      icon: 'bg-amber-50 text-amber-600',
      badge: 'bg-amber-50 border-amber-100 text-amber-700',
      badgeSub: 'text-amber-600',
    },
    slate: {
      icon: 'bg-slate-50 text-slate-600',
      badge: 'bg-slate-50 border-slate-100 text-slate-700',
      badgeSub: 'text-slate-600',
    },
  };
  const t = toneMap[tone] || toneMap.blue;

  return (
    <Link to={to} className="block touch-manipulation">
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm active:border-teal-200 hover:border-teal-200 transition-all h-full p-3.5 sm:p-5">
        <div className="flex items-start gap-2.5 sm:gap-3">
          <div
            className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl ${t.icon}`}
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 leading-snug line-clamp-2">
              {description}
            </p>
          </div>
        </div>
        <div className={`mt-3 rounded-lg border px-2.5 py-2 ${t.badge}`}>
          <p className="text-[11px] sm:text-xs font-semibold">{badgeTitle}</p>
          <p className={`text-[10px] sm:text-[11px] mt-0.5 ${t.badgeSub}`}>
            {badgeDesc}
          </p>
        </div>
      </Card>
    </Link>
  );
};

const formatTime = (value) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

const emptyCategory = {
  name: '',
  description: '',
  price: 0,
  capacity: 0,
  allowedZones: [],
  isPrivate: true,
  maxUsage: null,
  assignedSubOrganisers: [],
};

const getCurrency = (payload) =>
  payload?.event?.settings?.currency ||
  payload?.event?.currency ||
  payload?.settings?.currency ||
  payload?.currency ||
  localStorage.getItem('lastEventCurrency') ||
  'LKR';

/* ───────────────────── Main Component ───────────────────── */

const SubOrgDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentEventId, setCurrentEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [categoryModal, setCategoryModal] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const isSubOrganiser = user?.role === 'SubOrganiser';

  const load = (eventId) => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      getSubDashboard({ eventId }),
      listSubOrganisers({ eventId }).catch(() => ({
        data: { data: { users: [] } },
      })),
    ])
      .then(([subRes, teamRes]) => {
        const dashboardData = subRes.data?.data || null;
        setData(dashboardData);
        setTeamMembers(teamRes.data?.data?.users || []);
        setLoadError('');
        const dashboardCurrency = getCurrency(dashboardData);
        if (dashboardCurrency) {
          localStorage.setItem('lastEventCurrency', dashboardCurrency);
        }

        if (
          dashboardData?.event?._id &&
          String(dashboardData.event._id) !== String(eventId)
        ) {
          setCurrentEventId(String(dashboardData.event._id));
          localStorage.setItem(
            'lastSelectedEventId',
            String(dashboardData.event._id)
          );
        }
      })
      .catch((error) => {
        const status = error.response?.status;
        if (status === 404 || status === 403) {
          localStorage.removeItem('lastSelectedEventId');
          setCurrentEventId('');
        }
        const message =
          error.response?.data?.message ||
          'Unable to load sub-organiser workspace.';
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    const handleEventSelect = (e) => {
      const newId = e.detail ? String(e.detail) : '';
      if (!newId || newId === 'undefined') return;
      setCurrentEventId(newId);
      localStorage.setItem('lastSelectedEventId', newId);
      load(newId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => {
      window.removeEventListener('entrynex:event-select', handleEventSelect);
    };
  }, []);

  useEffect(() => {
    if (!currentEventId) {
      setLoading(false);
      return;
    }
    load(currentEventId);

    const interval = setInterval(() => {
      load(currentEventId);
    }, 15000);

    return () => clearInterval(interval);
  }, [currentEventId]);

  const saveCategory = async () => {
    if (!categoryModal?.name?.trim()) {
      return toast.error('Category name is required');
    }
    setIsSaving(true);
    try {
      const payload = { ...categoryModal, eventId: currentEventId };
      if (categoryModal.id) {
        await updateSubTicket(categoryModal.id, payload);
        toast.success('Ticket category updated');
      } else {
        await createSubTicket(payload);
        toast.success('Ticket category created');
      }
      setCategoryModal(null);
      load(currentEventId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deleteConfirm?.id) return;
    try {
      await deleteSubTicket(deleteConfirm.id, { eventId: currentEventId });
      toast.success('Category deleted');
      setDeleteConfirm(null);
      load(currentEventId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete category');
    }
  };

  const handleRegenerateCode = async (catId) => {
    try {
      await regenerateTicketCode(catId, { eventId: currentEventId });
      toast.success('Access code regenerated');
      load(currentEventId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to regenerate code');
    }
  };

  const currency = getCurrency(data);
  const allZones = data?.zones || [];
  // Filter zones to only show user's assigned zones from current event
  const userZoneIds = user?.assignedZones || [];
  const userZoneIdsLegacy = user?.responsibilities?.zoneIds || [];
  const zones = allZones.filter(z => {
    const zid = z.id || z.name;
    return userZoneIds.includes(zid) || userZoneIdsLegacy.includes(zid);
  });
  const categories = data?.categories || [];
  const activity = data?.activity || [];
  const currentUserId = String(user?._id || '');

  const getEventStatus = () => {
    const event = data?.event;
    if (!event) return 'Unknown';
    const status =
      event.status ||
      event.eventStatus ||
      event.state ||
      event.publishedStatus;
    if (!status) {
      if (event.isPublished === true || event.published === true)
        return 'Published';
      if (event.isPublished === false || event.published === false)
        return 'Draft';
    }
    return status || 'Published';
  };

  const eventStatus = getEventStatus();

  const isPublished = () => {
    const status = eventStatus.toLowerCase();
    return ['published', 'ongoing', 'live', 'active'].includes(status);
  };

  return (
    <DashboardLayout>
      <div className="space-y-3 sm:space-y-6 pb-20">
        {/* Header — compact on mobile */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-3 sm:gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1 sm:mb-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15 animate-pulse" />
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Sub-Organiser
                  </p>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] sm:text-[10px] font-medium text-slate-500">
                    Scoped
                  </span>
                </div>
                <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate leading-tight">
                  {data?.event?.name || 'Assigned Event'}
                </h1>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-500 leading-snug line-clamp-2">
                  Zones, scans, and access for your scope.
                </p>
                <div className="mt-2.5 sm:mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] sm:text-xs font-medium text-slate-600">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isPublished()
                          ? 'bg-emerald-500'
                          : eventStatus.toLowerCase() === 'draft'
                          ? 'bg-amber-400'
                          : 'bg-slate-400'
                      }`}
                    />
                    {eventStatus}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] sm:text-xs font-medium text-slate-600 max-w-[140px] sm:max-w-none">
                    <MapPinIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {data?.event?.venue?.name || 'Venue TBD'}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex gap-2 sm:gap-3 shrink-0">
                <div className="flex-1 sm:flex-none rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 sm:min-w-[90px] text-center">
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Zones
                  </p>
                  <p className="mt-0.5 text-base sm:text-lg font-bold text-slate-900 tabular-nums">
                    {loading ? '—' : zones.length}
                  </p>
                </div>
                <div className="flex-1 sm:flex-none rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 sm:min-w-[90px] text-center">
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                    In
                  </p>
                  <p className="mt-0.5 text-base sm:text-lg font-bold text-emerald-700 tabular-nums">
                    {loading ? '—' : data?.metrics?.checkedInCount ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* KPI — 2×2 on mobile */}
        <section className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
          <MetricCard
            title="Attendees"
            value={loading ? '—' : data?.metrics?.totalAttendees ?? 0}
            subtitle="In scope"
            icon={UsersIcon}
          />
          <MetricCard
            title="Checked-In"
            value={loading ? '—' : data?.metrics?.checkedInCount ?? 0}
            subtitle={
              data?.metrics?.totalAttendees
                ? `${Math.min(
                    100,
                    Math.round(
                      ((data?.metrics?.checkedInCount || 0) /
                        (data?.metrics?.totalAttendees || 1)) *
                        100
                    )
                  )}%`
                : 'None yet'
            }
            icon={CheckBadgeIcon}
          />
          <MetricCard
            title="Pending"
            value={loading ? '—' : data?.metrics?.pendingVerifications ?? 0}
            subtitle="Photos"
            icon={ClockIcon}
          />
          <MetricCard
            title="Zones"
            value={loading ? '—' : data?.metrics?.zoneCount ?? zones.length}
            subtitle="Assigned"
            icon={MapPinIcon}
          />
        </section>

        {/* Today's ops — compact grid */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <DocumentTextIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-bold text-slate-900">
                Today&apos;s Operations
              </h2>
              <p className="text-[11px] sm:text-sm text-slate-500">
                Live scan stats
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7 sm:gap-3">
            {!isSubOrganiser && (
              <>
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-2.5 py-2.5 sm:px-3 sm:py-3">
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                    Entry In
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
                    {loading ? '—' : data?.operations?.entryIn ?? 0}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-2.5 py-2.5 sm:px-3 sm:py-3">
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                    Entry Out
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
                    {loading ? '—' : data?.operations?.entryOut ?? 0}
                  </p>
                </div>
              </>
            )}
            <div className="rounded-xl bg-teal-50 border border-teal-100 px-2.5 py-2.5 sm:px-3 sm:py-3">
              <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-teal-600">
                Zone In
              </p>
              <p className="mt-0.5 sm:mt-1 text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
                {loading ? '—' : data?.operations?.zoneIn ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-teal-50 border border-teal-100 px-2.5 py-2.5 sm:px-3 sm:py-3">
              <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-teal-600">
                Zone Out
              </p>
              <p className="mt-0.5 sm:mt-1 text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
                {loading ? '—' : data?.operations?.zoneOut ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-2.5 py-2.5 sm:px-3 sm:py-3">
              <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                Denied
              </p>
              <p className="mt-0.5 sm:mt-1 text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
                {loading ? '—' : data?.operations?.denied ?? 0}
              </p>
            </div>
            {!isSubOrganiser && (
              <>
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2.5 sm:px-3 sm:py-3">
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    QR
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
                    {loading ? '—' : data?.operations?.qrScans ?? 0}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2.5 sm:px-3 sm:py-3">
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    RFID
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
                    {loading ? '—' : data?.operations?.rfidScans ?? 0}
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Operation links — 2 col on mobile */}
        <section className="grid grid-cols-1 gap-2.5 sm:gap-4 xs:grid-cols-2 xl:grid-cols-4">
          {!isSubOrganiser && (
            <PermissionGuard permission="canEntryAccess">
              <OpLinkCard
                to="/suborg/entry"
                title="Entry Scanning"
                description="QR check-in / out at gates"
                badgeTitle="QR + RFID"
                badgeDesc="Assign RFID on entry"
                icon={ArrowRightOnRectangleIcon}
                tone="emerald"
              />
            </PermissionGuard>
          )}

          <PermissionGuard permission="canAssignRfid">
            <OpLinkCard
              to="/suborg/rfid-assign"
              title="RFID Assignment"
              description="Scan QR, assign RFID tag"
              badgeTitle="QR → RFID"
              badgeDesc="Wristbands / tags"
              icon={IdentificationIcon}
              tone="purple"
            />
          </PermissionGuard>

          <PermissionGuard permission="canScanZones">
            <OpLinkCard
              to="/suborg/zone-scan"
              title="Zone Scanning"
              description="VIP, backstage, internal zones"
              badgeTitle="Entry + Exit"
              badgeDesc="Your zones only"
              icon={MapPinIcon}
              tone="blue"
            />
          </PermissionGuard>

          <PermissionGuard permission="true">
            <OpLinkCard
              to="/suborg/manual-search"
              title="Manual Search"
              description="Name, phone, NIC, passport"
              badgeTitle="Manual lookup"
              badgeDesc="By name / email / phone"
              icon={MagnifyingGlassIcon}
              tone="amber"
            />
          </PermissionGuard>

          <PermissionGuard permission="true">
            <OpLinkCard
              to="/suborg/activity-logs"
              title="Activity Logs"
              description="Entry audits & gate activity"
              badgeTitle="Audit log"
              badgeDesc="Recent scans"
              icon={ClockIcon}
              tone="slate"
            />
          </PermissionGuard>
        </section>

        {/* Quick control — compact */}
        <section className="grid gap-2.5 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          {[
            {
              title: 'Zone Control',
              sub: 'Areas & movement',
              count1: zones.length || 0,
              label1: 'Zones',
              count2: data?.metrics?.checkedInCount || 0,
              label2: 'In',
              to: '/suborg/zones',
            },
            {
              title: 'Tickets',
              sub: 'Categories & sales',
              count1: categories.length || 0,
              label1: 'Cats',
              count2: categories.reduce((s, c) => s + (c.sold || 0), 0),
              label2: 'Sold',
              to: null,
            },
            {
              title: 'Activity',
              sub: 'Recent ops',
              count1: activity.length || 0,
              label1: 'Actions',
              count2: data?.metrics?.pendingVerifications || 0,
              label2: 'Pending',
              to: '/suborg/logs',
            },
          ].map((item) => (
            <Card
              key={item.title}
              className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-3.5 sm:p-5"
            >
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500">
                {item.sub}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
                <div className="rounded-xl bg-teal-50/80 border border-teal-100/70 px-2.5 py-2.5 sm:px-3 sm:py-3">
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-teal-600/80">
                    {item.label1}
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                    {loading ? '—' : item.count1}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2.5 sm:px-3 sm:py-3">
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {item.label2}
                  </p>
                  <p className="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                    {loading ? '—' : item.count2}
                  </p>
                </div>
              </div>
              {item.to && (
                <div className="mt-3">
                  <Link to={item.to} className="block sm:inline-block">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto border-slate-200 text-slate-700 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 touch-manipulation"
                    >
                      Open
                    </Button>
                  </Link>
                </div>
              )}
            </Card>
          ))}
        </section>

        {loadError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:px-5 sm:py-4 text-xs sm:text-sm text-amber-800">
            {loadError}
          </div>
        )}

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
          {/* Left */}
          <div className="space-y-3 sm:space-y-5">
            <PermissionGuard permission="canViewZones" fallback={null}>
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                      <MapPinIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        Assigned zones
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500">
                        Your operational scope
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/suborg/zones"
                    className="text-xs sm:text-sm font-semibold text-teal-600 active:text-teal-700 hover:text-teal-700 shrink-0 touch-manipulation"
                  >
                    Open
                  </Link>
                </div>

                <div className="mt-3 sm:mt-5 grid gap-2.5 sm:gap-3 grid-cols-1 sm:grid-cols-2">
                  {zones.map((zone) => (
                    <div
                      key={zone.id || zone.name}
                      className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:p-4"
                    >
                      {zone.color && (
                        <div
                          className="absolute inset-y-0 left-0 w-1 rounded-l-xl"
                          style={{ backgroundColor: zone.color }}
                        />
                      )}
                      <div className={zone.color ? 'pl-2' : ''}>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {zone.name}
                          </h3>
                          <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                            Cap {zone.capacity || 0}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] sm:text-xs text-slate-500 line-clamp-2">
                          {zone.description || 'Entry & zone scans only.'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!loading && zones.length === 0 && (
                    <div className="sm:col-span-2 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 text-center">
                      <MapPinIcon className="h-8 w-8 text-teal-500 mb-2" />
                      <p className="text-sm font-semibold text-slate-700">
                        No zones assigned
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ask the main organiser to assign a zone.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </PermissionGuard>

            <CapabilityCard
              permission="canCollectCash"
              title="Cash Payments"
              description="Confirm cash at entrance"
              linkTo="/suborg/cash-payments"
              linkLabel="Manage payments"
              icon={BanknotesIcon}
              tone="emerald"
              enabledTitle="Cash collection enabled"
              enabledDesc="View and confirm cash payments"
            />

            <CapabilityCard
              permission="canAddAttendees"
              title="Add Attendees"
              description="Register guests directly"
              linkTo="/suborg/attendees"
              linkLabel="Manage attendees"
              icon={UserPlusIcon}
              tone="blue"
              enabledTitle="Registration enabled"
              enabledDesc="Add attendees to the event"
            />

            <CapabilityCard
              permission="canVerifyPhotos"
              title="Photo Verification"
              description="Approve photo uploads"
              linkTo="/suborg/verification"
              linkLabel="View queue"
              icon={PhotoIcon}
              tone="purple"
              enabledTitle="Verification enabled"
              enabledDesc="Approve attendee photos"
            />

            <CapabilityCard
              permission="canBulkUpload"
              title="Excel Bulk Imports"
              description="Spreadsheet bulk registration"
              linkTo="/suborg/upload"
              linkLabel="Bulk upload"
              icon={ArrowUpTrayIcon}
              tone="amber"
              enabledTitle="Bulk import enabled"
              enabledDesc="Upload Excel for registration"
            />

            <CapabilityCard
              permission="true"
              title="Manual Search"
              description="Search & manual check-in/out"
              linkTo="/suborg/manual-search"
              linkLabel="Search registry"
              icon={MagnifyingGlassIcon}
              tone="blue"
              enabledTitle="Manual ops available"
              enabledDesc="Search by name, phone, or email"
            />
          </div>

          {/* Right */}
          <div className="space-y-3 sm:space-y-5">
            <PermissionGuard permission="canViewTickets" fallback={null}>
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                      <TicketIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        Ticket Management
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500">
                        Your categories
                      </p>
                    </div>
                  </div>
                  <PermissionGuard permission="canEditTickets">
                    <Button
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-500 active:bg-teal-700 shrink-0 touch-manipulation"
                      onClick={() =>
                        setCategoryModal({
                          ...emptyCategory,
                          id: '',
                          allowedZones: zones.map((z) => z.id || z.name),
                        })
                      }
                    >
                      + Add
                    </Button>
                  </PermissionGuard>
                </div>

                <div className="mt-3 sm:mt-5 space-y-2.5 sm:space-y-3">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-4"
                    >
                      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-sm truncate">
                              {cat.name}
                            </h3>
                            {cat.isPrivate && (
                              <Badge color="indigo">Private</Badge>
                            )}
                          </div>
                          <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1">
                            {cat.description || 'No description.'}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500">
                            <span>
                              {cat.currency || currency}{' '}
                              {Number(cat.price || 0).toLocaleString()}
                            </span>
                            <span>
                              Sold: {cat.sold || 0}/{cat.capacity || 0}
                            </span>
                            {cat.accessCode && (
                              <span className="font-mono text-teal-600">
                                {cat.accessCode}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          {String(cat.createdBy || '') === currentUserId ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="touch-manipulation"
                                onClick={() => setCategoryModal(cat)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-rose-200 text-rose-700 hover:bg-rose-50 touch-manipulation"
                                onClick={() =>
                                  setDeleteConfirm({
                                    id: cat.id,
                                    label: cat.name,
                                  })
                                }
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                              {cat.isPrivate && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title="Regenerate access code"
                                  className="touch-manipulation"
                                  onClick={() => handleRegenerateCode(cat.id)}
                                >
                                  <ArrowPathIcon className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                              Assigned
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {!loading && categories.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 text-center">
                      <TicketIcon className="h-8 w-8 text-teal-500 mb-2" />
                      <p className="text-sm font-semibold text-slate-700">
                        No ticket categories
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Create one or wait for assignment.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </PermissionGuard>

            {/* Recent Scans */}
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Recent Scans
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Latest entry & zone activity
                  </p>
                </div>
                <Link
                  to="/suborg/logs"
                  className="text-xs sm:text-sm font-semibold text-teal-600 active:text-teal-700 hover:text-teal-700 touch-manipulation"
                >
                  View all
                </Link>
              </div>

              <div className="mt-3 sm:mt-5 space-y-2 sm:space-y-3">
                {activity.slice(0, 8).map((item, idx) => {
                  const isQr = (item.detail || '')
                    .toLowerCase()
                    .includes('qr');
                  const isRfid =
                    (item.detail || '').toLowerCase().includes('rfid') ||
                    (item.status || '').toLowerCase().includes('rfid');
                  const isSuccess =
                    item.status === 'success' ||
                    item.action?.toLowerCase().includes('allowed') ||
                    item.action?.toLowerCase().includes('in');
                  const isDenied =
                    item.status === 'error' ||
                    item.action?.toLowerCase().includes('denied');

                  return (
                    <div
                      key={item.id || idx}
                      className={`flex items-start gap-2.5 rounded-xl border px-2.5 py-2.5 sm:px-3 sm:py-3 ${
                        isDenied
                          ? 'border-rose-200 bg-rose-50/50'
                          : isSuccess
                          ? 'border-emerald-200 bg-emerald-50/50'
                          : 'border-slate-100 bg-slate-50/50'
                      }`}
                    >
                      <div
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          isDenied
                            ? 'bg-rose-500'
                            : isSuccess
                            ? 'bg-emerald-500'
                            : 'bg-teal-500'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs sm:text-sm font-medium text-slate-800 line-clamp-1">
                            {item.attendeeName ||
                              item.message ||
                              item.action ||
                              'Action'}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold ${
                              isQr
                                ? 'bg-teal-100 text-teal-700'
                                : isRfid
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isRfid ? 'RFID' : isQr ? 'QR' : 'MANUAL'}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] sm:text-[11px] text-slate-500">
                          <span>{item.zoneName || 'Entry'}</span>
                          <span>·</span>
                          <span className="truncate">
                            {formatTime(item.createdAt || item.timestamp)}
                          </span>
                          <span>·</span>
                          <span
                            className={
                              isDenied
                                ? 'text-rose-600 font-medium'
                                : 'text-emerald-600 font-medium'
                            }
                          >
                            {isDenied ? 'Denied' : 'Allowed'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!loading && activity.length === 0 && (
                  <div className="py-6 text-center text-sm text-slate-500">
                    No recent scans
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Category Modal */}
      <Modal
        open={!!categoryModal}
        onClose={() => setCategoryModal(null)}
        title={
          categoryModal?.id ? 'Edit Ticket Category' : 'Create Ticket Category'
        }
      >
        {categoryModal && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Name *
              </label>
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 sm:py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 touch-manipulation"
                value={categoryModal.name}
                onChange={(e) =>
                  setCategoryModal({ ...categoryModal, name: e.target.value })
                }
                placeholder="e.g. VIP Guest, Staff, Press"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 sm:py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 touch-manipulation"
                value={categoryModal.description}
                onChange={(e) =>
                  setCategoryModal({
                    ...categoryModal,
                    description: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Price ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 sm:py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 touch-manipulation"
                  value={categoryModal.price}
                  onChange={(e) =>
                    setCategoryModal({
                      ...categoryModal,
                      price: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Capacity
                </label>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 sm:py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 touch-manipulation"
                  value={categoryModal.capacity}
                  onChange={(e) =>
                    setCategoryModal({
                      ...categoryModal,
                      capacity: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isPrivate"
                type="checkbox"
                checked={!!categoryModal.isPrivate}
                onChange={(e) =>
                  setCategoryModal({
                    ...categoryModal,
                    isPrivate: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="isPrivate" className="text-sm text-slate-700">
                Private category (requires access code)
              </label>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto touch-manipulation"
                onClick={() => setCategoryModal(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={saveCategory}
                disabled={isSaving}
                className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 active:bg-teal-700 touch-manipulation"
              >
                {isSaving
                  ? 'Saving…'
                  : categoryModal.id
                  ? 'Update'
                  : 'Create'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Category"
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-snug">
              Delete <strong>{deleteConfirm.label}</strong>? This cannot be
              undone.
            </p>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
              <Button
                variant="outline"
                className="w-full sm:w-auto touch-manipulation"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white touch-manipulation"
                onClick={confirmDeleteCategory}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default SubOrgDashboard;