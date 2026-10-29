import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrderByToken, finalizeOrder } from '../../api/orders';
import { assignTicket, inviteTicket } from '../../api/attendees';
import { format } from 'date-fns';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import PhotoValidationFeedback from '../../components/shared/PhotoValidationFeedback';
import { usePhotoAiValidation } from '../../hooks/usePhotoAiValidation';
import toast from 'react-hot-toast';
import {
  TicketIcon,
  CheckBadgeIcon,
  EnvelopeIcon,
  PhotoIcon,
  XMarkIcon,
  ArrowRightIcon,
  UserIcon,
  CalendarDaysIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { getAssetUrl } from '../../utils/backend';

const ConfirmOrderPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState({});
  const [assigning, setAssigning] = useState({});
  const [finalizing, setFinalizing] = useState(false);

  // Modals
  const [assignModal, setAssignModal] = useState({ open: false, ticketId: null });
  const [inviteModal, setInviteModal] = useState({ open: false, ticketId: null });

  const [assignForm, setAssignForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    nationalId: '',
    passportNumber: '',
    photo: null,
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [assignErrors, setAssignErrors] = useState({});
  const [inviteForm, setInviteForm] = useState({
    email: '',
    phone: '',
    notificationChannel: 'email',
  });

  const {
    validationErrors,
    allowOverride,
    setAllowOverride,
    qualityAnalysis,
    faceAnalysis,
    validating,
    validateFile,
    resetValidation,
    appendValidationToFormData,
    canSubmitPhoto,
    modelLoadFailed,
    imageRef,
    overlayRef,
  } = usePhotoAiValidation();

  const load = () =>
    getOrderByToken(token)
      .then((r) => setData(r.data.data))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, [token]);

  // ─── Invite ───────────────────────────────────────────────────────
  const handleInvite = (ticketId) => {
    setInviteModal({ open: true, ticketId });
    setInviteForm({ email: '', phone: '', notificationChannel: 'email' });
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteForm.email) return toast.error('Email is required');
    if (
      (inviteForm.notificationChannel === 'sms' || inviteForm.notificationChannel === 'both') &&
      !inviteForm.phone
    ) {
      return toast.error('Phone number is required for SMS notifications');
    }
    if (inviteForm.phone && !phoneRegex.test(inviteForm.phone.trim())) {
      return toast.error('Enter a valid international phone number (e.g. +1234567890)');
    }

    setInviting((i) => ({ ...i, [inviteModal.ticketId]: true }));
    try {
      await inviteTicket({
        ticketId: inviteModal.ticketId,
        email: inviteForm.email,
        phone: inviteForm.phone,
        notificationChannel: inviteForm.notificationChannel,
      });
      toast.success(`Invite sent to ${inviteForm.email}`);
      setInviteModal({ open: false, ticketId: null });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invite');
    } finally {
      setInviting((i) => ({ ...i, [inviteModal.ticketId]: false }));
    }
  };

  // ─── Assign ───────────────────────────────────────────────────────
  const handleAssignMyself = (ticketId) => {
    setAssignModal({ open: true, ticketId });
    setAssignForm({
      fullName: order?.buyerName || '',
      email: order?.buyerEmail || '',
      phone: order?.buyerPhone || '',
      dateOfBirth: '',
      nationalId: '',
      passportNumber: '',
      photo: null,
    });
    setPhotoPreview(null);
    resetValidation();
    setAssignErrors({});
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setAssigning((a) => ({ ...a, [assignModal.ticketId]: true }));
    setAssignErrors({});

    try {
      if (assignForm.phone && !/^\+?[0-9]{9,15}$/.test(assignForm.phone.trim())) {
        setAssignErrors({ phone: 'Phone number is invalid' });
        setAssigning((a) => ({ ...a, [assignModal.ticketId]: false }));
        return;
      }

      if (assignForm.photo && !canSubmitPhoto(true)) {
        toast.error('Please fix photo validation issues or allow override.');
        setAssigning((a) => ({ ...a, [assignModal.ticketId]: false }));
        return;
      }

      let payload;
      if (assignForm.photo) {
        payload = new FormData();
        payload.append('ticketId', assignModal.ticketId);
        payload.append('fullName', assignForm.fullName);
        payload.append('email', assignForm.email);
        payload.append('phone', assignForm.phone);
        payload.append('dateOfBirth', assignForm.dateOfBirth);
        payload.append('nationalId', assignForm.nationalId);
        payload.append('passportNumber', assignForm.passportNumber);
        payload.append('photo', assignForm.photo);
        appendValidationToFormData(payload);
      } else {
        payload = {
          ticketId: assignModal.ticketId,
          fullName: assignForm.fullName,
          email: assignForm.email,
          phone: assignForm.phone,
          dateOfBirth: assignForm.dateOfBirth,
          nationalId: assignForm.nationalId,
          passportNumber: assignForm.passportNumber,
        };
      }

      await assignTicket(payload);
      toast.success('Ticket assigned successfully!');
      setAssignModal({ open: false, ticketId: null });
      setPhotoPreview(null);
      resetValidation();
      load();
    } catch (err) {
      if (err.response?.data?.errors) {
        const errors = {};
        err.response.data.errors.forEach((error) => {
          errors[error.path] = error.msg;
        });
        setAssignErrors(errors);
      } else {
        toast.error('Failed to assign ticket');
      }
    } finally {
      setAssigning((a) => ({ ...a, [assignModal.ticketId]: false }));
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-[3px] border-brand-main border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">Loading your order…</p>
        </div>
      </div>
    );
  }

  // ─── Not Found ────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-teal-50">
          <TicketIcon className="h-10 w-10 text-brand-main" />
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
          Order Not Found
        </h2>
        <p className="mt-3 max-w-md text-sm font-medium text-slate-500">
          This order confirmation link may have expired or is invalid.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-8 rounded-2xl bg-slate-900 px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-brand-main"
        >
          Back to Homepage
        </button>
      </div>
    );
  }

  const { order, tickets } = data;
  const assigned = tickets.filter(
    (t) => t.status === 'ASSIGNED' || t.status === 'CONFIRMED'
  ).length;
  const progressPercentage = tickets.length > 0 ? (assigned / tickets.length) * 100 : 0;
  const allAssigned = assigned === tickets.length;
  const currency = order?.currency || order?.event?.settings?.currency || 'LKR';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ────────────── Hero Header ────────────── */}
      <div className="relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-main/20 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <TicketIcon className="h-8 w-8 text-white" />
          </div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-white/50">
            Order Confirmation
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
            Confirm Your Tickets
          </h1>
          <p className="mt-3 text-sm font-medium text-white/70">
            Order #{order.orderNumber} · {order.event?.name}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        {/* ────────────── Progress Card ────────────── */}
        <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
          <div className="px-8 py-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
                Confirmation Progress
              </h2>
              <span className="text-xs font-bold text-slate-500">
                {assigned} of {tickets.length} assigned
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-6 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-main to-emerald-500 transition-all duration-700 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {allAssigned ? (
              <div className="space-y-5">
                <div className="flex items-start gap-4 rounded-2xl bg-emerald-50 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                    <CheckBadgeIcon className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-900">All tickets assigned!</p>
                    <p className="mt-0.5 text-sm text-emerald-700">
                      Complete confirmation to finalize and send final ticket notifications with QR codes.
                    </p>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    if (!order?._id) return;
                    setFinalizing(true);
                    try {
                      await finalizeOrder(order._id, token);
                      toast.success('Tickets confirmed. Check your email or SMS shortly.');
                      load();
                    } catch (err) {
                      console.error('Finalize error:', err);
                      toast.error(err.response?.data?.message || 'Failed to finalize order');
                    } finally {
                      setFinalizing(false);
                    }
                  }}
                  disabled={finalizing}
                  className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-brand-main hover:shadow-[0_0_30px_rgba(37,99,235,0.35)] disabled:opacity-60"
                >
                  {finalizing ? 'Processing…' : 'Complete Confirmation'}
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Please assign all ticket holders to complete your order.
              </p>
            )}
          </div>
        </div>

        {/* ────────────── Order Summary ────────────── */}
        <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
              Order Summary
            </h2>
          </div>

          <div className="space-y-8 p-8">
            {/* Buyer Info */}
            <div>
              <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Buyer Information
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-400">Name</p>
                  <p className="mt-1 font-bold text-slate-900">{order?.buyerName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Email</p>
                  <p className="mt-1 font-bold text-slate-900">{order?.buyerEmail || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Phone</p>
                  <p className="mt-1 font-bold text-slate-900">{order?.buyerPhone || '—'}</p>
                </div>
              </div>
            </div>

            {/* Event Info */}
            <div className="grid grid-cols-1 gap-6 border-t border-slate-50 pt-8 sm:grid-cols-2">
              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-brand-main">
                    <TicketIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Event</p>
                    <p className="mt-0.5 font-bold text-slate-900">{order?.event?.name || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-brand-main">
                    <CalendarDaysIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Date & Time</p>
                    <p className="mt-0.5 font-bold text-slate-900">
                      {order?.event?.startDate
                        ? format(new Date(order.event.startDate), "EEEE, MMMM d, yyyy 'at' h:mm a")
                        : 'TBD'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-brand-main">
                    <MapPinIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Venue</p>
                    <p className="mt-0.5 font-bold text-slate-900">{order?.event?.venue?.name || '—'}</p>
                    {order?.event?.venue?.address && (
                      <p className="mt-0.5 text-sm text-slate-500">{order.event.venue.address}</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Total Amount</p>
                  <p className="mt-1 text-xl font-black tracking-tighter text-brand-main">
                    {currency} {order?.totalAmount?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ────────────── Tickets ────────────── */}
        <div>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
              Your Tickets
              <span className="ml-2 text-base font-bold text-slate-400">({tickets.length})</span>
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                allAssigned ? 'bg-emerald-50 text-emerald-700' : 'bg-teal-50 text-teal-700'
              }`}
            >
              {assigned}/{tickets.length} Assigned
            </span>
          </div>

          <div className="space-y-4">
            {tickets.map((ticket, index) => (
              <div
                key={ticket._id}
                className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm transition hover:border-slate-200"
              >
                <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left */}
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-slate-900">{ticket.categoryName}</h3>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              ticket.status === 'ASSIGNED' || ticket.status === 'CONFIRMED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : ticket.status === 'INVITED'
                                  ? 'bg-teal-50 text-teal-700'
                                  : ticket.status === 'PENDING'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {ticket.status === 'PENDING'
                              ? 'Needs Assignment'
                              : ticket.status === 'ASSIGNED'
                                ? 'Assigned'
                                : ticket.status === 'INVITED'
                                  ? 'Invited'
                                  : ticket.status === 'CONFIRMED'
                                    ? 'Confirmed'
                                    : ticket.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500">
                          Ticket #{ticket.ticketNumber}
                        </p>

                        {ticket.status !== 'PENDING' && (
                          <div className="mt-2 space-y-0.5 text-[10px] font-medium text-slate-400">
                            {(ticket.inviteSentAt || ticket.createdAt) && (
                              <p>
                                Assigned:{' '}
                                {new Date(ticket.inviteSentAt || ticket.createdAt).toLocaleString()}
                              </p>
                            )}
                            {(ticket.status === 'CONFIRMED' || ticket.status === 'ASSIGNED') &&
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
                    </div>

                    {/* Attendee card */}
                    {ticket.attendee && (
                      <div className="mt-4 ml-14 rounded-2xl bg-slate-50 p-4">
                        <div className="flex items-start gap-3">
                          {ticket.attendee.photo ? (
                            <img
                              src={getAssetUrl(ticket.attendee.photo)}
                              alt={ticket.attendee.fullName}
                              className="h-12 w-12 rounded-xl object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200">
                              <UserIcon className="h-5 w-5 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {ticket.attendee.fullName}
                            </p>
                            <p className="text-sm text-slate-500">{ticket.attendee.email}</p>
                            {ticket.attendee.photoVerificationStatus && (
                              <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                                <PhotoIcon className="h-3 w-3" />
                                Photo {ticket.attendee.photoVerificationStatus}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right actions */}
                  <div className="flex shrink-0 flex-col items-end gap-2 sm:ml-4">
                    {ticket.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleAssignMyself(ticket._id)}
                          disabled={assigning[ticket._id]}
                          className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-brand-main disabled:opacity-60"
                        >
                          {assigning[ticket._id] ? 'Assigning…' : 'Assign Myself'}
                        </button>
                        <button
                          onClick={() => handleInvite(ticket._id)}
                          disabled={inviting[ticket._id]}
                          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {inviting[ticket._id] ? 'Sending…' : 'Send Invite'}
                        </button>
                      </>
                    )}

                    {ticket.status === 'INVITED' && (
                      <div className="text-center">
                        <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                          <EnvelopeIcon className="h-5 w-5" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-teal-600">
                          Invite Sent
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{ticket.inviteEmail}</p>
                      </div>
                    )}

                    {(ticket.status === 'ASSIGNED' || ticket.status === 'CONFIRMED') && (
                      <div className="text-center">
                        <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                          <CheckBadgeIcon className="h-5 w-5" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                          Assigned
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ────────────── Help ────────────── */}
        <div className="overflow-hidden rounded-[32px] border border-teal-100 bg-teal-50/50 p-8">
          <h3 className="text-sm font-black uppercase tracking-widest text-teal-900">
            Need Help?
          </h3>
          <p className="mt-2 max-w-lg text-sm text-teal-800/80">
            If you have any questions about confirming your tickets or need assistance, please
            contact our support team.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="mailto:support@entrynex.lk"
              className="rounded-xl border border-teal-200 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-wider text-teal-700 transition hover:bg-teal-50"
            >
              Email Support
            </a>
            <a
              href="tel:+94123456789"
              className="rounded-xl border border-teal-200 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-wider text-teal-700 transition hover:bg-teal-50"
            >
              Call Support
            </a>
          </div>
        </div>
      </div>

      {/* ────────────── Assign Modal ────────────── */}
      <Modal
        open={assignModal.open}
        onClose={() => setAssignModal({ open: false, ticketId: null })}
        title="Assign Ticket to Yourself"
        size="md"
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <Input
            label="Full Name *"
            value={assignForm.fullName}
            onChange={(e) => setAssignForm((f) => ({ ...f, fullName: e.target.value }))}
            error={assignErrors.fullName}
            placeholder="Enter your full name"
            required
          />
          <Input
            label="Email Address *"
            type="email"
            value={assignForm.email}
            onChange={(e) => setAssignForm((f) => ({ ...f, email: e.target.value }))}
            error={assignErrors.email}
            placeholder="Enter your email address"
            required
          />
          <Input
            label="Phone Number"
            type="tel"
            value={assignForm.phone}
            onChange={(e) => setAssignForm((f) => ({ ...f, phone: e.target.value }))}
            error={assignErrors.phone}
            placeholder="+1234567890"
          />
          <Input
            label="Date of Birth"
            type="date"
            value={assignForm.dateOfBirth}
            onChange={(e) => setAssignForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
            error={assignErrors.dateOfBirth}
          />
          <Input
            label="National ID / NIC"
            value={assignForm.nationalId}
            onChange={(e) => setAssignForm((f) => ({ ...f, nationalId: e.target.value }))}
            error={assignErrors.nationalId}
            placeholder="Enter your National ID or NIC number"
          />
          <Input
            label="Passport Number"
            value={assignForm.passportNumber}
            onChange={(e) => setAssignForm((f) => ({ ...f, passportNumber: e.target.value }))}
            error={assignErrors.passportNumber}
            placeholder="Enter your passport number (if applicable)"
          />

          {/* Photo Upload */}
          <div className="border-t border-slate-100 pt-5">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Your Photo for Verification{' '}
              <span className="text-xs text-slate-400">(Optional but recommended)</span>
            </label>
            <div className="flex flex-col gap-3">
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={async (e) => {
                  if (e.target.files?.[0]) {
                    const file = e.target.files[0];
                    await validateFile(file);
                    setAssignForm((f) => ({ ...f, photo: file }));
                    const reader = new FileReader();
                    reader.onloadend = () => setPhotoPreview(reader.result);
                    reader.readAsDataURL(file);
                  }
                }}
                className="block w-full cursor-pointer text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-teal-700 hover:file:bg-teal-100"
              />

              {photoPreview && (
                <div className="relative flex justify-center">
                  <img
                    ref={imageRef}
                    src={photoPreview}
                    alt="Preview"
                    className="max-h-48 max-w-xs rounded-2xl border-2 border-teal-100 shadow-md"
                  />
                  <canvas
                    ref={overlayRef}
                    className="pointer-events-none absolute inset-0 max-h-48 max-w-xs rounded-2xl"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAssignForm((f) => ({ ...f, photo: null }));
                      setPhotoPreview(null);
                      resetValidation();
                    }}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}

              {assignForm.photo && (
                <PhotoValidationFeedback
                  validationErrors={validationErrors}
                  qualityAnalysis={qualityAnalysis}
                  faceAnalysis={faceAnalysis}
                  allowOverride={allowOverride}
                  onAllowOverrideChange={setAllowOverride}
                  modelLoadFailed={modelLoadFailed}
                  validating={validating}
                />
              )}

              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <PhotoIcon className="h-3.5 w-3.5" />
                Upload a clear photo of your face for identity verification at event entry.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignModal({ open: false, ticketId: null })}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={assigning[assignModal.ticketId]}
              className="flex-1"
            >
              Assign Ticket
            </Button>
          </div>
        </form>
      </Modal>

      {/* ────────────── Invite Modal ────────────── */}
      <Modal
        open={inviteModal.open}
        onClose={() => setInviteModal({ open: false, ticketId: null })}
        title="Send Invite"
        size="md"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          <Input
            label="Email Address *"
            type="email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Enter invite email"
            required
          />
          <Input
            label="Phone Number"
            type="tel"
            value={inviteForm.phone}
            onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+1234567890"
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Send Via</label>
            <select
              value={inviteForm.notificationChannel}
              onChange={(e) =>
                setInviteForm((f) => ({ ...f, notificationChannel: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-brand-main focus:outline-none focus:ring-2 focus:ring-brand-main/20"
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="both">Email + SMS</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">
              Send Invite
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => setInviteModal({ open: false, ticketId: null })}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ConfirmOrderPage;