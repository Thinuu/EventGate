import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { getBuyerTickets } from '../../api/buyer';
import api from '../../api/client';
import TicketCard from '../../components/buyer/TicketCard';
import OrderControls from '../../components/buyer/OrderControls';
import EmptyState from '../../components/buyer/EmptyState';
import toast from 'react-hot-toast';
import {
  TicketIcon,
  UserGroupIcon,
  ClockIcon,
  ArrowRightIcon,
  QrCodeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarIcon,
  MapPinIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserCircleIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { io } from '../../utils/realtime';
import { getSocketUrl } from '../../utils/backend';

const StatCard = ({ label, value, icon: Icon, tone = 'blue' }) => {
  const iconTones = {
    blue: 'bg-teal-50 text-teal-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-white px-2.5 py-2.5 sm:p-5 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-3">
        {Icon && (
          <div
            className={`flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg sm:rounded-xl ${
              iconTones[tone] || iconTones.blue
            }`}
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 leading-none">
            {label}
          </p>
          <p className="mt-0.5 sm:mt-1.5 text-base sm:text-2xl font-bold tracking-tight text-slate-900 tabular-nums leading-none">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
};

const BuyerHomePage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingIds, setDownloadingIds] = useState({});
  const [resendingIds, setResendingIds] = useState({});

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [passesCurrentPage, setPassesCurrentPage] = useState(1);
  const passesPerPage = 9;

  const handleResend = async (ticketId) => {
    setResendingIds((prev) => ({ ...prev, [ticketId]: true }));
    try {
      await api.post(`/tickets/${ticketId}/resend-invite`);
      toast.success('Invite code resent successfully!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Resend failed');
    } finally {
      setResendingIds((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      getBuyerTickets().catch(() => ({ data: { data: { orders: [] } } })),
      api
        .get('/user/tickets')
        .catch(() => ({ data: { data: { tickets: [] } } })),
    ])
      .then(([buyerRes, userRes]) => {
        setOrders(buyerRes.data?.data?.orders || []);
        setPasses(userRes.data?.data?.tickets || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

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

    const handleUpdate = (data) => {
      if (data?.orderNumber) {
        toast.success(`Order #${data.orderNumber} updated!`);
      }
      fetchData();
    };

    socket.on('order_status_changed', handleUpdate);
    socket.on('ticket_update', handleUpdate);

    return () => {
      socket.emit('leave_buyer', { userId: user._id });
      socket.disconnect();
    };
  }, [user]);

  const stats = useMemo(() => {
    const totalTickets = orders.reduce(
      (acc, o) => acc + (o.stats?.total || 0),
      0
    );
    const assigned = orders.reduce(
      (acc, o) => acc + (o.stats?.assigned || 0),
      0
    );
    const pending = orders.reduce(
      (acc, o) => acc + (o.stats?.pending || 0),
      0
    );
    return { totalTickets, assigned, pending };
  }, [orders]);

  const nextOrder = useMemo(() => {
    const now = Date.now();
    return (
      [...orders]
        .filter((o) => o.event?.startDate)
        .sort(
          (a, b) =>
            new Date(a.event.startDate) - new Date(b.event.startDate)
        )
        .find((o) => new Date(o.event.startDate).getTime() >= now) ||
      orders[0] ||
      null
    );
  }, [orders]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDownload = async (token, ticketNumber, passId) => {
    if (!token) return;
    try {
      setDownloadingIds((prev) => ({ ...prev, [passId]: true }));
      const response = await api.get(`/tickets/download/${token}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Ticket-${ticketNumber || token}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Ticket downloaded successfully!');
    } catch (error) {
      console.error('Error downloading ticket:', error);
      toast.error('Failed to download ticket PDF');
    } finally {
      setDownloadingIds((prev) => ({ ...prev, [passId]: false }));
    }
  };

  const handleDownloadOrder = async (orderId) => {
    try {
      toast.loading('Generating order summary...', { id: 'order-pdf' });
      const response = await api.get(`/tickets/order-download/${orderId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `OrderSummary-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Order summary downloaded!', { id: 'order-pdf' });
    } catch (error) {
      console.error('Error downloading order summary:', error);
      toast.error('Failed to download order summary PDF', { id: 'order-pdf' });
    }
  };

  const filteredPasses = useMemo(() => {
    return passes.filter((pass) => {
      const matchesSearch =
        (pass.event?.name || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (pass.ticketNumber || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const isPhotoVerified =
        String(pass.attendee?.photoVerificationStatus || '').toLowerCase() ===
        'verified';
      const isPhotoRejected =
        String(pass.attendee?.photoVerificationStatus || '').toLowerCase() ===
        'rejected';
      const isPendingVerification =
        !isPhotoVerified &&
        !isPhotoRejected &&
        (pass.status === 'PENDING_VERIFICATION' ||
          (pass.status === 'ASSIGNED' &&
            pass.attendee?.photo &&
            pass.event?.requirePhotoVerification));
      const isInvalidated =
        pass.status === 'CANCELLED' || pass.refundStatus === 'refunded';
      const isInvited = pass.status === 'INVITED';

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' &&
          (pass.status === 'CONFIRMED' || isPhotoVerified)) ||
        (statusFilter === 'verification' && isPendingVerification) ||
        (statusFilter === 'rejected' && isPhotoRejected) ||
        (statusFilter === 'invited' && isInvited) ||
        (statusFilter === 'cancelled' && isInvalidated) ||
        (statusFilter === 'pending' &&
          pass.status !== 'CONFIRMED' &&
          !isPhotoVerified &&
          !isPendingVerification &&
          !isPhotoRejected &&
          !isInvalidated &&
          !isInvited);

      return matchesSearch && matchesStatus;
    });
  }, [passes, searchQuery, statusFilter]);

  useEffect(() => {
    setPassesCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const passesTotalPages = Math.max(
    1,
    Math.ceil(filteredPasses.length / passesPerPage)
  );
  const passesStartIndex = (passesCurrentPage - 1) * passesPerPage;
  const paginatedPasses = filteredPasses.slice(
    passesStartIndex,
    passesStartIndex + passesPerPage
  );

  const handlePassesPageChange = (page) => {
    if (page < 1 || page > passesTotalPages) return;
    setPassesCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <BuyerLayout>
      <div className="space-y-3 sm:space-y-5 pb-16 sm:pb-20">
        {/* ── Compact header ── */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 sm:px-6 sm:py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight truncate">
                  Your tickets
                </h1>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-500 truncate">
                  Assign guests · track invites · entry ready
                </p>
              </div>
              <Link
                to="/buyer/tickets"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-teal-500 active:bg-teal-700 transition touch-manipulation"
              >
                Orders
                <ArrowRightIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Stats — tight ── */}
        {loading ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 sm:h-24 rounded-xl sm:rounded-2xl bg-slate-100 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <StatCard
              label="Total"
              value={stats.totalTickets}
              icon={TicketIcon}
              tone="blue"
            />
            <StatCard
              label="Assigned"
              value={stats.assigned}
              icon={UserGroupIcon}
              tone="emerald"
            />
            <StatCard
              label="Pending"
              value={stats.pending}
              icon={ClockIcon}
              tone="amber"
            />
          </div>
        )}

        {/* ── Next event + quick links (one compact block) ── */}
        {!loading && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            {/* Next event row */}
            {nextOrder?.event ? (
              <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-100">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Next event
                    </p>
                    <p className="mt-0.5 text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-1">
                      {nextOrder.event.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] sm:text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5 text-teal-500" />
                        {formatDate(nextOrder.event.startDate)}
                      </span>
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <MapPinIcon className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                        <span className="truncate">
                          {nextOrder.event.venue?.name || 'Venue TBD'}
                        </span>
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/buyer/assign/${nextOrder._id}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-teal-600 px-3 py-2 text-[11px] sm:text-xs font-semibold text-white shadow-sm hover:bg-teal-500 active:bg-teal-700 transition touch-manipulation"
                  >
                    Assign
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ) : null}

            {/* Quick links — horizontal, no tall cards */}
            <div className="grid grid-cols-3 divide-x divide-slate-100">
              <Link
                to="/buyer/tickets"
                className="flex flex-col items-center justify-center gap-1 px-2 py-3 sm:py-3.5 text-center active:bg-slate-50 hover:bg-slate-50/80 transition touch-manipulation"
              >
                <ShoppingBagIcon className="h-5 w-5 text-teal-600" />
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700">
                  Orders
                </span>
              </Link>
              <Link
                to="/buyer/invites"
                className="flex flex-col items-center justify-center gap-1 px-2 py-3 sm:py-3.5 text-center active:bg-slate-50 hover:bg-slate-50/80 transition touch-manipulation"
              >
                <UserGroupIcon className="h-5 w-5 text-teal-600" />
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700">
                  Invites
                </span>
              </Link>
              <Link
                to="/buyer/profile"
                className="flex flex-col items-center justify-center gap-1 px-2 py-3 sm:py-3.5 text-center active:bg-slate-50 hover:bg-slate-50/80 transition touch-manipulation"
              >
                <UserCircleIcon className="h-5 w-5 text-teal-600" />
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700">
                  Profile
                </span>
              </Link>
            </div>
          </div>
        )}

        {/* ── Thin security tip (one line, not a tall card) ── */}
        {!loading && (orders.length > 0 || passes.length > 0) && (
          <div className="flex items-start gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 sm:px-4">
            <ShieldCheckIcon className="h-4 w-4 shrink-0 text-teal-600 mt-0.5" />
            <p className="text-[11px] sm:text-xs text-slate-600 leading-snug">
              Assign each pass to a guest email before QR codes can be generated.
            </p>
          </div>
        )}

        {/* ── Purchased Orders ── */}
        {!loading && orders.length > 0 && (
          <section className="space-y-2 sm:space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 px-0.5">
              Purchased Orders
            </h2>
            <OrderControls
              orders={orders}
              onDownloadOrder={handleDownloadOrder}
            />
          </section>
        )}

        {/* ── My Entry Passes ── */}
        {!loading && passes.length > 0 && (
          <section className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center gap-2 px-0.5">
              <QrCodeIcon className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Entry Passes
              </h2>
              <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                ({filteredPasses.length})
              </span>
            </div>

            {/* Compact search + filter */}
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  inputMode="search"
                  placeholder="Search event or ticket…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 sm:py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 touch-manipulation"
                />
              </div>
              <div className="relative sm:w-44 shrink-0">
                <FunnelIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm font-medium text-slate-700 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer touch-manipulation"
                >
                  <option value="all">All Passes</option>
                  <option value="active">Active</option>
                  <option value="verification">Awaiting Verification</option>
                  <option value="rejected">Photo Rejected</option>
                  <option value="invited">Invited</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            {filteredPasses.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {paginatedPasses.map((pass) => (
                    <TicketCard
                      key={pass._id}
                      pass={pass}
                      onDownload={() =>
                        handleDownload(
                          pass.attendee?.qrToken,
                          pass.ticketNumber,
                          pass._id
                        )
                      }
                      downloading={!!downloadingIds[pass._id]}
                      onResend={() => handleResend(pass._id)}
                      resending={!!resendingIds[pass._id]}
                    />
                  ))}
                </div>

                {passesTotalPages > 1 && (
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-center sm:text-left text-[11px] sm:text-xs text-slate-500 order-2 sm:order-1">
                      {passesStartIndex + 1}–
                      {Math.min(
                        passesStartIndex + passesPerPage,
                        filteredPasses.length
                      )}{' '}
                      of {filteredPasses.length}
                    </p>
                    <div className="flex items-center justify-center gap-1.5 order-1 sm:order-2">
                      <button
                        type="button"
                        onClick={() =>
                          handlePassesPageChange(passesCurrentPage - 1)
                        }
                        disabled={passesCurrentPage === 1}
                        className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 disabled:opacity-40 touch-manipulation active:bg-slate-50"
                      >
                        <ChevronLeftIcon className="h-4 w-4" />
                      </button>
                      <span className="px-2 text-xs font-semibold text-slate-600 tabular-nums">
                        {passesCurrentPage}/{passesTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handlePassesPageChange(passesCurrentPage + 1)
                        }
                        disabled={passesCurrentPage === passesTotalPages}
                        className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 disabled:opacity-40 touch-manipulation active:bg-slate-50"
                      >
                        <ChevronRightIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 text-center">
                <p className="text-sm text-slate-500">
                  No passes match your filters.
                </p>
              </div>
            )}
          </section>
        )}

        {!loading && passes.length === 0 && orders.length === 0 && (
          <EmptyState />
        )}
      </div>
    </BuyerLayout>
  );
};

export default BuyerHomePage;