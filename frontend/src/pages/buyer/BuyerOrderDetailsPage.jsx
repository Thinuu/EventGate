import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BuyerLayout from '../../components/layout/BuyerLayout';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import {
  assignAttendee,
  getBuyerOrderDetails,
  resendInvite,
} from '../../api/buyer';
import {
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
  UserPlusIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  QrCodeIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

const statusPill = (status) => {
  const map = {
    PENDING: 'bg-slate-50 text-slate-700 border-slate-200',
    INVITED: 'bg-teal-50 text-teal-700 border-teal-200',
    PENDING_VERIFICATION: 'bg-amber-50 text-amber-800 border-amber-200',
    CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return map[status] || 'bg-slate-50 text-slate-700 border-slate-200';
};

const statusLabel = (status) => {
  const map = {
    PENDING: 'Not Assigned',
    INVITED: 'Invited',
    PENDING_VERIFICATION: 'Photo Submitted',
    CONFIRMED: 'Confirmed',
  };
  return map[status] || status;
};

const BuyerOrderDetailsPage = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingTicketId, setSavingTicketId] = useState(null);
  const [qrTicket, setQrTicket] = useState(null);
  const [paymentRequiredError, setPaymentRequiredError] = useState(null);

  const load = () => {
    setLoading(true);
    setPaymentRequiredError(null);
    return getBuyerOrderDetails(orderId)
      .then((res) => {
        setOrder(res.data?.data?.order || null);
        setTickets(res.data?.data?.tickets || []);
      })
      .catch((err) => {
        if (
          err.response?.status === 403 &&
          err.response?.data?.paymentRequired
        ) {
          setPaymentRequiredError(err.response.data.message);
        } else {
          toast.error(
            err.response?.data?.message || 'Failed to load order details'
          );
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [orderId]);

  const isAwaitingPayment =
    (['cash_on_entrance', 'cash_at_entrance'].includes(order?.paymentMethod) &&
      order?.status === 'RESERVED') ||
    (order?.paymentMethod === 'bank_transfer' &&
      order?.paymentStatus !== 'success' &&
      order?.paymentStatus !== 'paid');

  const isPaymentConfirmed =
    (['cash_on_entrance', 'cash_at_entrance'].includes(order?.paymentMethod) &&
      order?.status === 'CONFIRMED' &&
      order?.paymentStatus === 'paid') ||
    (order?.paymentMethod === 'bank_transfer' &&
      order?.status === 'CONFIRMED' &&
      (order?.paymentStatus === 'success' || order?.paymentStatus === 'paid'));

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleAssign = async (ticketId, form) => {
    setSavingTicketId(ticketId);
    try {
      await assignAttendee({
        ticketId,
        ...form,
        notificationChannel: 'email',
      });
      toast.success('Invite sent successfully!');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Assign failed');
    } finally {
      setSavingTicketId(null);
    }
  };

  const handleResend = async (ticketId) => {
    setSavingTicketId(ticketId);
    try {
      await resendInvite(ticketId, { notificationChannel: 'email' });
      toast.success('Invite code resent successfully!');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Resend failed');
    } finally {
      setSavingTicketId(null);
    }
  };

  const paymentMethodLabel =
    order?.paymentMethod === 'cash_at_entrance' ||
    order?.paymentMethod === 'cash_on_entrance'
      ? 'Cash at Entrance'
      : order?.paymentMethod === 'bank_transfer'
      ? 'Bank Transfer'
      : order?.paymentMethod || 'Card';

  return (
    <BuyerLayout>
      <div className="space-y-4 sm:space-y-6 pb-16 sm:pb-20">
        {/* Back link */}
        <Link
          to="/buyer/tickets"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 active:bg-slate-100 hover:text-slate-900 transition touch-manipulation"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span className="hidden xs:inline">Back to Tickets</span>
          <span className="xs:hidden">Back</span>
        </Link>

        {/* Payment required error */}
        {paymentRequiredError ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-slate-200/80 bg-white px-5 py-8 sm:px-6 sm:py-10 text-center shadow-sm">
            <div className="mx-auto flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <ExclamationTriangleIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <h3 className="mt-3 sm:mt-4 text-base font-bold text-slate-900">
              Payment Required
            </h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              {paymentRequiredError}
            </p>
            <Link
              to="/buyer/tickets"
              className="mt-5 sm:mt-6 inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition touch-manipulation"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <>
            {/* Order header card */}
            {order && (
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-5">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-slate-600">
                        Order #{order.orderNumber}
                      </span>
                      <span className="text-[11px] sm:text-xs text-slate-400">
                        Placed{' '}
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                      {order.event?.name}
                    </h1>
                    <div className="flex flex-col xs:flex-row xs:flex-wrap gap-1.5 xs:gap-x-4 xs:gap-y-1.5 text-xs sm:text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <CalendarIcon className="h-4 w-4 text-teal-500 shrink-0" />
                        <span className="truncate">
                          {formatDate(order.event?.startDate)}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <MapPinIcon className="h-4 w-4 text-teal-500 shrink-0" />
                        <span className="truncate">
                          {order.event?.venue?.name || 'Venue TBD'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Status grid — 2x2 on mobile */}
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                      <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Order
                      </p>
                      <p
                        className={`mt-1 text-xs sm:text-sm font-bold leading-snug ${
                          isAwaitingPayment
                            ? 'text-amber-700'
                            : 'text-slate-900'
                        }`}
                      >
                        {isAwaitingPayment
                          ? 'Awaiting Payment'
                          : order?.status || 'Pending'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                      <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Payment
                      </p>
                      <p
                        className={`mt-1 text-xs sm:text-sm font-bold leading-snug ${
                          order?.paymentStatus === 'awaiting_payment'
                            ? 'text-amber-700'
                            : order?.paymentStatus === 'paid' ||
                              order?.paymentStatus === 'success'
                            ? 'text-emerald-700'
                            : 'text-slate-900'
                        }`}
                      >
                        {order?.paymentStatus === 'awaiting_payment'
                          ? 'Awaiting'
                          : order?.paymentStatus === 'paid' ||
                            order?.paymentStatus === 'success'
                          ? 'Paid'
                          : order?.paymentStatus || 'Pending'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                      <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Tickets
                      </p>
                      <p
                        className={`mt-1 text-xs sm:text-sm font-bold leading-snug ${
                          isAwaitingPayment
                            ? 'text-rose-700'
                            : 'text-slate-900'
                        }`}
                      >
                        {isAwaitingPayment ? 'Not Issued' : 'Issued'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                      <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Method
                      </p>
                      <p className="mt-1 text-xs sm:text-sm font-bold text-slate-900 leading-snug truncate">
                        {paymentMethodLabel}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Ticket slots section */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between px-0.5">
                <h2 className="text-base font-bold text-slate-900">
                  Manage TicketSlots
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Assign a guest email to activate each pass
                </p>
              </div>

              {/* Awaiting payment notice */}
              {!loading && isAwaitingPayment && (
                <div className="flex gap-2.5 sm:gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-3.5 sm:px-4 sm:py-4">
                  <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-amber-900 leading-snug">
                      Tickets issued after payment
                    </h4>
                    <p className="mt-1 text-xs sm:text-sm text-amber-800 leading-relaxed">
                      {order?.paymentMethod === 'bank_transfer'
                        ? 'Payment is being verified. Features unlock after approval.'
                        : 'Complete payment at the venue before assigning or downloading.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Payment confirmed notice */}
              {!loading && isPaymentConfirmed && (
                <div className="flex gap-2.5 sm:gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-3.5 py-3.5 sm:px-4 sm:py-4">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-emerald-900 leading-snug">
                      Payment Confirmed – Tickets Issued
                    </h4>
                    <p className="mt-1 text-xs sm:text-sm text-emerald-800 leading-relaxed">
                      You can assign attendees, download tickets, and view QR
                      codes.
                    </p>
                  </div>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-36 sm:h-40 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60"
                    />
                  ))}
                </div>
              )}

              {/* Empty */}
              {!loading && tickets.length === 0 && (
                <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-10 sm:px-6 sm:py-12 text-center shadow-sm">
                  <p className="text-sm text-slate-500">
                    No ticket slots found in this order.
                  </p>
                </div>
              )}

              {/* Ticket cards */}
              {!loading && tickets.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
                  {tickets.map((ticket) => (
                    <TicketSlotCard
                      key={ticket._id}
                      ticket={ticket}
                      saving={savingTicketId === ticket._id}
                      onAssign={handleAssign}
                      onResend={handleResend}
                      onViewQr={() => setQrTicket(ticket)}
                      isAwaitingVenuePayment={isAwaitingPayment}
                      currency={
                        order?.currency ||
                        order?.event?.settings?.currency ||
                        'LKR'
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* QR Modal */}
      <Modal
        open={!!qrTicket}
        onClose={() => setQrTicket(null)}
        title="Access Pass QR Code"
        size="sm"
      >
        <div className="space-y-4 p-2 text-center">
          <div>
            <p className="text-base font-bold text-slate-900">
              {qrTicket?.attendee?.fullName || 'Access Pass'}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 truncate">
              {qrTicket?.attendee?.email}
            </p>
          </div>

          {qrTicket?.attendee?.qrCode ? (
            <div className="inline-block rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <img
                src={qrTicket.attendee.qrCode}
                alt="QR Code"
                className="mx-auto h-44 w-44 sm:h-48 sm:w-48 rounded-lg"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              QR code verification is not completed yet.
            </div>
          )}

          <div className="flex flex-col items-center gap-1 pt-1">
            <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
              {qrTicket?.categoryName}
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              Ticket ID: {qrTicket?.ticketNumber}
            </span>
          </div>
        </div>
      </Modal>
    </BuyerLayout>
  );
};

/* ───────────────────── Ticket Slot Card ───────────────────── */

const TicketSlotCard = ({
  ticket,
  saving,
  onAssign,
  onResend,
  onViewQr,
  isAwaitingVenuePayment,
  currency = 'LKR',
}) => {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });

  useEffect(() => {
    if (ticket?.attendee) {
      setForm({
        fullName: ticket.attendee?.fullName || '',
        email: ticket.attendee?.email || ticket.inviteEmail || '',
        phone: ticket.attendee?.phone || ticket.invitePhone || '',
      });
    } else {
      setForm({ fullName: '', email: '', phone: '' });
    }
  }, [ticket]);

  const isPending = ticket.status === 'PENDING' || ticket.status === 'SOLD';
  const isInvited = ticket.status === 'INVITED';
  const isSubmitted = ticket.status === 'PENDING_VERIFICATION';
  const isConfirmed = ticket.status === 'CONFIRMED';
  const isInvalidated =
    ticket.status === 'CANCELLED' || ticket.refundStatus === 'refunded';
  const isPhotoRejected =
    !isInvalidated &&
    String(ticket.attendee?.photoVerificationStatus || '').toLowerCase() ===
      'rejected';
  const resubmitHref = ticket.attendee?.resubmitToken
    ? `/resubmit/${ticket.attendee.resubmitToken}`
    : `/buyer/confirm/${ticket._id}`;

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2.5 sm:gap-3">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Slot #{ticket.slotIndex}
          </p>
          <p className="mt-0.5 sm:mt-1 truncate text-sm sm:text-base font-bold text-slate-900">
            {ticket.categoryName}
          </p>
          <p className="mt-0.5 sm:mt-1 truncate text-[11px] sm:text-xs font-medium text-slate-500">
            {ticket.attendee?.fullName ||
              ticket.inviteEmail ||
              'No guest assigned'}
          </p>
          {ticket.status !== 'PENDING' && (
            <div className="mt-1.5 sm:mt-2 space-y-0.5 font-mono text-[9px] sm:text-[10px] text-slate-400">
              {(ticket.inviteSentAt || ticket.createdAt) && (
                <p>
                  Assigned:{' '}
                  {new Date(
                    ticket.inviteSentAt || ticket.createdAt
                  ).toLocaleString()}
                </p>
              )}
              {isConfirmed &&
                (ticket.attendee?.confirmedAt || ticket.updatedAt) && (
                  <p>
                    Confirmed:{' '}
                    {new Date(
                      ticket.attendee?.confirmedAt || ticket.updatedAt
                    ).toLocaleString()}
                  </p>
                )}
            </div>
          )}
        </div>

        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] sm:text-[11px] font-bold ${
            isInvalidated
              ? 'bg-slate-50 text-slate-700 border-slate-200'
              : isPhotoRejected
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : statusPill(ticket.status)
          }`}
        >
          {isInvalidated
            ? 'Invalidated'
            : isPhotoRejected
            ? 'Rejected'
            : statusLabel(ticket.status)}
        </span>
      </div>

      {/* Assign form */}
      {isPending && (
        <div className="space-y-2.5 sm:space-y-3 border-t border-slate-100 pt-3">
          <div className="flex flex-col gap-2">
            <input
              value={form.fullName}
              onChange={(e) =>
                setForm((f) => ({ ...f, fullName: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
              placeholder="Guest Full Name"
            />
            <input
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
              placeholder="Guest Email Address"
              type="email"
              inputMode="email"
            />
            <input
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
              placeholder="Guest Mobile (optional)"
              type="tel"
              inputMode="tel"
            />
          </div>

          <button
            type="button"
            onClick={() => onAssign(ticket._id, form)}
            disabled={
              saving || !form.email.trim() || isAwaitingVenuePayment
            }
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-4 py-3 sm:py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-500 active:bg-teal-700 disabled:opacity-50 transition touch-manipulation"
          >
            {saving ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Sending…
              </>
            ) : (
              <>
                <UserPlusIcon className="h-4 w-4" />
                Assign & Invite
              </>
            )}
          </button>
        </div>
      )}

      {/* Invalidated */}
      {isInvalidated && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4 space-y-1.5">
          <p className="text-xs font-bold text-slate-800">Ticket invalidated</p>
          <p className="text-[11px] leading-relaxed text-slate-600">
            {ticket.invalidationReason ||
              'Maximum photo resubmissions were reached.'}
          </p>
          {ticket.refundAmount > 0 && (
            <p className="text-[11px] font-semibold text-emerald-700">
              Refund: {currency}{' '}
              {Number(ticket.refundAmount).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Photo rejected */}
      {isPhotoRejected && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 sm:p-4 space-y-2.5 sm:space-y-3">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-rose-800">
                Photo verification rejected
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                {ticket.attendee?.photoRejectionReason ||
                  'Please upload a clearer verification photo.'}
              </p>
            </div>
          </div>
          <Link
            to={resubmitHref}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 active:bg-rose-700 transition touch-manipulation"
          >
            <PhotoIcon className="h-3.5 w-3.5" />
            Resubmit Photo
          </Link>
        </div>
      )}

      {/* Invited / Submitted */}
      {(isInvited || isSubmitted) && !isPhotoRejected && (
        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2.5 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            {isInvited ? (
              <ClockIcon className="h-4 w-4 text-slate-400 shrink-0" />
            ) : (
              <CheckBadgeIcon className="h-4 w-4 text-teal-500 shrink-0" />
            )}
            <span>
              {isInvited ? 'Awaiting confirmation' : 'Photo submitted'}
            </span>
          </div>
          {isInvited && (
            <button
              type="button"
              onClick={() => onResend(ticket._id)}
              disabled={saving || isAwaitingVenuePayment}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition touch-manipulation w-full xs:w-auto"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Resend invite
            </button>
          )}
        </div>
      )}

      {/* Confirmed + QR */}
      {isConfirmed && ticket.attendee?.qrCode && (
        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2.5 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircleIcon className="h-4 w-4 shrink-0" />
            Ticket Active
          </div>
          <button
            type="button"
            onClick={onViewQr}
            disabled={isAwaitingVenuePayment}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition touch-manipulation w-full xs:w-auto"
          >
            <QrCodeIcon className="h-3.5 w-3.5 text-slate-400" />
            View QR Code
          </button>
        </div>
      )}
    </div>
  );
};

export default BuyerOrderDetailsPage;