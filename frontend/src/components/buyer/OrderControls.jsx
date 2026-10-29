import React, { useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  CalendarIcon,
  ShoppingBagIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

const OrderControls = ({ orders, onDownloadOrder }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const totalPages = Math.max(1, Math.ceil(orders.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = orders.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const getOrderMeta = (order) => {
    const total = order.stats?.total || 0;
    const assigned = order.stats?.assigned || 0;
    const progressPercent =
      total > 0 ? Math.round((assigned / total) * 100) : 0;
    const isComplete = progressPercent === 100;

    const isCashReservation =
      order.paymentMethod === 'cash_at_entrance' ||
      order.paymentMethod === 'cash_on_entrance';
    const isReserved = order.status === 'RESERVED';
    const isAwaitingPayment = order.paymentStatus === 'awaiting_payment';
    const isBankPending =
      order.paymentMethod === 'bank_transfer' &&
      order.paymentStatus !== 'paid' &&
      order.paymentStatus !== 'success';
    const shouldDisableActions =
      (isCashReservation && (isReserved || isAwaitingPayment)) ||
      isBankPending;

    return {
      total,
      assigned,
      progressPercent,
      isComplete,
      isBankPending,
      shouldDisableActions,
    };
  };

  const ProgressBlock = ({ order, compact = false }) => {
    const {
      total,
      assigned,
      progressPercent,
      isComplete,
      isBankPending,
      shouldDisableActions,
    } = getOrderMeta(order);

    if (shouldDisableActions) {
      return (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-amber-700">
            {isBankPending ? 'On Hold' : 'Reserved'}
          </p>
          <p className="text-[11px] leading-snug text-slate-500">
            {isBankPending
              ? 'Verification usually completes within 48 hours.'
              : 'Pay at the venue before tickets can be issued.'}
          </p>
        </div>
      );
    }

    return (
      <>
        <div
          className={`mb-1.5 flex items-center justify-between font-semibold ${
            compact ? 'text-[11px]' : 'text-xs'
          }`}
        >
          <span className={isComplete ? 'text-emerald-600' : 'text-slate-600'}>
            {assigned} / {total} Assigned
          </span>
          <span className="tabular-nums text-slate-400">
            {progressPercent}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isComplete ? 'bg-emerald-500' : 'bg-teal-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </>
    );
  };

  const ActionButtons = ({ order, fullWidth = false }) => {
    const { shouldDisableActions } = getOrderMeta(order);
    const btnBase = fullWidth
      ? 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-xs font-semibold transition touch-manipulation'
      : 'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition';

    return (
      <div
        className={
          fullWidth
            ? 'flex gap-2 w-full'
            : 'flex items-center justify-end gap-2'
        }
      >
        <button
          type="button"
          onClick={() => onDownloadOrder(order._id)}
          className={`${btnBase} border border-slate-200 bg-white text-slate-700 shadow-sm active:bg-slate-50 hover:bg-slate-50`}
          title={
            shouldDisableActions
              ? 'Download Reservation PDF'
              : 'Download Receipt / Order Summary'
          }
        >
          <ArrowDownTrayIcon className="h-3.5 w-3.5" />
          <span>
            {shouldDisableActions ? 'Reservation' : 'Receipt'}
          </span>
        </button>

        {shouldDisableActions ? (
          <button
            type="button"
            disabled
            className={`${btnBase} bg-slate-100 text-slate-400 cursor-not-allowed`}
            title="Payment must be completed before tickets can be managed"
          >
            <span>Manage</span>
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Link
            to={`/buyer/assign/${order._id}`}
            className={`${btnBase} bg-teal-600 text-white shadow-sm hover:bg-teal-500 active:bg-teal-700`}
          >
            <span>Manage</span>
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* ── Mobile: card list ── */}
      <div className="space-y-3 sm:hidden">
        {paginatedOrders.map((order) => (
          <div
            key={order._id}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <ShoppingBagIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 text-sm">
                  #
                  {order.orderNumber ||
                    order._id.slice(-6).toUpperCase()}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {formatDate(order.createdAt)}
                </p>
              </div>
            </div>

            <div className="mt-3 min-w-0">
              <p className="font-semibold text-slate-900 text-sm truncate">
                {order.event?.name || 'Event Details'}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                <span className="truncate">
                  {formatDate(order.event?.startDate)}
                </span>
              </p>
            </div>

            <div className="mt-3">
              <ProgressBlock order={order} compact />
            </div>

            <div className="mt-3.5 border-t border-slate-100 pt-3">
              <ActionButtons order={order} fullWidth />
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop: table ── */}
      <div className="hidden sm:block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Order / Date
                </th>
                <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Event
                </th>
                <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Status & Progress
                </th>
                <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedOrders.map((order) => {
                const { shouldDisableActions, isBankPending } =
                  getOrderMeta(order);

                return (
                  <tr
                    key={order._id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="whitespace-nowrap px-4 py-4 sm:px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                          <ShoppingBagIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">
                            #
                            {order.orderNumber ||
                              order._id.slice(-6).toUpperCase()}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 sm:px-5">
                      <div className="max-w-[200px] sm:max-w-xs">
                        <p className="font-semibold text-slate-900 truncate">
                          {order.event?.name || 'Event Details'}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                          <span>{formatDate(order.event?.startDate)}</span>
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-4 sm:px-5">
                      <div className="w-44 sm:w-52">
                        {shouldDisableActions ? (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-amber-700">
                              {isBankPending
                                ? 'On Hold · Verification Pending'
                                : 'Reservation · Pending Payment'}
                            </p>
                            <p className="text-[11px] leading-snug text-slate-500">
                              {isBankPending
                                ? 'Payment verification usually completes within 48 hours.'
                                : 'Pay at the venue before tickets can be issued.'}
                            </p>
                          </div>
                        ) : (
                          <ProgressBlock order={order} />
                        )}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 sm:px-5 text-right">
                      <ActionButtons order={order} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-0.5">
          <p className="text-center sm:text-left text-xs text-slate-500 order-2 sm:order-1">
            Showing {startIndex + 1}–{Math.min(endIndex, orders.length)} of{' '}
            {orders.length}
          </p>

          <div className="flex items-center justify-center gap-1.5 order-1 sm:order-2">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm active:bg-slate-50 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition touch-manipulation"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Prev</span>
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  if (totalPages <= 5) return true;
                  return (
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  );
                })
                .map((page, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && page - prev > 1;
                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && (
                        <span className="px-1 text-xs text-slate-400">…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handlePageChange(page)}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold transition touch-manipulation ${
                          currentPage === page
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'bg-white text-slate-700 border border-slate-200 active:bg-slate-50 hover:bg-slate-50'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm active:bg-slate-50 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition touch-manipulation"
            >
              <span className="hidden xs:inline">Next</span>
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderControls;