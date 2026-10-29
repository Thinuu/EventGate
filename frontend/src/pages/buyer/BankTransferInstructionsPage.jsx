import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import toast from 'react-hot-toast';
import {
  BanknotesIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const BankTransferInstructionsPage = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [loading, setLoading] = useState(true);
  const [instructions, setInstructions] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    fetchInstructions();
  }, [orderId]);

  useEffect(() => {
    if (instructions?.order?.reservationExpiry) {
      const timer = setInterval(() => {
        const now = new Date().getTime();
        const expiry = new Date(instructions.order.reservationExpiry).getTime();
        const distance = expiry - now;

        if (distance < 0) {
          clearInterval(timer);
          setTimeLeft('Expired');
        } else {
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [instructions]);

  const fetchInstructions = async () => {
    try {
      const apiBase = import.meta.env.REACT_APP_API_URL || '';
      const response = await fetch(`${apiBase}/bank-transfer/instructions/${orderId}`);
      const data = await response.json();
      if (!response.ok) {
        console.error('API error fetching instructions:', data);
        toast.error(data.message || 'Failed to load instructions');
        return;
      }
      if (data.data) {
        setInstructions(data.data);
      } else {
        toast.error('Unexpected response format while loading instructions');
      }
    } catch (error) {
      console.error('Error fetching instructions:', error);
      toast.error('Failed to load instructions');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleProceed = () => {
    const orderIdToUse = instructions.order._id || orderId;
    navigate(`/bank-transfer/submit/${orderIdToUse}`);
  };

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

  // ─── Error ────────────────────────────────────────────────────────
  if (!instructions) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50">
            <ExclamationTriangleIcon className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
            Failed to Load
          </h2>
          <p className="mt-3 max-w-md text-sm font-medium text-slate-500">
            We couldn’t load the bank transfer instructions. Please try again.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-8 rounded-2xl bg-slate-900 px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-brand-main"
          >
            Go Back
          </button>
        </div>
      </PublicLayout>
    );
  }

  const { order, bankAccounts } = instructions;
  const currency =
    order?.currency ||
    order?.eventId?.settings?.currency ||
    order?.event?.settings?.currency ||
    'LKR';

  const isPaymentSubmitted =
    order.paymentStatus &&
    order.paymentStatus !== 'pending' &&
    order.paymentStatus !== 'awaiting_payment';

  const isExpired = timeLeft === 'Expired';

  return (
    <PublicLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-10">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
              Payment Instructions
            </p>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
              Bank Transfer
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Complete your payment using direct bank transfer
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            {/* ────────────── Left Column ────────────── */}
            <div className="space-y-6 lg:col-span-3">
              {/* Status Banner */}
              {isPaymentSubmitted ? (
                <div className="overflow-hidden rounded-[32px] border border-emerald-100 bg-white shadow-sm">
                  <div className="bg-emerald-50 px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
                        <CheckCircleIcon className="h-7 w-7 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black uppercase tracking-wide text-emerald-900">
                          Payment Submitted
                        </h3>
                        <p className="mt-1 text-sm font-medium text-emerald-700">
                          Your details are under review
                        </p>
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-2.5 px-8 py-6 text-sm font-medium text-slate-600">
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      Payment details have been submitted and are under review
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      You will receive an email once verification is complete
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      Status:{' '}
                      <strong>
                        {order.paymentStatus === 'pending_verification'
                          ? 'Awaiting Verification'
                          : order.paymentStatus}
                      </strong>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      Please allow up to 48 hours for verification
                    </li>
                  </ul>
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
                          Important Notice
                        </h3>
                        <p className="mt-1 text-sm font-medium text-amber-700">
                          Please read carefully before transferring
                        </p>
                      </div>
                    </div>
                  </div>
                  <ul className="space-y-2.5 px-8 py-6 text-sm font-medium text-slate-600">
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      Transfer the <strong>exact amount</strong> shown in the order summary
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      Tickets are confirmed only after payment verification
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      Verification is normally completed within 48 hours
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      Keep your payment receipt for submission
                    </li>
                  </ul>
                </div>
              )}

              {/* Bank Accounts */}
              <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                    Available Bank Accounts
                  </h2>
                </div>

                <div className="space-y-0 divide-y divide-slate-50">
                  {bankAccounts.map((bank, index) => (
                    <div key={bank._id} className="px-8 py-6">
                      <div className="mb-5 flex items-start justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            Option {index + 1}
                          </p>
                          <h3 className="mt-1 text-lg font-black text-slate-900">
                            {bank.bankName}
                          </h3>
                        </div>
                        {bank.qrCode && (
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
                            <BanknotesIcon className="h-7 w-7 text-slate-300" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-3.5">
                        {[
                          { label: 'Account Name', value: bank.accountName, copyable: true },
                          { label: 'Account Number', value: bank.accountNumber, copyable: true },
                          { label: 'Branch', value: bank.branch, copyable: false },
                          { label: 'SWIFT Code', value: bank.swiftCode, copyable: true },
                        ].map((field) => (
                          <div
                            key={field.label}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              {field.label}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">
                                {field.value}
                              </span>
                              {field.copyable && field.value && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(field.value, field.label)}
                                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-main"
                                  title={`Copy ${field.label}`}
                                >
                                  <ClipboardDocumentIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handleProceed}
                disabled={isExpired || isPaymentSubmitted}
                className={`group flex w-full items-center justify-center gap-3 rounded-2xl py-5 text-xs font-black uppercase tracking-[0.2em] transition-all ${
                  isExpired || isPaymentSubmitted
                    ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                    : 'bg-slate-900 text-white shadow-xl hover:bg-brand-main hover:shadow-[0_0_30px_rgba(37,99,235,0.35)]'
                }`}
              >
                <span>
                  {isPaymentSubmitted
                    ? 'Payment Already Submitted'
                    : isExpired
                      ? 'Reservation Expired'
                      : 'I Have Made the Payment'}
                </span>
                {!isExpired && !isPaymentSubmitted && (
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                )}
              </button>

              <div className="text-center">
                <button
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-brand-main"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back to Checkout
                </button>
              </div>
            </div>

            {/* ────────────── Right: Order Summary ────────────── */}
            <div className="lg:col-span-2">
              <div className="sticky top-8 overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-50 bg-slate-50/50 px-7 py-5">
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                    Order Summary
                  </h2>
                </div>

                <div className="space-y-6 p-7">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Event
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-base font-bold text-slate-900">
                      {order.eventName}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Order Ref
                    </p>
                    <p className="mt-1.5 text-sm font-bold text-slate-900">
                      {order.orderNumber}
                    </p>
                  </div>

                  {/* Ticket lines */}
                  <div className="space-y-4 border-t border-slate-50 pt-6">
                    {order.tickets.map((ticket, index) => (
                      <div key={index} className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {ticket.categoryName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {ticket.quantity} × {currency} {ticket.price.toLocaleString()}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-black text-slate-900">
                          {currency} {(ticket.quantity * ticket.price).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Total + Deadline */}
                  <div className="space-y-4 border-t border-slate-50 pt-6">
                    <div className="flex items-end justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Total Amount
                      </span>
                      <span className="text-2xl font-black tracking-tighter text-brand-main">
                        {currency} {order.totalAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500">Deadline</span>
                      </div>
                      <span
                        className={`text-sm font-black ${
                          isExpired ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {timeLeft || '—'}
                      </span>
                    </div>
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

export default BankTransferInstructionsPage;