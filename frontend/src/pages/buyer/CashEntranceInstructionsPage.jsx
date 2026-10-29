import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import toast from 'react-hot-toast';
import { getBuyerOrderByToken } from '../../api/orders';
import {
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  TicketIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

const CashEntranceInstructionsPage = () => {
  const navigate = useNavigate();
  const { confirmationToken } = useParams();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const isOrderConfirmed =
    order?.status === 'CONFIRMED' ||
    order?.paymentStatus === 'paid' ||
    order?.paymentStatus === 'success';

  useEffect(() => {
    const fetchOrder = async () => {
      if (!confirmationToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await getBuyerOrderByToken(confirmationToken);
        const fetchedOrder = response?.data?.data?.order;

        if (fetchedOrder) {
          setOrder(fetchedOrder);
        } else {
          toast.error('Failed to load order information');
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        toast.error('Failed to load order information');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [confirmationToken]);

  const handleProceed = () => {
    if (!isOrderConfirmed && !acceptedTerms) {
      toast.error('Please accept the venue payment terms to continue.');
      return;
    }
    navigate('/buyer/dashboard');
  };

  const currency =
    order?.event?.settings?.currency ||
    order?.eventId?.settings?.currency ||
    'LKR';

  const eventName = order?.event?.name || order?.eventId?.name || 'Event';

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

  // ─── Not Found ────────────────────────────────────────────────────
  if (!order) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50">
            <ExclamationTriangleIcon className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
            Order Not Found
          </h2>
          <p className="mt-3 max-w-md text-sm font-medium text-slate-500">
            We couldn’t load the order details. The link may be invalid or expired.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-8 rounded-2xl bg-slate-900 px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-brand-main"
          >
            Back to Homepage
          </button>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          {/* ────────────── Header ────────────── */}
          <div className="mb-12 text-center sm:text-left">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
              {isOrderConfirmed ? 'Payment Successful' : 'Reservation Confirmed'}
            </p>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
              {isOrderConfirmed ? 'Order Confirmed' : 'Cash at Entrance'}
            </h1>
            <p className="mt-3 max-w-xl text-sm font-medium text-slate-500">
              {isOrderConfirmed
                ? 'Your payment has been confirmed and your tickets are now active.'
                : 'Your reservation is secured. Please follow the instructions below to complete payment at the venue.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            {/* ────────────── Left Column ────────────── */}
            <div className="space-y-6 lg:col-span-3">
              {/* Status Card */}
              {isOrderConfirmed ? (
                <div className="overflow-hidden rounded-[32px] border border-emerald-100 bg-white shadow-sm">
                  <div className="bg-emerald-50 px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
                        <CheckCircleIcon className="h-7 w-7 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black uppercase tracking-wide text-emerald-900">
                          Payment Confirmed
                        </h3>
                        <p className="mt-1 text-sm font-medium text-emerald-700">
                          Tickets are active and ready for use
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="px-8 py-6">
                    <ul className="space-y-3.5 text-sm font-medium text-slate-600">
                      <li className="flex items-start gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        Your payment has been successfully processed
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        You can now complete attendee details and download tickets
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                        Present your QR code at the venue entrance for scanning
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[32px] border border-amber-100 bg-white shadow-sm">
                  <div className="bg-amber-50 px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
                        <ExclamationTriangleIcon className="h-7 w-7 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black uppercase tracking-wide text-amber-900">
                          Venue Payment Rules
                        </h3>
                        <p className="mt-1 text-sm font-medium text-amber-700">
                          Important instructions for cash payments
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-5 px-8 py-6">
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-brand-main">
                        <ClockIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Arrive Early</p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          Arrive <strong>30–60 minutes before</strong> the event to complete payment and collect tickets.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-brand-main">
                        <MapPinIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Payment Location</p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          Payment will be collected at the designated entrance desk at the venue.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-brand-main">
                        <TicketIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Ticket Status</p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          Tickets remain <strong>Reserved</strong> and inactive until payment is received.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-brand-main">
                        <BanknotesIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Cancellation Risk</p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          Failure to arrive and pay on time may result in automatic cancellation of your reservation.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Terms Acceptance */}
              {!isOrderConfirmed && (
                <div className="rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm">
                  <h3 className="mb-2 text-sm font-black uppercase tracking-widest text-slate-900">
                    Acceptance Required
                  </h3>
                  <p className="mb-6 text-sm text-slate-500">
                    Please confirm that you understand the cash payment terms before continuing.
                  </p>

                  <label className="group flex cursor-pointer items-start gap-4">
                    <div className="relative mt-0.5 flex h-6 w-6 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 transition checked:border-brand-main checked:bg-brand-main"
                      />
                      <svg
                        className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium leading-relaxed text-slate-600 transition group-hover:text-slate-900">
                      I agree to arrive 30–60 minutes before the event start time to complete my payment at the venue, and I understand my tickets will remain inactive until payment is received.
                    </span>
                  </label>
                </div>
              )}

              {/* CTA */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleProceed}
                  disabled={!isOrderConfirmed && !acceptedTerms}
                  className={`group inline-flex items-center gap-3 rounded-2xl px-8 py-5 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 ${
                    isOrderConfirmed || acceptedTerms
                      ? 'bg-slate-900 text-white shadow-xl hover:bg-brand-main hover:shadow-[0_0_30px_rgba(37,99,235,0.35)]'
                      : 'cursor-not-allowed bg-slate-200 text-slate-400'
                  }`}
                >
                  <span>Go to Dashboard</span>
                  <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </div>

            {/* ────────────── Right Column – Order Summary ────────────── */}
            <div className="lg:col-span-2">
              <div className="sticky top-8 overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-50 bg-slate-50/50 px-7 py-5">
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                    Order Summary
                  </h2>
                </div>

                <div className="space-y-6 p-7">
                  {/* Event + Ref + Status */}
                  <div className="space-y-5">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Event
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-base font-bold text-slate-900">
                        {eventName}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Order Ref
                        </p>
                        <p className="mt-1.5 text-sm font-bold text-slate-900">
                          {order.orderNumber || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Status
                        </p>
                        <span
                          className={`mt-1.5 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                            isOrderConfirmed
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {isOrderConfirmed ? 'Confirmed' : 'Reserved'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ticket lines */}
                  {order.tickets?.length > 0 && (
                    <div className="space-y-4 border-t border-slate-50 pt-6">
                      {order.tickets.map((ticket, index) => {
                        const qty = ticket.quantity || 0;
                        const price = ticket.price || 0;
                        const lineTotal = qty * price;

                        return (
                          <div key={index} className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-slate-900">
                                {ticket.categoryName || 'Ticket'}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {qty} × {currency} {price.toLocaleString()}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-black text-slate-900">
                              {currency} {lineTotal.toLocaleString()}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Total */}
                  <div className="border-t border-slate-50 pt-6">
                    <div className="flex items-end justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {isOrderConfirmed ? 'Amount Paid' : 'Amount Due'}
                      </span>
                      <span className="text-2xl font-black tracking-tighter text-brand-main">
                        {currency} {(order.totalAmount || 0).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                      {isOrderConfirmed ? 'Payment completed at venue' : 'To be paid at venue'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default CashEntranceInstructionsPage;