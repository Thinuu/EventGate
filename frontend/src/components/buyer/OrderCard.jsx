import React from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRightIcon,
  CalendarIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import Badge from '../ui/Badge';

const OrderCard = ({ order }) => {
  const progressPercent = order.progress?.total
    ? Math.round((order.progress.confirmed / order.progress.total) * 100)
    : 0;

  const isCashReservation =
    order.paymentMethod === 'cash_at_entrance' ||
    order.paymentMethod === 'cash_on_entrance';
  const isReserved = order.status === 'RESERVED';
  const isAwaitingPayment = order.paymentStatus === 'awaiting_payment';
  const shouldDisableActions =
    isCashReservation && (isReserved || isAwaitingPayment);

  const isComplete =
    order.confirmationStatus === 'All Confirmed' || progressPercent === 100;

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Order #{order.orderNumber}
          </p>
          <h3 className="mt-1 text-base font-bold text-slate-900 leading-snug line-clamp-2">
            {order.event?.name || 'Event'}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5 text-teal-500 shrink-0" />
              {formatDate(order.event?.startDate || order.createdAt)}
            </span>
            {order.event?.venue?.name && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                <span className="truncate max-w-[160px]">
                  {order.event.venue.name}
                </span>
              </span>
            )}
          </div>
        </div>

        <Badge
          color={
            shouldDisableActions
              ? 'orange'
              : isComplete
              ? 'green'
              : 'blue'
          }
        >
          {shouldDisableActions ? 'Reserved' : order.confirmationStatus}
        </Badge>
      </div>

      {/* Progress / Pending notice */}
      <div className="mt-4">
        {shouldDisableActions ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5">
            <p className="text-xs font-semibold text-amber-800">
              Reservation · Pending Payment
            </p>
            <p className="mt-0.5 text-[11px] text-amber-700/90">
              Payment must be completed at the venue before tickets can be
              issued.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>
                Confirmed {order.progress?.confirmed ?? 0} /{' '}
                {order.progress?.total ?? 0}
              </span>
              <span className="tabular-nums text-slate-400">
                {progressPercent}%
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isComplete ? 'bg-emerald-500' : 'bg-teal-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-sm font-bold text-slate-900 tabular-nums">
          {order.currency || 'LKR'}{' '}
          {Number(order.totalAmount || 0).toLocaleString()}
        </p>

        {shouldDisableActions ? (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-400 cursor-not-allowed"
            title="Payment must be completed at the venue before tickets can be issued"
          >
            Manage
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Link
            to={`/buyer/orders/${order._id}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
          >
            Manage
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
};

export default OrderCard;