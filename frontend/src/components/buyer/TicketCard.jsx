import React from 'react';
import { Link } from 'react-router-dom';
import {
  QrCodeIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  MapPinIcon,
  ShieldCheckIcon,
  ClockIcon,
  ArrowPathIcon,
  UserPlusIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import QRCodeDisplay from '../attendee/QRCodeDisplay';

const TicketCard = ({ pass, onDownload, downloading, onResend, resending }) => {
  const isInvalidated =
    pass.status === 'CANCELLED' || pass.refundStatus === 'refunded';
  const isPhotoVerified =
    !isInvalidated &&
    String(pass.attendee?.photoVerificationStatus || '').toLowerCase() ===
      'verified';
  const isPhotoRejected =
    !isInvalidated &&
    String(pass.attendee?.photoVerificationStatus || '').toLowerCase() ===
      'rejected';
  const isConfirmed =
    !isInvalidated && (pass.status === 'CONFIRMED' || isPhotoVerified);
  const isPendingVerification =
    !isInvalidated &&
    !isPhotoVerified &&
    !isPhotoRejected &&
    (pass.status === 'PENDING_VERIFICATION' ||
      (pass.status === 'ASSIGNED' &&
        pass.attendee?.photo &&
        pass.event?.requirePhotoVerification));
  const hasQrAccess =
    isConfirmed &&
    (pass.attendee?.qrCode || pass.attendee?.qrToken || pass.qrToken);
  const resubmitHref = pass.attendee?.resubmitToken
    ? `/resubmit/${pass.attendee.resubmitToken}`
    : `/buyer/confirm/${pass._id}`;

  const isPaid =
    ['paid', 'success', 'approved', 'verified'].includes(
      pass.paymentStatus?.toLowerCase()
    ) ||
    pass.orderStatus === 'CONFIRMED' ||
    pass.order?.status === 'CONFIRMED';
  const isCashUnpaid =
    (pass.paymentMethod === 'cash_at_entrance' ||
      pass.paymentMethod === 'cash_on_entrance') &&
    !isPaid;
  const isBankUnpaid = pass.paymentMethod === 'bank_transfer' && !isPaid;
  const isWaitingPayment = !isPaid && (isCashUnpaid || isBankUnpaid);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStatusPill = () => {
    if (isInvalidated) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
          <ExclamationTriangleIcon className="h-3.5 w-3.5" />
          Invalidated
        </span>
      );
    }
    if (pass.status === 'INVITED') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
          <UserPlusIcon className="h-3.5 w-3.5" />
          Invited
        </span>
      );
    }
    if (isConfirmed) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
          <CheckCircleSolid className="h-3.5 w-3.5" />
          Active Pass
        </span>
      );
    }
    if (isPhotoRejected) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
          <ExclamationTriangleIcon className="h-3.5 w-3.5" />
          Photo Rejected
        </span>
      );
    }
    if (isPendingVerification) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-700">
          Awaiting Verification
        </span>
      );
    }
    if (isWaitingPayment) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
          Waiting for Payment
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        Pending Action
      </span>
    );
  };

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* ── Top: Event info ── */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Category + Status */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
            {pass.categoryName || 'Standard'}
          </span>
          {renderStatusPill()}
        </div>

        {/* Event details */}
        <div>
          <h4 className="text-base font-bold text-slate-900 leading-snug line-clamp-2">
            {pass.event?.name}
          </h4>
          <div className="mt-2.5 space-y-1.5 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-teal-500" />
              <span>
                {formatDate(pass.event?.startDate)}
                {pass.event?.startDate && (
                  <> · {formatTime(pass.event?.startDate)}</>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-teal-500" />
              <span className="truncate">
                {pass.event?.venue?.name || 'Venue TBD'}
              </span>
            </div>
          </div>
        </div>

        {/* Attendee + Ticket # */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
          <span className="truncate font-medium text-slate-500">
            <span className="text-slate-400">Attendee:</span>{' '}
            {pass.attendee?.fullName || 'Not assigned'}
          </span>
          <span className="shrink-0 font-mono font-semibold text-slate-600">
            #{pass.ticketNumber}
          </span>
        </div>
      </div>

      {/* ── Ticket tear ── */}
      <div className="relative flex items-center px-5">
        <div className="absolute left-0 h-5 w-5 -translate-x-1/2 rounded-full border border-slate-200 bg-slate-50" />
        <div className="w-full border-t border-dashed border-slate-200" />
        <div className="absolute right-0 h-5 w-5 translate-x-1/2 rounded-full border border-slate-200 bg-slate-50" />
      </div>

      {/* ── Bottom: QR / Actions ── */}
      <div className="bg-slate-50/60 p-5">
        {hasQrAccess ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
              <QRCodeDisplay
                value={
                  pass.attendee?.qrCode ||
                  pass.attendee?.qrToken ||
                  pass.qrToken
                }
                size={100}
              />
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium text-slate-500">
                Present this QR at the entry gate
              </p>
              <button
                type="button"
                onClick={onDownload}
                disabled={downloading}
                className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-50 transition"
              >
                {downloading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Downloading…
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>
        ) : isInvalidated ? (
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-500">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <p className="text-xs font-bold text-slate-800">
                Ticket Invalidated
              </p>
              <p className="text-[11px] leading-relaxed text-slate-600">
                {pass.invalidationReason ||
                  'Maximum photo resubmissions were reached. This pass is no longer valid.'}
              </p>
              {pass.refundAmount > 0 && (
                <p className="text-[11px] font-semibold text-emerald-700">
                  Refund initiated:{' '}
                  {pass.currency ||
                    pass.eventId?.settings?.currency ||
                    'LKR'}{' '}
                  {Number(pass.refundAmount).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ) : isPhotoRejected ? (
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-2.5">
              <div>
                <p className="text-xs font-bold text-rose-800">
                  Photo Verification Rejected
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                  {pass.attendee?.photoRejectionReason ||
                    'Your submitted photo was rejected. Please upload a new verification photo.'}
                </p>
              </div>
              <Link
                to={resubmitHref}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 transition"
              >
                <PhotoIcon className="h-3.5 w-3.5" />
                Resubmit Photo
              </Link>
            </div>
          </div>
        ) : isPendingVerification ? (
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
              <ClockIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-800">
                Awaiting Photo Verification
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                The organiser is reviewing your photo. QR will unlock upon
                approval.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400">
              <QrCodeIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-2.5">
              <p className="text-xs text-slate-500">
                {pass.attendee?.isConfirmed ||
                pass.attendee?.confirmationStatus === 'confirmed'
                  ? 'Pass confirmed. QR code will appear after photo approval.'
                  : pass.status === 'INVITED'
                  ? 'Invite sent to guest. Awaiting confirmation.'
                  : 'Complete confirmation to view QR & PDF'}
              </p>

              {!(
                pass.attendee?.isConfirmed ||
                pass.attendee?.confirmationStatus === 'confirmed'
              ) &&
                (pass.status === 'INVITED' ? (
                  <button
                    type="button"
                    onClick={onResend}
                    disabled={resending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-50 transition"
                  >
                    <ArrowPathIcon className="h-3.5 w-3.5" />
                    {resending ? 'Resending…' : 'Resend Invite'}
                  </button>
                ) : isWaitingPayment ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-amber-700">
                      {pass.paymentMethod === 'bank_transfer'
                        ? 'Payment is awaiting verification. Features unlock after approval (usually within 48 hours).'
                        : 'Payment must be completed at the venue before tickets can be issued.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-500 cursor-not-allowed"
                      >
                        <ShieldCheckIcon className="h-3.5 w-3.5" />
                        Confirm Pass
                      </button>
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-500 cursor-not-allowed"
                      >
                        <UserPlusIcon className="h-3.5 w-3.5" />
                        Invite Guest
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/buyer/confirm/${pass._id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
                    >
                      <ShieldCheckIcon className="h-3.5 w-3.5" />
                      Confirm Pass
                    </Link>
                    <Link
                      to={`/buyer/assign/${pass.orderId || pass.order}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-500 transition"
                    >
                      <UserPlusIcon className="h-3.5 w-3.5" />
                      Invite Guest
                    </Link>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketCard;