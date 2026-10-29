import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { io } from '../../utils/realtime';
import toast from 'react-hot-toast';
import {
  BanknotesIcon,
  CreditCardIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  XCircleIcon,
  DocumentArrowDownIcon,
  MagnifyingGlassIcon,
  UserIcon,
  BuildingOfficeIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { getSocketUrl } from '../../utils/backend';
import {
  getAllPayments,
  getPaymentStatistics,
  getPaymentDetails,
  approvePayment,
  rejectPayment,
  requestPaymentInfo,
} from '../../api/organiser';

const statusColors = {
  pending_verification: 'amber',
  approved: 'green',
  rejected: 'red',
  needs_info: 'blue',
  paid: 'green',
  success: 'green',
  failed: 'red',
  awaiting_payment: 'amber',
  pending: 'amber',
};

const statusLabels = {
  pending_verification: 'Pending Verification',
  approved: 'Approved',
  rejected: 'Rejected',
  needs_info: 'Needs Info',
  paid: 'Paid',
  success: 'Success',
  failed: 'Failed',
  awaiting_payment: 'Awaiting Payment',
  pending: 'Pending',
};

const getPaymentDisplayStatus = (payment) => {
  const raw =
    payment?.verificationStatus ||
    payment?.paymentStatus ||
    payment?.orderStatus ||
    'pending';
  if (raw === 'success') return 'approved';
  if (raw === 'paid') return 'paid';
  return raw;
};

const paymentMethodIcons = {
  card: CreditCardIcon,
  bank_transfer: BanknotesIcon,
  cash_on_entrance: BanknotesIcon,
  cash_at_entrance: BanknotesIcon,
};

const paymentMethodLabels = {
  card: 'Credit/Debit Card',
  bank_transfer: 'Bank Transfer',
  cash_on_entrance: 'Cash at Entrance',
  cash_at_entrance: 'Cash at Entrance',
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

const MetricCard = ({ title, value, subtitle, icon: Icon }) => (
  <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
          {value}
        </p>
        {subtitle && <p className="mt-1.5 text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
      {Icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  </Card>
);

/**
 * @param {string} eventId
 * @param {string} [currency] - event currency from parent (e.g. LKR, USD)
 */
const PaymentsDashboard = ({ eventId, currency: currencyProp }) => {
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [statusFilter, setStatusFilter] = useState(params.get('status') || 'all');
  const [methodFilter, setMethodFilter] = useState(params.get('method') || 'all');
  const [searchQuery, setSearchQuery] = useState(params.get('search') || '');
  const [dateFrom, setDateFrom] = useState(params.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(params.get('dateTo') || '');

  const [currentPage, setCurrentPage] = useState(parseInt(params.get('page') || '1', 10));
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Single source of truth for event currency — never undefined
  const resolvedCurrency =
    currencyProp ||
    statistics?.currency ||
    payments[0]?.currency ||
    payments[0]?.event?.settings?.currency ||
    'LKR';

  const getResolvedEventId = () =>
    eventId || localStorage.getItem('lastSelectedEventId') || undefined;

  const formatCurrency = useCallback(
    (amount, curr) => {
      const code = curr || resolvedCurrency || 'LKR';
      try {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: code,
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(Number(amount) || 0);
      } catch {
        return `${code} ${Number(amount || 0).toLocaleString()}`;
      }
    },
    [resolvedCurrency]
  );

  const fetchStatistics = async () => {
    try {
      const response = await getPaymentStatistics({ eventId: getResolvedEventId() });
      if (response.data?.success) setStatistics(response.data.data?.overview || {});
    } catch (error) {
      console.error('Error fetching payment statistics:', error);
    }
  };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await getAllPayments({
        eventId: getResolvedEventId(),
        status: statusFilter !== 'all' ? statusFilter : undefined,
        paymentMethod: methodFilter !== 'all' ? methodFilter : undefined,
        search: searchQuery || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page: currentPage,
        limit: pageSize,
      });
      if (response.data?.success) {
        const data = response.data.data;
        setPayments(data.payments || []);
        setTotal(data.total || 0);
        setTotalPages(Math.max(1, data.pages || 1));
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentDetails = async (paymentId) => {
    setLoadingDetails(true);
    try {
      const response = await getPaymentDetails(paymentId);
      if (response.data?.success) setPaymentDetails(response.data.data);
    } catch (error) {
      toast.error('Failed to load payment details');
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
    fetchPayments();
  }, [eventId, statusFilter, methodFilter, currentPage]);

  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
      fetchPayments();
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    const resolvedEventId = getResolvedEventId();
    if (!resolvedEventId) return undefined;

    const socket = io(getSocketUrl(), {
      path: '/socket.io',
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const join = () => socket.emit('join_dashboard', { eventId: resolvedEventId });
    socket.on('connect', join);
    join();

    const refresh = () => {
      fetchStatistics();
      fetchPayments();
    };
    const events = [
      'payment_approved',
      'payment_rejected',
      'payment_info_request',
      'cash_payment_confirmed',
      'event_update',
    ];
    events.forEach((e) => socket.on(e, refresh));

    return () => {
      events.forEach((e) => socket.off(e, refresh));
      socket.disconnect();
    };
  }, [eventId]);

  const applyLocalPaymentUpdate = (paymentId, nextStatus, nextOrderStatus) => {
    setPayments((prev) =>
      prev.map((item) => {
        if (item._id !== paymentId && item.submissionId !== paymentId) return item;
        return {
          ...item,
          verificationStatus: nextStatus,
          paymentStatus: nextOrderStatus,
          orderStatus: nextOrderStatus,
        };
      })
    );
  };

  const handleApprove = async () => {
    if (!selectedPayment) return;
    setProcessing(true);
    try {
      const paymentId = selectedPayment.submissionId || selectedPayment._id;
      if (!paymentId) {
        toast.error('Payment ID not found');
        return;
      }
      await approvePayment(paymentId, { notes: actionMessage });
      applyLocalPaymentUpdate(selectedPayment._id, 'approved', 'CONFIRMED');
      toast.success('Payment approved');
      setActionModal(null);
      setSelectedPayment(null);
      setActionMessage('');
      await fetchPayments();
      await fetchStatistics();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to approve');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayment || !actionMessage.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setProcessing(true);
    try {
      const paymentId = selectedPayment.submissionId || selectedPayment._id;
      if (!paymentId) {
        toast.error('Payment ID not found');
        return;
      }
      await rejectPayment(paymentId, { rejectionReason: actionMessage });
      applyLocalPaymentUpdate(selectedPayment._id, 'rejected', 'CANCELLED');
      toast.success('Payment rejected');
      setActionModal(null);
      setSelectedPayment(null);
      setActionMessage('');
      await fetchPayments();
      await fetchStatistics();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reject');
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestInfo = async () => {
    if (!selectedPayment || !actionMessage.trim()) {
      toast.error('Please provide a message');
      return;
    }
    setProcessing(true);
    try {
      const paymentId = selectedPayment.submissionId || selectedPayment._id;
      if (!paymentId) {
        toast.error('Payment ID not found');
        return;
      }
      await requestPaymentInfo(paymentId, { message: actionMessage });
      applyLocalPaymentUpdate(selectedPayment._id, 'needs_info', 'PENDING_VERIFICATION');
      toast.success('Request sent');
      setActionModal(null);
      setSelectedPayment(null);
      setActionMessage('');
      await fetchPayments();
      await fetchStatistics();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to request info');
    } finally {
      setProcessing(false);
    }
  };

  const viewReceipt = async (submissionId) => {
    try {
      const token = localStorage.getItem('entrynex_token');
      const apiUrl = import.meta.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/bank-transfer/receipt/${submissionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const blob = await response.blob();
        window.open(window.URL.createObjectURL(blob), '_blank');
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.message || 'Failed to load receipt');
      }
    } catch {
      toast.error('Error viewing receipt');
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setMethodFilter('all');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    statusFilter !== 'all' || methodFilter !== 'all' || !!searchQuery || !!dateFrom || !!dateTo;

  const pageNumbers = (() => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  })();

  return (
    <div className="space-y-5">
      {/* KPIs */}
      {statistics && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            title="Total Transactions"
            value={statistics.totalPayments || 0}
            icon={BanknotesIcon}
          />
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(statistics.totalAmount || 0)}
            subtitle={resolvedCurrency}
            icon={BanknotesIcon}
          />
          <MetricCard
            title="Pending Actions"
            value={(statistics.pendingPayments || 0) + (statistics.needsInfoPayments || 0)}
            subtitle={`${statistics.pendingPayments || 0} pending · ${statistics.needsInfoPayments || 0} needs info`}
            icon={ClockIcon}
          />
        </section>
      )}

      {/* Toolbar + filters */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Payment Management</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {total} payment{total === 1 ? '' : 's'} · {resolvedCurrency}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search order, buyer, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputClass} pl-10`}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className={
                showFilters || hasActiveFilters
                  ? 'border-teal-300 bg-teal-50 text-teal-700'
                  : ''
              }
            >
              <FunnelIcon className="mr-1.5 h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-teal-600 px-1.5 text-[10px] font-bold text-white">
                  !
                </span>
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={inputClass}
              >
                <option value="all">All statuses</option>
                <option value="pending_verification">Pending verification</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="needs_info">Needs info</option>
                <option value="awaiting_payment">Awaiting payment</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Method
              </label>
              <select
                value={methodFilter}
                onChange={(e) => {
                  setMethodFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className={inputClass}
              >
                <option value="all">All methods</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash_at_entrance">Cash at entrance</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                From date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                To date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className={inputClass}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card
        className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
        padding={false}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          </div>
        ) : payments.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">
            No payments found
            {hasActiveFilters && (
              <>
                {' '}
                ·{' '}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-semibold text-teal-600 hover:underline"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[960px]">
              <thead>
                <Tr>
                  <Th>Order</Th>
                  <Th>Buyer</Th>
                  <Th>Event / Tickets</Th>
                  <Th>Method</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th>Actions</Th>
                </Tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const MethodIcon =
                    paymentMethodIcons[payment.paymentMethod] || BanknotesIcon;
                  const displayStatus = getPaymentDisplayStatus(payment);
                  const rowCurrency =
                    payment.currency ||
                    payment.event?.settings?.currency ||
                    resolvedCurrency ||
                    'LKR';

                  return (
                    <Tr key={payment._id}>
                      <Td>
                        <span className="font-semibold text-slate-900">
                          {payment.orderNumber || '—'}
                        </span>
                      </Td>
                      <Td>
                        <p className="font-medium text-slate-900">
                          {payment.buyer?.name || '—'}
                        </p>
                        <p className="text-xs text-slate-500">{payment.buyer?.email || ''}</p>
                      </Td>
                      <Td>
                        <p className="font-medium text-slate-900">
                          {payment.event?.name || '—'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {payment.ticketSummary?.map((t) => t.categoryName).join(', ') || '—'}
                        </p>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <MethodIcon className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="text-sm text-slate-600">
                            {paymentMethodLabels[payment.paymentMethod] ||
                              payment.paymentMethod ||
                              '—'}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(payment.totalAmount, rowCurrency)}
                        </span>
                      </Td>
                      <Td>
                        <Badge color={statusColors[displayStatus] || 'gray'}>
                          {statusLabels[displayStatus] || displayStatus}
                        </Badge>
                      </Td>
                      <Td className="text-sm text-slate-500">
                        {payment.submittedAt
                          ? new Date(payment.submittedAt).toLocaleDateString()
                          : '—'}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          {/* View */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPayment(payment);
                              fetchPaymentDetails(payment._id);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                            title="View details"
                          >
                            <MagnifyingGlassIcon className="h-4 w-4" />
                          </button>

                          {/* Receipt */}
                          {payment.paymentMethod === 'bank_transfer' && payment.submissionId && (
                            <button
                              type="button"
                              onClick={() => viewReceipt(payment.submissionId)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                              title="View receipt"
                            >
                              <DocumentArrowDownIcon className="h-4 w-4" />
                            </button>
                          )}

                          {/* Status actions */}
                          {(displayStatus === 'pending_verification' || displayStatus === 'pending') &&
                            payment.paymentMethod === 'bank_transfer' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setActionModal('approve');
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                                  title="Approve"
                                >
                                  <CheckCircleIcon className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setActionModal('reject');
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                                  title="Reject"
                                >
                                  <XCircleIcon className="h-4 w-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setActionModal('request-info');
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-600 transition hover:bg-teal-100"
                                  title="Request info"
                                >
                                  <ExclamationCircleIcon className="h-4 w-4" />
                                </button>
                              </>
                            )}

                          {displayStatus === 'awaiting_payment' &&
                            (payment.paymentMethod === 'cash_at_entrance' ||
                              payment.paymentMethod === 'cash_on_entrance') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setActionModal('approve');
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                                title="Approve"
                              >
                                <CheckCircleIcon className="h-4 w-4" />
                              </button>
                            )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {payments.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 rounded-lg px-3 text-xs"
              >
                Prev
              </Button>
              <div className="mx-1 flex items-center gap-1">
                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCurrentPage(n)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                      n === currentPage
                        ? 'bg-teal-600 text-white shadow-sm shadow-teal-200'
                        : 'text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 rounded-lg px-3 text-xs"
              >
                Next
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Page
              </span>
              <span className="font-bold text-slate-900">{currentPage}</span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                of
              </span>
              <span className="font-bold text-slate-900">{totalPages}</span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                · {total} rows
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Payment details modal */}
      <Modal
        open={!!selectedPayment && !actionModal}
        onClose={() => {
          setSelectedPayment(null);
          setPaymentDetails(null);
        }}
        title={`Payment · ${selectedPayment?.orderNumber || ''}`}
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedPayment(null);
                setPaymentDetails(null);
              }}
            >
              Close
            </Button>

            <div className="flex flex-wrap gap-2">
              {(selectedPayment?.verificationStatus === 'pending_verification' ||
                selectedPayment?.verificationStatus === 'pending') &&
                selectedPayment?.paymentMethod === 'bank_transfer' && (
                  <>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-500"
                      onClick={() => setActionModal('approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="border-rose-200 text-rose-600 hover:bg-rose-50"
                      onClick={() => setActionModal('reject')}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="outline"
                      className="border-teal-200 text-teal-600 hover:bg-teal-50"
                      onClick={() => setActionModal('request-info')}
                    >
                      Request info
                    </Button>
                  </>
                )}

              {selectedPayment?.verificationStatus === 'awaiting_payment' &&
                (selectedPayment?.paymentMethod === 'cash_at_entrance' ||
                  selectedPayment?.paymentMethod === 'cash_on_entrance') && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-500"
                    onClick={() => setActionModal('approve')}
                  >
                    Approve
                  </Button>
                )}
            </div>
          </div>
        }
      >
        {loadingDetails ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          </div>
        ) : paymentDetails ? (
          <div className="space-y-5">
            {/* Header strip */}
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Order details
                </p>
                <h3 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">
                  {selectedPayment?.orderNumber || paymentDetails.order?.orderNumber || '—'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {paymentDetails.event?.name || selectedPayment?.event?.name || 'Event'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Badge
                  color={
                    statusColors[
                      getPaymentDisplayStatus(selectedPayment || paymentDetails.order || {})
                    ] || 'gray'
                  }
                >
                  {statusLabels[
                    getPaymentDisplayStatus(selectedPayment || paymentDetails.order || {})
                  ] ||
                    paymentDetails.order?.paymentStatus ||
                    '—'}
                </Badge>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {paymentMethodLabels[paymentDetails.order?.paymentMethod] ||
                    paymentDetails.order?.paymentMethod ||
                    '—'}
                </span>
                <span className="text-lg font-bold text-slate-900">
                  {formatCurrency(paymentDetails.order?.totalAmount)}
                </span>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Buyer */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">Buyer</h4>
                </div>
                <dl className="space-y-2.5 text-sm">
                  {[
                    ['Name', paymentDetails.order?.buyerName],
                    ['Email', paymentDetails.order?.buyerEmail],
                    ['Phone', paymentDetails.order?.buyerPhone],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">{label}</dt>
                      <dd className="truncate text-right font-medium text-slate-900">
                        {value || '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Event */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <BuildingOfficeIcon className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">Event</h4>
                </div>
                <dl className="space-y-2.5 text-sm">
                  {[
                    ['Name', paymentDetails.event?.name],
                    [
                      'Date',
                      paymentDetails.event?.startDate
                        ? new Date(paymentDetails.event.startDate).toLocaleDateString()
                        : 'TBD',
                    ],
                    ['Venue', paymentDetails.event?.venue?.name || 'TBD'],
                    [
                      'Currency',
                      paymentDetails.event?.settings?.currency || resolvedCurrency || 'LKR',
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">{label}</dt>
                      <dd className="truncate text-right font-medium text-slate-900">
                        {value || '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Payment meta */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:col-span-2">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <BanknotesIcon className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">Payment</h4>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    [
                      'Method',
                      paymentMethodLabels[paymentDetails.order?.paymentMethod] ||
                        paymentDetails.order?.paymentMethod,
                    ],
                    ['Payment status', paymentDetails.order?.paymentStatus],
                    ['Order status', paymentDetails.order?.status],
                    [
                      'Order date',
                      paymentDetails.order?.createdAt
                        ? new Date(paymentDetails.order.createdAt).toLocaleString()
                        : 'N/A',
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {label}
                      </p>
                      <p className="mt-1 font-medium text-slate-900">{value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bank transfer */}
            {paymentDetails.paymentSubmission &&
              paymentDetails.order?.paymentMethod === 'bank_transfer' && (
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                        <BanknotesIcon className="h-4 w-4" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">Bank transfer</h4>
                    </div>
                    {paymentDetails.paymentSubmission?._id && (
                      <button
                        type="button"
                        onClick={() => viewReceipt(paymentDetails.paymentSubmission._id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                      >
                        <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                        View receipt
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ['Payer', paymentDetails.paymentSubmission.payerName],
                      ['Bank', paymentDetails.paymentSubmission.bankUsed],
                      ['Date', paymentDetails.paymentSubmission.transferDate],
                      ['Time', paymentDetails.paymentSubmission.transferTime],
                      ['Reference', paymentDetails.paymentSubmission.referenceNumber],
                      [
                        'Amount paid',
                        formatCurrency(paymentDetails.paymentSubmission.amountPaid),
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 font-medium text-slate-900">{value || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Tickets */}
            {paymentDetails.tickets?.length > 0 && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-sm font-semibold text-slate-900">
                  Tickets
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {paymentDetails.tickets.length} item
                    {paymentDetails.tickets.length === 1 ? '' : 's'}
                  </span>
                </h4>
                <div className="overflow-hidden rounded-xl border border-slate-100">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="px-3 py-2.5">Category</th>
                        <th className="px-3 py-2.5">Ticket #</th>
                        <th className="px-3 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paymentDetails.tickets.map((ticket) => (
                        <tr key={ticket._id} className="bg-white">
                          <td className="px-3 py-2.5 font-medium text-slate-900">
                            {ticket.categoryName || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {ticket.ticketNumber || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge color={statusColors[ticket.status] || 'gray'}>
                              {ticket.status || '—'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-slate-500">
            No payment details available
          </div>
        )}
      </Modal>

      {/* Action modal */}
      <Modal
        open={!!actionModal}
        onClose={() => {
          if (processing) return;
          setActionModal(null);
          setActionMessage('');
          setSelectedPayment(null); 
          setPaymentDetails(null);
        }}
        title={
          actionModal === 'approve'
            ? 'Approve payment'
            : actionModal === 'reject'
            ? 'Reject payment'
            : 'Request information'
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              disabled={processing}
              onClick={() => {
                setActionModal(null);
                setActionMessage('');
                setSelectedPayment(null);
                setPaymentDetails(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={processing || (actionModal !== 'approve' && !actionMessage.trim())}
              className={
                actionModal === 'reject'
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-sm shadow-rose-200'
                  : actionModal === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-200'
                  : 'bg-teal-600 hover:bg-teal-500 shadow-sm shadow-teal-200'
              }
              onClick={
                actionModal === 'approve'
                  ? handleApprove
                  : actionModal === 'reject'
                  ? handleReject
                  : handleRequestInfo
              }
            >
              {processing ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Processing...
                </span>
              ) : actionModal === 'approve' ? (
                'Approve payment'
              ) : actionModal === 'reject' ? (
                'Reject payment'
              ) : (
                'Send request'
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Order summary chip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Order
              </p>
              <p className="mt-0.5 truncate font-semibold text-slate-900">
                {selectedPayment?.orderNumber || '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Amount
              </p>
              <p className="mt-0.5 font-bold text-slate-900">
                {formatCurrency(selectedPayment?.totalAmount)}
              </p>
            </div>
          </div>

          {/* Approve */}
          {actionModal === 'approve' && (
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 p-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircleIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-emerald-900">Confirm approval</p>
                  <p className="mt-1 text-emerald-800/90">
                    This will mark the payment as received, set the order to{' '}
                    <span className="font-semibold">CONFIRMED</span>, activate tickets, and
                    email the buyer.
                  </p>
                  <ul className="mt-3 space-y-1.5 text-emerald-800/80">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      Payment marked as approved
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      Tickets activated for the buyer
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      Confirmation email sent
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Reject */}
          {actionModal === 'reject' && (
            <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 p-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                  <XCircleIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-rose-900">Reject payment</p>
                  <p className="mt-1 text-rose-800/90">
                    This will cancel the submission, set the order to{' '}
                    <span className="font-semibold">CANCELLED</span>, deactivate tickets, and
                    notify the buyer with your reason.
                  </p>
                  <ul className="mt-3 space-y-1.5 text-rose-800/80">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                      Payment rejected
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                      Tickets deactivated
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                      Buyer receives rejection notice
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Request info */}
          {actionModal === 'request-info' && (
            <div className="rounded-2xl border border-teal-200/80 bg-teal-50/90 p-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                  <ExclamationCircleIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-teal-900">Request more information</p>
                  <p className="mt-1 text-teal-800/90">
                    Status becomes <span className="font-semibold">Needs info</span>. Your
                    message is sent to the buyer so they can reply with details.
                  </p>
                  <ul className="mt-3 space-y-1.5 text-teal-800/80">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                      Status set to Needs info
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                      Message delivered to buyer
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                      Order stays open until you decide
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Message field — reject & request-info only */}
          {actionModal !== 'approve' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {actionModal === 'reject' ? 'Rejection reason' : 'Message to buyer'}
                <span className="ml-1 text-rose-500">*</span>
              </label>
              <textarea
                value={actionMessage}
                onChange={(e) => setActionMessage(e.target.value)}
                rows={4}
                disabled={processing}
                placeholder={
                  actionModal === 'reject'
                    ? 'Explain why this payment is being rejected...'
                    : 'Describe what additional information you need...'
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50 disabled:text-slate-500"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {actionModal === 'reject'
                  ? 'This reason is included in the notification to the buyer.'
                  : 'The buyer will see this message and can respond with more details.'}
              </p>
            </div>
          )}

          {/* Optional note on approve */}
          {actionModal === 'approve' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Internal note <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                value={actionMessage}
                onChange={(e) => setActionMessage(e.target.value)}
                rows={2}
                disabled={processing}
                placeholder="Optional note for your records..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50"
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default PaymentsDashboard;