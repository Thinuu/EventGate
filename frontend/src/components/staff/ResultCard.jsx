import React from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ArrowLeftOnRectangleIcon,
} from '@heroicons/react/24/solid';
import { getAssetUrl } from '../../utils/backend';

const buildAssetUrl = (path) => getAssetUrl(path);

const toneMap = {
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50/90 text-emerald-950',
    badge: 'bg-emerald-600 text-white',
    iconWrap: 'bg-emerald-600 text-white',
    icon: CheckCircleIcon,
    title: 'Valid Ticket',
    colorName: 'Valid',
  },
  checkout: {
    wrapper: 'border-teal-200 bg-teal-50/90 text-teal-950',
    badge: 'bg-teal-600 text-white',
    iconWrap: 'bg-teal-600 text-white',
    icon: ArrowLeftOnRectangleIcon,
    title: 'Checked Out',
    colorName: 'Checked Out',
  },
  already_used: {
    wrapper: 'border-amber-200 bg-amber-50/90 text-amber-950',
    badge: 'bg-amber-600 text-white',
    iconWrap: 'bg-amber-600 text-white',
    icon: InformationCircleIcon,
    title: 'Already Used',
    colorName: 'Already Used',
  },
  error: {
    wrapper: 'border-rose-200 bg-rose-50/90 text-rose-950',
    badge: 'bg-rose-600 text-white',
    iconWrap: 'bg-rose-600 text-white',
    icon: XCircleIcon,
    title: 'Access Denied',
    colorName: 'Invalid',
  },
  idle: {
    wrapper: 'border-slate-200/80 bg-white text-slate-900',
    badge: 'bg-slate-700 text-white',
    iconWrap: 'bg-slate-100 text-slate-500',
    icon: CheckCircleIcon,
    title: 'Ready to Scan',
    colorName: 'Idle',
  },
};

const ResultCard = ({
  state = 'idle',
  attendee,
  message,
  detail,
  meta = [],
  actions,
}) => {
  let activeTone = state;

  if (state === 'success') {
    const isExit =
      meta.some((m) => m.label === 'Mode' && m.value === 'Exit') ||
      attendee?.checkedIn === false;
    activeTone = isExit ? 'checkout' : 'success';
  } else if (state === 'error') {
    const isAlreadyUsed =
      detail?.toLowerCase().includes('already') ||
      detail?.toLowerCase().includes('used');
    activeTone = isAlreadyUsed ? 'already_used' : 'error';
  }

  const tone = toneMap[activeTone] || toneMap.idle;
  const Icon = tone.icon;

  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm transition-all duration-300 sm:p-6 ${tone.wrapper}`}
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm sm:h-14 sm:w-14 ${tone.iconWrap}`}
          >
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
              Validation Status
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              {message || tone.title}
            </h2>
            <p className="mt-1.5 text-sm opacity-80">
              {detail || 'Point the camera at a QR code to validate access.'}
            </p>
          </div>
        </div>

        <span
          className={`self-start rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm sm:self-center ${tone.badge}`}
        >
          {tone.colorName}
        </span>
      </div>

      {/* Body */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Attendee */}
        <div className="rounded-xl border border-white/60 bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Attendee Info
          </p>

          <div className="mt-3.5 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:h-28 sm:w-28">
              {attendee?.photo ? (
                <img
                  src={buildAssetUrl(attendee.photo)}
                  alt={attendee.fullName || 'Attendee'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="px-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  No Image
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                {attendee?.fullName || 'Waiting for QR…'}
              </p>
              <p className="mt-1 text-sm font-semibold text-teal-700">
                {attendee?.categoryName ||
                  attendee?.ticketCategory ||
                  'Scan a ticket code'}
              </p>

              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Account
                  </p>
                  <p className="mt-1 truncate text-xs font-bold text-slate-800">
                    {attendee?.confirmationStatus || 'Pending'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Entry
                  </p>
                  <p className="mt-1 truncate text-xs font-bold text-slate-800">
                    {attendee?.checkedIn ? 'Checked In' : 'Checked Out'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="rounded-xl border border-white/60 bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Scan Session Details
          </p>

          <div className="mt-3 space-y-2">
            {meta.length > 0 ? (
              meta.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {item.label}
                  </p>
                  <p className="text-xs font-bold text-slate-800 text-right">
                    {item.value || '—'}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-400">
                Scan metadata will appear here automatically.
              </div>
            )}
          </div>
        </div>
      </div>

      {actions && <div className="mt-5">{actions}</div>}
    </section>
  );
};

export default ResultCard;