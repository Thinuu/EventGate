import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getBuyerOrderHistory,
  getOrderDetails,
  requestRefund,
  downloadInvoice,
} from '../../api/buyerOrders';
import {
  CalendarIcon,
  MapPinIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { useAuth } from '../../context/AuthContext';
import { io } from '../../utils/realtime';
import { getSocketUrl } from '../../utils/backend';

const statusConfig = {
  PENDING: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  CONFIRMED: {
    label: 'Confirmed',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  REFUNDED: {
    label: 'Refunded',
    className: 'bg-violet-50 text-violet-800 border-violet-200',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  RESERVED: {
    label: 'Reserved · Awaiting Payment',
    shortLabel: 'Reserved',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  PENDING_PAYMENT: {
    label: 'On Hold · Payment Verification',
    shortLabel: 'On Hold',
    className: 'bg-orange-50 text-orange-800 border-orange-200',
  },
  PENDING_VERIFICATION: {
    label: 'Pending Verification',
    shortLabel: 'Pending',
    className: 'bg-teal-50 text-teal-800 border-teal-200',
  },
};

const BuyerOrderHistoryPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('all');
  const itemsPerPage = 8;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: currentPage, limit: itemsPerPage };
      if (filterStatus !== 'all') params.status = filterStatus;
      const response = await getBuyerOrderHistory(params);
      const data = response.data?.data || {};
      setOrders(data.orders || []);
    } catch {
      toast.error('Failed to load order history');
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterStatus]);

  const fetchOrderDetails = useCallback(async (orderId) => {
    setDetailsLoading(true);
    try {
      const response = await getOrderDetails(orderId);
      setOrderDetails(response.data?.data);
    } catch {
      toast.error('Failed to load order details');
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!user?._id) return;

    const socket = io(getSocketUrl(), {
      path: '/socket.io',
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      socket.emit('join_buyer', { userId: user._id });
    });

    socket.on('order_status_changed', (data) => {
      toast.success(
        `Order #${data.orderNumber} status updated to ${
          data.paymentStatus || data.status
        }!`
      );
      fetchOrders();
      if (selectedOrder?._id === data.orderId) {
        fetchOrderDetails(data.orderId);
      }
    });

    return () => {
      socket.emit('leave_buyer', { userId: user._id });
      socket.disconnect();
    };
  }, [user, selectedOrder, fetchOrders, fetchOrderDetails]);

  const handleViewOrder = async (order) => {
    setSelectedOrder(order);
    setOrderDetails(null);
    setDetailsLoading(true);
    setShowRefundModal(false);
    try {
      const response = await getOrderDetails(order._id);
      setOrderDetails(response.data?.data);
    } catch {
      toast.error('Failed to load order details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleRequestRefund = async () => {
    if (!refundReason.trim() || refundReason.length < 10) {
      toast.error('Reason must be at least 10 characters');
      return;
    }
    setRefundLoading(true);
    try {
      await requestRefund(selectedOrder._id, refundReason);
      toast.success('Refund request submitted');
      setShowRefundModal(false);
      setRefundReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit refund');
    } finally {
      setRefundLoading(false);
    }
  };

  const handleDownloadInvoice = async (orderId) => {
    try {
      toast.loading('Downloading invoice...', { id: 'invoice' });
      const response = await downloadInvoice(orderId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Invoice downloaded', { id: 'invoice' });
    } catch {
      toast.error('Failed to download invoice', { id: 'invoice' });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount, currency = 'LKR') =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount || 0);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ),
    [orders]
  );

  const closeDetails = () => {
    setSelectedOrder(null);
    setOrderDetails(null);
  };

  return (
    <BuyerLayout>
      <div className="space-y-4 sm:space-y-6 pb-16 sm:pb-20">
        {/* ── Header ── */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-teal-500 ring-4 ring-teal-500/15" />
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Buyer Workspace
                  </p>
                </div>
                <h1 className="mt-1.5 sm:mt-2 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                  Order History
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  View and manage your ticket orders
                </p>
              </div>

              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:py-2.5 text-sm text-slate-700 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
              >
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="RESERVED">Reserved</option>
                <option value="PENDING_PAYMENT">On Hold</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="REFUNDED">Refunded</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3 sm:space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 sm:h-36 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60"
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && sortedOrders.length === 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-12 sm:px-6 sm:py-14 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              No orders found
            </p>
          </div>
        )}

        {/* Orders list */}
        {!loading && sortedOrders.length > 0 && (
          <div className="space-y-3 sm:space-y-4">
            {sortedOrders.map((order) => {
              const status =
                statusConfig[order.status] || {
                  label: order.status,
                  shortLabel: order.status,
                  className: 'bg-slate-100 text-slate-700 border-slate-200',
                };

              const canManage =
                ['CONFIRMED', 'COMPLETED', 'PAID'].includes(order.status) ||
                order.paymentStatus === 'paid' ||
                order.paymentStatus === 'success';

              return (
                <div
                  key={order._id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:gap-5">
                    {/* Top: meta + status */}
                    <div className="min-w-0 space-y-2.5 sm:space-y-3">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-slate-600">
                          #{order.orderNumber}
                        </span>
                        <span className="text-[11px] sm:text-xs text-slate-400">
                          {formatDate(order.createdAt)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] sm:text-[11px] font-bold ${status.className}`}
                        >
                          <span className="sm:hidden">
                            {status.shortLabel || status.label}
                          </span>
                          <span className="hidden sm:inline">
                            {status.label}
                          </span>
                        </span>
                      </div>

                      <h3 className="text-base sm:text-xl font-bold text-slate-900 leading-snug">
                        {order.event?.name || 'Event'}
                      </h3>

                      <div className="flex flex-col xs:flex-row xs:flex-wrap gap-1 xs:gap-x-4 xs:gap-y-1.5 text-xs sm:text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <CalendarIcon className="h-4 w-4 text-teal-500 shrink-0" />
                          <span className="truncate">
                            {formatDate(order.event?.startDate)}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <MapPinIcon className="h-4 w-4 text-teal-500 shrink-0" />
                          <span className="truncate">
                            {order.event?.venue?.name || 'Venue TBD'}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Bottom: amount + actions */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                      <div className="sm:text-right">
                        <p className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">
                          {formatCurrency(
                            order.totalAmount,
                            order.currency || order.event?.currency || 'LKR'
                          )}
                        </p>
                        <p className="text-[11px] sm:text-xs text-slate-500">
                          {order.progress?.total || 0} tickets
                        </p>
                      </div>

                      <div className="flex flex-col xs:flex-row gap-2 w-full sm:w-auto">
                        {canManage && (
                          <Link
                            to={`/buyer/orders/${order._id}`}
                            className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-3 sm:py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 active:bg-emerald-700 transition touch-manipulation"
                          >
                            Manage Tickets
                          </Link>
                        )}

                        <button
                          type="button"
                          onClick={() => handleViewOrder(order)}
                          className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 transition touch-manipulation"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            <div className="flex items-center justify-center gap-2 pt-1 sm:pt-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition touch-manipulation"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Previous</span>
              </button>
              <span className="px-2.5 sm:px-3 text-xs font-semibold text-slate-600 tabular-nums">
                Page {currentPage}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={sortedOrders.length < itemsPerPage}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition touch-manipulation"
              >
                <span className="hidden xs:inline">Next</span>
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Order Details Modal ── */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4 backdrop-blur-sm"
          onClick={closeDetails}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-200/80 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  Order #{selectedOrder.orderNumber}
                </h3>
                <p className="mt-0.5 text-[11px] sm:text-xs text-slate-400">
                  Placed {formatDate(selectedOrder.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 active:bg-slate-100 hover:text-slate-600 transition touch-manipulation shrink-0"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {detailsLoading && !orderDetails ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-14">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" />
                  <p className="mt-3 text-xs text-slate-500">
                    Loading order details…
                  </p>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-5">
                  {/* Summary cards — 3 col always, compact on mobile */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                      <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Total
                      </p>
                      <p className="mt-1 text-sm sm:text-lg font-bold text-slate-900 tabular-nums leading-tight">
                        {formatCurrency(
                          orderDetails?.order?.totalAmount ??
                            selectedOrder.totalAmount,
                          orderDetails?.order?.currency ||
                            selectedOrder.currency ||
                            'LKR'
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                      <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Tickets
                      </p>
                      <p className="mt-1 text-sm sm:text-lg font-bold text-slate-900 leading-tight">
                        {orderDetails?.tickets?.length ??
                          selectedOrder.progress?.total ??
                          1}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4">
                      <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Status
                      </p>
                      <div className="mt-1">
                        {(() => {
                          const stKey =
                            orderDetails?.order?.status || selectedOrder.status;
                          const st =
                            statusConfig[stKey] || {
                              label: stKey || 'Confirmed',
                              shortLabel: stKey || 'Confirmed',
                              className:
                                'bg-emerald-50 text-emerald-800 border-emerald-200',
                            };
                          return (
                            <span
                              className={`inline-flex items-center rounded-full border px-1.5 sm:px-2.5 py-0.5 text-[9px] sm:text-[11px] font-bold ${st.className}`}
                            >
                              <span className="sm:hidden">
                                {st.shortLabel || st.label}
                              </span>
                              <span className="hidden sm:inline">
                                {st.label}
                              </span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Purchaser */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 sm:p-4">
                    <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Purchaser
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                      {orderDetails?.order?.buyerName ||
                        selectedOrder.buyerName ||
                        user?.fullName ||
                        user?.name ||
                        'Guest Purchaser'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      {orderDetails?.order?.buyerEmail ||
                        selectedOrder.buyerEmail ||
                        user?.email ||
                        'N/A'}
                    </p>
                    {(orderDetails?.order?.buyerPhone ||
                      selectedOrder.buyerPhone) && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {orderDetails?.order?.buyerPhone ||
                          selectedOrder.buyerPhone}
                      </p>
                    )}
                  </div>

                  {/* Event */}
                  {(orderDetails?.order?.event || selectedOrder.event) && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 sm:p-4">
                      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Event
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {orderDetails?.order?.event?.name ||
                          selectedOrder.event?.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDate(
                          orderDetails?.order?.event?.startDate ||
                            selectedOrder.event?.startDate
                        )}
                      </p>
                      {(orderDetails?.order?.event?.venue?.name ||
                        selectedOrder.event?.venue?.name) && (
                        <p className="mt-0.5 text-xs text-slate-500 truncate">
                          {orderDetails?.order?.event?.venue?.name ||
                            selectedOrder.event?.venue?.name}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tickets list */}
                  {orderDetails?.tickets?.length > 0 && (
                    <div>
                      <p className="mb-2.5 sm:mb-3 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Tickets
                      </p>
                      <div className="space-y-2">
                        {orderDetails.tickets.map((ticket) => {
                          const isConfirmed = [
                            'CONFIRMED',
                            'SOLD',
                            'PAID',
                            'COMPLETED',
                          ].includes(ticket.status);
                          return (
                            <div
                              key={ticket._id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-3.5 sm:py-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {ticket.categoryName}
                                </p>
                                <p className="mt-0.5 font-mono text-[11px] sm:text-xs text-slate-500 truncate">
                                  {ticket.ticketNumber}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] sm:text-[11px] font-bold ${
                                  isConfirmed
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                              >
                                {isConfirmed ? 'Confirmed' : ticket.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {(() => {
                    const st =
                      orderDetails?.order?.status || selectedOrder.status;
                    const paySt = orderDetails?.order?.paymentStatus;
                    const isPaidOrConfirmed =
                      [
                        'CONFIRMED',
                        'COMPLETED',
                        'PAID',
                        'RESERVED',
                        'PENDING_PAYMENT',
                      ].includes(st) ||
                      paySt === 'paid' ||
                      paySt === 'success';

                    const orgList =
                      orderDetails?.order?.event?.mainOrganisers ||
                      selectedOrder.event?.mainOrganisers ||
                      [];
                    const orgObj = orgList[0];
                    const organiserContact =
                      typeof orgObj === 'string' ? orgObj : orgObj?.email;

                    if (!isPaidOrConfirmed) return null;

                    return (
                      <div className="space-y-3 sm:space-y-4 border-t border-slate-100 pt-4 sm:pt-5">
                        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3.5 sm:p-4">
                          <p className="text-sm font-bold text-emerald-900">
                            Payment Confirmed & Active
                          </p>
                          <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                            Assign attendee names, guest emails, and upload
                            photos to activate your passes.
                          </p>
                          <div className="mt-3 flex flex-col xs:flex-row gap-2">
                            <Link
                              to={`/buyer/orders/${selectedOrder._id}`}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-3 sm:py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 active:bg-emerald-700 transition touch-manipulation"
                            >
                              Manage Tickets
                            </Link>
                            <button
                              type="button"
                              onClick={() =>
                                handleDownloadInvoice(selectedOrder._id)
                              }
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-3 sm:py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 transition touch-manipulation"
                            >
                              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                              Invoice
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4">
                          <p className="text-sm font-semibold text-slate-800">
                            Need to cancel?
                          </p>
                          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                            Contact:{' '}
                            {organiserContact ||
                              'the Event Organizer for your ticket category.'}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              if (organiserContact) {
                                window.location.href = `mailto:${organiserContact}?subject=Order Cancellation Request - ${selectedOrder.orderNumber}`;
                              } else {
                                toast.error(
                                  'Organizer contact information not available'
                                );
                              }
                            }}
                            className="mt-3 inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-3 sm:py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-500 active:bg-teal-700 transition touch-manipulation"
                          >
                            Contact Organizer
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Refund Modal ── */}
      {showRefundModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4 backdrop-blur-sm"
          onClick={() => setShowRefundModal(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Request Refund
            </h3>
            <p className="mt-1.5 text-sm text-slate-500 leading-snug">
              Refund requests are reviewed within 3–5 business days.
            </p>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Reason for refund (min 10 characters)…"
              className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
              rows={3}
            />
            <div className="mt-4 flex flex-col-reverse xs:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="rounded-xl px-4 py-3 sm:py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 active:bg-slate-100 transition touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestRefund}
                disabled={refundLoading}
                className="rounded-xl bg-teal-600 px-4 py-3 sm:py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-500 active:bg-teal-700 disabled:opacity-50 transition touch-manipulation"
              >
                {refundLoading ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </BuyerLayout>
  );
};

export default BuyerOrderHistoryPage;