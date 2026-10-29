import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { CalendarDaysIcon, MapPinIcon, TicketIcon, ArrowLeftIcon, PrinterIcon, QrCodeIcon } from '@heroicons/react/24/outline';
import PublicLayout from '../../components/layout/PublicLayout';
import { getBuyerTickets } from '../../api/buyer';
import { formatTimezoneDisplay } from '../../utils/timezone';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const TicketWalletPage = () => {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isObjectId = /^[a-f\d]{24}$/i.test(token || '');
    if (isObjectId && authLoading) return;

    const request =
      isObjectId && user?.role === 'buyer'
        ? getUserTicket(token).then((res) => ({
            mode: 'private',
            ticket: res.data?.data?.ticket || null,
          }))
        : getConfirmInfo(token).then((res) => {
            const attendee = res.data?.data?.attendee || null;
            return {
              mode: 'public',
              ticket: attendee
                ? {
                    attendee,
                    categoryName: attendee.categoryName,
                    allowedZones: attendee.allowedZones || [],
                    event: attendee.event,
                  }
                : null,
            };
          });

    request
      .then((result) => setTicket(result.ticket))
      .catch(() => toast.error('Ticket not found'))
      .finally(() => setLoading(false));
  }, [token, user, authLoading]);

  // ─── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-brand-main border-t-transparent" />
        </div>
      </PublicLayout>
    );
  }

  const zones = ticket?.allowedZones || ticket?.attendee?.allowedZones || [];
  const timezoneDisplay = formatTimezoneDisplay(ticket.event?.timezone);

  // Safer date formatting with event timezone support
  const formatEventDate = () => {
    const start = ticket?.event?.startDate;
    if (!start) return null;

    try {
      const options = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: ticket.event?.timezone || 'Asia/Colombo',
      };

      const formatted = new Date(start).toLocaleString('en-US', options);
      return `${formatted} (${timezoneDisplay})`;
    } catch {
      return new Date(start).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: ticket.event?.timezone || 'Asia/Colombo',
      });
    }
  };

  const eventDate = formatEventDate();

  return (
    <PublicLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
          {/* Header */}
          <div className="mb-8 text-center">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
              Ticket Wallet
            </p>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 md:text-3xl">
              {ticket?.attendee?.fullName || ticket?.event?.name || 'Ticket'}
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Show this QR code at entry. Keep this page open for quick access.
            </p>
          </div>

          {/* Ticket Card */}
          <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
            {ticket?.attendee?.qrCode ? (
              <>
                {/* QR Section */}
                <div className="flex flex-col items-center bg-slate-900 px-8 py-10">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <QrCodeIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="overflow-hidden rounded-2xl bg-white p-4 shadow-lg">
                    <img
                      src={ticket.attendee.qrCode}
                      alt="Ticket QR"
                      className="h-56 w-56 object-contain sm:h-64 sm:w-64"
                    />
                  </div>
                  <p className="mt-4 text-[10px] font-black uppercase tracking-[0.25em] text-white/50">
                    Scan at Entrance
                  </p>
                </div>

                {/* Details */}
                <div className="space-y-5 p-7">
                  {/* Attendee / Event name */}
                  {ticket.attendee?.fullName && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Attendee
                      </p>
                      <p className="mt-1 text-base font-bold text-slate-900">
                        {ticket.attendee.fullName}
                      </p>
                    </div>
                  )}

                  {/* Event */}
                  {ticket.event?.name && (
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-brand-main">
                        <TicketIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Event
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-slate-900">
                          {ticket.event.name}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Category */}
                  {ticket.categoryName && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Category
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {ticket.categoryName}
                      </p>
                    </div>
                  )}

                  {/* Date */}
                  {eventDate && (
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-brand-main">
                        <CalendarDaysIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Date & Time
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-slate-900">{eventDate}</p>
                      </div>
                    </div>
                  )}

                  {/* Venue */}
                  {ticket.event?.venue?.name && (
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-brand-main">
                        <MapPinIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Venue
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-slate-900">
                          {ticket.event.venue.name}
                          {ticket.event.venue.city ? `, ${ticket.event.venue.city}` : ''}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Zones */}
                  {zones.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Allowed Zones
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {zones.map((zone) => (
                          <span
                            key={zone}
                            className="rounded-full bg-teal-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-teal-700"
                          >
                            {zone}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {ticket.event?.description && (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-sm leading-relaxed text-slate-600">
                        {ticket.event.description}
                      </p>
                    </div>
                  )}

                  {/* Print */}
                  <button
                    onClick={() => window.print()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 text-xs font-black uppercase tracking-[0.15em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <PrinterIcon className="h-4 w-4" />
                    Print QR
                  </button>
                </div>
              </>
            ) : (
              <div className="px-8 py-12 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
                  <QrCodeIcon className="h-8 w-8 text-amber-500" />
                </div>
                <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
                  QR Not Ready
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Ticket QR is not ready yet. Please check back later or contact support.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default TicketWalletPage;