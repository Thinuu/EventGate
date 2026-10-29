import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CheckBadgeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EnvelopeIcon,
  InformationCircleIcon,
  PhoneIcon,
  TicketIcon,
  UserPlusIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import PublicLayout from '../../components/layout/PublicLayout';
import { getBuyerOrderByToken, saveTicketAttendee, sendTicketInvite } from '../../api/orders';
import CameraCapture from '../../components/shared/CameraCapture';

const OrderConfirmationPage = () => {
  const { token } = useParams();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [inviteEmailByTicket, setInviteEmailByTicket] = useState({});
  const [invitePhoneByTicket, setInvitePhoneByTicket] = useState({});
  const [submittingTicketId, setSubmittingTicketId] = useState(null);
  const [formByTicket, setFormByTicket] = useState({});
  const [cameraTicketId, setCameraTicketId] = useState(null);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const response = await getBuyerOrderByToken(token);
      setPayload(response.data.data);
      setError('');
    } catch (err) {
      const errorMessage =
        err?.response?.data?.message || 'Unable to load this order confirmation link.';
      setError(errorMessage);
      setRequiresPayment(err?.response?.data?.requiresPayment || false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [token]);

  const formatCurrency = (value) => {
    // Get currency from order event settings, fallback to LKR
    const currency = 
      payload?.order?.event?.settings?.currency ||
      payload?.order?.event?.currency ||
      payload?.order?.currency ||
      'LKR';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return Number.isNaN(date.getTime())
      ? 'TBD'
      : date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
  };

  const isConfirmedTicket = (status) =>
    status === 'ASSIGNED' || status === 'CONFIRMED' || status === 'INVITED';

  const getTicketStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
      case 'ASSIGNED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-teal-700 border border-teal-100">
            <CheckCircleIcon className="h-3.5 w-3.5" /> Confirmed
          </span>
        );
      case 'INVITED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-teal-700 border border-teal-100">
            <EnvelopeIcon className="h-3.5 w-3.5" /> Invited
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border border-slate-200">
            Pending
          </span>
        );
    }
  };

  const totalTickets = payload?.tickets?.length || 0;
  const confirmedCount = useMemo(
    () => (payload?.tickets || []).filter((ticket) => isConfirmedTicket(ticket.status)).length,
    [payload]
  );
  const progressPercentage = totalTickets > 0 ? (confirmedCount / totalTickets) * 100 : 0;

  const getForm = (ticketId) =>
    formByTicket[ticketId] || {
      fullName: '',
      nationalId: '',
      passportNumber: '',
      dateOfBirth: '',
      email: '',
      phone: '',
      photo: null,
    };

  const updateForm = (ticketId, key, value) => {
    setFormByTicket((prev) => ({
      ...prev,
      [ticketId]: { ...getForm(ticketId), [key]: value },
    }));
  };

  const prefillBuyerDetails = (ticketId) => {
    const current = getForm(ticketId);
    const buyer = payload?.order || {};
    setFormByTicket((prev) => ({
      ...prev,
      [ticketId]: {
        ...current,
        fullName: current.fullName || buyer.buyerName || '',
        email: current.email || buyer.buyerEmail || '',
        phone: current.phone || buyer.buyerPhone || '',
      },
    }));
  };

  const toggleTicketForm = (ticketId) => {
    if (expandedTicketId === ticketId) {
      setExpandedTicketId(null);
      return;
    }
    prefillBuyerDetails(ticketId);
    setExpandedTicketId(ticketId);
  };

  const handleFillSubmit = async (ticketId) => {
    const form = getForm(ticketId);
    if (!form.fullName || !form.email) {
      toast.error('Full name and email are required.');
      return;
    }
    if (!form.photo) {
      toast.error('Identity Verification Photo is required.');
      return;
    }

    const body = new FormData();
    body.append('fullName', form.fullName);
    body.append('nationalId', form.nationalId);
    body.append('passportNumber', form.passportNumber);
    body.append('dateOfBirth', form.dateOfBirth);
    body.append('email', form.email);
    body.append('phone', form.phone);
    if (form.photo) body.append('photo', form.photo);
    body.append('ticketId', ticketId);

    setSubmittingTicketId(ticketId);
    try {
      await saveTicketAttendee(ticketId, body);
      toast.success('Attendee identity confirmed successfully!');
      setExpandedTicketId(null);
      await loadOrder();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save attendee details.');
    } finally {
      setSubmittingTicketId(null);
    }
  };

  const handleSendInvite = async (ticketId) => {
    const email = (inviteEmailByTicket[ticketId] || '').trim();
    const phone = (invitePhoneByTicket[ticketId] || '').trim();
    if (!email) {
      toast.error('Please enter an invite email address.');
      return;
    }
    if (payload?.smsEnabled && !phone) {
      toast.error('Please enter a phone number for SMS invite.');
      return;
    }
    if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone.trim().replace(/\s+/g, ''))) {
      toast.error('Please enter a valid international phone number');
      return;
    }

    setSubmittingTicketId(ticketId);
    try {
      await sendTicketInvite(ticketId, {
        email,
        phone: phone || undefined,
        notificationChannel: payload?.smsEnabled && phone ? 'both' : 'email',
      });
      toast.success('Secure invite link sent.');
      await loadOrder();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send invite.');
    } finally {
      setSubmittingTicketId(null);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-teal-600 border-t-transparent" />
            <p className="text-sm font-medium text-slate-500">Retrieving secure link...</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (error || !payload) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <div
            className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${
              requiresPayment ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
            }`}
          >
            <InformationCircleIcon className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {requiresPayment ? 'Payment Required' : 'Security Check Failed'}
          </h1>
          <p className="mt-3 text-sm text-slate-500 max-w-sm mx-auto">
            {error || 'This order link is no longer valid or has expired.'}
          </p>
          {requiresPayment && (
            <p className="mt-2 text-sm text-slate-500">
              Please complete payment at the venue or wait for bank transfer verification.
            </p>
          )}
          <div className="mt-8">
            <Link
              to="/buyer/dashboard"
              className="inline-flex rounded-2xl bg-teal-600 hover:bg-teal-700 px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition-all"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const { order, tickets } = payload;

  return (
    <PublicLayout>
      <div className="relative min-h-screen bg-slate-50 pb-16">
        {/* Header */}
        <div className="bg-slate-950 px-4 pt-14 pb-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-teal-400 mb-3">
                  Verification Portal
                </p>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                  {order?.event?.name || 'Order Details'}
                </h1>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                    Order #{order.orderNumber}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                    Buyer: {order.buyerName}
                  </span>
                </div>
              </div>

              <div className="w-full lg:w-72">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>Assignment Progress</span>
                  <span>
                    {confirmedCount}/{totalTickets}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-teal-500 rounded-full transition-all duration-700"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto -mt-14 max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Sidebar */}
            <div className="space-y-5">
              <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-900 px-5 py-3.5">
                  <h3 className="text-sm font-semibold text-teal-400">Order Information</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Event Date
                    </p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {formatDate(order?.event?.startDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Venue
                    </p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">
                      {order?.event?.venue?.name || 'TBD'}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Total
                    </p>
                    <p className="text-lg font-bold text-teal-600 mt-0.5">
                      {formatCurrency(order?.totalAmount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-teal-100 bg-teal-50 p-5">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-teal-900 mb-2">
                  <InformationCircleIcon className="h-4 w-4" />
                  Important Note
                </h4>
                <p className="text-sm text-teal-700 leading-relaxed">
                  Every ticket holder must confirm their identity to generate a valid entry QR. You
                  can fill details yourself or send an invite.
                </p>
              </div>
            </div>

            {/* Tickets */}
            <div className="lg:col-span-2 space-y-4">
              {tickets.map((ticket) => {
                const form = getForm(ticket._id);
                const isOpen = expandedTicketId === ticket._id;
                const confirmed = isConfirmedTicket(ticket.status);

                return (
                  <article
                    key={ticket._id}
                    className={`rounded-[28px] border bg-white shadow-sm overflow-hidden transition-all ${
                      confirmed ? 'border-teal-200' : 'border-slate-200'
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                              confirmed
                                ? 'bg-teal-50 text-teal-600'
                                : 'bg-slate-50 text-slate-400'
                            }`}
                          >
                            <TicketIcon className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Slot #{ticket.slotIndex}
                              </p>
                              {getTicketStatusBadge(ticket.status)}
                            </div>
                            <h3 className="text-base font-semibold text-slate-900">
                              {ticket.categoryName}
                            </h3>
                          </div>
                        </div>

                        {!confirmed && (
                          <button
                            type="button"
                            onClick={() => toggleTicketForm(ticket._id)}
                            className={`inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-semibold transition-all ${
                              isOpen
                                ? 'bg-slate-900 text-white'
                                : 'bg-teal-600 hover:bg-teal-500 text-white shadow-sm shadow-teal-200'
                            }`}
                          >
                            {isOpen ? 'Close' : 'Complete Identity'}
                            {isOpen ? (
                              <ChevronUpIcon className="h-4 w-4" />
                            ) : (
                              <ChevronDownIcon className="h-4 w-4" />
                            )}
                          </button>
                        )}

                        {confirmed && (
                          <div className="flex items-center gap-2.5 rounded-2xl bg-slate-50 border border-slate-100 px-3.5 py-2">
                            <div className="text-right">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Assigned To
                              </p>
                              <p className="text-sm font-semibold text-slate-900">
                                {ticket.attendee?.fullName || ticket.inviteEmail || 'Guest'}
                              </p>
                            </div>
                            <CheckBadgeIcon className="h-5 w-5 text-teal-500" />
                          </div>
                        )}
                      </div>

                      {isOpen && !confirmed && (
                        <div className="mt-6 grid gap-5 lg:grid-cols-2">
                          {/* Direct Fill */}
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                            <div className="flex items-center gap-2 mb-4">
                              <CheckBadgeIcon className="h-5 w-5 text-teal-600" />
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                                I’m Attending
                              </h4>
                            </div>
                            <div className="space-y-3">
                              <input
                                type="text"
                                value={form.fullName}
                                onChange={(e) => updateForm(ticket._id, 'fullName', e.target.value)}
                                placeholder="Full Name *"
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                              />
                              <input
                                type="email"
                                value={form.email}
                                onChange={(e) => updateForm(ticket._id, 'email', e.target.value)}
                                placeholder="Email Address *"
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                              />
                              <div className="grid grid-cols-2 gap-3">
                                <input
                                  type="text"
                                  value={form.nationalId}
                                  onChange={(e) =>
                                    updateForm(ticket._id, 'nationalId', e.target.value)
                                  }
                                  placeholder="NIC / Passport"
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                                />
                                <input
                                  type="date"
                                  value={form.dateOfBirth}
                                  onChange={(e) =>
                                    updateForm(ticket._id, 'dateOfBirth', e.target.value)
                                  }
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                                />
                              </div>

                              <div>
                                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                                  Identity Photo *
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                  <label className="group relative flex h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white transition-all hover:border-teal-400 hover:bg-teal-50/30">
                                    {form.photo ? (
                                      <img
                                        src={URL.createObjectURL(form.photo)}
                                        alt="Preview"
                                        className="h-full w-full rounded-xl object-cover p-1"
                                      />
                                    ) : (
                                      <div className="flex flex-col items-center">
                                        <UserPlusIcon className="h-6 w-6 text-slate-300 group-hover:text-teal-500" />
                                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-teal-600">
                                          Upload
                                        </p>
                                      </div>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) =>
                                        updateForm(ticket._id, 'photo', e.target.files?.[0] || null)
                                      }
                                      className="hidden"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => setCameraTicketId(ticket._id)}
                                    className="group flex h-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white transition-all hover:border-teal-400 hover:bg-teal-50/30"
                                  >
                                    <CameraIcon className="h-6 w-6 text-slate-300 group-hover:text-teal-500" />
                                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-teal-600">
                                      Camera
                                    </p>
                                  </button>
                                </div>
                                {cameraTicketId === ticket._id && (
                                  <CameraCapture
                                    onCapture={(file) => updateForm(ticket._id, 'photo', file)}
                                    onClose={() => setCameraTicketId(null)}
                                  />
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleFillSubmit(ticket._id)}
                                disabled={submittingTicketId === ticket._id}
                                className="w-full rounded-2xl bg-slate-900 hover:bg-slate-800 py-3.5 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50 transition-colors"
                              >
                                {submittingTicketId === ticket._id
                                  ? 'Saving...'
                                  : 'Confirm My Details'}
                              </button>
                            </div>
                          </div>

                          {/* Invite */}
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                            <div className="flex items-center gap-2 mb-4">
                              <UserPlusIcon className="h-5 w-5 text-teal-600" />
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                                Delegate Slot
                              </h4>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed mb-4">
                              We’ll send a secure confirmation link so your guest can fill their own
                              details.
                            </p>
                            <div className="space-y-3">
                              <div className="relative">
                                <EnvelopeIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="email"
                                  value={inviteEmailByTicket[ticket._id] || ''}
                                  onChange={(e) =>
                                    setInviteEmailByTicket((prev) => ({
                                      ...prev,
                                      [ticket._id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Guest Email"
                                  className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm font-medium outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                                />
                              </div>
                              <div className="relative">
                                <PhoneIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="tel"
                                  value={invitePhoneByTicket[ticket._id] || ''}
                                  onChange={(e) =>
                                    setInvitePhoneByTicket((prev) => ({
                                      ...prev,
                                      [ticket._id]: e.target.value,
                                    }))
                                  }
                                  placeholder={`Phone ${payload?.smsEnabled ? '*' : '(Optional)'}`}
                                  className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm font-medium outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSendInvite(ticket._id)}
                                disabled={submittingTicketId === ticket._id}
                                className="w-full rounded-2xl border border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-700 transition-colors disabled:opacity-50"
                              >
                                Send Secure Invite
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default OrderConfirmationPage;