import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { getBuyerInvites, resendInvite } from '../../api/buyer';
import toast from 'react-hot-toast';
import {
  BellIcon,
  ArrowPathIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  EnvelopeIcon,
  PhoneIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

const badgeFor = (status) => {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    case 'PENDING_VERIFICATION':
      return 'bg-amber-50 border-amber-200 text-amber-800';
    case 'INVITED':
      return 'bg-teal-50 border-teal-200 text-teal-800';
    default:
      return 'bg-slate-50 border-slate-200 text-slate-700';
  }
};

const labelFor = (status) => {
  switch (status) {
    case 'CONFIRMED':
      return 'Confirmed';
    case 'PENDING_VERIFICATION':
      return 'Photo Submitted';
    case 'INVITED':
      return 'Invite Sent';
    default:
      return status;
  }
};

const BuyerInvitesPage = () => {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const load = () => {
    setLoading(true);
    return getBuyerInvites()
      .then((res) => setInvites(res.data?.data?.invites || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const grouped = useMemo(() => {
    const byEvent = new Map();
    invites.forEach((i) => {
      const key = i.event?._id || 'unknown';
      if (!byEvent.has(key)) byEvent.set(key, { event: i.event, invites: [] });
      byEvent.get(key).invites.push(i);
    });
    return Array.from(byEvent.values());
  }, [invites]);

  const totalPages = Math.max(1, Math.ceil(grouped.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedGroups = grouped.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResend = async (ticketId) => {
    setResending(ticketId);
    try {
      await resendInvite(ticketId, { notificationChannel: 'email' });
      toast.success('Invite resent successfully');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Resend failed');
    } finally {
      setResending(null);
    }
  };

  const metrics = useMemo(() => {
    const total = invites.length;
    const confirmed = invites.filter((i) => i.status === 'CONFIRMED').length;
    const submitted = invites.filter(
      (i) => i.status === 'PENDING_VERIFICATION'
    ).length;
    const pending = invites.filter((i) => i.status === 'INVITED').length;
    return { total, confirmed, submitted, pending };
  }, [invites]);

  return (
    <BuyerLayout>
      <div className="space-y-5 sm:space-y-6 pb-16 sm:pb-20">
        {/* ── Header ── */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-teal-500 ring-4 ring-teal-500/15" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Ticket Owner
                  </p>
                </div>
                <h1 className="mt-2 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
                  Invite Status Tracker
                </h1>
                <p className="mt-1.5 text-sm text-slate-500 max-w-xl">
                  Track invitation acceptance, photo submissions, and gate
                  verification. Resend active invite links when needed.
                </p>
              </div>
              <button
                type="button"
                onClick={load}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── Metrics ── */}
        {!loading && invites.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Total Invites
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {metrics.total}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                Confirmed
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {metrics.confirmed}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                Photos Submitted
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {metrics.submitted}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">
                Pending
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {metrics.pending}
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-40 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60"
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && invites.length === 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-14 text-center shadow-sm max-w-lg mx-auto">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              <BellIcon className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-base font-bold text-slate-900">
              No active invites
            </h3>
            <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
              You haven’t invited any guests yet. Assign an attendee to a ticket
              to send an invite.
            </p>
            <Link
              to="/buyer/tickets"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 transition"
            >
              Manage Purchases
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Grouped invites */}
        {!loading && invites.length > 0 && (
          <div className="space-y-5">
            {paginatedGroups.map((group) => (
              <div
                key={group.event?._id || 'event'}
                className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
              >
                {/* Event header */}
                <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                  <h3 className="text-base font-bold text-slate-900">
                    {group.event?.name || 'Event'}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4 text-teal-500 shrink-0" />
                      {formatDate(group.event?.startDate)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPinIcon className="h-4 w-4 text-teal-500 shrink-0" />
                      <span className="truncate max-w-[200px]">
                        {group.event?.venue?.name || 'Venue TBD'}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Invite cards */}
                <div className="grid grid-cols-1 gap-3 p-4 sm:p-5 md:grid-cols-2">
                  {group.invites.map((invite) => {
                    const isRejected =
                      invite.attendee?.photoVerificationStatus === 'rejected';

                    return (
                      <div
                        key={invite.ticketId}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {invite.attendee?.fullName || 'Anonymous Guest'}
                            </p>
                            <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                              <EnvelopeIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              {invite.attendee?.email}
                            </p>
                            {invite.attendee?.phone && (
                              <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                                <PhoneIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                {invite.attendee.phone}
                              </p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badgeFor(
                              invite.status
                            )}`}
                          >
                            {labelFor(invite.status)}
                          </span>
                        </div>

                        {/* Photo rejected */}
                        {isRejected && (
                          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                            <p className="text-xs font-bold text-rose-800">
                              Identity Photo Rejected
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                              {invite.attendee?.photoRejectionReason ||
                                'Please resubmit details.'}
                            </p>
                            <Link
                              to={
                                invite.attendee?.resubmitToken
                                  ? `/resubmit/${invite.attendee.resubmitToken}`
                                  : `/buyer/confirm/${invite.ticketId}`
                              }
                              className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-500 transition"
                            >
                              <PhotoIcon className="h-3.5 w-3.5" />
                              Resubmit Photo
                            </Link>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-2 border-t border-slate-200/60 pt-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            <ClockIcon className="h-3.5 w-3.5" />
                            Sent:{' '}
                            {invite.inviteSentAt
                              ? new Date(
                                  invite.inviteSentAt
                                ).toLocaleDateString()
                              : '—'}
                          </span>

                          {invite.status === 'INVITED' && (
                            <button
                              type="button"
                              onClick={() => handleResend(invite.ticketId)}
                              disabled={resending === invite.ticketId}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-50 transition"
                            >
                              <ArrowPathIcon className="h-3.5 w-3.5" />
                              {resending === invite.ticketId
                                ? 'Resending…'
                                : 'Resend Code'}
                            </button>
                          )}

                          {invite.status === 'CONFIRMED' && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                              <CheckCircleIcon className="h-3.5 w-3.5" />
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
                <p className="text-center sm:text-left text-xs text-slate-500">
                  Showing {startIndex + 1}–
                  {Math.min(startIndex + itemsPerPage, grouped.length)} of{' '}
                  {grouped.length} event groups
                </p>

                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                    <span className="hidden xs:inline">Previous</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        if (totalPages <= 5) return true;
                        return (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        );
                      })
                      .map((page, idx, arr) => {
                        const prev = arr[idx - 1];
                        const showEllipsis = prev && page - prev > 1;
                        return (
                          <React.Fragment key={page}>
                            {showEllipsis && (
                              <span className="px-1 text-xs text-slate-400">
                                …
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handlePageChange(page)}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition ${
                                currentPage === page
                                  ? 'bg-teal-600 text-white shadow-sm'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <span className="hidden xs:inline">Next</span>
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </BuyerLayout>
  );
};

export default BuyerInvitesPage;