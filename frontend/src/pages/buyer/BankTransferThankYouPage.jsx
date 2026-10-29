import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import {
  CheckCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  ArrowRightIcon,
  TicketIcon,
  ShieldCheckIcon,
  UserIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

const BankTransferThankYouPage = () => {
  const { orderId } = useParams();
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrderData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/bank-transfer/instructions/${orderId}`);
        const data = await response.json();
        if (data.data) {
          setOrderData(data.data.order);
        }
      } catch (error) {
        console.error('Error fetching order data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId]);

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

  return (
    <PublicLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 lg:px-8">
          {/* ────────────── Success Header ────────────── */}
          <div className="mb-10 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50">
              <CheckCircleIcon className="h-11 w-11 text-emerald-600" />
            </div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">
              Payment Submitted
            </p>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 md:text-4xl">
              Thank You
            </h1>
            <p className="mt-3 text-sm font-medium text-slate-500">
              Your payment submission has been received successfully
            </p>
          </div>

          {/* ────────────── Info Cards ────────────── */}
          <div className="mb-6 overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
            <div className="space-y-0 divide-y divide-slate-50">
              <div className="flex items-start gap-4 px-7 py-6">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-brand-main">
                  <ClockIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                    Verification Timeline
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                    Your payment will be verified within <strong className="text-slate-700">48 hours</strong>.
                    You will receive an email and SMS once verification is completed.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 px-7 py-6">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-brand-main">
                  <EnvelopeIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                    Confirmation Details
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                    A confirmation email has been sent with your payment submission details.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ────────────── Order Reference ────────────── */}
          {orderData && (
            <div className="mb-6 overflow-hidden rounded-[32px] border border-teal-100 bg-teal-50/60">
              <div className="px-7 py-6 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-teal-500">
                  Your Reference Number
                </p>
                <p className="mt-2 text-3xl font-black tracking-tight text-teal-900">
                  {orderData.orderNumber}
                </p>
                <p className="mt-2 text-xs font-medium text-teal-600">
                  Please keep this reference number for your records
                </p>
              </div>
            </div>
          )}

          {/* ────────────── Next Steps ────────────── */}
          <div className="mb-6 overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-50 bg-slate-50/50 px-7 py-5">
              <h3 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                What Happens Next?
              </h3>
            </div>

            <div className="space-y-0 divide-y divide-slate-50 px-7">
              {[
                {
                  icon: ShieldCheckIcon,
                  text: 'Our team will verify your payment against bank records',
                },
                {
                  icon: CheckCircleIcon,
                  text: 'Once verified, your tickets will be confirmed and activated',
                },
                {
                  icon: TicketIcon,
                  text: "You'll receive QR codes and attendee assignment links via email",
                },
                {
                  icon: UserIcon,
                  text: 'Complete attendee details and upload photos if required',
                },
              ].map((step, index) => (
                <div key={index} className="flex items-start gap-4 py-5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-[11px] font-black text-white">
                    {index + 1}
                  </div>
                  <div className="flex items-center gap-3 pt-1.5">
                    <step.icon className="h-4 w-4 shrink-0 text-brand-main" />
                    <span className="text-sm font-medium text-slate-600">{step.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ────────────── Support ────────────── */}
          <div className="mb-8 overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
            <div className="px-7 py-6">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
                Need Help?
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                If you don't receive confirmation within 48 hours, please contact our support team.
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <a
                  href="mailto:support@entrynex.lk"
                  className="font-bold text-brand-main transition hover:underline"
                >
                  support@entrynex.lk
                </a>
                <span className="text-slate-300">·</span>
                <a
                  href="tel:+94111234567"
                  className="font-bold text-brand-main transition hover:underline"
                >
                  +94 11 123 4567
                </a>
              </div>
            </div>
          </div>

          {/* ────────────── Actions ────────────── */}
          <div className="space-y-3">
            <Link
              to="/events"
              className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:bg-brand-main hover:shadow-[0_0_30px_rgba(37,99,235,0.35)]"
            >
              <span>Browse More Events</span>
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              to="/buyer/tickets"
              className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white py-4 text-xs font-black uppercase tracking-[0.15em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              View My Orders
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default BankTransferThankYouPage;