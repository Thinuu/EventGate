import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BuildingOffice2Icon,
  CreditCardIcon,
  ShieldCheckIcon,
  TicketIcon,
  UsersIcon,
  CheckBadgeIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';

import toast from 'react-hot-toast';
import { duplicateAdminEvent } from '../../api/events';
import { getSystemLogs } from '../../api/audit';
import AdminPaymentManagement from './AdminPaymentManagement';
import AdminRfidInventoryPage from './AdminRfidInventoryPage';
import {
  createSuperAdminEvent,
  createSuperAdminOrganiser,
  createSuperAdminUser,
  createSuperAdminCompany,
  updateSuperAdminCompany,
  deleteSuperAdminCompany,
  deleteSuperAdminEvent,
  deleteSuperAdminOrganiser,
  deleteSuperAdminUser,
  exportSuperAdminReport,
  getSuperAdminWorkspace,
  resendSuperAdminNotification,
  searchSuperAdmin,
  updateSuperAdminEvent,
  updateSuperAdminOrganiser,
  updateSuperAdminUser,
  resendSuperAdminUserCredentials,
  updateSuperAdminUserStatus,
  getAdminBankAccounts,
  createAdminBankAccount,
  updateAdminBankAccount,
  deleteAdminBankAccount,
} from '../../api/superAdmin';

const SECTION_LABELS = {
  overview: 'Overview',
  events: 'Events',
  rfid: 'RFID Inventory',
  organisations: 'Organizations',
  organisers: 'Organisers',
  users: 'Users',
  tickets: 'Tickets',
  verification: 'Verification',
  'entry-logs': 'Entry Logs',
  'zone-activity': 'Zone Activity',
  notifications: 'Notifications',
  reports: 'Reports',
  'system-logs': 'System Logs',

  'bank-accounts': 'Bank Accounts',
  payments: 'Payments',
};

const SECTION_SUBTITLES = {
  'bank-accounts': 'Manage bank transfer accounts shown to buyers during checkout and payment instructions.',
  payments: 'Review and manage bank transfer payments submitted by buyers.',
};

const statusTone = {
  Active: 'green',
  Inactive: 'red',
  Live: 'green',
  Upcoming: 'blue',
  Completed: 'gray',
  Allowed: 'green',
  Denied: 'red',
  pending: 'amber',
  rejected: 'red',
  verified: 'green',
  login: 'green',
  logout: 'blue',
  ticket_creation: 'cyan',
  ticket_scan: 'teal',
  event_update: 'purple',
  user_creation: 'indigo',
  qr_verification: 'violet',
  sponsor_action: 'orange',
  mfa_activity: 'fuchsia',
};

const downloadBlob = (blob, fallbackName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const fmt = (value) => (value ? format(new Date(value), 'dd MMM yyyy, HH:mm') : '-');
const money = (value, currency = 'LKR') => `${currency} ${Number(value || 0).toLocaleString()}`;

// Format multi-currency revenue display
const formatMultiCurrencyRevenue = (workspace, reports) => {
  const byCurrency = reports?.summary?.totalRevenueByCurrency;
  if (!byCurrency || Object.keys(byCurrency).length === 0) {
    return money(reports?.summary?.totalRevenue, workspace?.settings?.currency);
  }
  // If multiple currencies, show each currency's total
  return Object.entries(byCurrency)
    .map(([currency, amount]) => money(amount, currency))
    .join(' | ');
};

const MetricCard = ({ title, value, subtitle, icon: Icon }) => (
  <Card className="rounded-2xl border-slate-200 bg-gradient-to-br from-white to-slate-50/80 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900/5 text-slate-700">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </Card>
);

const Field = ({ label, children }) => (
  <label className="space-y-2">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    {children}
  </label>
);

const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 ${props.className || ''}`}
  />
);

const Select = (props) => (
  <select
    {...props}
    className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed disabled:pointer-events-none ${props.className || ''}`}
  />
);

const normalizeEntityId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value._id === 'string') return value._id;
    if (typeof value.id === 'string') return value.id;
    if (typeof value.toString === 'function') {
      const asString = value.toString();
      if (asString && asString !== '[object Object]') return asString;
    }
  }
  return '';
};

const SectionFilters = ({ section, params, updateQuery, organiserOptions = [] }) => {
  if (section === 'overview' || section === 'settings' || section === 'bank-accounts' || section === 'payments') {
    return null;
  }

  return (
    <Card className="rounded-[28px] border-slate-200">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input
          placeholder="Search"
          value={params.get('search') || ''}
          onChange={(e) => updateQuery('search', e.target.value)}
        />

        {section === 'events' && (
          <>
            <Select value={params.get('status') || ''} onChange={(e) => updateQuery('status', e.target.value)}>
              <option value="">All statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
            </Select>
            <Select value={params.get('organiser') || ''} onChange={(e) => updateQuery('organiser', e.target.value)}>
              <option value="">All organisers</option>
              {organiserOptions.map((option) => (
                <option key={option._id} value={option._id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </>
        )}

        {(section === 'organisations' || section === 'organisers' || section === 'users') && (
          <Select value={params.get('status') || ''} onChange={(e) => updateQuery('status', e.target.value)}>
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </Select>
        )}

        {section === 'users' && (
          <Select value={params.get('role') || ''} onChange={(e) => updateQuery('role', e.target.value)}>
            <option value="">All roles</option>
            {['MainAdmin', 'MainOrganiser', 'SubOrganiser', 'Staff', 'Volunteer', 'Auditor', 'Attendee'].map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
        )}

        {section === 'verification' && (
          <Select value={params.get('status') || ''} onChange={(e) => updateQuery('status', e.target.value)}>
            <option value="">All verification states</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </Select>
        )}

        {(section === 'entry-logs' || section === 'zone-activity' || section === 'reports' || section === 'system-logs') && (
          <>
            <Input type="date" value={params.get('from') || ''} onChange={(e) => updateQuery('from', e.target.value)} />
            <Input type="date" value={params.get('to') || ''} onChange={(e) => updateQuery('to', e.target.value)} />
          </>
        )}

        {section === 'system-logs' && (
          <Select value={params.get('action') || ''} onChange={(e) => updateQuery('action', e.target.value)}>
            <option value="">All actions</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="ticket_creation">Ticket Creation</option>
            <option value="ticket_scan">Ticket Scan</option>
            <option value="event_update">Event Update</option>
            <option value="user_creation">User Creation</option>
            <option value="qr_verification">QR Photo Verification</option>
            <option value="sponsor_action">Sponsor Action</option>
            <option value="mfa_activity">MFA Activity</option>
          </Select>
        )}

        <Select value={params.get('limit') || '1000'} onChange={(e) => updateQuery('limit', e.target.value)}>
          <option value="20">20 rows</option>
          <option value="50">50 rows</option>
          <option value="100">100 rows</option>
          <option value="200">200 rows</option>
          <option value="1000">All</option>
        </Select>
      </div>
    </Card>
  );
};

const Pagination = ({ pagination, updateQuery }) => {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages } = pagination;

  const getPageNumbers = () => {
    const nums = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(pages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) nums.push(i);
    return nums;
  };

  return (
    <div className="mt-auto flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/30">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => updateQuery('page', page - 1)}
            className="h-8 rounded-lg px-3 text-xs"
          >
            Prev
          </Button>
          <div className="flex items-center gap-1 mx-1">
            {getPageNumbers().map((n) => (
              <button
                key={n}
                onClick={() => updateQuery('page', n)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                  page === n
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
            disabled={page >= pages}
            onClick={() => updateQuery('page', page + 1)}
            className="h-8 rounded-lg px-3 text-xs"
          >
            Next
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Page</span>
        <span className="text-sm font-bold text-slate-900">{page}</span>
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">of</span>
        <span className="text-sm font-bold text-slate-900">{pages}</span>
      </div>
    </div>
  );
};

const SectionContent = ({
  section,
  workspace,
  params,
  updateQuery,
  openModal,
  loadWorkspace,
  deleteOrganiser,
  deleteUser,
  setDuplicateModal,
  systemLogsData,
  sysLoading,
  lastUpdated,
  handleDeleteDashboard,
  handleDeleteCompany,
  exportReport,
}) => {
  const overview = workspace?.overview;
  const eventRows = workspace?.events?.rows || [];
  const companyRows = workspace?.organisations?.rows || [];
  const allUserRows = workspace?.users?.rows || [];
  const onlyOrganiserRows = allUserRows.filter((u) => ['MainOrganiser', 'SubOrganiser'].includes(u.role));
  const otherUserRows = allUserRows.filter((u) => !['MainOrganiser', 'SubOrganiser'].includes(u.role));
  const ticketRows = workspace?.tickets?.rows || [];
  const verification = workspace?.verification;
  const entryRows = workspace?.entryLogs?.rows || [];
  const zoneActivity = workspace?.zoneActivity;
  const notificationRows = workspace?.notifications?.rows || [];
  const reports = workspace?.reports;
  const organiserOptions = workspace?.events?.filters?.organiserOptions || [];

  const renderPagination = (data) => <Pagination pagination={data?.pagination} updateQuery={updateQuery} />;

  const overviewMetrics = useMemo(
    () => [
      { title: 'Total Events', value: overview?.metrics?.totalEvents || 0, subtitle: 'All events in the platform', icon: TicketIcon },
      { title: 'Total Users', value: overview?.metrics?.totalUsers || 0, subtitle: 'Across every role', icon: UsersIcon },
      { title: 'Tickets Sold', value: overview?.metrics?.totalTicketsSold || 0, subtitle: 'System-wide issued tickets', icon: CreditCardIcon },
      { title: 'Total Orders', value: overview?.metrics?.totalOrders || 0, subtitle: 'All confirmed orders', icon: BuildingOffice2Icon },
      { title: 'Active Events', value: overview?.metrics?.activeEvents || 0, subtitle: 'Live events running now', icon: ShieldCheckIcon },
      { title: 'Verification Rate', value: `${overview?.metrics?.verificationRate || 0}%`, subtitle: 'Attendees with verified photos', icon: CheckBadgeIcon },
    ],
    [overview?.metrics]
  );

  const verificationSeries = useMemo(() => overview?.distributions?.verification || [], [overview?.distributions?.verification]);
  const activityRows = overview?.activity?.rows || [];

  return (
    <>
      <SectionFilters section={section} params={params} updateQuery={updateQuery} organiserOptions={organiserOptions} />

      {section === 'overview' && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
              Auto-updating overview data
            </span>
            {lastUpdated && <span>Updated {format(lastUpdated, 'HH:mm:ss')}</span>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {overviewMetrics.map((metric) => (
              <MetricCard key={metric.title} title={metric.title} value={metric.value} subtitle={metric.subtitle} icon={metric.icon} />
            ))}
          </div>

          <Card className="mt-6 rounded-[24px] border-slate-200 bg-slate-50/80 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Platform analysis</p>
                <p className="mt-1 text-sm text-slate-600">
                  Momentum is strong with {overview?.metrics?.activeEvents || 0} live events and {overview?.metrics?.totalTicketsSold || 0} tickets already sold.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                  Orders {overview?.metrics?.totalOrders || 0}
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                  Verification {overview?.metrics?.verificationRate || 0}%
                </span>
              </div>
            </div>
          </Card>

          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.55fr,0.95fr]">
            <div className="space-y-6">
              <Card className="rounded-[24px] border-slate-200 shadow-sm">
                <CardHeader title="Ticket Sales Over Time" subtitle="Global ticket demand over the last 30 days" />
                <div className="h-72 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={overview?.ticketSalesOverTime || []}>
                      <defs>
                        <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f766e" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontSize: '12px', fontWeight: '600' }}
                      />
                      <Area type="monotone" dataKey="ticketsSold" stroke="#0f766e" strokeWidth={2.5} fill="url(#salesFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="rounded-[24px] border-slate-200 shadow-sm">
                  <CardHeader title="Recent Logins" subtitle="Last 5 users who logged in to the system" />
                  <div className="p-6 space-y-3">
                    {overview?.recentLogins?.length > 0 ? (
                      overview.recentLogins.map((user, idx) => (
                        <div
                          key={idx}
                          className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-100 hover:border-teal-200 hover:shadow-md transition-all duration-200"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold text-base shadow-sm group-hover:scale-105 transition-transform shrink-0">
                              {user.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900 group-hover:text-teal-700 transition-colors truncate">{user.name}</p>
                              <p className="text-xs text-slate-500 truncate">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                            <Badge variant="outline" className="text-xs font-medium px-2 py-0.5 whitespace-nowrap">
                              {user.role}
                            </Badge>
                            <p className="text-xs font-medium text-slate-400 whitespace-nowrap">{fmt(user.lastLogin)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <UsersIcon className="h-12 w-12 text-slate-300 mb-3" />
                        <p className="text-sm font-medium text-slate-500">No recent logins</p>
                        <p className="text-xs text-slate-400 mt-1">Users will appear here when they log in</p>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="rounded-[24px] border-slate-200 shadow-sm">
                  <CardHeader title="Verification Health" subtitle="Attendee verification status" />
                  <div className="p-6">
                    {verificationSeries.length > 0 ? (
                      <>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={verificationSeries} innerRadius={60} outerRadius={85} paddingAngle={6} dataKey="value" strokeWidth={0}>
                                {verificationSeries.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={['#10b981', '#f59e0b', '#ef4444', '#94a3b8'][index % 4]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value) => [value, 'Attendees']}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          {verificationSeries.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                              <div
                                className="h-3 w-3 rounded-full shadow-sm"
                                style={{ backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#94a3b8'][index % 4] }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{entry.name}</p>
                                <p className="text-sm font-bold text-slate-900">{entry.value}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <ShieldCheckIcon className="h-12 w-12 text-slate-300 mb-3" />
                        <p className="text-sm font-medium text-slate-500">No verification data</p>
                        <p className="text-xs text-slate-400 mt-1">Data will appear when attendees verify</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>

            <Card className="rounded-[24px] border-slate-200 shadow-sm" padding={false}>
              <CardHeader title="Latest System Activity" subtitle="Recent scans and platform actions" className="px-6 pt-6" />
              <Table>
                <thead>
                  <Tr>
                    <Th>Activity</Th>
                    <Th>Context</Th>
                    <Th className="text-right">Time</Th>
                  </Tr>
                </thead>
                <tbody>
                  {activityRows.map((item) => (
                    <Tr key={item._id}>
                      <Td>
                        {item.title.includes('/api/') ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                item.title.startsWith('GET') ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'
                              }`}
                            >
                              {item.title.split(' ')[0]}
                            </span>
                            <span className="truncate text-xs font-medium text-slate-600 max-w-[150px]">{item.title.split(' ')[1]}</span>
                          </div>
                        ) : (
                          <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              String(item.subtitle).startsWith('200') ||
                              String(item.subtitle).includes('scanned in') ||
                              String(item.subtitle).includes('entered')
                                ? 'bg-emerald-500'
                                : 'bg-slate-300'
                            }`}
                          />
                          <p className="text-xs text-slate-500">{item.subtitle}</p>
                        </div>
                      </Td>
                      <Td className="text-right">
                        <span className="text-[11px] font-medium text-slate-400">{fmt(item.createdAt)}</span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              {renderPagination(overview?.activity)}
            </Card>
          </div>
        </>
      )}

      {section === 'events' && (
        <Card className="rounded-[28px] border-slate-200" padding={false}>
          <CardHeader title="Events Management" subtitle="Manage all events across the platform" className="px-6 pt-6" />
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <thead>
                <Tr>
                  <Th>Event</Th>
                  <Th>Organization</Th>
                  <Th>Category</Th>
                  <Th>Venue</Th>
                  <Th>Date</Th>
                  <Th>Tickets</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </thead>
              <tbody>
                {eventRows.map((row) => (
                  <Tr key={row._id}>
                    <Td>
                      <div>
                        <p className="font-medium text-slate-900">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.description?.slice(0, 40)}...</p>
                      </div>
                    </Td>
                    <Td>{row.company?.name || 'Legacy'}</Td>
                    <Td>
                      <Badge variant="outline">{row.eventType}</Badge>
                    </Td>
                    <Td>{row.venue}</Td>
                    <Td>{fmt(row.date)}</Td>
                    <Td>
                      <div>
                        <p className="text-sm">
                          {row.ticketsSold} / {row.ticketCapacity}
                        </p>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-teal-500"
                            style={{ width: `${Math.min((row.ticketsSold / row.ticketCapacity) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge variant={statusTone[row.lifecycleStatus] || 'gray'}>{row.status}</Badge>
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openModal('event', 'edit', row)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDuplicateModal({
                              isOpen: true,
                              eventId: row._id,
                              name: `${row.name} (Copy)`,
                              startDate: row.date,
                            });
                          }}
                        >
                          Duplicate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-rose-500 border-rose-100 hover:bg-rose-50"
                          onClick={() => handleDeleteDashboard(row)}
                        >
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          {renderPagination(workspace?.events)}
        </Card>
      )}

      {section === 'organisations' && (
        <Card className="rounded-[28px] border-slate-200" padding={false}>
          <CardHeader title="Organizations" subtitle="Manage organizations and companies" className="px-6 pt-6" />
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <thead>
                <Tr>
                  <Th>Organization</Th>
                  <Th>Type</Th>
                  <Th>Contact</Th>
                  <Th>Organisers</Th>
                  <Th>Events</Th>
                  <Th>Tickets</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </thead>
              <tbody>
                {companyRows.map((row) => (
                  <Tr key={row._id}>
                    <Td>
                      <div>
                        <p className="font-medium text-slate-900">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.registeredBusinessName}</p>
                      </div>
                    </Td>
                    <Td>
                      <Badge variant={row.isProfitable ? 'blue' : 'emerald'}>{row.organizationType}</Badge>
                    </Td>
                    <Td>
                      <div>
                        <p className="text-sm">{row.primaryContactPerson}</p>
                        <p className="text-xs text-slate-500">{row.officialEmail}</p>
                      </div>
                    </Td>
                    <Td>{row.stats?.organisers || 0}</Td>
                    <Td>{row.stats?.events || 0}</Td>
                    <Td>{row.stats?.ticketsSold || 0}</Td>
                    <Td>
                      <Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge>
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openModal('organiser', 'create', { companyId: row._id, _locked: true })}
                        >
                          Add Organiser
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openModal('company', 'edit', row)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-rose-500 border-rose-100 hover:bg-rose-50"
                          onClick={() => handleDeleteCompany(row)}
                        >
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          {renderPagination(workspace?.organisations)}
        </Card>
      )}

      {section === 'organisers' && (
        <Card className="rounded-[28px] border-slate-200" padding={false}>
          <CardHeader title="Organizers" subtitle="Manage organizers and staff accounts" className="px-6 pt-6" />
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <thead>
                <Tr>
                  <Th>Organiser</Th>
                  <Th>Organization</Th>
                  <Th>Role</Th>
                  <Th>Tickets</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </Tr>
              </thead>
              <tbody>
                {onlyOrganiserRows.map((row) => (
                  <Tr key={row._id}>
                    <Td>
                      <div>
                        <p className="font-medium text-slate-900">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                      </div>
                    </Td>
                    <Td>{row.company?.name || 'Unassigned'}</Td>
                    <Td>
                      <Badge variant="outline">{row.role}</Badge>
                    </Td>
                    <Td>{row.stats?.ticketsSold || 0}</Td>
                    <Td>
                      <Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge>
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openModal('organiser', 'edit', row)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await resendSuperAdminUserCredentials(row._id);
                            toast.success('Login details email sent');
                          }}
                        >
                          Resend
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-rose-500 border-rose-100 hover:bg-rose-50"
                          onClick={() => deleteOrganiser(row)}
                        >
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          {renderPagination(workspace?.users)}
        </Card>
      )}

      {section === 'users' && (
        <Card className="rounded-[28px] border-slate-200" padding={false}>
          <CardHeader title="System Users" subtitle="Global platform administrators and staff" className="px-6 pt-6" />
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <thead>
                <Tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Assigned Events</Th>
                  <Th>Last Login</Th>
                  <Th>Actions</Th>
                </Tr>
              </thead>
              <tbody>
                {otherUserRows.map((row) => (
                  <Tr key={row._id}>
                    <Td>
                      <div>
                        <p className="font-medium text-slate-900">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                      </div>
                    </Td>
                    <Td>
                      <Badge variant="outline">{row.role}</Badge>
                    </Td>
                    <Td>
                      <Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge>
                    </Td>
                    <Td>{row.assignedEvents?.map((event) => event.name).join(', ') || '-'}</Td>
                    <Td>{fmt(row.lastLogin)}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openModal('user', 'edit', row)}>
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await resendSuperAdminUserCredentials(row._id);
                            toast.success('Login details email sent');
                          }}
                        >
                          Resend
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await updateSuperAdminUserStatus(row._id, row.status === 'Active' ? 'Inactive' : 'Active');
                            toast.success('User status updated');
                            loadWorkspace();
                          }}
                        >
                          {row.status === 'Active' ? 'Disable' : 'Activate'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-rose-500 border-rose-100 hover:bg-rose-50"
                          onClick={() => deleteUser(row)}
                        >
                          Delete
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          {renderPagination(workspace?.users)}
        </Card>
      )}

      {section === 'tickets' && (
        <div className="grid gap-5 xl:grid-cols-[1.2fr,1fr]">
          <Card className="rounded-[28px] border-slate-200" padding={false}>
            <CardHeader title="All Tickets" subtitle="Global ticket issuance and status" className="px-6 pt-6" />
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <thead>
                  <Tr>
                    <Th>#</Th>
                    <Th>Ticket</Th>
                    <Th>Event</Th>
                    <Th>Attendee</Th>
                    <Th>Category</Th>
                    <Th>Status</Th>
                  </Tr>
                </thead>
                <tbody>
                  {ticketRows.map((row, idx) => (
                    <Tr key={row._id}>
                      <Td>
                        {idx + 1 + ((workspace?.tickets?.pagination?.page - 1) * workspace?.tickets?.pagination?.limit || 0)}
                      </Td>
                      <Td>
                        <span className="font-mono text-xs font-bold">{row.ticketNumber}</span>
                      </Td>
                      <Td>{row.event}</Td>
                      <Td>
                        <div>
                          <p className="font-medium text-slate-900">{row.attendee}</p>
                          <p className="text-xs text-slate-500">{row.attendeeEmail}</p>
                        </div>
                      </Td>
                      <Td>{row.categoryName}</Td>
                      <Td>
                        <Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {renderPagination(workspace?.tickets)}
          </Card>
          <Card className="rounded-[28px] border-slate-200">
            <CardHeader title="Anomaly Detection" subtitle="Overbooking and assignment gaps" />
            <div className="space-y-4">
              <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Unassigned tickets</p>
                <p className="mt-1 text-2xl font-semibold">{workspace?.tickets?.anomalySummary?.unassignedTickets || 0}</p>
              </div>
              {(workspace?.tickets?.anomalySummary?.overbookedEvents || []).map((item) => (
                <div key={item.event} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">{item.event}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.categories.join(', ')}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {section === 'verification' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <MetricCard title="Pending" value={verification?.summary?.pending || 0} subtitle="Awaiting photo review" icon={ShieldCheckIcon} />
            <MetricCard title="Rejected" value={verification?.summary?.rejected || 0} subtitle="Need resubmission" icon={ShieldCheckIcon} />
            <MetricCard title="Verified" value={verification?.summary?.verified || 0} subtitle="Ready for access" icon={ShieldCheckIcon} />
          </div>
          <Card className="rounded-[28px] border-slate-200" padding={false}>
            <CardHeader title="Verification Requests" subtitle="Review and approve attendee identities" className="px-6 pt-6" />
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <thead>
                  <Tr>
                    <Th>Attendee</Th>
                    <Th>Event</Th>
                    <Th>Status</Th>
                    <Th>Rejection</Th>
                    <Th>Verified By</Th>
                    <Th>Updated</Th>
                  </Tr>
                </thead>
                <tbody>
                  {(verification?.rows || []).map((row) => (
                    <Tr key={row._id}>
                      <Td>
                        <div>
                          <p className="font-medium text-slate-900">{row.attendee}</p>
                          <p className="text-xs text-slate-500">{row.email}</p>
                        </div>
                      </Td>
                      <Td>{row.event}</Td>
                      <Td>
                        <Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge>
                      </Td>
                      <Td>{row.rejectionReason || '-'}</Td>
                      <Td>{row.verifiedBy || '-'}</Td>
                      <Td>
                        <span className="text-[11px] font-medium text-slate-400">{fmt(row.updatedAt)}</span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {renderPagination(workspace?.verification)}
          </Card>
        </div>
      )}

      {section === 'entry-logs' && (
        <Card className="rounded-[28px] border-slate-200" padding={false}>
          <CardHeader title="Global Entry Logs" subtitle="Live scan history across all events" className="px-6 pt-6" />
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <thead>
                <Tr>
                  <Th>Attendee</Th>
                  <Th>Event</Th>
                  <Th>Gate</Th>
                  <Th>Action</Th>
                  <Th>Status</Th>
                  <Th>Time</Th>
                </Tr>
              </thead>
              <tbody>
                {entryRows.map((row) => (
                  <Tr key={row._id}>
                    <Td>{row.attendee}</Td>
                    <Td>{row.event}</Td>
                    <Td>{row.gate}</Td>
                    <Td>
                      <span className="text-xs font-medium uppercase tracking-wider">{row.action}</span>
                    </Td>
                    <Td>
                      <Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge>
                    </Td>
                    <Td>
                      <span className="text-[11px] font-medium text-slate-400">{fmt(row.time)}</span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          {renderPagination(workspace?.entryLogs)}
        </Card>
      )}

      {section === 'zone-activity' && (
        <div className="grid gap-6 xl:grid-cols-[1.5fr,1fr]">
          <Card className="rounded-[28px] border-slate-200" padding={false}>
            <CardHeader title="Recent Movements" subtitle="Detailed entry and exit logs" className="px-6 pt-6" />
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <thead>
                  <Tr>
                    <Th>Attendee</Th>
                    <Th>Event</Th>
                    <Th>Zone</Th>
                    <Th>Action</Th>
                    <Th>Status</Th>
                    <Th>Time</Th>
                  </Tr>
                </thead>
                <tbody>
                  {(zoneActivity?.movements?.rows || []).map((row) => (
                    <Tr key={row._id}>
                      <Td>
                        <p className="font-medium text-slate-900">{row.attendee}</p>
                      </Td>
                      <Td>
                        <p className={`text-xs ${row.event === 'Unknown event' ? 'text-slate-300 italic' : 'text-slate-500'}`}>
                          {row.event}
                        </p>
                      </Td>
                      <Td>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{row.zoneName}</span>
                      </Td>
                      <Td>
                        <span className="text-xs font-medium uppercase tracking-wider">{row.action}</span>
                      </Td>
                      <Td>
                        <Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge>
                      </Td>
                      <Td>
                        <span className="text-[11px] font-medium text-slate-400">{fmt(row.timestamp)}</span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {renderPagination(workspace?.zoneActivity?.movements)}
          </Card>
          <Card className="rounded-[28px] border-slate-200" padding={false}>
            <CardHeader title="Zone Occupancy" subtitle="Live occupancy totals" className="px-6 pt-6" />
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <thead>
                  <Tr>
                    <Th>Zone</Th>
                    <Th>Occupancy</Th>
                    <Th>Activity</Th>
                  </Tr>
                </thead>
                <tbody>
                  {(zoneActivity?.occupancy?.rows || []).map((row) => (
                    <Tr key={`${row.event}-${row.zoneName}`}>
                      <Td>
                        <div>
                          <p className="font-semibold text-slate-900">{row.zoneName}</p>
                          <p className={`text-[10px] ${row.event === 'Unknown event' ? 'text-slate-300' : 'text-slate-500'}`}>
                            {row.event}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        <p className="text-lg font-bold text-slate-900">{row.occupancy}</p>
                      </Td>
                      <Td className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-medium text-emerald-600">In: {row.entries}</span>
                          <span className="text-[10px] font-medium text-teal-600">Out: {row.exits}</span>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            {renderPagination(workspace?.zoneActivity?.occupancy)}
          </Card>
        </div>
      )}

      {section === 'notifications' && (
        <Card className="rounded-[28px] border-slate-200" padding={false}>
          <CardHeader title="Platform Notifications" subtitle="History of sent emails and system alerts" className="px-6 pt-6" />
          <div className="overflow-x-auto">
            <Table className="min-w-[1000px]">
              <thead>
                <Tr>
                  <Th>Recipient</Th>
                  <Th>Message</Th>
                  <Th>Type</Th>
                  <Th>Channel</Th>
                  <Th>Event</Th>
                  <Th>Created</Th>
                  <Th>Action</Th>
                </Tr>
              </thead>
              <tbody>
                {notificationRows.map((row) => (
                  <Tr key={row._id}>
                    <Td>
                      <div>
                        <p className="font-medium text-slate-900">{row.user}</p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                      </div>
                    </Td>
                    <Td>
                      <div>
                        <p className="font-medium text-slate-900">{row.title}</p>
                        <p className="text-xs text-slate-500 line-clamp-1">{row.message}</p>
                      </div>
                    </Td>
                    <Td>
                      <Badge variant="outline">{row.type}</Badge>
                    </Td>
                    <Td>{row.channel}</Td>
                    <Td>{row.eventName || '-'}</Td>
                    <Td>
                      <span className="text-[11px] font-medium text-slate-400">{fmt(row.createdAt)}</span>
                    </Td>
                    <Td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await resendSuperAdminNotification(row._id);
                          toast.success('Notification marked for resend');
                        }}
                      >
                        Resend
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          {renderPagination(workspace?.notifications)}
        </Card>
      )}

      {section === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Report Tickets"
              value={reports?.summary?.totalTickets || 0}
              subtitle="Tickets issued in report"
              icon={TicketIcon}
            />
            <MetricCard
              title="Report Entry"
              value={reports?.summary?.totalAttendance || 0}
              subtitle="Successful entries logged"
              icon={CheckBadgeIcon}
            />
            <MetricCard
              title="Avg Verification"
              value={`${reports?.summary?.avgVerificationRate || 0}%`}
              subtitle="Mean security compliance"
              icon={ShieldCheckIcon}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.5fr,1fr]">
            <Card className="rounded-[28px] border-slate-200" padding={false}>
              <CardHeader
                title="Detailed Revenue Report"
                subtitle="Financial breakdown per event"
                className="px-6 pt-6"
                action={
                  <Button
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => exportReport('revenue')}
                  >
                    Export CSV
                  </Button>
                }
              />
              <div className="overflow-x-auto">
                <Table className="min-w-[600px]">
                  <thead>
                    <Tr>
                      <Th>Event Name</Th>
                      <Th>Tickets</Th>
                      <Th>Orders</Th>
                      <Th>Revenue</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {(reports?.revenue || []).map((row) => (
                      <Tr key={row._id}>
                        <Td>
                          <p className="font-medium text-slate-900">{row.eventName}</p>
                        </Td>
                        <Td>{row.ticketsSold}</Td>
                        <Td>{row.orders}</Td>
                        <Td className="font-semibold text-slate-900">
                          {money(row.revenue, row.currency || workspace?.settings?.currency)}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>

            <Card className="rounded-[28px] border-slate-200" padding={false}>
              <CardHeader
                title="Organizer Performance"
                subtitle="Top throughput leaders"
                className="px-6 pt-6"
                action={
                  <Button
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => exportReport('organisers')}
                  >
                    Export CSV
                  </Button>
                }
              />
              <div className="overflow-x-auto">
                <Table className="min-w-[500px]">
                  <thead>
                    <Tr>
                      <Th>Organizer</Th>
                      <Th>Events</Th>
                      <Th>Tickets Sold</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {(reports?.organisers || []).map((row) => (
                      <Tr key={row.organiser}>
                        <Td>
                          <p className="font-medium text-slate-900">{row.organiser}</p>
                        </Td>
                        <Td>{row.events}</Td>
                        <Td className="font-bold text-slate-900">{row.ticketsSold}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          </div>

          <Card className="rounded-[28px] border-slate-200" padding={false}>
            <CardHeader
              title="Attendance & Security Audit"
              subtitle="Entry validation metrics per event"
              className="px-6 pt-6"
              action={
                <Button
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => exportReport('attendance')}
                >
                  Export CSV
                </Button>
              }
            />
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <thead>
                  <Tr>
                    <Th>Event Name</Th>
                    <Th>Allowed</Th>
                    <Th>Denied</Th>
                    <Th>Compliance</Th>
                    <Th>Total Scans</Th>
                  </Tr>
                </thead>
                <tbody>
                  {(reports?.attendance || []).map((row) => {
                    const total = row.allowedEntries + row.deniedEntries;
                    const rate = total > 0 ? ((row.allowedEntries / total) * 100).toFixed(1) : 0;
                    return (
                      <Tr key={row._id}>
                        <Td>
                          <p className="font-medium text-slate-900">{row.eventName}</p>
                        </Td>
                        <Td className="text-emerald-600 font-medium">{row.allowedEntries}</Td>
                        <Td className="text-rose-600 font-medium">{row.deniedEntries}</Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${rate}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-slate-600">{rate}%</span>
                          </div>
                        </Td>
                        <Td className="font-medium text-slate-500">{total}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {section === 'system-logs' && (
        <Card className="rounded-[28px] border-slate-200" padding={false}>
          <CardHeader title="System Audit Logs" subtitle="Comprehensive platform-level log of actions" className="px-6 pt-6" />
          <div className="overflow-x-auto">
            <Table className="min-w-[1100px]">
              <thead>
                <Tr>
                  <Th>Timestamp</Th>
                  <Th>Operator</Th>
                  <Th>Role</Th>
                  <Th>Event Scope</Th>
                  <Th>Action</Th>
                  <Th>Message</Th>
                  <Th>IP Address</Th>
                </Tr>
              </thead>
              <tbody>
                {sysLoading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                      Loading system logs...
                    </td>
                  </tr>
                ) : (
                  (systemLogsData?.logs || []).map((log) => (
                    <Tr key={log._id}>
                      <Td>{fmt(log.createdAt)}</Td>
                      <Td>
                        <span className="font-semibold text-slate-900">{log.userEmail || 'system'}</span>
                      </Td>
                      <Td>
                        <Badge variant="outline">{log.userRole || 'System'}</Badge>
                      </Td>
                      <Td>{log.eventId?.name || 'Global Platform'}</Td>
                      <Td>
                        <Badge variant={statusTone[log.action] || 'gray'}>{String(log.action).replace('_', ' ')}</Badge>
                      </Td>
                      <Td>
                        <p className="max-w-md text-sm font-medium text-slate-800 break-words">{log.details?.message}</p>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs text-slate-500">{log.ipAddress || '-'}</span>
                      </Td>
                    </Tr>
                  ))
                )}
                {!sysLoading && (!systemLogsData?.logs || systemLogsData.logs.length === 0) && (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                      No system logs found matching filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
          <Pagination
            pagination={{ page: systemLogsData?.page || 1, pages: systemLogsData?.pages || 1 }}
            updateQuery={updateQuery}
          />
        </Card>
      )}

      {section === 'settings' && <AdminSettingsPanel />}
    </>
  );
};

/* ─────────────────────────────────────────────────────────
   Bank Accounts Section
───────────────────────────────────────────────────────── */
const EMPTY_BANK_FORM = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  branch: '',
  swiftCode: '',
  qrCode: '',
  isActive: true,
};

const BankAccountsSection = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_BANK_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, account: null });

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await getAdminBankAccounts();
      const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setAccounts(list);
    } catch {
      toast.error('Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_BANK_FORM);
    setModalOpen(true);
  };

  const openEdit = (acct) => {
    setEditTarget(acct);
    setForm({
      bankName: acct.bankName || '',
      accountName: acct.accountName || '',
      accountNumber: acct.accountNumber || '',
      branch: acct.branch || '',
      swiftCode: acct.swiftCode || '',
      qrCode: acct.qrCode || '',
      isActive: acct.isActive !== false,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTarget) {
        await updateAdminBankAccount(editTarget._id, form);
        toast.success('Bank account updated');
      } else {
        await createAdminBankAccount(form);
        toast.success('Bank account created');
      }
      setModalOpen(false);
      loadAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (acct) => {
    setDeleteModal({ isOpen: true, account: acct });
  };

  const confirmDelete = async () => {
    if (!deleteModal.account) return;
    try {
      await deleteAdminBankAccount(deleteModal.account._id);
      toast.success('Bank account deleted');
      loadAccounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteModal({ isOpen: false, account: null });
    }
  };

  const handleToggleActive = async (acct) => {
    try {
      await updateAdminBankAccount(acct._id, { isActive: !acct.isActive });
      toast.success(`Bank account ${!acct.isActive ? 'activated' : 'deactivated'}`);
      loadAccounts();
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {accounts.length} account{accounts.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Button onClick={openCreate}>+ Add Bank Account</Button>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : accounts.length === 0 ? (
        <Card className="rounded-[28px] border-slate-200">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <CreditCardIcon className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-lg font-semibold text-slate-700">No bank accounts yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Add a bank account so buyers can transfer payments during checkout.
            </p>
            <Button className="mt-6" onClick={openCreate}>
              + Add Bank Account
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((acct) => (
            <Card
              key={acct._id}
              className={`rounded-[28px] border-2 transition-all ${
                acct.isActive ? 'border-teal-100 bg-white' : 'border-slate-100 bg-slate-50 opacity-70'
              }`}
            >
              {/* Status + Actions */}
              <div className="mb-4 flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    acct.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${acct.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {acct.isActive ? 'Active' : 'Inactive'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(acct)}
                    className="rounded-xl p-1.5 text-slate-400 hover:bg-teal-50 hover:text-teal-600 transition-colors"
                    title="Edit"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleToggleActive(acct)}
                    className={`rounded-xl p-1.5 transition-colors ${
                      acct.isActive
                        ? 'text-amber-400 hover:bg-amber-50 hover:text-amber-600'
                        : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                    }`}
                    title={acct.isActive ? 'Deactivate' : 'Activate'}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M12 8v4m0 4h.01"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleDeleteClick(acct)}
                    className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                    title="Delete"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Bank info */}
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50">
                  <CreditCardIcon className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-900">{acct.bankName}</p>
                  <p className="text-xs text-slate-400">{acct.branch}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Account Name</span>
                  <span className="font-semibold text-slate-800">{acct.accountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Account No.</span>
                  <span className="font-mono font-semibold text-slate-800">{acct.accountNumber}</span>
                </div>
                {acct.swiftCode && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Swift / BIC</span>
                    <span className="font-mono font-semibold text-slate-800">{acct.swiftCode}</span>
                  </div>
                )}
              </div>

              {acct.qrCode && (
                <div className="mt-4 flex justify-center">
                  <img
                    src={acct.qrCode}
                    alt="QR Code"
                    className="h-24 w-24 rounded-xl border border-slate-200 object-contain p-1"
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <Modal
          open
          onClose={() => setModalOpen(false)}
          title={editTarget ? 'Edit Bank Account' : 'Add Bank Account'}
          size="lg"
        >
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-h-[65vh] overflow-y-auto px-1">
              <Field label="Bank Name *">
                <Input
                  value={form.bankName}
                  onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
                  placeholder="e.g. Commercial Bank of Ceylon"
                  required
                />
              </Field>
              <Field label="Account Name *">
                <Input
                  value={form.accountName}
                  onChange={(e) => setForm((p) => ({ ...p, accountName: e.target.value }))}
                  placeholder="e.g. EventGate Events (Pvt) Ltd"
                  required
                />
              </Field>
              <Field label="Account Number *">
                <Input
                  value={form.accountNumber}
                  onChange={(e) => setForm((p) => ({ ...p, accountNumber: e.target.value }))}
                  placeholder="e.g. 1234567890"
                  required
                />
              </Field>
              <Field label="Branch *">
                <Input
                  value={form.branch}
                  onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))}
                  placeholder="e.g. Colombo 03"
                  required
                />
              </Field>
              <Field label="Swift / BIC Code *">
                <Input
                  value={form.swiftCode}
                  onChange={(e) => setForm((p) => ({ ...p, swiftCode: e.target.value }))}
                  placeholder="e.g. CCEYLKLX"
                  required
                />
              </Field>
              <Field label="QR Code Image URL (optional)">
                <Input
                  value={form.qrCode}
                  onChange={(e) => setForm((p) => ({ ...p, qrCode: e.target.value }))}
                  placeholder="https://..."
                />
              </Field>
              <div className="col-span-1 md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.isActive}
                      onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                    />
                    <div
                      className={`block h-6 w-10 rounded-full transition-colors ${
                        form.isActive ? 'bg-teal-500' : 'bg-slate-200'
                      }`}
                    />
                    <div
                      className={`dot absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                        form.isActive ? 'translate-x-4' : ''
                      }`}
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-700">
                    Active (visible to buyers during checkout)
                  </span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editTarget ? 'Save Changes' : 'Create Account'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Delete Bank Account</h3>
            <p className="text-sm text-slate-700 mb-4">
              Are you sure you want to delete{' '}
              <strong>
                {deleteModal.account?.bankName} – {deleteModal.account?.accountName}
              </strong>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteModal({ isOpen: false, account: null })}
              >
                Cancel
              </Button>
              <Button className="bg-rose-600 hover:bg-rose-500" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const EntityModal = ({ modal, closeModal, form, setForm, saving, saveEntity, organiserOptions, companyOptions = [] }) => {
  if (!modal.isOpen) return null;

  const isProfitable = ['Sole Proprietorship', 'Partnership', 'Incorporated Company', 'State Company'].includes(form.organizationType);

  return (
    <Modal
      open
      onClose={closeModal}
      title={`${modal.mode === 'create' ? 'Create' : 'Edit'} ${
        modal.type === 'event' ? 'Event' : modal.type === 'organiser' ? 'Organiser' : modal.type === 'company' ? 'Organization' : 'User'
      }`}
      size={modal.type === 'company' ? 'xl' : 'lg'}
    >
      <form onSubmit={saveEntity}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-h-[60vh] overflow-y-auto px-1">
          {modal.type === 'company' ? (
            <>
              <div className="col-span-2 pt-2 border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Basic Information</h3>
              </div>
              <Field label="Organization Name *">
                <Input value={form.name || ''} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
              </Field>
              <Field label="Registered Business Name *">
                <Input
                  value={form.registeredBusinessName || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, registeredBusinessName: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Organization Type *">
                <Select
                  value={form.organizationType || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, organizationType: e.target.value }))}
                  required
                >
                  <option value="">Select Type</option>
                  <optgroup label="Profitable">
                    <option value="Sole Proprietorship">Sole Proprietorship</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Incorporated Company">Incorporated Company</option>
                    <option value="State Company">State Company</option>
                  </optgroup>
                  <optgroup label="Non-Profitable">
                    <option value="NGO">NGO</option>
                    <option value="Cooperative Society">Cooperative Society</option>
                    <option value="Government Department">Government Department</option>
                    <option value="Association">Association</option>
                  </optgroup>
                </Select>
              </Field>
              <Field label="Organization Code">
                <Input value={form.organizationCode || ''} onChange={(e) => setForm((prev) => ({ ...prev, organizationCode: e.target.value }))} />
              </Field>
              <Field label="Establishment Date">
                <Input
                  type="date"
                  value={form.establishmentDate?.split('T')[0] || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, establishmentDate: e.target.value }))}
                />
              </Field>

              {isProfitable && (
                <>
                  <div className="col-span-2 pt-2 border-b border-slate-100 pb-2 mb-2">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Tax & Registration</h3>
                  </div>
                  <Field label="BR Number *">
                    <Input value={form.brNumber || ''} onChange={(e) => setForm((prev) => ({ ...prev, brNumber: e.target.value }))} required />
                  </Field>
                  <Field label="TIN Number *">
                    <Input value={form.tinNumber || ''} onChange={(e) => setForm((prev) => ({ ...prev, tinNumber: e.target.value }))} required />
                  </Field>
                  <Field label="VAT Number *">
                    <Input value={form.vatNumber || ''} onChange={(e) => setForm((prev) => ({ ...prev, vatNumber: e.target.value }))} required />
                  </Field>
                </>
              )}

              <div className="col-span-2 pt-2 border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Contact Information</h3>
              </div>
              <Field label="Primary Contact Person *">
                <Input
                  value={form.primaryContactPerson || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, primaryContactPerson: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Designation *">
                <Input value={form.designation || ''} onChange={(e) => setForm((prev) => ({ ...prev, designation: e.target.value }))} required />
              </Field>
              <Field label="Official Email Address *">
                <Input
                  type="email"
                  value={form.officialEmail || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, officialEmail: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Contact Number *">
                <Input value={form.contactNumber || ''} onChange={(e) => setForm((prev) => ({ ...prev, contactNumber: e.target.value }))} required />
              </Field>
              <Field label="Website URL">
                <Input value={form.websiteUrl || ''} onChange={(e) => setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))} />
              </Field>

              <div className="col-span-2 pt-2 border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Address Information</h3>
              </div>
              <Field label="Registered Address *">
                <Input
                  value={form.registeredAddress || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, registeredAddress: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Operational Address">
                <Input value={form.operationalAddress || ''} onChange={(e) => setForm((prev) => ({ ...prev, operationalAddress: e.target.value }))} />
              </Field>
              <Field label="City">
                <Input value={form.city || ''} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
              </Field>
              <Field label="District">
                <Input value={form.district || ''} onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value }))} />
              </Field>
              <Field label="Province">
                <Input value={form.province || ''} onChange={(e) => setForm((prev) => ({ ...prev, province: e.target.value }))} />
              </Field>
              <Field label="Postal Code">
                <Input value={form.postalCode || ''} onChange={(e) => setForm((prev) => ({ ...prev, postalCode: e.target.value }))} />
              </Field>
              <Field label="Country">
                <Input value={form.country || ''} onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))} />
              </Field>

              <div className="col-span-2 pt-2 border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Financial Information</h3>
              </div>
              <Field label="Bank Details *">
                <Input value={form.bankDetails || ''} onChange={(e) => setForm((prev) => ({ ...prev, bankDetails: e.target.value }))} required />
              </Field>
              <Field label="Billing Address">
                <Input value={form.billingAddress || ''} onChange={(e) => setForm((prev) => ({ ...prev, billingAddress: e.target.value }))} />
              </Field>
              <Field label="Payment Contact *">
                <Input value={form.paymentContact || ''} onChange={(e) => setForm((prev) => ({ ...prev, paymentContact: e.target.value }))} required />
              </Field>
              <Field label="Invoice Email *">
                <Input
                  type="email"
                  value={form.invoiceEmail || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, invoiceEmail: e.target.value }))}
                  required
                />
              </Field>
            </>
          ) : modal.type === 'event' ? (
            <>
              <div className="col-span-2 pt-2 border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Basic Information</h3>
              </div>
              <Field label="Event Name *">
                <Input value={form.name || ''} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
              </Field>
              <Field label="Event Type *">
                <Select value={form.eventType || 'cricket'} onChange={(e) => setForm((prev) => ({ ...prev, eventType: e.target.value }))} required>
                  <option value="cricket">Cricket Match</option>
                  <option value="concert">Concert / Musical</option>
                  <option value="conference">Conference / Exhibition</option>
                  <option value="other">Other Event</option>
                </Select>
              </Field>
              <Field label="Organization">
                <Select value={form.companyId || ''} onChange={(e) => setForm((prev) => ({ ...prev, companyId: e.target.value }))}>
                  <option value="">None / Unassigned</option>
                  {companyOptions.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Main Organisers (Max 2)">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-xl border border-slate-200 bg-slate-50">
                    {(form.organiserIds || []).map((id) => {
                      const org = organiserOptions.find((o) => o._id === id);
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-xs font-medium border border-teal-200"
                        >
                          {org?.name || id}
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, organiserIds: prev.organiserIds.filter((oid) => oid !== id) }))}
                            className="hover:text-teal-900"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    {(form.organiserIds || []).length === 0 && <span className="text-slate-400 text-xs py-1">No organisers selected</span>}
                  </div>
                  <Select
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) return;
                      if ((form.organiserIds || []).length >= 2) {
                        toast.error('Maximum 2 organisers allowed');
                        return;
                      }
                      if ((form.organiserIds || []).includes(id)) return;
                      setForm((prev) => ({ ...prev, organiserIds: [...(prev.organiserIds || []), id] }));
                    }}
                    disabled={(form.organiserIds || []).length >= 2}
                  >
                    <option value="">Add Organiser...</option>
                    {organiserOptions
                      .filter((o) => (!form.companyId || o.company === form.companyId) && !(form.organiserIds || []).includes(o._id))
                      .map((option) => (
                        <option key={option._id} value={option._id}>
                          {option.name} ({option.email})
                        </option>
                      ))}
                  </Select>
                </div>
              </Field>

              <div className="col-span-2 pt-4 border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Venue & Time</h3>
              </div>
              <Field label="Venue Name *">
                <Input value={form.venueName || ''} onChange={(e) => setForm((prev) => ({ ...prev, venueName: e.target.value }))} required />
              </Field>
              <Field label="City">
                <Input value={form.city || ''} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
              </Field>
              <Field label="Start Date/Time *">
                <Input
                  type="datetime-local"
                  value={form.startDate ? form.startDate.slice(0, 16) : ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  required
                />
              </Field>
              <Field label="End Date/Time *">
                <Input
                  type="datetime-local"
                  value={form.endDate ? form.endDate.slice(0, 16) : ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Event Timezone *">
                <Select value={form.timezone || 'Asia/Colombo'} onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))} required>
                  <option value="Asia/Colombo">Asia/Colombo (UTC+5:30)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
                  <option value="Asia/Singapore">Asia/Singapore (UTC+8:00)</option>
                  <option value="Asia/Dubai">Asia/Dubai (UTC+4:00)</option>
                  <option value="Europe/London">Europe/London (UTC+0:00)</option>
                  <option value="Europe/Paris">Europe/Paris (UTC+1:00)</option>
                  <option value="America/New_York">America/New_York (UTC-5:00)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (UTC-8:00)</option>
                  <option value="Australia/Sydney">Australia/Sydney (UTC+10:00)</option>
                  <option value="UTC">UTC (UTC+0:00)</option>
                </Select>
              </Field>

              <div className="col-span-2 pt-4 border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Communication & Settings</h3>
              </div>
              <Field label="Status">
                <Select value={form.status || 'draft'} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </Field>
              <Field label="Currency">
                <Select value={form.currency || 'LKR'} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}>
                  <option value="LKR">LKR (Rs.)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AUD">AUD (A$)</option>
                </Select>
              </Field>
              <Field label="Invite Limit">
                <Input
                  type="number"
                  value={form.inviteLimitPerAttendee || 3}
                  onChange={(e) => setForm((prev) => ({ ...prev, inviteLimitPerAttendee: parseInt(e.target.value) }))}
                />
              </Field>
              <Field label="Confirmation Deadline (Hrs)">
                <Input
                  type="number"
                  value={form.settings?.confirmationDeadlineHours || 48}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, confirmationDeadlineHours: parseInt(e.target.value) },
                    }))
                  }
                />
              </Field>

              <div className="col-span-2 flex flex-wrap gap-x-8 gap-y-4 pt-2 pb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.rfidEnabled === true}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        rfidEnabled: e.target.checked,
                        settings: {
                          ...prev.settings,
                          rfidEnabled: e.target.checked,
                        },
                      }))
                    }
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Enable RFID Access Control</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.communicationEmail !== false}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        communicationEmail: e.target.checked,
                        settings: {
                          ...prev.settings,
                          communicationChannels: { ...prev.settings?.communicationChannels, email: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Enable Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.communicationSms === true}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        communicationSms: e.target.checked,
                        settings: {
                          ...prev.settings,
                          communicationChannels: { ...prev.settings?.communicationChannels, sms: e.target.checked },
                        },
                      }))
                    }
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Enable SMS</span>
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="col-span-2 pt-2 border-b border-slate-100 pb-2 mb-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">User Information</h3>
              </div>
              <Field label="Full Name *">
                <Input value={form.name || ''} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
              </Field>
              <Field label="Email Address *">
                <Input type="email" value={form.email || ''} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} required />
              </Field>
              <Field label="Phone Number">
                <Input value={form.phone || ''} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
              </Field>
              <Field label="Organization">
                <Select
                  value={form.companyId || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, companyId: e.target.value }))}
                  disabled={!!form._locked}
                >
                  <option value="">None / Unassigned</option>
                  {companyOptions.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="System Role *">
                <Select value={form.role || ''} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))} required>
                  {(modal.type === 'organiser'
                    ? ['MainOrganiser', 'SubOrganiser']
                    : ['MainAdmin', 'MainOrganiser', 'SubOrganiser', 'Staff', 'Volunteer', 'Auditor', 'Attendee']
                  ).map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Set Password">
                <Input
                  type="password"
                  placeholder={modal.mode === 'create' ? 'Enter password' : 'Leave blank to keep current'}
                  value={form.password || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  required={modal.mode === 'create'}
                />
              </Field>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={closeModal}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const DuplicateModal = ({ modal, closeModal, submit }) => {
  if (!modal.isOpen) return null;
  return (
    <Modal open onClose={() => closeModal({ isOpen: false })} title="Duplicate Event" size="md">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New Event Name">
          <Input required value={modal.name} onChange={(e) => closeModal((prev) => ({ ...prev, name: e.target.value }))} />
        </Field>
        <Field label="New Start Date">
          <Input
            type="datetime-local"
            required
            value={modal.startDate}
            onChange={(e) => closeModal((prev) => ({ ...prev, startDate: e.target.value }))}
          />
        </Field>
        <Field label="New End Date">
          <Input
            type="datetime-local"
            required
            value={modal.endDate}
            onChange={(e) => closeModal((prev) => ({ ...prev, endDate: e.target.value }))}
          />
        </Field>
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => closeModal({ isOpen: false })}>
            Cancel
          </Button>
          <Button type="submit">Duplicate</Button>
        </div>
      </form>
    </Modal>
  );
};

const AdminDashboard = () => {
  const [params, setParams] = useSearchParams();
  const section = params.get('section') || 'overview';
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [modal, setModal] = useState({ type: '', mode: 'create', item: null });
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [searchResults, setSearchResults] = useState({ events: [], users: [] });
  const [duplicateModal, setDuplicateModal] = useState({ isOpen: false, eventId: null, name: '', startDate: '', endDate: '' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, eventId: null, name: '' });
  const [deleteCompanyModal, setDeleteCompanyModal] = useState({ isOpen: false, companyId: null, name: '' });
  const [deleteOrganiserModal, setDeleteOrganiserModal] = useState({ isOpen: false, organiserId: null, name: '' });
  const [deleteUserModal, setDeleteUserModal] = useState({ isOpen: false, userId: null, name: '' });
  const [systemLogsData, setSystemLogsData] = useState({ logs: [], total: 0, pages: 1 });
  const [sysLoading, setSysLoading] = useState(false);

  const updateQuery = (key, value) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });

  const loadWorkspace = async ({ showSpinner = true } = {}) => {
    if (showSpinner) setLoading(true);
    try {
      const response = await getSuperAdminWorkspace(Object.fromEntries(params.entries()));
      setWorkspace(response.data?.data || null);
      setLastUpdated(new Date());
    } catch {
      if (showSpinner) toast.error('Failed to load super admin workspace');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [params.toString()]);

  useAutoRefresh(
    () => {
      if (section !== 'overview') return;
      loadWorkspace({ showSpinner: false });
    },
    {
      enabled: section === 'overview',
      interval: 15000,
      immediate: false,
      deps: [section, params.toString()],
    }
  );

  useEffect(() => {
    if (section !== 'system-logs') return;
    setSysLoading(true);
    getSystemLogs({
      search: params.get('search') || undefined,
      action: params.get('action') || undefined,
      from: params.get('from') || undefined,
      to: params.get('to') || undefined,
      page: params.get('page') || 1,
      limit: params.get('limit') || 15,
    })
      .then((res) => {
        setSystemLogsData(res.data?.data || { logs: [], total: 0, pages: 1 });
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to fetch system logs');
      })
      .finally(() => setSysLoading(false));
  }, [section, params.toString()]);

  useEffect(() => {
    const handleSearch = async (event) => {
      const q = String(event.detail || '').trim();
      if (!q) return setSearchResults({ events: [], users: [] });
      updateQuery('search', q);
      try {
        const response = await searchSuperAdmin(q);
        setSearchResults(response.data?.data || { events: [], users: [] });
      } catch {
        setSearchResults({ events: [], users: [] });
      }
    };
    window.addEventListener('entrynex:search', handleSearch);
    return () => window.removeEventListener('entrynex:search', handleSearch);
  }, []);

  const openModal = (type, mode = 'create', item = null) => {
    setModal({ type, mode, isOpen: true, item });
    if (type === 'event') {
      setForm({
        _id: normalizeEntityId(item?._id || item?.id),
        name: item?.name || '',
        timezone: item?.timezone || 'Asia/Colombo',
        startDate: item?.date ? new Date(item.date).toISOString().slice(0, 16) : '',
        endDate: item?.endDate ? new Date(item.endDate).toISOString().slice(0, 16) : '',
        organiserIds: Array.isArray(item?.organiser)
          ? item.organiser.map((o) => o._id)
          : item?.organiser?._id
          ? [item.organiser._id]
          : [],
        companyId: item?.company?._id || item?.company || '',
        venueName: item?.venue || '',
        status: item?.lifecycleStatus || 'draft',
        description: item?.description || '',
        eventType: item?.eventType || 'cricket',
        requirePhotoVerification: item?.settings?.requirePhotoVerification ?? true,
        allowSelfConfirmation: item?.settings?.allowSelfConfirmation ?? true,
        rfidEnabled: item?.settings?.rfidEnabled ?? false,
        currency: item?.settings?.currency || 'LKR',
        settings: item?.settings || {},
        paymentCard: item?.settings?.paymentMethods?.card ?? true,
        paymentBank: item?.settings?.paymentMethods?.bank_transfer ?? true,
        paymentCash: item?.settings?.paymentMethods?.cash ?? true,
        communicationEmail: item?.settings?.communicationChannels?.email ?? true,
        communicationSms: item?.settings?.communicationChannels?.sms ?? false,
      });
    } else if (type === 'company') {
      setForm({
        ...item,
        establishmentDate: item?.establishmentDate ? item.establishmentDate.split('T')[0] : '',
      });
    } else if (type === 'organiser' || type === 'user') {
      setForm({
        _id: normalizeEntityId(item?._id || item?.id),
        name: item?.name || '',
        email: item?.email || '',
        phone: item?.phone || '',
        password: '',
        role: item?.role || (type === 'organiser' ? 'MainOrganiser' : 'Staff'),
        status: item?.status || 'Active',
        companyId: item?.company?._id || item?.company || (mode === 'create' && item?.companyId ? item.companyId : ''),
      });
    }
  };

  const closeModal = () => {
    setModal({ type: '', mode: 'create', item: null });
    setForm({});
  };

  const saveEntity = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal.type === 'company') {
        const entityId = normalizeEntityId(form._id || modal.item?._id || modal.item?.id);
        if (modal.mode === 'create') await createSuperAdminCompany(form);
        else {
          if (!entityId) throw new Error('Missing company ID');
          await updateSuperAdminCompany(entityId, form);
        }
      } else if (modal.type === 'event') {
        const entityId = normalizeEntityId(form._id || modal.item?._id || modal.item?.id);
        const eventPayload = {
          ...form,
          companyId: form.companyId ? form.companyId : null,
          rfidEnabled: form.rfidEnabled ?? false,
          communicationEmail: form.communicationEmail ?? form.settings?.communicationChannels?.email ?? true,
          communicationSms: form.communicationSms ?? form.settings?.communicationChannels?.sms ?? false,
        };
        if (modal.mode === 'create') await createSuperAdminEvent(eventPayload);
        else {
          if (!entityId) throw new Error('Missing event ID');
          await updateSuperAdminEvent(entityId, eventPayload);
        }
      } else if (modal.type === 'organiser') {
        const entityId = normalizeEntityId(form._id || modal.item?._id || modal.item?.id);
        if (modal.mode === 'create') await createSuperAdminOrganiser(form);
        else {
          if (!entityId) throw new Error('Missing organiser ID');
          await updateSuperAdminOrganiser(entityId, form);
        }
      } else {
        const entityId = normalizeEntityId(form._id || modal.item?._id || modal.item?.id);
        if (modal.mode === 'create') await createSuperAdminUser(form);
        else {
          if (!entityId) throw new Error('Missing user ID');
          await updateSuperAdminUser(entityId, form);
        }
      }
      toast.success('Saved successfully');
      closeModal();
      loadWorkspace();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateSubmit = async (e) => {
    e.preventDefault();
    if (!duplicateModal.name || !duplicateModal.startDate || !duplicateModal.endDate) {
      return toast.error('Please fill in all fields.');
    }
    setSaving(true);
    try {
      await duplicateAdminEvent(duplicateModal.eventId, {
        newName: duplicateModal.name,
        newStartDate: duplicateModal.startDate,
        newEndDate: duplicateModal.endDate,
      });
      toast.success('Event duplicated successfully');
      setDuplicateModal({ isOpen: false, eventId: null, name: '', startDate: '', endDate: '' });
      loadWorkspace();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Duplication failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDashboard = (event) => {
    setDeleteModal({ isOpen: true, eventId: event._id, name: event.name });
  };

  const confirmDeleteDashboard = async () => {
    try {
      await deleteSuperAdminEvent(deleteModal.eventId);
      loadWorkspace();
      toast.success('Event deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete event');
    } finally {
      setDeleteModal({ isOpen: false, eventId: null, name: '' });
    }
  };

  const handleDeleteCompany = (row) => {
    setDeleteCompanyModal({ isOpen: true, companyId: row._id, name: row.name });
  };

  const confirmDeleteCompany = async () => {
    try {
      await deleteSuperAdminCompany(deleteCompanyModal.companyId);
      toast.success('Organization deleted');
      loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete organization');
    } finally {
      setDeleteCompanyModal({ isOpen: false, companyId: null, name: '' });
    }
  };

  const handleDeleteOrganiser = (row) => {
    setDeleteOrganiserModal({ isOpen: true, organiserId: row._id, name: row.name });
  };

  const confirmDeleteOrganiser = async () => {
    try {
      await deleteSuperAdminOrganiser(deleteOrganiserModal.organiserId);
      toast.success('Organiser deleted');
      loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete organiser');
    } finally {
      setDeleteOrganiserModal({ isOpen: false, organiserId: null, name: '' });
    }
  };

  const handleDeleteUser = (row) => {
    setDeleteUserModal({ isOpen: true, userId: row._id, name: row.name });
  };

  const confirmDeleteUser = async () => {
    try {
      await deleteSuperAdminUser(deleteUserModal.userId);
      toast.success('User deleted');
      loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeleteUserModal({ isOpen: false, userId: null, name: '' });
    }
  };

  const exportReport = async (type) => {
    try {
      const response = await exportSuperAdminReport({ type, ...Object.fromEntries(params.entries()) });
      downloadBlob(response.data, `${type}.csv`);
      toast.success('Report exported');
    } catch {
      toast.error('Export failed');
    }
  };

  const searchSummary = useMemo(() => {
    if (!params.get('search')) return null;
    return [...(searchResults.events || []).slice(0, 3), ...(searchResults.users || []).slice(0, 3)];
  }, [params, searchResults]);

  if (loading && !workspace) {
    return (
      <DashboardLayout>
        <LoadingSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card className="rounded-[28px] border-slate-200 bg-white">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Super Admin</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">{SECTION_LABELS[section]}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                {SECTION_SUBTITLES[section] ||
                  'Platform-level control across events, organisers, users, verification, access activity, and system configuration.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {section === 'events' && <Button onClick={() => openModal('event')}>Create event</Button>}
              {section === 'organisations' && <Button onClick={() => openModal('company')}>Create Organization</Button>}
              {section === 'organisers' && <Button onClick={() => openModal('organiser')}>Create Organiser</Button>}
              {section === 'users' && <Button onClick={() => openModal('user')}>Create user</Button>}
              {section === 'reports' && (
                <>
                  <Button onClick={() => exportReport('revenue')}>Revenue CSV</Button>
                  <Button variant="outline" onClick={() => exportReport('attendance')}>
                    Attendance CSV
                  </Button>
                </>
              )}
            </div>
          </div>
          {searchSummary?.length > 0 && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Global search matches</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {searchSummary.map((item) => (
                  <span
                    key={`${item._id}-${item.email || item.slug || ''}`}
                    className="rounded-full bg-white px-3 py-1 text-sm text-slate-600 ring-1 ring-slate-200"
                  >
                    {item.name} {item.email ? `• ${item.email}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {section === 'rfid' ? (
          <AdminRfidInventoryPage embedded />
        ) : section === 'bank-accounts' ? (
          <BankAccountsSection />
        ) : section === 'payments' ? (
          <AdminPaymentManagement />
        ) : (
          <SectionContent
            section={section}
            workspace={workspace}
            params={params}
            updateQuery={updateQuery}
            openModal={openModal}
            loadWorkspace={loadWorkspace}
            deleteOrganiser={handleDeleteOrganiser}
            deleteUser={handleDeleteUser}
            handleDeleteDashboard={handleDeleteDashboard}
            setDuplicateModal={setDuplicateModal}
            systemLogsData={systemLogsData}
            sysLoading={sysLoading}
            lastUpdated={lastUpdated}
            handleDeleteCompany={handleDeleteCompany}
            exportReport={exportReport}
          />
        )}

        {/* Delete Event Modal */}
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Delete Event</h3>
              <p className="text-sm text-slate-700 mb-4">
                Are you sure you want to delete <strong>{deleteModal.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteModal({ isOpen: false, eventId: null, name: '' })}>
                  Cancel
                </Button>
                <Button className="bg-rose-600 hover:bg-rose-500" onClick={confirmDeleteDashboard}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Organization Modal */}
        {deleteCompanyModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Delete Organization</h3>
              <p className="text-sm text-slate-700 mb-4">
                Are you sure you want to delete <strong>{deleteCompanyModal.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteCompanyModal({ isOpen: false, companyId: null, name: '' })}>
                  Cancel
                </Button>
                <Button className="bg-rose-600 hover:bg-rose-500" onClick={confirmDeleteCompany}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Organiser Modal */}
        {deleteOrganiserModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Delete Organiser</h3>
              <p className="text-sm text-slate-700 mb-4">
                Are you sure you want to delete <strong>{deleteOrganiserModal.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDeleteOrganiserModal({ isOpen: false, organiserId: null, name: '' })}
                >
                  Cancel
                </Button>
                <Button className="bg-rose-600 hover:bg-rose-500" onClick={confirmDeleteOrganiser}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete User Modal */}
        {deleteUserModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Delete User</h3>
              <p className="text-sm text-slate-700 mb-4">
                Are you sure you want to delete <strong>{deleteUserModal.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteUserModal({ isOpen: false, userId: null, name: '' })}>
                  Cancel
                </Button>
                <Button className="bg-rose-600 hover:bg-rose-500" onClick={confirmDeleteUser}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        <EntityModal
          modal={modal}
          closeModal={closeModal}
          form={form}
          setForm={setForm}
          saving={saving}
          saveEntity={saveEntity}
          organiserOptions={workspace?.events?.filters?.organiserOptions || []}
          companyOptions={
            workspace?.events?.filters?.companyOptions ||
            workspace?.users?.filters?.companyOptions ||
            workspace?.organisations?.filters?.companyOptions ||
            []
          }
        />
        <DuplicateModal modal={duplicateModal} closeModal={setDuplicateModal} submit={handleDuplicateSubmit} />
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;