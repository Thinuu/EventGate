import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import AttendeeLayout from '../../components/attendee/AttendeeLayout';
import AttendeeTicketCard from '../../components/attendee/AttendeeTicketCard';
import QRCodeDisplay from '../../components/attendee/QRCodeDisplay';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  TicketIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  ArrowRightIcon,
  ArrowDownTrayIcon,
  UserCircleIcon,
  BellIcon,
  ArrowTopRightOnSquareIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const AttendeeDashboardPage = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (token, ticketNumber) => {
    if (!token) return;
    try {
      setDownloading(true);
      const response = await api.get(`/tickets/download/${token}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Ticket-${ticketNumber || token}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Ticket downloaded successfully!');
    } catch (err) {
      console.error('Error downloading ticket:', err);
      toast.error('Failed to download ticket PDF');
    } finally {
      setDownloading(false);
    }
  };

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/user/tickets');
      setTickets(data?.data?.tickets || []);
    } catch (err) {
      console.error('Error loading tickets:', err);
      setError(err?.response?.data?.message || err.message);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  useAutoRefresh(loadTickets, {
    enabled: true,
    interval: 15000,
    immediate: false,
    deps: [],
  });

  const primaryTicket = tickets[0];
  const needsConfirmation = tickets.some(
    (t) =>
      !t.attendee?.isConfirmed || t.attendee?.confirmationStatus !== 'confirmed'
  );
  const needsPhoto = tickets.some(
    (t) => !t.attendee?.photo && t.event?.requirePhotoVerification
  );
  const primaryConfirmed =
    primaryTicket?.attendee?.isConfirmed &&
    primaryTicket?.attendee?.confirmationStatus === 'confirmed';

  const confirmedCount = tickets.filter(
    (t) => t.attendee?.confirmationStatus === 'confirmed'
  ).length;
  const actionNeededCount = tickets.filter(
    (t) =>
      !t.attendee?.isConfirmed || t.attendee?.confirmationStatus !== 'confirmed'
  ).length;

  const getInitials = (name) => {
    if (!name) return 'A';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getGreetingDate = () =>
    new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'Time TBD';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <AttendeeLayout>
        <div className="flex items-center justify-center min-h-[320px]">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" />
        </div>
      </AttendeeLayout>
    );
  }

  return (
    <AttendeeLayout>
      <div className="space-y-5 sm:space-y-6 pb-16 sm:pb-20">
        {/* ── Welcome Header ── */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4 min-w-0">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-lg font-bold text-white shadow-sm">
                  {getInitials(user?.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {getGreetingDate()}
                  </p>
                  <h1 className="mt-1 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 truncate">
                    Welcome back, {user?.name?.split(' ')[0] || 'Attendee'}
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-500 max-w-xl">
                    {tickets.length > 0
                      ? `You have ${tickets.length} ticket${
                          tickets.length > 1 ? 's' : ''
                        }. ${
                          needsConfirmation
                            ? 'Some still need confirmation.'
                            : 'All tickets are confirmed and active.'
                        }`
                      : 'Explore events and manage your digital access passes.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Action Required ── */}
        {(needsConfirmation || needsPhoto) && (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <ClockIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-amber-900">
                  Action Required
                </h3>
                <p className="mt-1 text-sm text-amber-800">
                  {needsConfirmation && 'Complete identity confirmation'}
                  {needsConfirmation && needsPhoto && ' and '}
                  {needsPhoto && 'upload photo verification'} to activate your
                  tickets and unlock entry QR codes.
                </p>
                <Link
                  to="/attendee/tickets"
                  className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900 hover:underline"
                >
                  Go to My Tickets
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Primary Pass Card ── */}
        {primaryTicket && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 px-0.5">
              Your Next Entry Pass
            </h2>

            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="flex flex-col md:flex-row">
                {/* Left – Event details */}
                <div className="flex-1 p-5 sm:p-6 lg:p-7 space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                      {primaryTicket.categoryName || 'Standard'}
                    </span>
                    {primaryConfirmed ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                        <CheckCircleSolid className="h-3.5 w-3.5" />
                        Pass Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                        <ClockIcon className="h-3.5 w-3.5" />
                        Pending Action
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                      {primaryTicket.event?.name}
                    </h3>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarIcon className="h-4 w-4 text-teal-500 shrink-0" />
                        {formatDate(primaryTicket.event?.startDate)} ·{' '}
                        {formatTime(primaryTicket.event?.startDate)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPinIcon className="h-4 w-4 text-teal-500 shrink-0" />
                        <span className="truncate max-w-[200px] sm:max-w-none">
                          {primaryTicket.event?.venue?.name || 'Venue TBD'}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Attendee Pass
                        </p>
                        <p className="mt-0.5 font-semibold text-slate-900">
                          {primaryTicket.attendee?.fullName || user?.name}
                        </p>
                        <p className="text-xs font-mono text-slate-500 mt-0.5">
                          #{primaryTicket.ticketNumber}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {primaryConfirmed && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDownload(
                                primaryTicket.attendee?.qrToken,
                                primaryTicket.ticketNumber
                              )
                            }
                            disabled={downloading}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-50 transition"
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
                        )}
                        <Link
                          to={`/attendee/ticket/${primaryTicket._id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                          View Ticket
                          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ticket tear (desktop) */}
                {primaryConfirmed && (
                  <div className="hidden md:flex relative w-px shrink-0">
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-l-2 border-dashed border-slate-200" />
                    <div className="absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full border border-slate-200 bg-slate-50" />
                    <div className="absolute -bottom-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full border border-slate-200 bg-slate-50" />
                  </div>
                )}

                {/* Mobile tear */}
                {primaryConfirmed && (
                  <div className="relative flex md:hidden items-center px-5">
                    <div className="absolute left-0 h-6 w-6 -translate-x-1/2 rounded-full border border-slate-200 bg-slate-50" />
                    <div className="w-full border-t-2 border-dashed border-slate-200" />
                    <div className="absolute right-0 h-6 w-6 translate-x-1/2 rounded-full border border-slate-200 bg-slate-50" />
                  </div>
                )}

                {/* Right – QR or CTA */}
                {primaryConfirmed ? (
                  <div className="w-full md:w-64 lg:w-72 p-5 sm:p-6 flex flex-col items-center justify-center bg-slate-50/60 text-center">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <QRCodeDisplay
                        value={
                          primaryTicket.attendee?.qrCode ||
                          primaryTicket.attendee?.qrToken
                        }
                        size={128}
                      />
                    </div>
                    <p className="mt-3 text-xs font-medium text-slate-500">
                      Present this QR at the gate
                    </p>
                  </div>
                ) : (
                  <div className="w-full md:w-64 lg:w-72 p-5 sm:p-6 flex flex-col items-center justify-center bg-slate-50/60 text-center space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400">
                      <ClockIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Verification Pending
                      </p>
                      <p className="mt-1 text-xs text-slate-500 max-w-[180px] mx-auto">
                        Complete your details to activate this pass
                      </p>
                    </div>
                    <Link
                      to={`/confirm/${
                        primaryTicket.attendee?.confirmationToken ||
                        primaryTicket.inviteToken
                      }`}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 transition"
                    >
                      <ShieldCheckIcon className="h-3.5 w-3.5" />
                      Confirm Pass
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Metric Cards ── */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Total Tickets
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                  {tickets.length}
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <TicketIcon className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Confirmed
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">
                  {confirmedCount}
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircleSolid className="h-5 w-5" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Needs Action
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">
                  {actionNeededCount}
                </p>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <ClockIcon className="h-5 w-5" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Ticket List ── */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              Your Ticket List
            </h2>
            <Link
              to="/attendee/tickets"
              className="inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:text-teal-700"
            >
              View all
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="p-4 sm:p-5">
            {tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                  <TicketIcon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  No tickets yet
                </h3>
                <p className="mt-1.5 text-sm text-slate-500 max-w-xs">
                  You haven’t been assigned or purchased any tickets.
                </p>
                <Link
                  to="/events"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 transition"
                >
                  Browse Events
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.slice(0, 3).map((ticket) => (
                  <AttendeeTicketCard key={ticket._id} ticket={ticket} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Actions + Help ── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Quick Services */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">
              Quick Services
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Manage tickets, profile and notifications
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                {
                  to: '/attendee/tickets',
                  icon: TicketIcon,
                  label: 'My Tickets',
                  tone: 'text-teal-600 bg-teal-50',
                },
                {
                  to: '/attendee/events',
                  icon: CalendarIcon,
                  label: 'Browse Events',
                  tone: 'text-teal-600 bg-teal-50',
                },
                {
                  to: '/attendee/profile',
                  icon: UserCircleIcon,
                  label: 'My Profile',
                  tone: 'text-violet-600 bg-violet-50',
                },
                {
                  to: '/attendee/notifications',
                  icon: BellIcon,
                  label: 'Notifications',
                  tone: 'text-amber-600 bg-amber-50',
                },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-4 text-center transition hover:border-slate-200 hover:bg-slate-100/80"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Help & Support */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm flex flex-col">
            <h3 className="text-base font-bold text-slate-900">
              Help & Support
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Tips for verification and gate entry
            </p>

            <div className="mt-5 space-y-3 flex-1">
              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                <QuestionMarkCircleIcon className="h-5 w-5 shrink-0 text-teal-600 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Digital QR Instructions
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Turn up your screen brightness when presenting the QR at the
                    gates.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                <UserCircleIcon className="h-5 w-5 shrink-0 text-teal-600 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Photo Requirements
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Use a clear portrait without hats or heavy glasses for
                    verification.
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
              Need help?{' '}
              <span className="font-semibold text-slate-600">
                support@entrynex.lk
              </span>
            </p>
          </div>
        </div>
      </div>
    </AttendeeLayout>
  );
};

export default AttendeeDashboardPage;