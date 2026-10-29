import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { getSubAttendees, verifySubAttendee } from '../../api/sub';
import { getAssetUrl } from '../../utils/backend';
import toast from 'react-hot-toast';
import {
  PhotoIcon,
  CheckBadgeIcon,
  XCircleIcon,
  ArrowLeftIcon,
  ClockIcon,
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

const SubOrgVerificationPage = () => {
  const [items, setItems] = useState([]);
  const [reason, setReason] = useState('Face mismatch or unclear image');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [currentEventId, setCurrentEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );

  const load = async (eventId = currentEventId) => {
    setLoading(true);
    try {
      const params = { verificationStatus: 'pending' };
      if (eventId) params.eventId = eventId;
      const response = await getSubAttendees(params);
      setItems(
        (response.data?.data?.attendees || []).filter((a) => a.photo)
      );
      setLoadError('');
    } catch (error) {
      const message =
        error.response?.data?.message ||
        'Unable to load pending verifications.';
      setLoadError(message);
      setItems([]);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(currentEventId);

    const handleEventSelect = (event) => {
      const nextId = event.detail ? String(event.detail) : '';
      if (!nextId || nextId === 'undefined') return;
      setCurrentEventId(nextId);
      localStorage.setItem('lastSelectedEventId', nextId);
      load(nextId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const handleAction = async (attendeeId, status) => {
    setActionLoading(`${attendeeId}-${status}`);
    try {
      await verifySubAttendee({ attendeeId, status, reason });
      toast.success(
        status === 'verified'
          ? 'Photo approved.'
          : 'Photo rejected and attendee notified.'
      );
      await load(currentEventId);
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Unable to update verification.'
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
                  Verification
                </p>
              </div>
              <h1 className="mt-1.5 sm:mt-2.5 text-xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                Pending photo reviews
              </h1>
              <p className="mt-1 sm:mt-2 max-w-2xl text-xs sm:text-sm text-slate-500 leading-snug">
                Approve or reject photos for attendees in your zones.
              </p>
            </div>
          </div>
        </Card>

        {/* Metrics — 2-col always */}
        <section className="grid grid-cols-2 gap-2 sm:gap-4">
          <MetricCard
            title="Pending"
            value={loading ? '—' : items.length}
            subtitle="Awaiting"
            icon={ClockIcon}
          />
          <MetricCard
            title="With Photo"
            value={loading ? '—' : items.length}
            subtitle="To review"
            icon={PhotoIcon}
          />
        </section>

        {/* Reject reason */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-3.5 sm:p-5">
          <label className="block space-y-1.5">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
              Default reject reason
            </span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 sm:py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
              placeholder="Reason used for SMS and email on reject"
            />
            <p className="text-[10px] sm:text-[11px] text-slate-400 leading-snug">
              Used when you reject a photo. Attendee is notified.
            </p>
          </label>
        </Card>

        {loadError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:px-5 sm:py-4 text-xs sm:text-sm text-amber-800">
            {loadError}
          </div>
        )}

        {/* Cards grid */}
        {loading ? (
          <div className="grid gap-3 sm:gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 sm:h-72 animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-12 sm:px-6 sm:py-16 text-center">
            <div className="mb-3 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              <CheckBadgeIcon className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <p className="text-sm sm:text-base font-semibold text-slate-800">
              No pending verifications
            </p>
            <p className="mt-1 max-w-sm text-xs sm:text-sm text-slate-500 leading-snug">
              New photo uploads in your zones will appear here for review.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {items.map((attendee) => {
              const photoSrc = attendee.photo
                ? String(attendee.photo).startsWith('http')
                  ? attendee.photo
                  : getAssetUrl?.(attendee.photo) || attendee.photo
                : null;
              const approving =
                actionLoading === `${attendee._id}-verified`;
              const rejecting =
                actionLoading === `${attendee._id}-rejected`;

              return (
                <Card
                  key={attendee._id}
                  className="rounded-2xl border border-slate-200/80 bg-white shadow-sm active:border-teal-200 hover:border-teal-200 transition-all overflow-hidden"
                  padding={false}
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    {photoSrc ? (
                      <img
                        src={photoSrc}
                        alt={attendee.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 sm:p-4">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                      {attendee.fullName || '—'}
                    </h2>
                    <p className="mt-0.5 text-xs sm:text-sm text-slate-500 truncate">
                      {attendee.categoryName || 'No category'}
                    </p>
                    {(attendee.email || attendee.phone) && (
                      <p className="mt-0.5 text-[11px] sm:text-xs text-slate-400 truncate">
                        {attendee.email || attendee.phone}
                      </p>
                    )}
                    <div className="mt-3.5 sm:mt-4 flex gap-2">
                      <Button
                        className="flex-1 min-h-[44px] bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white touch-manipulation"
                        onClick={() =>
                          handleAction(attendee._id, 'verified')
                        }
                        disabled={!!actionLoading}
                      >
                        <CheckBadgeIcon className="mr-1.5 h-4 w-4" />
                        {approving ? '…' : 'Approve'}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 min-h-[44px] border-rose-200 text-rose-600 active:bg-rose-50 hover:bg-rose-50 touch-manipulation"
                        onClick={() =>
                          handleAction(attendee._id, 'rejected')
                        }
                        disabled={!!actionLoading}
                      >
                        <XCircleIcon className="mr-1.5 h-4 w-4" />
                        {rejecting ? '…' : 'Reject'}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubOrgVerificationPage;