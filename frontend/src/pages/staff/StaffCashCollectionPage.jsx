import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import api from '../../api/client';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  BanknotesIcon,
  CheckCircleIcon,
  XMarkIcon,
  TicketIcon,
  UserIcon,
  ArrowLeftIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { getMyEvents } from '../../api/events';
import { useNavigate } from 'react-router-dom';

const StaffCashCollectionPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  const [confirmingOrder, setConfirmingOrder] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const hasAccess =
    ['MainAdmin', 'MainOrganiser', 'SubOrganiser'].includes(user?.role) ||
    user?.canCollectCash === true ||
    user?.permissions?.canCollectCash === true;

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="mx-auto mt-12 sm:mt-16 max-w-md rounded-2xl border border-slate-200/70 bg-white p-6 sm:p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <XMarkIcon className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Access Denied
          </h2>
          <p className="mt-2 text-sm text-slate-500 leading-snug">
            You do not have permission to access the Cash Collection console.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  useEffect(() => {
    getMyEvents()
      .then((res) => {
        const list = res.data?.data?.events || [];
        setEvents(list);
        if (list.length > 0 && !selectedEventId) {
          setSelectedEventId(list[0]._id);
          localStorage.setItem('lastSelectedEventId', list[0]._id);
        }
      })
      .catch(() => toast.error('Failed to load events'));
  }, [selectedEventId]);

  const fetchCashOrders = () => {
    if (!selectedEventId) return;
    setLoading(true);
    api
      .get(
        `/payment/cash-orders?eventId=${selectedEventId}&status=${statusFilter}`
      )
      .then((res) => {
        setOrders(res.data?.data || []);
      })
      .catch((err) => {
        console.error('Cash orders error:', err);
        const errorMsg =
          err.response?.data?.message ||
          err.message ||
          'Failed to load cash orders';
        toast.error(errorMsg);
      })
      .finally(() => setLoading(false));
  };

  const fetchAllOrders = () => {
    if (!selectedEventId) return;
    setLoading(true);
    api
      .get(`/payment/cash-orders?eventId=${selectedEventId}`)
      .then((res) => {
        const allOrders = res.data?.data || [];
        setOrders(allOrders);
        if (allOrders.length === 0) {
          toast('No cash orders found for this event', { icon: 'ℹ️' });
        } else {
          const methods = [
            ...new Set(allOrders.map((o) => o.paymentMethod)),
          ];
          toast.success(
            `Found ${allOrders.length} orders (payment methods: ${methods.join(
              ', '
            )})`,
            { icon: '💰' }
          );
        }
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to load orders');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCashOrders();
  }, [selectedEventId, statusFilter]);

  const handleConfirmCash = async () => {
    if (!confirmingOrder) return;
    setConfirmLoading(true);
    try {
      await api.post(`/payment/cash-confirm/${confirmingOrder._id}`);
      toast.success('Cash payment confirmed. Tickets generated.');
      setConfirmingOrder(null);
      fetchCashOrders();
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Failed to confirm cash payment'
      );
    } finally {
      setConfirmLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const q = searchQuery.toLowerCase();
    return (
      order.orderNumber?.toLowerCase().includes(q) ||
      order.buyerName?.toLowerCase().includes(q) ||
      order.buyerEmail?.toLowerCase().includes(q)
    );
  });

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
    }).format(amount || 0);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-3 px-3 pb-24 sm:space-y-5 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/staff/dashboard')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 active:bg-slate-100 touch-manipulation"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span className="hidden xs:inline">Exit</span>
          </button>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-sm sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-teal-500 ring-4 ring-teal-500/20" />
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Cash Desk
                </p>
              </div>
              <h1 className="mt-1.5 sm:mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-3xl leading-tight">
                Cash Collection
              </h1>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500 leading-snug">
                Collect payment at the door and issue confirmation.
              </p>
            </div>

            <div className="w-full sm:w-64 shrink-0">
              <select
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  localStorage.setItem('lastSelectedEventId', e.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 sm:px-4 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white touch-manipulation"
              >
                {events.map((evt) => (
                  <option key={evt._id} value={evt._id}>
                    {evt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative w-full">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                inputMode="search"
                placeholder="Search order #, name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 touch-manipulation"
              />
            </div>

            {/* Status pills — scrollable on very narrow screens */}
            <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`shrink-0 rounded-xl px-3.5 py-2.5 text-[11px] sm:text-xs font-semibold transition touch-manipulation ${
                  statusFilter === 'pending'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'border border-slate-200 bg-white text-slate-600 active:bg-slate-50 hover:bg-slate-50'
                }`}
              >
                Awaiting
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('approved')}
                className={`shrink-0 rounded-xl px-3.5 py-2.5 text-[11px] sm:text-xs font-semibold transition touch-manipulation ${
                  statusFilter === 'approved'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'border border-slate-200 bg-white text-slate-600 active:bg-slate-50 hover:bg-slate-50'
                }`}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={fetchAllOrders}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[11px] sm:text-xs font-semibold text-slate-600 transition active:bg-slate-50 hover:bg-slate-50 touch-manipulation"
              >
                View All
              </button>
            </div>
          </div>
        </div>

        {/* Orders — cards on mobile, table on desktop */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          {loading ? (
            <div className="flex justify-center py-14 sm:py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 sm:py-16 text-center px-4">
              <div className="mx-auto mb-3 sm:mb-4 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <BanknotesIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                {selectedEventId
                  ? 'No orders found for this filter'
                  : 'Select an event to view orders'}
              </p>
              {selectedEventId && (
                <button
                  type="button"
                  onClick={fetchAllOrders}
                  className="mt-3 sm:mt-4 text-xs font-semibold text-teal-600 active:text-teal-700 hover:text-teal-700 touch-manipulation"
                >
                  View all cash orders
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="divide-y divide-slate-100 sm:hidden">
                {filteredOrders.map((order) => (
                  <div key={order._id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">
                          {order.orderNumber}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-medium text-slate-800">
                          {order.buyerName}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {order.buyerEmail}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                          order.status === 'CONFIRMED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {order.status === 'CONFIRMED' ? 'Paid' : 'Awaiting'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span className="font-medium">
                        {order.tickets
                          ?.map((t) => `${t.categoryName} ×${t.quantity}`)
                          .join(', ')}
                      </span>
                      {order.zones?.length > 0 && (
                        <span className="text-teal-600">
                          Zones: {order.zones.join(', ')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-slate-900 tabular-nums">
                          {formatCurrency(order.totalAmount)}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      {order.status === 'RESERVED' && (
                        <button
                          type="button"
                          onClick={() => setConfirmingOrder(order)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2.5 text-xs font-semibold text-white transition active:bg-teal-700 hover:bg-teal-700 touch-manipulation"
                        >
                          <BanknotesIcon className="h-4 w-4" />
                          Collect
                        </button>
                      )}
                      {order.status === 'CONFIRMED' && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <CheckCircleIcon className="h-4 w-4" />
                          Paid
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Order
                      </th>
                      <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Buyer
                      </th>
                      <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Tickets
                      </th>
                      <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Amount
                      </th>
                      <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Status
                      </th>
                      <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Date
                      </th>
                      <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((order) => (
                      <tr key={order._id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {order.orderNumber}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium text-slate-900">
                            {order.buyerName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {order.buyerEmail}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {order.tickets
                            ?.map(
                              (t) => `${t.categoryName} × ${t.quantity}`
                            )
                            .join(', ')}
                          {order.zones?.length > 0 && (
                            <p className="mt-1 text-xs text-teal-600">
                              Zones: {order.zones.join(', ')}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-900">
                          {formatCurrency(order.totalAmount)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                              order.status === 'CONFIRMED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {order.status === 'CONFIRMED'
                              ? 'Paid'
                              : 'Awaiting Cash'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-500">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4">
                          {order.status === 'RESERVED' && (
                            <button
                              type="button"
                              onClick={() => setConfirmingOrder(order)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700"
                            >
                              <BanknotesIcon className="h-4 w-4" />
                              Collect Cash
                            </button>
                          )}
                          {order.status === 'CONFIRMED' && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <CheckCircleIcon className="h-4 w-4" />
                              Paid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmingOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-200/70 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4 sticky top-0 bg-white z-10">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Confirm Cash Payment
              </h3>
              <button
                type="button"
                onClick={() => setConfirmingOrder(null)}
                className="rounded-xl p-2 text-slate-400 transition active:bg-slate-100 hover:bg-slate-100 hover:text-slate-600 touch-manipulation"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4 p-4 sm:p-5">
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5 sm:p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Purchaser
                  </p>
                  <p className="font-semibold text-slate-900 truncate">
                    {confirmingOrder.buyerName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {confirmingOrder.buyerEmail}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 sm:p-4">
                <p className="mb-2.5 sm:mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <TicketIcon className="h-3.5 w-3.5" />
                  Tickets
                </p>
                <div className="divide-y divide-slate-200">
                  {confirmingOrder.tickets?.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium text-slate-700">
                          {t.categoryName}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          ×{t.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {confirmingOrder.zones?.length > 0 && (
                <div className="rounded-xl border border-teal-100 bg-teal-50 p-3.5 sm:p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-600">
                    <MapPinIcon className="h-3.5 w-3.5" />
                    Access Zones
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {confirmingOrder.zones.map((zone, idx) => (
                      <span
                        key={idx}
                        className="inline-flex rounded-lg bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-700"
                      >
                        {zone}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50 p-3.5 sm:p-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
                    Total Due Now
                  </p>
                  <p className="mt-1 text-xl sm:text-2xl font-bold text-teal-900 tabular-nums">
                    {formatCurrency(confirmingOrder.totalAmount)}
                  </p>
                </div>
                <div className="rounded-xl bg-teal-100 p-2.5 sm:p-3 text-teal-700">
                  <BanknotesIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 sm:gap-3 border-t border-slate-100 p-4 sm:p-5 sticky bottom-0 bg-white">
              <button
                type="button"
                disabled={confirmLoading}
                onClick={handleConfirmCash}
                className="flex-1 rounded-xl bg-teal-600 py-3.5 text-sm font-semibold text-white transition active:bg-teal-700 hover:bg-teal-700 disabled:opacity-50 touch-manipulation"
              >
                {confirmLoading ? 'Processing...' : 'Confirm Cash Received'}
              </button>
              <button
                type="button"
                disabled={confirmLoading}
                onClick={() => setConfirmingOrder(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-700 transition active:bg-slate-50 hover:bg-slate-50 disabled:opacity-50 touch-manipulation"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default StaffCashCollectionPage;