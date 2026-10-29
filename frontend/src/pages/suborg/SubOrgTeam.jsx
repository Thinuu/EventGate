import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import {
  getSubOrgTeam,
  createSubOrgTeamMember,
  updateSubOrgTeamMember,
  getSubZones,
} from '../../api/sub';
import toast from 'react-hot-toast';
import {
  UsersIcon,
  UserPlusIcon,
  ArrowLeftIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

const emptyTeamMember = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'Staff',
  operationScope: 'entry',
  assignedGates: ['Main Gate'],
  assignedZones: [],
  permissions: {
    canAddAttendees: false,
    canVerifyPhotos: false,
    canInviteAttendees: false,
    canBulkUpload: false,
    canEntryAccess: true,
    canCollectCash: false,
  },
};

const scopeDescriptions = {
  entry: 'Can validate tickets at assigned gates or entry points.',
  zone: 'Can check attendee access only for the selected zones.',
  both: 'Can work at entry points and inside allowed zones.',
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

const SubOrgTeam = () => {
  const [team, setTeam] = useState([]);
  const [myZones, setMyZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyTeamMember);
  const [currentEventId, setCurrentEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(team.length / pageSize));
  const pagedTeam = team.slice((page - 1) * pageSize, page * pageSize);
  const isCheckpointRole = ['Staff', 'Volunteer'].includes(form.role);

  const loadData = async (eventId = currentEventId) => {
    setLoading(true);
    try {
      const [teamRes, zonesRes] = await Promise.all([
        getSubOrgTeam({ eventId }),
        getSubZones({ eventId }),
      ]);
      setTeam(teamRes.data?.data?.users || []);
      setMyZones(zonesRes.data?.data?.zones || []);
      setPage(1);
    } catch {
      toast.error('Failed to load team data');
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
      loadData(newId);
    };
    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  useEffect(() => {
    loadData();
  }, [currentEventId]);

  const handleEdit = (member) => {
    setForm({
      ...emptyTeamMember,
      ...member,
      role: member.role || 'Staff',
      operationScope: ['Staff', 'Volunteer'].includes(member.role)
        ? member.assignedGates?.length && member.assignedZones?.length
          ? 'both'
          : member.assignedZones?.length
          ? 'zone'
          : 'entry'
        : 'entry',
      assignedGates:
        ['Staff', 'Volunteer'].includes(member.role) &&
        member.assignedGates?.length
          ? member.assignedGates
          : ['Main Gate'],
      assignedZones: ['Staff', 'Volunteer'].includes(member.role)
        ? member.assignedZones || []
        : [],
      _id: member._id,
    });
    setModalOpen(true);
  };

  const handleCreate = () => {
    setForm(emptyTeamMember);
    setModalOpen(true);
  };

  const updateRole = (role) => {
    setForm((current) => {
      if (!['Staff', 'Volunteer'].includes(role)) {
        return {
          ...current,
          role,
          operationScope: 'entry',
          assignedGates: [],
          assignedZones: [],
          permissions: {
            ...current.permissions,
            canEntryAccess: false,
          },
        };
      }
      return {
        ...current,
        role,
        assignedGates: current.assignedGates?.length
          ? current.assignedGates
          : ['Main Gate'],
      };
    });
  };

  const setScope = (scope) => {
    setForm((current) => ({
      ...current,
      operationScope: scope,
      assignedGates:
        scope === 'zone'
          ? []
          : current.assignedGates?.length
          ? current.assignedGates
          : ['Main Gate'],
      assignedZones: scope === 'entry' ? [] : current.assignedZones,
      permissions: {
        ...current.permissions,
        canEntryAccess: scope === 'entry' || scope === 'both',
      },
    }));
  };

  const updateGateAt = (index, value) => {
    setForm((current) => {
      const next = [...(current.assignedGates || [])];
      next[index] = value;
      return { ...current, assignedGates: next };
    });
  };

  const saveMember = async () => {
    try {
      const assignedGates =
        form.operationScope === 'zone' ||
        !['Staff', 'Volunteer'].includes(form.role)
          ? []
          : (form.assignedGates || [])
              .map((item) => item.trim())
              .filter(Boolean);
      const assignedZones =
        form.operationScope === 'entry' ||
        !['Staff', 'Volunteer'].includes(form.role)
          ? []
          : (form.assignedZones || []).map(String).filter(Boolean);

      if (form._id) {
        const res = await updateSubOrgTeamMember(form._id, {
          ...form,
          eventId: currentEventId,
          assignedGates,
          assignedZones,
          permissions: {
            ...form.permissions,
            canEntryAccess:
              ['Staff', 'Volunteer'].includes(form.role) &&
              (form.operationScope === 'entry' ||
                form.operationScope === 'both'),
          },
        });
        toast.success('Member updated');
        if (res.data?.data?.user) {
          setTeam((prev) =>
            prev.map((u) => (u._id === form._id ? res.data.data.user : u))
          );
        }
      } else {
        await createSubOrgTeamMember({
          ...form,
          eventId: currentEventId,
          assignedGates,
          assignedZones,
          permissions: {
            ...form.permissions,
            canEntryAccess:
              ['Staff', 'Volunteer'].includes(form.role) &&
              (form.operationScope === 'entry' ||
                form.operationScope === 'both'),
          },
        });
        toast.success('Member created');
      }
      setModalOpen(false);
      if (!form._id) loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const staffCount = team.filter((u) => u.role === 'Staff').length;
  const volunteerCount = team.filter((u) => u.role === 'Volunteer').length;
  const activeCount = team.filter(
    (u) => String(u.status).toLowerCase() === 'active'
  ).length;

  const zoneLabel = (zid) =>
    myZones.find((z) => String(z.id || z.name) === String(zid))?.name || zid;

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
                    Team
                  </p>
                </div>
                <h1 className="mt-1.5 sm:mt-2.5 text-xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                  My Event Team
                </h1>
                <p className="mt-1 sm:mt-2 max-w-2xl text-xs sm:text-sm text-slate-500 leading-snug">
                  Staff and volunteers for your zones.
                </p>
              </div>
              <Button
                className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white shrink-0 touch-manipulation"
                onClick={handleCreate}
              >
                <UserPlusIcon className="mr-1.5 h-4 w-4" />
                Add Team Member
              </Button>
            </div>
          </div>
        </Card>

        {/* Metrics — 3-col on mobile */}
        <section className="grid grid-cols-3 gap-2 sm:gap-4">
          <MetricCard
            title="Total"
            value={loading ? '—' : team.length}
            subtitle="Members"
            icon={UsersIcon}
          />
          <MetricCard
            title="Staff"
            value={loading ? '—' : staffCount}
            subtitle={`${volunteerCount} vol.`}
            icon={UsersIcon}
          />
          <MetricCard
            title="Active"
            value={loading ? '—' : activeCount}
            subtitle="Online"
            icon={UsersIcon}
          />
        </section>

        {/* Team list */}
        <Card
          className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
          padding={false}
        >
          <div className="border-b border-slate-100 bg-slate-50/40 px-4 py-3 sm:px-5 sm:py-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Team Members
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Personnel for your operations
            </p>
          </div>

          {loading ? (
            <div className="space-y-3 p-4 sm:p-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 sm:h-12 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : team.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-12 sm:px-6 sm:py-16 text-center">
              <div className="mb-3 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                <UsersIcon className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <p className="text-sm sm:text-base font-semibold text-slate-800">
                No team members yet
              </p>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Add staff or volunteers for your assigned operations.
              </p>
              <Button
                className="mt-4 sm:mt-5 w-full sm:w-auto bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white touch-manipulation"
                onClick={handleCreate}
              >
                <UserPlusIcon className="mr-1.5 h-4 w-4" />
                Add first member
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="divide-y divide-slate-100 sm:hidden">
                {pagedTeam.map((member) => (
                  <div key={member._id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">
                          {member.name}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600 mt-0.5">
                          {member.role}
                        </p>
                      </div>
                      <Badge
                        color={
                          String(member.status).toLowerCase() === 'active'
                            ? 'green'
                            : 'gray'
                        }
                      >
                        {member.status || '—'}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <p className="truncate">{member.email}</p>
                      {member.phone && <p>{member.phone}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {member.assignedGates?.length > 0 && (
                        <span className="rounded-md border border-teal-100 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                          Entry
                        </span>
                      )}
                      {member.assignedZones?.length > 0 && (
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          Zone
                        </span>
                      )}
                      {(member.assignedZones || []).slice(0, 3).map((zid) => (
                        <span
                          key={zid}
                          className="rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          {zoneLabel(zid)}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEdit(member)}
                      className="inline-flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-white text-xs font-semibold text-teal-700 active:bg-teal-50 touch-manipulation"
                    >
                      <PencilSquareIcon className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <Table className="min-w-[800px]">
                  <thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Role & Contact</Th>
                      <Th>Checkpoint</Th>
                      <Th>Zones</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Actions</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {pagedTeam.map((member) => (
                      <Tr key={member._id}>
                        <Td>
                          <p className="font-semibold text-slate-900">
                            {member.name}
                          </p>
                        </Td>
                        <Td>
                          <p className="text-xs font-bold uppercase tracking-wider text-teal-600">
                            {member.role}
                          </p>
                          <p className="text-sm text-slate-600">
                            {member.email}
                          </p>
                          <p className="text-xs text-slate-400">
                            {member.phone}
                          </p>
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {member.assignedGates?.length > 0 && (
                              <span className="rounded-md border border-teal-100 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                                Entry
                              </span>
                            )}
                            {member.assignedZones?.length > 0 && (
                              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                Zone
                              </span>
                            )}
                            {!member.assignedGates?.length &&
                              !member.assignedZones?.length && (
                                <span className="text-xs italic text-slate-400">
                                  No scope
                                </span>
                              )}
                          </div>
                          {member.assignedGates?.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {member.assignedGates.map((gate) => (
                                <span
                                  key={gate}
                                  className="rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  {gate}
                                </span>
                              ))}
                            </div>
                          )}
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {(member.assignedZones || []).map((zid) => (
                              <span
                                key={zid}
                                className="rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                {zoneLabel(zid)}
                              </span>
                            ))}
                            {!(member.assignedZones || []).length && (
                              <span className="text-xs italic text-slate-400">
                                —
                              </span>
                            )}
                          </div>
                        </Td>
                        <Td>
                          <Badge
                            color={
                              String(member.status).toLowerCase() === 'active'
                                ? 'green'
                                : 'gray'
                            }
                          >
                            {member.status || '—'}
                          </Badge>
                        </Td>
                        <Td className="text-right">
                          <button
                            type="button"
                            onClick={() => handleEdit(member)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-teal-200 px-2.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-50"
                          >
                            <PencilSquareIcon className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}

          {pages > 1 && (
            <div className="flex flex-col gap-2.5 border-t border-slate-100 bg-slate-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-center sm:text-left text-xs sm:text-sm text-slate-500 order-2 sm:order-1">
                Showing {pagedTeam.length} of {team.length}
              </p>
              <div className="flex justify-center gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-[40px] rounded-xl px-4 text-xs touch-manipulation"
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  className="min-h-[40px] rounded-xl px-4 text-xs touch-manipulation"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form._id ? 'Edit Team Member' : 'Add Team Member'}
        size="lg"
      >
        <div className="max-h-[75vh] space-y-4 sm:space-y-5 overflow-y-auto pr-0.5">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Full Name *
              </span>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
                placeholder="Full name"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Role *
              </span>
              <select
                value={form.role}
                onChange={(e) => updateRole(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
              >
                <option value="Staff">Staff</option>
                <option value="Volunteer">Volunteer</option>
                <option value="Auditor">Auditor</option>
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Email *
              </span>
              <input
                type="email"
                inputMode="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
                placeholder="staff@example.com"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Phone *
              </span>
              <input
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
                placeholder="+94..."
              />
            </label>
            {!form._id && (
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                  Temporary Password *
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
                  placeholder="Temporary password"
                />
                <p className="text-[11px] text-slate-400">
                  Member will change this on first login
                </p>
              </label>
            )}
          </div>

          {isCheckpointRole && (
            <>
              <div className="rounded-2xl border border-slate-200 p-3.5 sm:p-4">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                  Checkpoint Assignment
                </p>
                <p className="mt-1 text-[11px] sm:text-xs text-slate-500 mb-3">
                  Gates, zones, or both
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['entry', 'Entry'],
                    ['zone', 'Zone'],
                    ['both', 'Both'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setScope(value)}
                      className={`rounded-xl border px-2 py-2.5 sm:px-3 text-xs font-semibold transition touch-manipulation ${
                        form.operationScope === value
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 active:bg-teal-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 rounded-xl border border-teal-100 bg-teal-50/80 px-3 py-2 text-[11px] sm:text-xs text-teal-800 leading-snug">
                  {scopeDescriptions[form.operationScope]}
                </p>

                {(form.operationScope === 'entry' ||
                  form.operationScope === 'both') && (
                  <div className="mt-4 space-y-2">
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                      Entry Points
                    </p>
                    {(form.assignedGates || []).map((gate, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          value={gate}
                          onChange={(e) => updateGateAt(index, e.target.value)}
                          className="flex-1 rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
                          placeholder="e.g. Main Gate"
                        />
                        {(form.assignedGates || []).length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-rose-500 border-rose-100 shrink-0 touch-manipulation"
                            onClick={() =>
                              setForm((curr) => ({
                                ...curr,
                                assignedGates: curr.assignedGates.filter(
                                  (_, i) => i !== index
                                ),
                              }))
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setForm((curr) => ({
                          ...curr,
                          assignedGates: [...(curr.assignedGates || []), ''],
                        }))
                      }
                      className="text-xs font-semibold text-teal-600 active:text-teal-700 touch-manipulation"
                    >
                      + Add entry point
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-3.5 sm:p-4">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                  Zone Access
                </p>
                <p className="mt-1 mb-3 text-[11px] sm:text-xs text-slate-500 leading-snug">
                  {form.operationScope === 'entry'
                    ? 'Disabled for entry-only scope.'
                    : 'Select zones this member can control.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {myZones.map((zone) => {
                    const zoneId = String(zone.id || zone.name);
                    const isChecked = (form.assignedZones || []).some(
                      (z) => String(z) === zoneId
                    );
                    return (
                      <label
                        key={zoneId}
                        className={`flex items-center gap-2.5 rounded-xl border p-3 sm:p-2.5 text-xs cursor-pointer transition touch-manipulation ${
                          form.operationScope === 'entry'
                            ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                            : isChecked
                            ? 'border-teal-200 bg-teal-50 text-teal-900 font-semibold'
                            : 'border-slate-100 active:border-teal-200 active:bg-teal-50/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={form.operationScope === 'entry'}
                          checked={isChecked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [
                                  ...new Set([
                                    ...(form.assignedZones || []),
                                    zoneId,
                                  ]),
                                ]
                              : (form.assignedZones || []).filter(
                                  (item) => String(item) !== zoneId
                                );
                            setForm((curr) => ({
                              ...curr,
                              assignedZones: next,
                            }));
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-teal-600"
                        />
                        {zone.name}
                      </label>
                    );
                  })}
                  {myZones.length === 0 && (
                    <p className="col-span-full text-center text-xs italic text-slate-400 py-2">
                      No zones assigned to you yet.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="rounded-2xl border border-slate-200 p-3.5 sm:p-4">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Capabilities
            </p>
            <p className="mt-1 mb-3 text-[11px] sm:text-xs text-slate-500">
              Actions this member can perform
            </p>
            <div className="space-y-2">
              {[
                ['canVerifyPhotos', 'Verify attendee photos'],
                ['canEntryAccess', 'Process gate entry'],
                ['canInviteAttendees', 'Send invites'],
                ['canCollectCash', 'Collect / confirm cash payments'],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 rounded-xl border p-3 sm:p-2.5 text-sm cursor-pointer transition touch-manipulation ${
                    key === 'canEntryAccess' &&
                    isCheckpointRole &&
                    form.operationScope === 'zone'
                      ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                      : form.permissions[key]
                      ? 'border-teal-200 bg-teal-50'
                      : 'border-slate-100 active:border-teal-200 active:bg-teal-50/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={
                      key === 'canEntryAccess' &&
                      isCheckpointRole &&
                      form.operationScope === 'zone'
                    }
                    checked={!!form.permissions[key]}
                    onChange={(e) =>
                      setForm((curr) => ({
                        ...curr,
                        permissions: {
                          ...curr.permissions,
                          [key]: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-teal-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 border-t border-slate-100 pt-4">
            <Button
              variant="outline"
              className="w-full sm:flex-1 py-3 sm:py-2.5 touch-manipulation"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:flex-1 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 py-3 sm:py-2.5 touch-manipulation"
              onClick={saveMember}
            >
              {form._id ? 'Update Member' : 'Create Member'}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default SubOrgTeam;