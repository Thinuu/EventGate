import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  getSubOrgPayments,
  getSubOrgPaymentStatistics,
  getSubOrgPaymentDetails,
  approveSubOrgPayment,
  rejectSubOrgPayment,
  requestSubOrgPaymentInfo,
} from '../../api/subPaymentManagement';
import { getSubDashboard } from '../../api/sub';
import {
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const statusConfig = {
  pending: { label: 'Pending', shortLabel: 'Pending', color: 'amber' },
  pending_verification: {
    label: 'Pending Verification',
    shortLabel: 'Verifying',
    color: 'amber',
  },
  awaiting_payment: {
    label: 'Awaiting Payment',
    shortLabel: 'Awaiting',
    color: 'blue',
  },
  paid: { label: 'Paid', shortLabel: 'Paid', color: 'green' },
  success: { label: 'Approved', shortLabel: 'Approved', color: 'green' },
  approved: { label: 'Approved', shortLabel: 'Approved', color: 'green' },
  verified: { label: 'Verified', shortLabel: 'Verified', color: 'green' },
  rejected: { label: 'Rejected', shortLabel: 'Rejected', color: 'red' },
  failed: { label: 'Failed', shortLabel: 'Failed', color: 'red' },
  needs_info: { label: 'Needs Info', shortLabel: 'Needs Info', color: 'blue' },
};

const resolveCurrency = (...sources) => {
  for (const source of sources) {
    const currency =
      source?.event?.settings?.currency ||
      source?.event?.currency ||
      source?.order?.event?.settings?.currency ||
      source?.order?.eventId?.settings?.currency ||
      source?.order?.currency ||
      source?.orderId?.event?.settings?.currency ||
      source?.orderId?.eventId?.settings?.currency ||
      source?.orderId?.currency ||
      source?.settings?.currency ||
      source?.currency;
    if (currency) return currency;
  }
  return null;
};

const getCurrency = (...sources) =>
  resolveCurrency(...sources) ||
  localStorage.getItem('lastEventCurrency') ||
  'LKR';

const formatCurrency = (amount, currency = 'LKR') =>
  `${currency} ${Number(amount || 0).toLocaleString()}`;

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateShort = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const formatMethod = (m) => {
  if (m === 'card') return 'Card';
  if (m === 'bank_transfer') return 'Bank Transfer';
  if (m === 'cash_at_entrance' || m === 'cash_on_entrance') return 'Cash at Venue';
  return m || '—';
};

const formatMethodShort = (m) => {
  if (m === 'card') return 'Card';
  if (m === 'bank_transfer') return 'Bank';
  if (m === 'cash_at_entrance' || m === 'cash_on_entrance') return 'Cash';
  return m || '—';
};

const normalizeStatus = (status) => {
  if (status === 'success' || status === 'paid') return 'approved';
  if (status === 'failed') return 'rejected';
  return status;
};

const MetricCard = ({ title, value, subtitle, icon: Icon }) => (
  <Card className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white shadow-sm p-3 sm:p-5">
    <div className="flex items-start justify-between gap-2 sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 leading-none">
          {title}
        </p>
        <p className="mt-1 sm:mt-2 text-base sm:text-3xl font-bold tracking-tight text-slate-900 truncate leading-tight">
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 sm:mt-1.5 text-[10px] sm:text-xs text-slate-500 truncate">
            {subtitle}
          </p>
        )}
      </div>
      {Icon && (
        <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  </Card>
);

const SubOrgPayments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    pages: 1,
    total: 0,
  });

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [showConfirmCashModal, setShowConfirmCashModal] = useState(false);
  const [showConfirmApproveModal, setShowConfirmApproveModal] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(false);

  const [currentEventId, setCurrentEventId] = useState(() => {
    const id = localStorage.getItem('lastSelectedEventId');
    return id && id !== 'undefined' && id !== 'null' ? id : '';
  });
  const [eventCurrency, setEventCurrency] = useState(
    localStorage.getItem('lastEventCurrency') || 'LKR'
  );

  const filterRefs = useRef({
    statusFilter,
    methodFilter,
    searchQuery,
    pagination,
    currentEventId,
  });

  useEffect(() => {
    filterRefs.current = {
      statusFilter,
      methodFilter,
      searchQuery,
      pagination,
      currentEventId,
    };
  }, [statusFilter, methodFilter, searchQuery, pagination, currentEventId]);

  const currency = getCurrency(
    statistics,
    paymentDetails,
    selectedPayment,
    payments[0],
    { currency: eventCurrency }
  );

  const rememberCurrency = useCallback((nextCurrency) => {
    if (!nextCurrency) return;
    setEventCurrency(nextCurrency);
    localStorage.setItem('lastEventCurrency', nextCurrency);
  }, []);

  const fetchPayments = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(null);
    try {
      const {
        statusFilter,
        methodFilter,
        searchQuery,
        pagination,
        currentEventId,
      } = filterRefs.current;

      const cleanId =
        currentEventId &&
        currentEventId !== 'undefined' &&
        currentEventId !== 'null'
          ? currentEventId
          : undefined;

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        eventId: cleanId,
      };
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (methodFilter && methodFilter !== 'all')
        params.paymentMethod = methodFilter;
      if (searchQuery) params.search = searchQuery;

      const res = await getSubOrgPayments(params);
      const data = res.data?.data || {};
      setPayments(data.payments || []);
      rememberCurrency(resolveCurrency(data, data.payments?.[0]));

      const backendPagination = data.pagination || {};
      const total = Number(data.total ?? backendPagination.total ?? 0);
      const limit = Number(backendPagination.limit || pagination.limit || 10);
      const pages = Number(
        data.pages ||
          backendPagination.pages ||
          Math.ceil(total / limit) ||
          1
      );

      setPagination((prev) => ({
        ...prev,
        page: data.page || Number(backendPagination.page) || prev.page,
        limit,
        total,
        pages,
      }));
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to load payments');
      toast.error('Failed to load payments');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async (isInitial = false) => {
    if (isInitial) setStatsLoading(true);
    try {
      const { currentEventId } = filterRefs.current;

      const cleanId =
        currentEventId &&
        currentEventId !== 'undefined' &&
        currentEventId !== 'null'
          ? currentEventId
          : undefined;

      const res = await getSubOrgPaymentStatistics({ eventId: cleanId });
      const nextStats = res.data?.data?.overview || {};
      setStatistics(nextStats);
      rememberCurrency(resolveCurrency(res.data?.data, nextStats));
      setLastUpdated(new Date());
    } catch (err) {
      setStatistics({});
    } finally {
      if (isInitial) setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      if (!currentEventId) return;

      setLoading(true);
      setStatsLoading(true);

      try {
        const { statusFilter, methodFilter, searchQuery, pagination } =
          filterRefs.current;

        const cleanId =
          currentEventId &&
          currentEventId !== 'undefined' &&
          currentEventId !== 'null'
            ? currentEventId
            : undefined;

        const [paymentsRes, statsRes] = await Promise.all([
          getSubOrgPayments({
            page: pagination.page,
            limit: pagination.limit,
            eventId: cleanId,
            status: statusFilter !== 'all' ? statusFilter : undefined,
            paymentMethod: methodFilter !== 'all' ? methodFilter : undefined,
            search: searchQuery || undefined,
          }),
          getSubOrgPaymentStatistics({ eventId: cleanId }),
        ]);

        if (!mounted) return;

        const paymentsData = paymentsRes.data?.data || {};
        setPayments(paymentsData.payments || []);

        const backendPagination = paymentsData.pagination || {};
        const total = Number(
          paymentsData.total ?? backendPagination.total ?? 0
        );
        const limit = Number(
          backendPagination.limit || pagination.limit || 10
        );
        const pages = Number(
          paymentsData.pages ||
            backendPagination.pages ||
            Math.ceil(total / limit) ||
            1
        );

        setPagination((prev) => ({
          ...prev,
          page:
            paymentsData.page ||
            Number(backendPagination.page) ||
            prev.page,
          limit,
          total,
          pages,
        }));

        const statsData = statsRes.data?.data || {};
        setStatistics(statsData.overview || {});
        rememberCurrency(resolveCurrency(statsData, statsData.overview));

        setLastUpdated(new Date());
      } catch (err) {
        if (mounted) {
          setError('Failed to load payments');
          setStatistics({});
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setStatsLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, [currentEventId]);

  useEffect(() => {
    if (!currentEventId) return;

    const fetchFilteredData = async () => {
      setLoading(true);
      try {
        const cleanId =
          currentEventId &&
          currentEventId !== 'undefined' &&
          currentEventId !== 'null'
            ? currentEventId
            : undefined;

        const res = await getSubOrgPayments({
          page: pagination.page,
          limit: pagination.limit,
          eventId: cleanId,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          paymentMethod: methodFilter !== 'all' ? methodFilter : undefined,
          search: searchQuery || undefined,
        });

        const data = res.data?.data || {};
        setPayments(data.payments || []);

        const backendPagination = data.pagination || {};
        const total = Number(data.total ?? backendPagination.total ?? 0);
        const limit = Number(
          backendPagination.limit || pagination.limit || 10
        );
        const pages = Number(
          data.pages ||
            backendPagination.pages ||
            Math.ceil(total / limit) ||
            1
        );

        setPagination((prev) => ({
          ...prev,
          page: data.page || Number(backendPagination.page) || prev.page,
          limit,
          total,
          pages,
        }));
      } catch (err) {
        setError('Failed to load payments');
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchFilteredData, 300);
    return () => clearTimeout(timeoutId);
  }, [
    statusFilter,
    methodFilter,
    searchQuery,
    pagination.page,
    pagination.limit,
    currentEventId,
  ]);

  useEffect(() => {
    if (!currentEventId) return;

    const loadCurrency = async () => {
      try {
        const cleanId =
          currentEventId &&
          currentEventId !== 'undefined' &&
          currentEventId !== 'null'
            ? currentEventId
            : undefined;
        const response = await getSubDashboard({ eventId: cleanId });
        rememberCurrency(resolveCurrency(response.data?.data));
      } catch (e) {}
    };

    loadCurrency();

    const intervalId = setInterval(() => {
      fetchStats(false);
    }, 60000);

    return () => clearInterval(intervalId);
  }, [currentEventId]);

  useEffect(() => {
    const handleEventSelect = (e) => {
      const newId = e.detail ? String(e.detail) : '';
      if (!newId || newId === 'undefined' || newId === 'null') return;
      setCurrentEventId(newId);
      localStorage.setItem('lastSelectedEventId', newId);
    };
    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const handleViewDetails = async (payment) => {
    setSelectedPayment(payment);
    setDetailsLoading(true);
    try {
      const res = await getSubOrgPaymentDetails(payment._id);
      const nextDetails = res.data?.data || null;
      setPaymentDetails(nextDetails);
      rememberCurrency(resolveCurrency(nextDetails, payment));
    } catch {
      toast.error('Failed to load payment details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedPayment(null);
    setPaymentDetails(null);
    setShowRejectModal(false);
    setShowRequestInfoModal(false);
    setShowConfirmCashModal(false);
    setShowConfirmApproveModal(false);
    setActionMessage('');
  };

  const handleViewReceipt = async (submissionId) => {
    if (!submissionId) {
      toast.error('Receipt is not available for this payment.');
      return;
    }

    setViewingReceipt(true);
    try {
      const response = await api.get(`/bank-transfer/receipt/${submissionId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: response.headers?.['content-type'] || 'application/octet-stream',
      });
      const url = window.URL.createObjectURL(blob);
      const opened = window.open(url, '_blank', 'noopener,noreferrer');

      if (!opened) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }

      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to open receipt');
    } finally {
      setViewingReceipt(false);
    }
  };

  const openApproveConfirm = (payment) => {
    setSelectedPayment(payment);
    setShowConfirmApproveModal(true);
  };

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await approveSubOrgPayment(id);
      toast.success('Payment approved successfully!');
      closeDetails();
      await Promise.all([fetchPayments(false), fetchStats(false)]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!actionMessage.trim())
      return toast.error('Please provide a reason for rejection');
    setActionLoading('reject');
    try {
      await rejectSubOrgPayment(selectedPayment._id, {
        rejectionReason: actionMessage,
      });
      toast.success('Payment rejected');
      closeDetails();
      await Promise.all([fetchPayments(false), fetchStats(false)]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestInfo = async () => {
    if (!actionMessage.trim()) return toast.error('Please provide a message');
    setActionLoading('request_info');
    try {
      await requestSubOrgPaymentInfo(selectedPayment._id, {
        message: actionMessage,
      });
      toast.success('Information request sent to buyer');
      closeDetails();
      await Promise.all([fetchPayments(false), fetchStats(false)]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setActionLoading(null);
    }
  };

  const renderPaymentActions = (payment, displayStatus, mobile = false) => {
    const btnPad = mobile ? 'p-2.5' : 'p-1.5';
    return (
      <div
        className={`flex items-center gap-1.5 ${
          mobile ? 'w-full justify-stretch' : 'justify-end'
        }`}
      >
        <button
          type="button"
          onClick={() => handleViewDetails(payment)}
          className={`rounded-xl ${btnPad} text-slate-500 active:bg-teal-50 hover:bg-teal-50 hover:text-teal-600 touch-manipulation ${
            mobile ? 'flex-1 border border-slate-200 bg-white justify-center inline-flex' : ''
          }`}
          title="View details"
        >
          <EyeIcon className="h-4 w-4" />
          {mobile && (
            <span className="ml-1.5 text-xs font-semibold">Details</span>
          )}
        </button>
        {payment.paymentMethod === 'bank_transfer' &&
          (displayStatus === 'pending' ||
            displayStatus === 'pending_verification') && (
            <>
              <button
                type="button"
                onClick={() => openApproveConfirm(payment)}
                disabled={
                  actionLoading === (payment.submissionId || payment._id)
                }
                className={`rounded-xl ${btnPad} text-emerald-600 active:bg-emerald-50 hover:bg-emerald-50 touch-manipulation ${
                  mobile
                    ? 'flex-1 border border-emerald-200 bg-emerald-50 justify-center inline-flex'
                    : ''
                }`}
                title="Approve"
              >
                <CheckCircleIcon className="h-4 w-4" />
                {mobile && (
                  <span className="ml-1.5 text-xs font-semibold">Approve</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPayment(payment);
                  setShowRejectModal(true);
                }}
                className={`rounded-xl ${btnPad} text-rose-500 active:bg-rose-50 hover:bg-rose-50 touch-manipulation ${
                  mobile
                    ? 'flex-1 border border-rose-200 bg-rose-50 justify-center inline-flex'
                    : ''
                }`}
                title="Reject"
              >
                <XCircleIcon className="h-4 w-4" />
                {mobile && (
                  <span className="ml-1.5 text-xs font-semibold">Reject</span>
                )}
              </button>
            </>
          )}
        {(payment.paymentMethod === 'cash_at_entrance' ||
          payment.paymentMethod === 'cash_on_entrance') &&
          (displayStatus === 'pending' ||
            displayStatus === 'awaiting_payment') && (
            <Button
              size="sm"
              className={`bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs touch-manipulation ${
                mobile ? 'flex-1 py-2.5' : ''
              }`}
              onClick={() => {
                setSelectedPayment(payment);
                setShowConfirmCashModal(true);
              }}
              disabled={
                actionLoading === (payment.submissionId || payment._id)
              }
            >
              Confirm
            </Button>
          )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-3 sm:space-y-6 pb-20">
        {/* Header */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-2 sm:gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/suborg/dashboard"
                  className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-teal-600 active:bg-teal-50 hover:text-teal-700 touch-manipulation"
                >
                  <ArrowLeftIcon className="h-3.5 w-3.5" />
                  Dashboard
                </Link>
                <span className="text-slate-300">·</span>
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Payments
                </p>
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                  Payments
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-snug">
                  Review and approve payments for your event scope.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Live indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-sm text-slate-500 px-0.5">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
          {lastUpdated && (
            <span className="tabular-nums">
              Updated {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Metrics — 2×2 on mobile, less scroll */}
        {!statsLoading && Object.keys(statistics || {}).length === 0 ? (
          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-5 sm:p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <ExclamationTriangleIcon className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                No payment statistics available
              </p>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-snug">
                You may not have ticket categories assigned. Contact the event
                organizer.
              </p>
            </div>
          </Card>
        ) : (
          <section className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
            <MetricCard
              title="Total"
              value={statsLoading ? '—' : statistics?.totalPayments || 0}
              subtitle="Transactions"
              icon={BanknotesIcon}
            />
            <MetricCard
              title="Paid"
              value={
                statsLoading
                  ? '—'
                  : formatCurrency(statistics?.approvedAmount || 0, currency)
              }
              subtitle="Confirmed"
              icon={CheckCircleIcon}
            />
            <MetricCard
              title="Pending Bank"
              value={
                statsLoading ? '—' : statistics?.pendingBankTransfers || 0
              }
              subtitle="Review"
              icon={ClockIcon}
            />
            <MetricCard
              title="Cash Due"
              value={statsLoading ? '—' : statistics?.cashReservations || 0}
              subtitle="At entrance"
              icon={ClockIcon}
            />
            <MetricCard
              title="Bank OK"
              value={
                statsLoading ? '—' : statistics?.approvedBankTransfers || 0
              }
              subtitle="Verified"
              icon={CheckCircleIcon}
            />
            <MetricCard
              title="Cash In"
              value={
                statsLoading
                  ? '—'
                  : formatCurrency(statistics?.cashCollected || 0, currency)
              }
              subtitle="Collected"
              icon={BanknotesIcon}
            />
            <MetricCard
              title="Needs Info"
              value={statsLoading ? '—' : statistics?.needsInfoPayments || 0}
              subtitle="Buyer reply"
              icon={ExclamationTriangleIcon}
            />
            <MetricCard
              title="Rejected"
              value={statsLoading ? '—' : statistics?.rejectedPayments || 0}
              subtitle="Declined"
              icon={XCircleIcon}
            />
          </section>
        )}

        {/* Filters */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-3.5 sm:p-5">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
            {[
              { key: 'all', label: 'All' },
              { key: 'bank_transfer', label: 'Bank' },
              { key: 'cash_at_entrance', label: 'Cash' },
              { key: 'card', label: 'Card' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMethodFilter(key);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className={`shrink-0 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition touch-manipulation ${
                  methodFilter === key
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 active:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <input
              type="search"
              inputMode="search"
              placeholder="Search order #, email…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPagination((p) => ({ ...p, page: 1 }));
                }
              }}
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="awaiting_payment">Awaiting Payment</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="needs_info">Needs Info</option>
            </select>
          </div>
        </Card>

        {/* Payments list */}
        <Card
          className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
          padding={false}
        >
          <div className="border-b border-slate-100 bg-slate-50/40 px-4 py-3 sm:px-5 sm:py-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Submissions
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {pagination.total} payment
              {pagination.total !== 1 ? 's' : ''}
            </p>
          </div>

          {loading ? (
            <div className="p-4 sm:p-6">
              <LoadingSkeleton />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-sm text-rose-600">{error}</div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-12 sm:py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                <BanknotesIcon className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                No payments found
              </p>
              <p className="mt-1 text-xs text-slate-500">Try adjusting filters</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="divide-y divide-slate-100 sm:hidden">
                {payments.map((payment) => {
                  const displayStatus = normalizeStatus(
                    payment.verificationStatus || payment.paymentStatus
                  );
                  const info = statusConfig[displayStatus] || {
                    label: displayStatus,
                    shortLabel: displayStatus,
                    color: 'gray',
                  };

                  return (
                    <div key={payment._id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-semibold text-slate-900">
                            {payment.orderNumber ||
                              payment.orderId?.orderNumber ||
                              '—'}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatDateShort(
                              payment.submittedAt || payment.createdAt
                            )}{' '}
                            · {formatMethodShort(payment.paymentMethod)}
                          </p>
                        </div>
                        <Badge color={info.color}>
                          {info.shortLabel || info.label}
                        </Badge>
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {payment.buyer?.name || payment.buyerName || '—'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {payment.buyer?.email || payment.buyerEmail || '—'}
                        </p>
                      </div>

                      <p className="text-sm font-bold text-slate-900 tabular-nums">
                        {formatCurrency(
                          payment.totalAmount || payment.amountPaid,
                          getCurrency(payment, statistics)
                        )}
                      </p>

                      {renderPaymentActions(payment, displayStatus, true)}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <Table className="min-w-[800px]">
                  <thead>
                    <Tr>
                      <Th>Order #</Th>
                      <Th>Method</Th>
                      <Th>Payer</Th>
                      <Th>Amount</Th>
                      <Th>Date</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Actions</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => {
                      const displayStatus = normalizeStatus(
                        payment.verificationStatus || payment.paymentStatus
                      );
                      const info = statusConfig[displayStatus] || {
                        label: displayStatus,
                        color: 'gray',
                      };

                      return (
                        <Tr key={payment._id}>
                          <Td>
                            <span className="font-mono text-sm font-medium text-slate-900">
                              {payment.orderNumber ||
                                payment.orderId?.orderNumber ||
                                '—'}
                            </span>
                          </Td>
                          <Td>
                            <p className="text-sm font-medium text-slate-900">
                              {formatMethod(payment.paymentMethod)}
                            </p>
                            {(payment.gatewayUsed || payment.bankUsed) && (
                              <p className="text-xs text-slate-500 uppercase">
                                {payment.gatewayUsed || payment.bankUsed}
                              </p>
                            )}
                          </Td>
                          <Td>
                            <p className="text-sm font-medium text-slate-900">
                              {payment.buyer?.name || payment.buyerName || '—'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {payment.buyer?.email ||
                                payment.buyerEmail ||
                                '—'}
                            </p>
                          </Td>
                          <Td>
                            <span className="text-sm font-semibold text-slate-900">
                              {formatCurrency(
                                payment.totalAmount || payment.amountPaid,
                                getCurrency(payment, statistics)
                              )}
                            </span>
                          </Td>
                          <Td>
                            <p className="text-sm text-slate-600">
                              {formatDate(
                                payment.submittedAt || payment.createdAt
                              )}
                            </p>
                          </Td>
                          <Td>
                            <Badge color={info.color}>{info.label}</Badge>
                          </Td>
                          <Td className="text-right">
                            {renderPaymentActions(payment, displayStatus, false)}
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </>
          )}

          {pagination.pages > 1 && (
            <div className="flex flex-col gap-2.5 border-t border-slate-100 bg-slate-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-center sm:text-left text-xs sm:text-sm text-slate-500 order-2 sm:order-1">
                Page {pagination.page} of {pagination.pages} ·{' '}
                {pagination.total} total
              </p>
              <div className="flex items-center justify-center gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page - 1 }))
                  }
                  className="min-h-[40px] rounded-xl px-4 text-xs touch-manipulation"
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page + 1 }))
                  }
                  className="min-h-[40px] rounded-xl px-4 text-xs touch-manipulation"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Details modal — logic unchanged; tighter mobile spacing */}
      {selectedPayment &&
        !showRejectModal &&
        !showRequestInfoModal &&
        !showConfirmCashModal &&
        !showConfirmApproveModal && (
          <Modal open onClose={closeDetails} title="Payment Details" size="xl">
            {detailsLoading ? (
              <div className="py-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
              </div>
            ) : paymentDetails ? (
              <div className="space-y-4 sm:space-y-5">
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  {[
                    {
                      label: 'Order Number',
                      value: paymentDetails.order?.orderNumber || '—',
                    },
                    {
                      label: 'Amount',
                      value: formatCurrency(
                        paymentDetails.order?.totalAmount,
                        getCurrency(
                          paymentDetails,
                          selectedPayment,
                          statistics
                        )
                      ),
                    },
                    {
                      label: 'Payment Method',
                      value:
                        paymentDetails.order?.paymentMethod?.replace(
                          /_/g,
                          ' '
                        ) || '—',
                    },
                    {
                      label: 'Date Created',
                      value: formatDate(paymentDetails.order?.createdAt),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-3.5"
                    >
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-900 capitalize break-words">
                        {item.value}
                      </p>
                    </div>
                  ))}
                  {paymentDetails.order?.paymentMethod === 'bank_transfer' &&
                    paymentDetails.paymentSubmission && (
                      <>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-3.5">
                          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Bank Used
                          </p>
                          <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-900">
                            {paymentDetails.paymentSubmission.bankUsed || '—'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:p-3.5">
                          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Reference
                          </p>
                          <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-900 break-all">
                            {paymentDetails.paymentSubmission
                              .referenceNumber || '—'}
                          </p>
                        </div>
                      </>
                    )}
                </div>

                <div className="rounded-xl border border-slate-200 p-3.5 sm:p-4">
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Buyer
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
                    <p>
                      <span className="text-slate-500">Name:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {paymentDetails.order?.buyerName || '—'}
                      </span>
                    </p>
                    <p className="truncate">
                      <span className="text-slate-500">Email:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {paymentDetails.order?.buyerEmail || '—'}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-500">Phone:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {paymentDetails.order?.buyerPhone || '—'}
                      </span>
                    </p>
                  </div>
                </div>

                {paymentDetails.paymentSubmission?.receiptFile && (
                  <div className="rounded-xl border border-slate-200 p-3.5 sm:p-4">
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Receipt
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        handleViewReceipt(
                          selectedPayment?.submissionId ||
                            selectedPayment?._id ||
                            paymentDetails.paymentSubmission?._id
                        )
                      }
                      disabled={viewingReceipt}
                      className="text-sm font-semibold text-teal-600 active:text-teal-700 hover:underline touch-manipulation"
                    >
                      View receipt →
                    </button>
                  </div>
                )}

                {(() => {
                  const s = normalizeStatus(
                    paymentDetails.paymentSubmission?.verificationStatus ||
                      paymentDetails.order?.paymentStatus
                  );
                  const isPending =
                    s === 'pending' ||
                    s === 'pending_verification' ||
                    s === 'awaiting_payment';
                  if (!isPending) return null;
                  return (
                    <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 border-t border-slate-100 pt-4">
                      <Button
                        className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 active:bg-teal-700 touch-manipulation"
                        onClick={() => {
                          if (
                            paymentDetails.order?.paymentMethod ===
                              'cash_at_entrance' ||
                            paymentDetails.order?.paymentMethod ===
                              'cash_on_entrance'
                          ) {
                            setSelectedPayment(paymentDetails.order);
                            setShowConfirmCashModal(true);
                          } else {
                            openApproveConfirm({
                              ...selectedPayment,
                              ...paymentDetails.order,
                              submissionId:
                                paymentDetails.paymentSubmission?._id ||
                                selectedPayment.submissionId ||
                                selectedPayment._id,
                              totalAmount: paymentDetails.order?.totalAmount,
                              orderNumber: paymentDetails.order?.orderNumber,
                            });
                          }
                        }}
                      >
                        <CheckCircleIcon className="mr-1.5 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto border-teal-200 text-teal-700 hover:bg-teal-50 touch-manipulation"
                        onClick={() => setShowRequestInfoModal(true)}
                      >
                        Request info
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto text-rose-600 border-rose-200 hover:bg-rose-50 touch-manipulation"
                        onClick={() => setShowRejectModal(true)}
                      >
                        <XCircleIcon className="mr-1.5 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">
                No details available.
              </p>
            )}
          </Modal>
        )}

      {/* Reject / Request info / Cash / Approve modals — same logic, full-width buttons on mobile */}
      <Modal
        open={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          if (!paymentDetails) closeDetails();
        }}
        title="Reject Payment"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-snug">
            Provide a reason for rejecting this payment. The buyer will see this
            message.
          </p>
          <textarea
            value={actionMessage}
            onChange={(e) => setActionMessage(e.target.value)}
            placeholder="Rejection reason…"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
            rows={4}
          />
          <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
            <Button
              variant="outline"
              className="flex-1 touch-manipulation"
              onClick={() => {
                setShowRejectModal(false);
                if (!paymentDetails) closeDetails();
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 touch-manipulation"
              onClick={handleReject}
              disabled={actionLoading === 'reject'}
            >
              Reject payment
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showRequestInfoModal}
        onClose={() => {
          setShowRequestInfoModal(false);
          if (!paymentDetails) closeDetails();
        }}
        title="Request More Information"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-snug">
            Ask the buyer for additional information or documentation.
          </p>
          <textarea
            value={actionMessage}
            onChange={(e) => setActionMessage(e.target.value)}
            placeholder="What information do you need?"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
            rows={4}
          />
          <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
            <Button
              variant="outline"
              className="flex-1 touch-manipulation"
              onClick={() => {
                setShowRequestInfoModal(false);
                if (!paymentDetails) closeDetails();
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 touch-manipulation"
              onClick={handleRequestInfo}
              disabled={actionLoading === 'request_info'}
            >
              Send request
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!showConfirmCashModal && !!selectedPayment}
        onClose={() => {
          setShowConfirmCashModal(false);
          if (!paymentDetails) closeDetails();
        }}
        title="Confirm Cash Payment"
        size="md"
      >
        {selectedPayment && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-snug">
              Confirm you received{' '}
              <span className="font-semibold text-slate-900">
                {formatCurrency(
                  selectedPayment.totalAmount || selectedPayment.amountPaid,
                  getCurrency(selectedPayment, statistics)
                )}
              </span>{' '}
              for order{' '}
              <span className="font-semibold text-slate-900">
                {selectedPayment.orderNumber ||
                  selectedPayment.orderId?.orderNumber ||
                  '—'}
              </span>
              ?
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
              <Button
                variant="outline"
                className="flex-1 touch-manipulation"
                onClick={() => {
                  setShowConfirmCashModal(false);
                  if (!paymentDetails) closeDetails();
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 touch-manipulation"
                onClick={() =>
                  handleApprove(
                    selectedPayment.submissionId || selectedPayment._id
                  )
                }
                disabled={
                  actionLoading ===
                  (selectedPayment.submissionId || selectedPayment._id)
                }
              >
                {actionLoading ===
                (selectedPayment.submissionId || selectedPayment._id)
                  ? 'Confirming…'
                  : 'Confirm received'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!showConfirmApproveModal && !!selectedPayment}
        onClose={() => {
          setShowConfirmApproveModal(false);
          if (!paymentDetails) closeDetails();
        }}
        title="Confirm Payment Approval"
        size="md"
      >
        {selectedPayment && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-snug">
              Approve this payment? This will confirm the order and activate
              tickets.
            </p>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-sm">
              <p>
                <span className="text-slate-500">Order:</span>{' '}
                <span className="font-semibold text-slate-900">
                  {selectedPayment.orderNumber ||
                    selectedPayment.orderId?.orderNumber ||
                    '—'}
                </span>
              </p>
              <p className="mt-1">
                <span className="text-slate-500">Amount:</span>{' '}
                <span className="font-semibold text-slate-900">
                  {formatCurrency(
                    selectedPayment.totalAmount || selectedPayment.amountPaid,
                    getCurrency(selectedPayment, statistics)
                  )}
                </span>
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
              <Button
                variant="outline"
                className="flex-1 touch-manipulation"
                onClick={() => {
                  setShowConfirmApproveModal(false);
                  if (!paymentDetails) closeDetails();
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 touch-manipulation"
                onClick={() =>
                  handleApprove(
                    selectedPayment.submissionId || selectedPayment._id
                  )
                }
                disabled={
                  actionLoading ===
                  (selectedPayment.submissionId || selectedPayment._id)
                }
              >
                {actionLoading ===
                (selectedPayment.submissionId || selectedPayment._id)
                  ? 'Approving…'
                  : 'Confirm Approve'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default SubOrgPayments;