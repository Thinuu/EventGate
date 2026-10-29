import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getAllPayments,
  getPaymentStatistics,
  getPaymentDetails,
  approvePayment,
  rejectPayment,
  requestPaymentInfo,
  exportPayments,
} from '../../api/adminPaymentManagement';
import { getAllEventsAdmin } from '../../api/events';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';
import {
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

const statusConfig = {
  pending: { label: 'Pending', variant: 'amber' },
  pending_verification: { label: 'Pending Verification', variant: 'amber' },
  verified: { label: 'Verified', variant: 'green' },
  rejected: { label: 'Rejected', variant: 'red' },
  approved: { label: 'Approved', variant: 'green' },
  needs_info: { label: 'Needs Info', variant: 'blue' },
  success: { label: 'Approved', variant: 'green' },
  paid: { label: 'Approved', variant: 'green' },
  failed: { label: 'Rejected', variant: 'red' },
};

const formatCurrency = (amount, currency = 'LKR') => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'LKR',
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    return `${currency || 'LKR'} ${Number(amount || 0).toLocaleString()}`;
  }
};

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

const formatMethod = (m) => {
  if (m === 'card') return 'Credit/Debit Card';
  if (m === 'bank_transfer') return 'Bank Transfer';
  if (m === 'cash_at_entrance') return 'Cash at Venue';
  if (m === 'cash_on_entrance') return 'Cash on Entrance';
  return m || '—';
};

const normalizeStatus = (status) => {
  if (status === 'success' || status === 'paid') return 'approved';
  if (status === 'failed') return 'rejected';
  return status;
};

const AdminPaymentManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [searchInput, setSearchInput] = useState('');

  const eventFilter = searchParams.get('eventId') || '';
  const statusFilter = searchParams.get('status') || '';
  const paymentMethodFilter = searchParams.get('paymentMethod') || 'all';
  const searchQuery = searchParams.get('search') || '';
  const currentPage = searchParams.get('page') || '1';

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const updateQuery = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        limit: 10,
        status: statusFilter || undefined,
        eventId: eventFilter || undefined,
        search: searchQuery || undefined,
        paymentMethod:
          paymentMethodFilter !== 'all' ? paymentMethodFilter : undefined,
      };
      const response = await getAllPayments(params);
      const data = response.data?.data || {};
      setPayments(data.payments || []);
      setPagination({
        page: data.currentPage || data.pagination?.page || 1,
        pages: data.pages || data.pagination?.pages || 1,
        total: data.total || data.pagination?.total || 0,
      });
    } catch {
      setError('Failed to load payments');
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    eventFilter,
    statusFilter,
    paymentMethodFilter,
    searchQuery,
  ]);

  const fetchEvents = async () => {
    try {
      const response = await getAllEventsAdmin({ limit: 200 });
      const payload = response?.data?.data ?? response?.data ?? response ?? {};
      let list = [];
      if (Array.isArray(payload)) list = payload;
      else if (Array.isArray(payload.events)) list = payload.events;
      else if (Array.isArray(payload.rows)) list = payload.rows;
      else if (Array.isArray(payload.data)) list = payload.data;
      setEvents(list);
    } catch (err) {
      console.error('Failed to load events:', err);
      toast.error('Failed to load events for filter');
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleViewDetails = async (payment) => {
    setSelectedPayment(payment);
    setDetailsLoading(true);
    setShowRejectModal(false);
    setShowRequestInfoModal(false);
    try {
      const response = await getPaymentDetails(payment._id);
      setPaymentDetails(response.data?.data || {});
    } catch {
      toast.error('Failed to load payment details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleApprove = async (paymentId) => {
    setActionLoading(paymentId);
    try {
      await approvePayment(paymentId);
      toast.success('Payment approved successfully');
      fetchPayments();
      setSelectedPayment(null);
      setPaymentDetails(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    const targetId =
      selectedPayment?.submissionId || paymentDetails?.paymentSubmission?._id;
    if (!targetId) {
      toast.error('Payment submission ID not found');
      return;
    }
    setActionLoading('reject');
    try {
      await rejectPayment(targetId, { rejectionReason: rejectReason });
      toast.success('Payment rejected');
      setShowRejectModal(false);
      setRejectReason('');
      fetchPayments();
      setSelectedPayment(null);
      setPaymentDetails(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestInfo = async () => {
    if (!infoMessage.trim()) {
      toast.error('Please provide a message requesting more information');
      return;
    }
    const targetId =
      selectedPayment?.submissionId || paymentDetails?.paymentSubmission?._id;
    if (!targetId) {
      toast.error('Payment submission ID not found');
      return;
    }
    setActionLoading('request_info');
    try {
      await requestPaymentInfo(targetId, { message: infoMessage });
      toast.success('Information request sent to buyer');
      setShowRequestInfoModal(false);
      setInfoMessage('');
      fetchPayments();
      setSelectedPayment(null);
      setPaymentDetails(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async () => {
    try {
      const response = await exportPayments({
        eventId: eventFilter || undefined,
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `payments_export_${new Date().toISOString().split('T')[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Payments exported successfully');
    } catch {
      toast.error('Failed to export payments');
    }
  };

  const getPageNumbers = () => {
    const nums = [];
    const maxVisible = 5;
    const { page, pages } = pagination;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(pages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) nums.push(i);
    return nums;
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-end">
        <Button
          onClick={handleExport}
          className="bg-teal-600 hover:bg-teal-500 text-white"
        >
          <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="mb-4 flex gap-2 overflow-x-auto border-b border-slate-100 pb-4">
          {[
            { key: 'all', label: 'All Payments' },
            { key: 'card', label: 'Card' },
            { key: 'bank_transfer', label: 'Bank Transfer' },
            { key: 'cash_at_entrance', label: 'Cash at Venue' },
          ].map(({ key, label }) => {
            const active = paymentMethodFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  updateQuery('paymentMethod', key === 'all' ? null : key)
                }
                className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'border border-slate-200 text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="text"
            placeholder="Search order #, email…"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateQuery('search', searchInput.trim() || null);
              }
            }}
          />
          <select
            value={eventFilter}
            onChange={(e) => updateQuery('eventId', e.target.value || null)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="">All Events</option>
            {events.map((event) => (
              <option key={event._id} value={event._id}>
                {event.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => updateQuery('status', e.target.value || null)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="needs_info">Needs Info</option>
            <option value="verified">Verified</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card
        className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
        padding={false}
      >
        <div className="border-b border-slate-100 bg-slate-50/40 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            Payment Submissions
          </h2>
          <p className="text-sm text-slate-500">
            {pagination.total} payment{pagination.total !== 1 ? 's' : ''} found
          </p>
        </div>

        {loading ? (
          <div className="p-6">
            <LoadingSkeleton />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600">{error}</div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              <BanknotesIcon className="h-7 w-7" />
            </div>
            <p className="text-base font-semibold text-slate-800">
              No payments found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try adjusting your filters
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <thead>
                <Tr>
                  <Th>Order #</Th>
                  <Th>Event</Th>
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
                  const statusInfo = statusConfig[displayStatus] || {
                    label: displayStatus || 'Unknown',
                    variant: 'gray',
                  };
                  const rowCurrency =
                    payment.currency || payment.order?.currency || 'LKR';

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
                          {payment.event?.name || '—'}
                        </p>
                        {payment.event?.startDate && (
                          <p className="text-xs text-slate-500">
                            {new Date(
                              payment.event.startDate
                            ).toLocaleDateString()}
                          </p>
                        )}
                      </Td>
                      <Td>
                        <p className="text-sm font-medium text-slate-900">
                          {formatMethod(payment.paymentMethod)}
                        </p>
                        {(payment.gatewayUsed || payment.bankUsed) && (
                          <p className="text-xs uppercase text-slate-500">
                            {payment.gatewayUsed || payment.bankUsed}
                          </p>
                        )}
                      </Td>
                      <Td>
                        <p className="text-sm font-medium text-slate-900">
                          {payment.buyer?.name || '—'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {payment.buyer?.email || '—'}
                        </p>
                      </Td>
                      <Td>
                        <span className="text-sm font-semibold text-slate-900">
                          {formatCurrency(
                            payment.totalAmount || payment.amountPaid,
                            rowCurrency
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
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(payment)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-teal-50 hover:text-teal-600"
                          title="View details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}

        {payments.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => updateQuery('page', String(pagination.page - 1))}
                className="h-8 rounded-lg px-3 text-xs"
              >
                Prev
              </Button>
              <div className="mx-1 flex items-center gap-1">
                {getPageNumbers().map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateQuery('page', String(n))}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition ${
                      pagination.page === n
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-500 hover:bg-white hover:text-slate-900'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => updateQuery('page', String(pagination.page + 1))}
                className="h-8 rounded-lg px-3 text-xs"
              >
                Next
              </Button>
            </div>
            <p className="text-sm text-slate-500">
              Page {pagination.page} of {pagination.pages}
            </p>
          </div>
        )}
      </Card>

      {/* Details modal */}
      <Modal
        open={!!selectedPayment}
        onClose={() => {
          setSelectedPayment(null);
          setPaymentDetails(null);
        }}
        title="Payment Details"
        size="xl"
      >
        {detailsLoading ? (
          <div className="py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          </div>
        ) : paymentDetails ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: 'Order Number',
                  value: paymentDetails.order?.orderNumber || '—',
                },
                {
                  label: 'Amount',
                  value: formatCurrency(
                    paymentDetails.order?.totalAmount,
                    selectedPayment?.currency ||
                      paymentDetails.order?.currency ||
                      'LKR'
                  ),
                },
                {
                  label: 'Payment Method',
                  value: formatMethod(paymentDetails.order?.paymentMethod),
                },
                {
                  label: 'Date Created',
                  value: formatDate(paymentDetails.order?.createdAt),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {item.value}
                  </p>
                </div>
              ))}

              {paymentDetails.order?.paymentMethod === 'bank_transfer' &&
                paymentDetails.paymentSubmission && (
                  <>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Bank Used
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {paymentDetails.paymentSubmission.bankUsed || '—'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Reference
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {paymentDetails.paymentSubmission.referenceNumber ||
                          '—'}
                      </p>
                    </div>
                  </>
                )}
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Status
              </p>
              {(() => {
                const raw =
                  paymentDetails.paymentSubmission?.verificationStatus ||
                  paymentDetails.order?.paymentStatus ||
                  'pending';
                const status = normalizeStatus(raw);
                const info = statusConfig[status] || {
                  label: status,
                  variant: 'gray',
                };
                return <Badge variant={info.variant}>{info.label}</Badge>;
              })()}
            </div>

            {paymentDetails.order?.paymentMethod === 'bank_transfer' &&
              paymentDetails.paymentSubmission &&
              ['pending', 'pending_verification', 'needs_info'].includes(
                paymentDetails.paymentSubmission.verificationStatus
              ) && (
                <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                  <Button
                    onClick={() =>
                      handleApprove(paymentDetails.paymentSubmission._id)
                    }
                    disabled={
                      actionLoading === paymentDetails.paymentSubmission._id
                    }
                    className="bg-teal-600 hover:bg-teal-500"
                  >
                    <CheckCircleIcon className="mr-1.5 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="border-teal-200 text-teal-700 hover:bg-teal-50"
                    onClick={() => setShowRequestInfoModal(true)}
                  >
                    Request info
                  </Button>
                  <Button
                    variant="outline"
                    className="border-rose-200 text-rose-600 hover:bg-rose-50"
                    onClick={() => setShowRejectModal(true)}
                  >
                    <XCircleIcon className="mr-1.5 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">
            Failed to load details
          </p>
        )}
      </Modal>

      <Modal
        open={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Payment"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Provide a reason for rejecting this payment. The buyer will see this
            message.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason…"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            rows={4}
          />
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-rose-600 hover:bg-rose-500"
              onClick={handleReject}
              disabled={actionLoading === 'reject'}
            >
              Reject payment
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowRejectModal(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showRequestInfoModal}
        onClose={() => setShowRequestInfoModal(false)}
        title="Request More Information"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Ask the buyer for additional information or documentation.
          </p>
          <textarea
            value={infoMessage}
            onChange={(e) => setInfoMessage(e.target.value)}
            placeholder="What information do you need?"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            rows={4}
          />
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-teal-600 hover:bg-teal-500"
              onClick={handleRequestInfo}
              disabled={actionLoading === 'request_info'}
            >
              Send request
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowRequestInfoModal(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminPaymentManagement;