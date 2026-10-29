import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import AttendeeTable from '../../components/suborg/AttendeeTable';
import { getSubAttendees, getSubZones, scanSubEntry } from '../../api/sub';
import { createAttendee, updateAttendee } from '../../api/attendees';
import { deleteOrganiserAttendee } from '../../api/organiser';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getAssetUrl } from '../../utils/backend';
import toast from 'react-hot-toast';
import {
  UsersIcon,
  CheckBadgeIcon,
  ClockIcon,
  UserPlusIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const emptyWorkspace = {
  event: null,
  attendees: [],
  total: 0,
  pages: 1,
  page: 1,
};

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

const SubOrgAttendees = () => {
  const [searchParams] = useSearchParams();
  const initialZone = searchParams.get('zone') || '';
  const [currentEventId, setCurrentEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: '',
    verificationStatus: '',
    zone: initialZone,
    page: 1,
    limit: 20,
  });
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const [zones, setZones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const { user } = useAuth();
  const { hasAnyPermission } = usePermissions();
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const initialAttendee = {
    fullName: '',
    email: '',
    phone: '',
    categoryId: '',
    notificationChannel: 'email',
  };
  const [newAttendee, setNewAttendee] = useState(initialAttendee);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === 'page' ? value : 1,
    }));
  };

  const load = async (eventId = currentEventId) => {
    setLoading(true);
    try {
      const [attendeesRes, zonesRes] = await Promise.all([
        getSubAttendees({ ...filters, eventId }),
        getSubZones({ eventId }),
      ]);
      setWorkspace(attendeesRes.data?.data || emptyWorkspace);
      setZones(zonesRes.data?.data?.zones || []);
      setLoadError('');
    } catch (error) {
      const message =
        error.response?.data?.message ||
        'Unable to load attendees for this workspace.';
      setLoadError(message);
      setWorkspace(emptyWorkspace);
      setZones([]);
      toast.error(message);
    } finally {
      setLoading(false);
    }
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
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  useEffect(() => {
    load();
  }, [
    filters.search,
    filters.category,
    filters.status,
    filters.verificationStatus,
    filters.zone,
    filters.page,
    filters.limit,
    currentEventId,
  ]);

  const zoneFilteredAttendees = useMemo(() => {
    if (!filters.zone) return workspace.attendees || [];
    return (workspace.attendees || []).filter((attendee) =>
      (attendee.allowedZones || []).includes(filters.zone)
    );
  }, [filters.zone, workspace.attendees]);

  const categoryOptions = useMemo(() => {
    const map = new Map();
    (workspace.attendees || []).forEach((attendee) => {
      if (attendee.categoryId && !map.has(attendee.categoryId)) {
        map.set(
          attendee.categoryId,
          attendee.categoryName || attendee.categoryId
        );
      }
    });
    return Array.from(map.entries());
  }, [workspace.attendees]);

  const availableCategories = useMemo(() => {
    if (!workspace.event?.categories) return [];
    if (user?.role === 'SubOrganiser') {
      const myZones = (
        user.assignedZones ||
        user.responsibilities?.zoneIds ||
        []
      ).map(String);
      return workspace.event.categories.filter((cat) => {
        const catZones = (cat.allowedZones || []).map(String);
        return (
          catZones.length === 0 || catZones.some((z) => myZones.includes(z))
        );
      });
    }
    return workspace.event.categories;
  }, [workspace.event, user]);

  const attendees = zoneFilteredAttendees;
  const checkedInCount = attendees.filter(
    (a) =>
      a.status === 'checked-in' ||
      a.checkedIn ||
      a.confirmationStatus === 'checked-in'
  ).length;
  const pendingCount = attendees.filter(
    (a) => a.verificationStatus === 'pending' || a.status === 'pending'
  ).length;

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newAttendee.fullName || !newAttendee.categoryId) {
      toast.error('Name and category are required');
      return;
    }
    setAdding(true);
    try {
      await createAttendee({
        ...newAttendee,
        eventId: workspace.event?._id || currentEventId,
      });
      toast.success('Attendee created successfully');
      setAddModal(false);
      setNewAttendee(initialAttendee);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create attendee');
    } finally {
      setAdding(false);
    }
  };

  const handleMarkAttendance = async (attendee) => {
    const matchedZone = zones.find(
      (zone) =>
        (attendee.allowedZones || []).includes(zone.id) ||
        (attendee.allowedZones || []).includes(zone.name)
    );
    if (!matchedZone) {
      toast.error('This attendee does not match one of your assigned zones.');
      return;
    }
    try {
      await scanSubEntry({
        qrToken: attendee.qrToken,
        zoneId: matchedZone.id || matchedZone.name,
      });
      toast.success('Attendance marked.');
      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Unable to mark attendance.'
      );
    }
  };

  const handleDisableToggle = async (attendee) => {
    const newStatus = !attendee.isDisabled;
    try {
      await updateAttendee(attendee._id, { isDisabled: newStatus });
      toast.success(
        newStatus
          ? 'Attendee disabled successfully'
          : 'Attendee enabled successfully'
      );
      load();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to update attendee status'
      );
    }
  };

  const handleDeleteAttendee = (id, name) => {
    setDeleteConfirm({ id, name: name || 'this attendee' });
  };

  const confirmDeleteAttendee = async () => {
    if (!deleteConfirm?.id) return;
    try {
      await deleteOrganiserAttendee(deleteConfirm.id, currentEventId);
      toast.success('Attendee deleted successfully');
      setDeleteConfirm(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete attendee');
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
                    Attendees
                  </p>
                </div>
                <h1 className="mt-1.5 sm:mt-2.5 text-xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate leading-tight">
                  {workspace.event?.name || 'Assigned Event'}
                </h1>
                <p className="mt-1 sm:mt-2 max-w-2xl text-xs sm:text-sm text-slate-500 leading-snug">
                  Search and manage attendees in your assigned zones.
                </p>
              </div>
              <Button
                className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white shrink-0 touch-manipulation"
                onClick={() => setAddModal(true)}
              >
                <UserPlusIcon className="mr-1.5 h-4 w-4" />
                Add Attendee
              </Button>
            </div>
          </div>
        </Card>

        {/* Metrics — 3-col on mobile */}
        <section className="grid grid-cols-3 gap-2 sm:gap-4">
          <MetricCard
            title="Total"
            value={loading ? '—' : workspace.total || attendees.length}
            subtitle="In scope"
            icon={UsersIcon}
          />
          <MetricCard
            title="In"
            value={loading ? '—' : checkedInCount}
            subtitle="Present"
            icon={CheckBadgeIcon}
          />
          <MetricCard
            title="Pending"
            value={loading ? '—' : pendingCount}
            subtitle="Waiting"
            icon={ClockIcon}
          />
        </section>

        {/* Filters — stack on mobile */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-3.5 sm:p-5">
          <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <input
              type="search"
              inputMode="search"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Search name, email, phone"
              className="rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation sm:col-span-2 xl:col-span-1"
            />
            <select
              value={filters.zone}
              onChange={(e) => handleFilterChange('zone', e.target.value)}
              className="rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
            >
              <option value="">All zones</option>
              {zones.map((zone) => (
                <option key={zone.id || zone.name} value={zone.id || zone.name}>
                  {zone.name}
                </option>
              ))}
            </select>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
            >
              <option value="">All categories</option>
              {categoryOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
            >
              <option value="">All statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="invited">Invited</option>
              <option value="checked-in">Checked in</option>
              <option value="not-checked-in">Not checked in</option>
            </select>
            <select
              value={filters.verificationStatus}
              onChange={(e) =>
                handleFilterChange('verificationStatus', e.target.value)
              }
              className="rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
            >
              <option value="">All verification</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={String(filters.limit)}
              onChange={(e) =>
                handleFilterChange('limit', Number(e.target.value))
              }
              className="rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
            >
              <option value="10">10 rows</option>
              <option value="20">20 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
            </select>
          </div>
        </Card>

        {loadError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:px-5 sm:py-4 text-xs sm:text-sm text-amber-800">
            {loadError}
          </div>
        )}

        {/* Table */}
        <Card
          className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
          padding={false}
        >
          <div className="border-b border-slate-100 bg-slate-50/40 px-4 py-3 sm:px-5 sm:py-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Attendee list
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Page {workspace.page || 1} of {workspace.pages || 1} ·{' '}
              {workspace.total || 0} total
            </p>
          </div>
          <div className="p-0 overflow-x-auto">
            <AttendeeTable
              attendees={attendees}
              loading={loading}
              onView={setSelected}
              onMarkAttendance={handleMarkAttendance}
              canEdit={false}
              onDisableToggle={handleDisableToggle}
              onDelete={
                hasAnyPermission(['canAddAttendees', 'canEditAttendees'])
                  ? (id, attendee) =>
                      handleDeleteAttendee(id, attendee?.fullName)
                  : undefined
              }
            />
          </div>
          {!loading && (workspace.pages || 1) > 1 && (
            <div className="flex flex-col gap-2.5 border-t border-slate-100 bg-slate-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-center sm:text-left text-xs sm:text-sm text-slate-500 order-2 sm:order-1">
                Page {workspace.page || filters.page} of {workspace.pages} ·{' '}
                {workspace.total || 0} total
              </p>
              <div className="flex justify-center gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page <= 1}
                  onClick={() =>
                    setFilters((curr) => ({
                      ...curr,
                      page: Math.max(1, curr.page - 1),
                    }))
                  }
                  className="min-h-[40px] rounded-xl px-4 text-xs touch-manipulation"
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page >= (workspace.pages || 1)}
                  onClick={() =>
                    setFilters((curr) => ({
                      ...curr,
                      page: Math.min(workspace.pages || 1, curr.page + 1),
                    }))
                  }
                  className="min-h-[40px] rounded-xl px-4 text-xs touch-manipulation"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Add modal */}
      <Modal
        open={addModal}
        onClose={() => setAddModal(false)}
        title="Add Attendee"
        size="md"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Full Name *
            </span>
            <input
              required
              value={newAttendee.fullName}
              onChange={(e) =>
                setNewAttendee({ ...newAttendee, fullName: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
              placeholder="Attendee full name"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Email *
              </span>
              <input
                type="email"
                required
                inputMode="email"
                value={newAttendee.email}
                onChange={(e) =>
                  setNewAttendee({ ...newAttendee, email: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
                placeholder="email@example.com"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Phone
              </span>
              <input
                type="tel"
                inputMode="tel"
                value={newAttendee.phone}
                onChange={(e) =>
                  setNewAttendee({ ...newAttendee, phone: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
                placeholder="+94..."
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Category *
            </span>
            <select
              required
              value={newAttendee.categoryId}
              onChange={(e) =>
                setNewAttendee({ ...newAttendee, categoryId: e.target.value })
              }
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
            >
              <option value="">Select a category</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {user?.role === 'SubOrganiser' &&
              availableCategories.length === 0 && (
                <p className="mt-1 text-xs text-rose-500">
                  No categories available for your zones.
                </p>
              )}
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Notification
            </span>
            <select
              value={newAttendee.notificationChannel}
              onChange={(e) =>
                setNewAttendee({
                  ...newAttendee,
                  notificationChannel: e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
            >
              <option value="none">No notification (Pending)</option>
              <option value="email_sms">Send Invite (Email + SMS)</option>
              <option value="email">Email Only</option>
              <option value="sms">SMS Only</option>
            </select>
          </label>
          <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:flex-1 py-3 sm:py-2.5 touch-manipulation"
              onClick={() => setAddModal(false)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:flex-1 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 py-3 sm:py-2.5 touch-manipulation"
              disabled={adding}
            >
              {adding ? 'Creating…' : 'Create Attendee'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Details modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Attendee details"
        size="md"
      >
        {selected && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {selected.photo ? (
                <img
                  src={getAssetUrl(selected.photo)}
                  alt={selected.fullName || 'Attendee'}
                  className="h-48 sm:h-64 w-full object-cover"
                />
              ) : (
                <div className="flex h-32 sm:h-40 items-center justify-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
                  No verification photo
                </div>
              )}
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Name
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {selected.fullName || '—'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Category', value: selected.categoryName },
                {
                  label: 'Confirmation',
                  value: selected.confirmationStatus,
                },
                { label: 'Email', value: selected.email },
                { label: 'Phone', value: selected.phone },
              ].map((item) => (
                <div key={item.label} className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-slate-700 break-words">
                    {item.value || '—'}
                  </p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Allowed zones
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(selected.allowedZones || []).length === 0 ? (
                  <span className="text-xs italic text-slate-400">None</span>
                ) : (
                  (selected.allowedZones || []).map((zone) => (
                    <span
                      key={zone}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600"
                    >
                      {zone}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-2 border-t border-slate-100 pt-4">
              <Button
                variant="outline"
                className="w-full sm:flex-1 touch-manipulation"
                onClick={() => setSelected(null)}
              >
                Close
              </Button>
              <Button
                className="w-full sm:flex-1 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 touch-manipulation"
                onClick={() => {
                  handleMarkAttendance(selected);
                  setSelected(null);
                }}
              >
                Mark attendance
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Attendee"
        size="sm"
      >
        {deleteConfirm && (
          <div className="space-y-4 sm:space-y-5">
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3.5 sm:p-4">
              <p className="text-sm text-slate-700 leading-snug">
                Delete{' '}
                <span className="font-semibold text-slate-900">
                  {deleteConfirm.name}
                </span>
                ?
              </p>
              <p className="mt-1.5 text-xs text-slate-500 leading-snug">
                This permanently removes the attendee and ticket access.
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
              <Button
                variant="outline"
                className="w-full sm:flex-1 py-3 sm:py-2.5 touch-manipulation"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:flex-1 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 py-3 sm:py-2.5 touch-manipulation"
                onClick={confirmDeleteAttendee}
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

export default SubOrgAttendees;