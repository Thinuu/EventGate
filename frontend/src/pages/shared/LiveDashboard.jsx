import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { io } from '../../utils/realtime';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie 
} from 'recharts';
import { getMyEvents, getEvents } from '../../api/events';
import EventSelector from '../../components/ui/EventSelector';
import { 
  UsersIcon, TicketIcon, ShieldCheckIcon, ArrowUpIcon, ArrowDownIcon, MapPinIcon, ChartBarIcon 
} from '@heroicons/react/24/outline';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card, { CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import { getOrganiserWorkspace } from '../../api/organiser';
import { getSocketUrl } from '../../utils/backend';
import { useAuth } from '../../context/AuthContext';
import { getCanonicalRole } from '../../utils/rbac';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// Format number with commas
const formatNumber = (num) => num?.toLocaleString() || '0';

// Format currency
const formatCurrency = (amount, currency = 'LKR') => {
  const safeAmount = Number(amount || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(safeAmount);
};

// Format time
const formatTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const LiveEventDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const urlEventId = searchParams.get('eventId');
  const [selectedEventId, setSelectedEventId] = useState(urlEventId || '');
  const currentRole = getCanonicalRole(user?.role);
  const canSeeAllEvents = Boolean(isAdmin || currentRole === 'MainAdmin');
  
  const [loading, setLoading] = useState(true);
  // State for events list
  const [availableEvents, setAvailableEvents] = useState([]);
  // Loading flag for events fetching
  const [isFetchingEvents, setIsFetchingEvents] = useState(true);
  const [event, setEvent] = useState(null);
  const [stats, setStats] = useState({
    totalTickets: 0,
    ticketsSold: 0,
    confirmedAttendees: 0,
    checkedInCount: 0,
    totalRevenue: 0,
    zoneOccupancy: 0
  });
  const [charts, setCharts] = useState({
    checkinsOverTime: [],
    revenueByCategory: [],
    ticketStatusDistribution: []
  });
  const [recentEntries, setRecentEntries] = useState([]);
  const [zoneOccupancy, setZoneOccupancy] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [notifications, setNotifications] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const currency = event?.settings?.currency || event?.currency || 'LKR';
  
  const socketRef = useRef(null);

  // Fetch initial data
  const fetchInitialData = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!silent) {
      setLoading(true);
    }

    try {
      if (!selectedEventId) {
        setStats({ totalTickets: 0, ticketsSold: 0, confirmedAttendees: 0, checkedInCount: 0, totalRevenue: 0, zoneOccupancy: 0 });
        setCharts({ checkinsOverTime: [], revenueByCategory: [], ticketStatusDistribution: [] });
        setRecentEntries([]);
        setZoneOccupancy([]);
        return;
      }

      const response = await getOrganiserWorkspace({ eventId: selectedEventId });
      const payload = response?.data?.data || response?.data || {};
      const data = payload;
      
      if (data) {
        const overview = data.overview || {};
        const revenueValue = Number(
          overview.totalRevenue ??
          overview.revenue ??
          data.totalRevenue ??
          data.revenue ??
          0
        );

        setEvent(data.event || null);
        setStats({
          totalTickets: Number(overview.totalTickets ?? data.totalTickets ?? 0),
          ticketsSold: Number(overview.ticketsSold ?? data.ticketsSold ?? 0),
          confirmedAttendees: Number(overview.confirmedAttendees ?? data.confirmedAttendees ?? 0),
          checkedInCount: Number(overview.checkedInCount ?? data.checkedInCount ?? 0),
          totalRevenue: revenueValue,
          zoneOccupancy: Number(overview.zoneOccupancy ?? data.zoneOccupancy ?? 0)
        });
        setCharts({
          checkinsOverTime: data.charts?.checkinsOverTime || data.checkinsOverTime || [],
          revenueByCategory: data.charts?.revenueByCategory || data.revenueByCategory || [],
          ticketStatusDistribution: data.charts?.ticketStatusDistribution || data.ticketStatusDistribution || []
        });
        setRecentEntries(data.entryLogs || data.recentEntries || []);
        setZoneOccupancy(data.zoneOccupancy || data.overview?.zoneOccupancy || []);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      addNotification({ type: 'error', title: 'Refresh Failed', message: 'Unable to load the latest live data.' });
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [selectedEventId]);

  // Fetch user events list
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsFetchingEvents(true);

        if (canSeeAllEvents) {
          const publicRes = await getEvents();
          const publicEvents = (() => {
            if (Array.isArray(publicRes?.data?.events)) return publicRes?.data?.events;
            if (Array.isArray(publicRes?.data?.data?.events)) return publicRes?.data?.data?.events;
            if (Array.isArray(publicRes?.data?.data)) return publicRes?.data?.data;
            if (Array.isArray(publicRes?.data)) return publicRes?.data;
            return [];
          })();
          setAvailableEvents(publicEvents);

          if (!selectedEventId && publicEvents.length > 0) {
            const firstId = publicEvents[0]._id || publicEvents[0].id || '';
            setSelectedEventId(firstId);
            navigate(`${location.pathname}?eventId=${firstId}`, { replace: true });
          }
          return;
        }

        const res = await getMyEvents();
        const events = res?.data?.data?.events || res?.data?.events || [];

        if (events.length === 0) {
          setAvailableEvents([]);
          if (selectedEventId) {
            setSelectedEventId('');
            navigate(location.pathname, { replace: true });
          }
          return;
        }

        const hasValidSelection = events.some((event) => String(event._id || event.id) === String(selectedEventId));
        setAvailableEvents(events);

        if (!selectedEventId || !hasValidSelection) {
          const firstId = events[0]._id || events[0].id || '';
          setSelectedEventId(firstId);
          navigate(`${location.pathname}?eventId=${firstId}`, { replace: true });
        }
      } catch (e) {
        console.error('Failed to load events', e);
        setAvailableEvents([]);
      } finally {
        setIsFetchingEvents(false);
      }
    };

    fetchEvents();
  }, [canSeeAllEvents, location.pathname, navigate]);

  // Initialize Socket.IO connection
  useEffect(() => {
    // Cleanup previous socket connection if exists
    if (socketRef.current) {
      const oldSocket = socketRef.current;
      if (selectedEventId) {
        oldSocket.emit('leave_dashboard', { eventId: selectedEventId });
      }
      oldSocket.disconnect();
      socketRef.current = null;
    }

    const socketUrl = getSocketUrl(); // base URL without /api
    socketRef.current = io(socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      // Ensure socket.io uses the default path
      path: '/socket.io'
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      console.log('Socket connected:', socket.id);
      if (selectedEventId) {
        socket.emit('join_dashboard', { eventId: selectedEventId });
      }
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      console.log('Socket disconnected');
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setConnectionStatus('error');
        // Attempt a quick reconnection after short delay
        setTimeout(() => {
          socket.connect();
        }, 3000);
      });

    // Listen for real-time updates
    socket.on('event_update', (data) => {
      console.log('Event update received:', data);
      fetchInitialData();
    });

    socket.on('check_in', (data) => {
      console.log('Check-in received:', data);
      setRecentEntries(prev => [data, ...prev.slice(0, 49)]);
      setStats(prev => ({
        ...prev,
        checkedInCount: (prev.checkedInCount || 0) + 1
      }));
      addNotification({
        type: 'success',
        title: 'Check-in',
        message: `${data.attendeeName} checked in at ${data.gateName || 'entry'}`
      });
    });

    socket.on('check_in_denied', (data) => {
      console.log('Check-in denied:', data);
      addNotification({
        type: 'error',
        title: 'Access Denied',
        message: `${data.attendeeName} - ${data.reason}`
      });
    });

    socket.on('zone_scan', (data) => {
      console.log('Zone scan received:', data);
      // Update zone occupancy state based on entry/exit
      setZoneOccupancy(prev => {
        const idx = prev.findIndex(z => z.zoneName === data.zoneName);
        if (idx >= 0) {
          const zone = { ...prev[idx] };
          if (data.action === 'ENTRY') {
            zone.entries = (zone.entries || 0) + 1;
          } else if (data.action === 'EXIT') {
            zone.exits = (zone.exits || 0) + 1;
          }
          zone.occupancy = Math.max((zone.entries || 0) - (zone.exits || 0), 0);
          const updated = [...prev];
          updated[idx] = zone;
          return updated;
        } else {
          // If zone not present, create a new entry
          const newZone = {
            zoneName: data.zoneName,
            entries: data.action === 'ENTRY' ? 1 : 0,
            exits: data.action === 'EXIT' ? 1 : 0,
            occupancy: data.action === 'ENTRY' ? 1 : 0
          };
          return [...prev, newZone];
        }
      });
      addNotification({
        type: 'info',
        title: 'Zone Access',
        message: `${data.attendeeName} ${data.action === 'ENTRY' ? 'entered' : 'exited'} ${data.zoneName}`
      });
    });

    socket.on('ticket_sold', (data) => {
      console.log('Ticket sold:', data);
      fetchInitialData({ silent: true });
      addNotification({
        type: 'success',
        title: 'Ticket Sale',
        message: `New ticket sold: ${data.categoryName}`
      });
    });

    socket.on('payment_approved', (data) => {
      console.log('Payment approved:', data);
      fetchInitialData({ silent: true });
      addNotification({
        type: 'success',
        title: 'Payment',
        message: data.message || 'Payment approved'
      });
    });

    return () => {
      if (socketRef.current) {
        if (selectedEventId) {
          socketRef.current.emit('leave_dashboard', { eventId: selectedEventId });
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [selectedEventId, fetchInitialData]);

  // Add notification
  const addNotification = useCallback((notification) => {
    const id = Date.now();
    setNotifications(prev => [{ ...notification, id }, ...prev.slice(0, 9)]);
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData, selectedEventId]);

  useAutoRefresh(
    () => {
      if (!selectedEventId) return;
      fetchInitialData({ silent: true });
    },
    {
      enabled: !!selectedEventId,
      interval: 15000,
      immediate: true,
      deps: [selectedEventId],
    }
  );

  // Metric Card Component
  const MetricCard = ({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) => {
    const colorClasses = {
      blue: 'bg-teal-50 text-teal-600',
      green: 'bg-green-50 text-green-600',
      amber: 'bg-amber-50 text-amber-600',
      red: 'bg-red-50 text-red-600',
      purple: 'bg-purple-50 text-purple-600'
    };

    return (
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
            {trend && (
              <div className={`mt-2 flex items-center text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend > 0 ? <ArrowUpIcon className="mr-1 h-4 w-4" /> : <ArrowDownIcon className="mr-1 h-4 w-4" />}
                {Math.abs(trend)}% from last hour
              </div>
            )}
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </Card>
    );
  };

  // Get connection status badge
  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge variant="green">Live</Badge>;
      case 'disconnected':
        return <Badge variant="amber">Reconnecting...</Badge>;
      case 'error':
        return <Badge variant="red">Connection Error</Badge>;
      default:
        return <Badge variant="gray">Connecting...</Badge>;
    }
  };

  if (loading && !event && selectedEventId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent"></div>
            <p className="mt-4 text-slate-600">Loading live dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const attendanceRate = stats.confirmedAttendees ? Math.round((stats.checkedInCount / stats.confirmedAttendees) * 100) : 0;
  const capacityUsed = stats.totalTickets ? Math.round((stats.ticketsSold / stats.totalTickets) * 100) : 0;
  const remainingTickets = Math.max(stats.totalTickets - stats.ticketsSold, 0);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Card className="rounded-[28px] border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">Live Stream</span>
                {getConnectionBadge()}
              </div>
              <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">{event?.name || 'Live Event Dashboard'}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">Monitor ticket flow, attendee entry behavior, and venue occupancy in real time for the selected event.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-100">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Updating live data'}</span>
              <span className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-100">{recentEntries.length} recent events</span>
            </div>
          </div>
        </Card>

        <Card className="rounded-[24px] border-slate-200 bg-slate-50/80 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              {isFetchingEvents ? (
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 animate-spin text-teal-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="text-sm text-slate-600">Loading events…</span>
                </div>
              ) : (
                <EventSelector
                  events={availableEvents}
                  selectedEventId={selectedEventId}
                  onSelect={(id) => {
                    setSelectedEventId(id);
                    navigate(`${location.pathname}${id ? `?eventId=${id}` : ''}`);
                  }}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-400">
                Auto-refreshing every 15s
              </span>
            </div>
          </div>
        </Card>

        {/* Notifications Toast */}
        {notifications.length > 0 && (
          <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-xl shadow-lg border ${
                  notification.type === 'success' ? 'bg-green-50 border-green-200' :
                  notification.type === 'error' ? 'bg-red-50 border-red-200' :
                  notification.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                  'bg-teal-50 border-teal-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    notification.type === 'success' ? 'bg-green-100 text-green-600' :
                    notification.type === 'error' ? 'bg-red-100 text-red-600' :
                    notification.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                    'bg-teal-100 text-teal-600'
                  }`}>
                    {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : 'ℹ'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{notification.title}</p>
                    <p className="text-sm text-slate-600">{notification.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total Tickets"
            value={formatNumber(stats.totalTickets)}
            subtitle={`${formatNumber(stats.ticketsSold)} sold`}
            icon={TicketIcon}
            color="blue"
          />
          <MetricCard
            title="Confirmed"
            value={formatNumber(stats.confirmedAttendees)}
            subtitle="attendees"
            icon={UsersIcon}
            color="green"
          />
          <MetricCard
            title="Checked In"
            value={formatNumber(stats.checkedInCount)}
            subtitle={`${attendanceRate}% attendance`}
            icon={ShieldCheckIcon}
            color="purple"
          />
          <MetricCard
            title="Revenue"
            value={formatCurrency(stats.totalRevenue, currency)}
            subtitle="total collected"
            icon={ChartBarIcon}
            color="amber"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-700">Entry performance</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-900">{attendanceRate}%</p>
            <p className="mt-1 text-sm text-emerald-700">Attendee check-in success rate</p>
          </div>
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-sm font-medium text-teal-700">Capacity used</p>
            <p className="mt-2 text-2xl font-semibold text-teal-900">{capacityUsed}%</p>
            <p className="mt-1 text-sm text-teal-700">Tickets sold versus inventory</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-700">Remaining inventory</p>
            <p className="mt-2 text-2xl font-semibold text-amber-900">{formatNumber(remainingTickets)}</p>
            <p className="mt-1 text-sm text-amber-700">Tickets still available</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Check-ins Over Time */}
          <Card className="rounded-2xl border-slate-200">
            <CardHeader 
              title="Check-ins Over Time" 
              subtitle="Hourly check-in distribution"
            />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.checkinsOverTime}>
                  <defs>
                    <linearGradient id="checkinGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fill="url(#checkinGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Revenue by Category */}
          <Card className="rounded-2xl border-slate-200">
            <CardHeader 
              title="Revenue by Category" 
              subtitle="Revenue distribution across ticket types"
            />
            <div className="h-72">
              {charts.revenueByCategory?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.revenueByCategory} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value) => formatCurrency(value, currency)}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                      {charts.revenueByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                  No revenue breakdown is available for this event yet.
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Zone Occupancy & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Zone Occupancy */}
          <Card className="lg:col-span-1 rounded-2xl border-slate-200">
            <CardHeader 
              title="Zone Occupancy" 
              subtitle="Current zone distribution"
            />
            <div className="h-64">
              {zoneOccupancy?.length ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={zoneOccupancy}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="occupancy"
                        nameKey="zoneName"
                        paddingAngle={2}
                      >
                        {zoneOccupancy.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="px-4 pb-4">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {zoneOccupancy.map((zone, index) => (
                        <div key={zone.zoneName} className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-xs text-slate-600">{zone.zoneName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                  No zone occupancy data is available yet.
                </div>
              )}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2 rounded-2xl border-slate-200" padding={false}>
            <div className="px-6 pt-6 pb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">Recent Activity</h3>
                <p className="text-sm text-slate-500">Latest entry logs and events</p>
              </div>
              <Badge variant="blue">{recentEntries.length} entries</Badge>
            </div>
            <div className="overflow-x-auto max-h-80">
              <Table>
                <thead>
                  <Tr>
                    <Th>Attendee</Th>
                    <Th>Gate/Zone</Th>
                    <Th>Status</Th>
                    <Th>Time</Th>
                  </Tr>
                </thead>
                <tbody>
                  {recentEntries.length === 0 ? (
                    <Tr>
                      <Td colSpan={4} className="text-center text-slate-500 py-8">
                        No recent activity
                      </Td>
                    </Tr>
                  ) : (
                    recentEntries.slice(0, 10).map((entry, index) => (
                      <Tr key={entry._id || index}>
                        <Td>
                          <div>
                            <p className="font-medium text-slate-900">{entry.attendee?.fullName || entry.snapshot?.fullName || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{entry.attendee?.categoryName || entry.snapshot?.categoryName || '-'}</p>
                          </div>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <MapPinIcon className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-700">{entry.gateName || entry.zoneName || '-'}</span>
                          </div>
                        </Td>
                        <Td>
                          {entry.accessGranted ? (
                            <Badge variant="green">Allowed</Badge>
                          ) : (
                            <Badge variant="red">Denied</Badge>
                          )}
                        </Td>
                        <Td className="text-sm text-slate-500">
                          {entry.timestamp ? formatTime(entry.timestamp) : '-'}
                        </Td>
                      </Tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default LiveEventDashboard;