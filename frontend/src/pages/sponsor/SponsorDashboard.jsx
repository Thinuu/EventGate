import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';
import {
  getSponsorWorkspace,
  getSponsorTeam,
  addSponsorTeamMember,
  removeSponsorTeamMember,
  downloadTicketPass,
} from '../../api/sponsor';
import {
  PlusIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const emptyMember = { fullName: '', email: '', phone: '' };

const SponsorDashboard = () => {
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [team, setTeam] = useState([]);
  const [memberModal, setMemberModal] = useState(false);
  const [memberForm, setMemberForm] = useState(emptyMember);

  // Confirmation modal state
  const [confirmRemove, setConfirmRemove] = useState(null); // holds the member object to remove

  const activeSection = params.get('section') || 'overview';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wsRes, teamRes] = await Promise.all([
        getSponsorWorkspace(),
        getSponsorTeam(),
      ]);
      setWorkspace(wsRes.data?.data);
      setTeam(teamRes.data?.data || []);
    } catch (error) {
      toast.error('Failed to load sponsor data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useAutoRefresh(loadData, {
    enabled: true,
    interval: 15000,
    immediate: false,
    deps: [],
  });

  const handleAddMember = async () => {
    if (!memberForm.fullName || !memberForm.email) {
      toast.error('Name and email are required');
      return;
    }
    try {
      await addSponsorTeamMember(memberForm);
      toast.success('Team member added and notified');
      setMemberModal(false);
      setMemberForm(emptyMember);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add member');
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;
    try {
      await removeSponsorTeamMember(confirmRemove._id);
      toast.success('Member removed');
      setConfirmRemove(null);
      loadData();
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const handleDownloadPass = async (token, name) => {
    if (!token) return toast.error('QR Token not found');
    try {
      const response = await downloadTicketPass(token);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Pass-${name.replace(/\s+/g, '-')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download pass');
    }
  };

  if (loading && !workspace)
    return (
      <DashboardLayout>
        <LoadingSkeleton />
      </DashboardLayout>
    );

  const pkg = workspace?.package;
  const event = workspace?.event;
  const capacity = Number(pkg?.capacity || 0);
  const teamCount = team.length;
  const remainingSlots = Math.max(capacity - teamCount, 0);
  const utilization =
    capacity > 0 ? Math.round((teamCount / capacity) * 100) : 0;
  const verifiedCount = team.filter(
    (m) =>
      String(m.photoVerificationStatus || '').toLowerCase() === 'verified'
  ).length;
  const pendingVerificationCount = team.filter(
    (m) =>
      String(m.photoVerificationStatus || '').toLowerCase() === 'pending'
  ).length;
  const confirmedPassCount = team.filter(
    (m) => String(m.confirmationStatus || '').toLowerCase() === 'confirmed'
  ).length;

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-24 sm:px-6">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-teal-500 ring-4 ring-teal-500/20" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Sponsor Portal
                </p>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {pkg?.name || 'Sponsor Package'}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {event?.name} · {event?.venue?.name}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Pass Capacity
                </p>
                <p className="mt-1 text-2xl font-bold text-teal-600">
                  {teamCount} / {capacity}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Utilization
                </p>
                <p className="mt-1 text-2xl font-bold text-teal-600">
                  {utilization}%
                </p>
                <p className="text-[10px] text-slate-500">
                  {remainingSlots} slots left
                </p>
              </div>
            </div>
          </div>
        </div>

        {activeSection === 'overview' && (
          <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
            {/* Metrics */}
            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Overview Metrics
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Live sponsor package and pass-holder health
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200/70 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Verified Profiles
                  </p>
                  <p className="mt-2 text-3xl font-bold text-emerald-600">
                    {verifiedCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Completed identity verification
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Pending Verification
                  </p>
                  <p className="mt-2 text-3xl font-bold text-amber-600">
                    {pendingVerificationCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Action needed by pass holders
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Confirmed Passes
                  </p>
                  <p className="mt-2 text-3xl font-bold text-teal-600">
                    {confirmedPassCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Ready for venue operations
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Capacity Remaining
                  </p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {remainingSlots}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Available seats in your package
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200/70 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">
                    Package usage
                  </span>
                  <span className="font-semibold text-slate-900">
                    {teamCount} / {capacity}
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-600 transition-all"
                    style={{ width: `${Math.min(utilization, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Package snapshot */}
            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Package Snapshot
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Current event and package context
              </p>

              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-slate-200/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Package Name
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {pkg?.name || '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Event
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {event?.name || '—'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {event?.venue?.name || '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Package Capacity
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">{capacity}</p>
                </div>
                <div className="rounded-xl border border-slate-200/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Summary
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {verifiedCount} verified, {pendingVerificationCount} pending,{' '}
                    {confirmedPassCount} confirmed passes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Members */}
        {(activeSection === 'overview' || activeSection === 'team') && (
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Team Members
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Manage your sponsor team. Members receive an email to verify
                  identity and receive their pass.
                </p>
              </div>
              {team.length < (pkg?.capacity || 0) && (
                <button
                  onClick={() => setMemberModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Member
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Name
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Verification
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Pass Status
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {team.map((member) => (
                    <tr key={member._id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900">
                          {member.fullName}
                        </p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                            member.photoVerificationStatus === 'verified'
                              ? 'bg-emerald-50 text-emerald-700'
                              : member.photoVerificationStatus === 'rejected'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {member.photoVerificationStatus || 'pending'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                            member.confirmationStatus === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-teal-50 text-teal-700'
                          }`}
                        >
                          {member.confirmationStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {member.confirmationStatus === 'confirmed' && (
                            <button
                              onClick={() =>
                                handleDownloadPass(
                                  member.qrToken || member.confirmationToken,
                                  member.fullName
                                )
                              }
                              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:underline"
                            >
                              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                              Download Pass
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmRemove(member)}
                            className="rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-50"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {team.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-12 text-center text-sm text-slate-500"
                      >
                        No team members added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {memberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-900">
                Add Team Member
              </h3>
              <button
                onClick={() => setMemberModal(false)}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-teal-100 bg-teal-50 p-3.5">
                <p className="text-xs text-teal-700">
                  The member will receive an email to confirm their identity
                  and photo for their entry pass.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Full Name *
                </label>
                <input
                  value={memberForm.fullName}
                  onChange={(e) =>
                    setMemberForm((c) => ({ ...c, fullName: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Email Address *
                </label>
                <input
                  value={memberForm.email}
                  onChange={(e) =>
                    setMemberForm((c) => ({ ...c, email: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                  placeholder="john@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Phone Number
                </label>
                <input
                  value={memberForm.phone}
                  onChange={(e) =>
                    setMemberForm((c) => ({ ...c, phone: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                  placeholder="+94 ..."
                />
              </div>
            </div>

            <div className="border-t border-slate-100 p-5">
              <button
                onClick={handleAddMember}
                className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                Add & Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-900">
                Remove Team Member
              </h3>
              <button
                onClick={() => setConfirmRemove(null)}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50 p-4">
                <ExclamationTriangleIcon className="h-6 w-6 shrink-0 text-rose-600" />
                <div>
                  <p className="text-sm font-semibold text-rose-800">
                    Are you sure?
                  </p>
                  <p className="mt-1 text-sm text-rose-700">
                    You are about to remove{' '}
                    <span className="font-bold">{confirmRemove.fullName}</span>{' '}
                    from your sponsor team. This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 p-5">
              <button
                onClick={handleConfirmRemove}
                className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                Yes, Remove
              </button>
              <button
                onClick={() => setConfirmRemove(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default SponsorDashboard;