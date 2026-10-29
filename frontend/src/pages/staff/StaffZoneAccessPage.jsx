import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from '../../utils/realtime';
import { getSocketUrl } from '../../utils/backend';
import {
  CameraIcon,
  SignalIcon,
  SignalSlashIcon,
  BoltIcon,
  ArrowLeftIcon,
  ChartBarIcon,
  ListBulletIcon,
  DevicePhoneMobileIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QRScannerComponent from '../../components/events/QRScannerComponent';
import ResultCard from '../../components/staff/ResultCard';
import ActivityList from '../../components/staff/ActivityList';
import SearchBar from '../../components/staff/SearchBar';
import { getZoneLogs } from '../../api/zone';
import { getMyEvents } from '../../api/events';
import { scanStaffZone } from '../../api/staff';
import { useAuth } from '../../context/AuthContext';
import {
  getAssignedZones,
  parseScannedValue,
  playFeedbackTone,
  triggerHaptic,
} from './staffUtils';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const StaffZoneAccessPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [zoneName, setZoneName] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [scanMode, setScanMode] = useState('ENTRY');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState({ state: 'idle' });
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [zoneInput, setZoneInput] = useState('');
  const [readerMode, setReaderMode] = useState('qr');
  const rfidInputRef = React.useRef(null);

  const [activeTab, setActiveTab] = useState('scan');
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });
  const [lastScan, setLastScan] = useState(null);

  const currentEvent = useMemo(
    () => events.find((e) => e._id === selectedEventId),
    [events, selectedEventId]
  );
  const rfidEnabled = currentEvent?.settings?.rfidEnabled === true;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem('entrynex:offline-zone-scans')) || []
      );
    } catch {
      return [];
    }
  });

  const getZoneDisplayName = useCallback(
    (zone) => {
      if (!currentEvent || !currentEvent.zones) return zone;
      const found = currentEvent.zones.find(
        (z) => z.id === zone || z.name === zone
      );
      return found ? found.name : zone;
    },
    [currentEvent]
  );

  const assignedZones = useMemo(() => getAssignedZones(user), [user]);
  const zoneLocked = assignedZones.length > 0;

  const availableZones = useMemo(() => {
    const eventZones = currentEvent?.zones || [];
    if (assignedZones.length > 0) {
      const filtered = eventZones.filter((z) =>
        assignedZones.some((az) => az === z.id || az === z.name)
      );
      if (filtered.length > 0) return filtered;
    }
    return eventZones;
  }, [currentEvent, assignedZones]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored. Syncing zone scans...');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Offline mode activated');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      const syncScans = async () => {
        const queueToProcess = [...offlineQueue];
        setOfflineQueue([]);
        localStorage.removeItem('entrynex:offline-zone-scans');

        let successfulSyncCount = 0;
        for (const scan of queueToProcess) {
          try {
            await scanStaffZone({
              ...(scan.method === 'rfid'
                ? { rfidId: scan.rfidId }
                : { qrToken: scan.qrToken }),
              zone: scan.zone,
              eventId: scan.eventId,
              action: scan.action,
              method: scan.method || 'qr',
            });
            successfulSyncCount++;
          } catch (err) {
            console.error('Offline zone sync failure:', err);
          }
        }

        if (successfulSyncCount > 0) {
          toast.success(`Synced ${successfulSyncCount} offline zone scans`);
        }
        refreshLogs();
        fetchStats();
      };

      syncScans();
    }
  }, [isOnline, offlineQueue]);

  useEffect(() => {
    localStorage.setItem(
      'entrynex:offline-zone-scans',
      JSON.stringify(offlineQueue)
    );
  }, [offlineQueue]);

  useEffect(() => {
    getMyEvents().then((response) => {
      const nextEvents = response.data?.data?.events || [];
      setEvents(nextEvents);
      const isValidEvent = nextEvents.some((e) => e._id === selectedEventId);
      const fallbackEventId =
        (isValidEvent ? selectedEventId : nextEvents[0]?._id) || '';
      if (fallbackEventId) {
        setSelectedEventId(fallbackEventId);
        localStorage.setItem('lastSelectedEventId', fallbackEventId);
      }
    });
  }, [selectedEventId]);

  useEffect(() => {
    const handleEventSelect = (event) => {
      setSelectedEventId(event.detail || '');
    };
    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  useEffect(() => {
    if (assignedZones[0]) {
      setZoneName(assignedZones[0]);
      setZoneInput(assignedZones[0]);
    } else if (availableZones[0]) {
      const defaultName = availableZones[0].name || availableZones[0].id;
      setZoneName(defaultName);
      setZoneInput(defaultName);
    } else {
      setZoneName('VIP Zone');
      setZoneInput('VIP Zone');
    }
  }, [assignedZones, availableZones]);

  useEffect(() => {
    if (!selectedEventId) return;
    const nextEvent = events.find((e) => e._id === selectedEventId);
    const nextEventZones = nextEvent?.zones || [];
    if (assignedZones.length > 0) {
      const matched = nextEventZones.find((z) =>
        assignedZones.some((az) => az === z.id || az === z.name)
      );
      if (matched) {
        setZoneName(matched.name || matched.id);
        setZoneInput(matched.name || matched.id);
        return;
      }
    }
    if (nextEventZones.length > 0) {
      const first = nextEventZones[0];
      setZoneName(first.name || first.id);
      setZoneInput(first.name || first.id);
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (readerMode === 'rfid' && activeTab === 'scan')
      rfidInputRef.current?.focus();
  }, [readerMode, activeTab]);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(
      new CustomEvent('entrynex:event-select', { detail: nextId })
    );
  };

  const refreshLogs = useCallback(async () => {
    if (!selectedEventId || !zoneName) return;
    try {
      const response = await getZoneLogs({
        eventId: selectedEventId,
        zone: zoneName,
        limit: 10,
      });
      const nextLogs = (response.data?.data?.logs || []).map((item) => ({
        id: item._id,
        attendeeName: item.attendee?.fullName || item.snapshot?.fullName,
        zoneName: getZoneDisplayName(item.zone),
        action: item.accessGranted
          ? item.action === 'EXIT'
            ? 'Zone Exit processed'
            : 'Zone Entry permitted'
          : item.denialReason || 'Access Denied',
        status: item.accessGranted ? 'success' : 'error',
        timestamp: item.timestamp,
        accessGranted: item.accessGranted,
      }));
      setLogs(nextLogs);
    } catch {
      setLogs([]);
    }
  }, [selectedEventId, zoneName, getZoneDisplayName]);

  const fetchStats = useCallback(async () => {
    if (!selectedEventId || !zoneName) return;
    try {
      const response = await getZoneLogs({
        eventId: selectedEventId,
        zone: zoneName,
        limit: 1,
      });
      const meta = response.data?.data?.meta || {};
      setStats({
        total: meta.totalScanned || 0,
        success: meta.allowedCount || 0,
        failed: meta.deniedCount || 0,
      });
    } catch {
      // fallback
    }
  }, [selectedEventId, zoneName]);

  useEffect(() => {
    refreshLogs();
    fetchStats();
  }, [refreshLogs, fetchStats]);

  useEffect(() => {
    if (!selectedEventId) return;

    const socket = io(getSocketUrl());
    socket.emit('join_event', { eventId: selectedEventId });
    socket.emit('join_dashboard', { eventId: selectedEventId });

    const handleZoneUpdate = (data) => {
      if (
        data.eventId === selectedEventId &&
        String(data.zoneName || '').toLowerCase() ===
          String(zoneName || '').toLowerCase()
      ) {
        if (data.accessGranted) {
          setLastScan({
            action: data.action || 'ZONE ENTRY',
            name: data.name || 'Attendee',
            categoryName: data.categoryName || 'VIP Ticket',
            zoneName: getZoneDisplayName(data.zoneName),
            timestamp: data.timestamp || new Date(),
            processedByName: data.processedByName || 'System',
          });

          setStats((prev) => ({
            total: prev.total + 1,
            success: prev.success + 1,
            failed: prev.failed,
          }));
        } else {
          setStats((prev) => ({
            total: prev.total + 1,
            success: prev.success,
            failed: prev.failed + 1,
          }));
        }
        refreshLogs();
      }
    };

    socket.on('zone_update', handleZoneUpdate);
    return () => {
      socket.off('zone_update', handleZoneUpdate);
      socket.disconnect();
    };
  }, [selectedEventId, zoneName, getZoneDisplayName, refreshLogs]);

  const handleScan = useCallback(
    async (rawToken) => {
      const qrToken = parseScannedValue(rawToken);
      if (!qrToken || !selectedEventId || !zoneName || submitting) return;
      if (readerMode === 'rfid' && !rfidEnabled) {
        toast.error('RFID access is disabled for this event.');
        return;
      }

      if (!isOnline) {
        playFeedbackTone(true);
        triggerHaptic(true);

        const simulatedAttendee = {
          fullName: 'Offline Attendee',
          categoryName: 'VIP Pass',
          checkedIn: true,
          confirmationStatus: 'confirmed',
        };

        setResult({
          state: 'success',
          attendee: simulatedAttendee,
          message:
            scanMode === 'EXIT'
              ? 'Zone Exit permitted (Offline)'
              : 'Zone Entry permitted (Offline)',
          detail:
            'Zone scan saved locally. Will sync automatically when online.',
          meta: [
            { label: 'Zone', value: getZoneDisplayName(zoneName) },
            { label: 'Mode', value: scanMode },
            { label: 'Network', value: 'Offline Cache' },
          ],
        });

        setOfflineQueue((prev) => [
          ...prev,
          {
            ...(readerMode === 'rfid' ? { rfidId: qrToken } : { qrToken }),
            method: readerMode === 'rfid' ? 'rfid' : 'qr',
            zone: zoneName,
            eventId: selectedEventId,
            action: scanMode,
            timestamp: new Date(),
          },
        ]);

        setStats((prev) => ({
          total: prev.total + 1,
          success: prev.success + 1,
          failed: prev.failed,
        }));

        setLastScan({
          action: scanMode === 'EXIT' ? 'ZONE EXIT' : 'ZONE ENTRY',
          name: 'Offline Attendee',
          categoryName: 'VIP Pass',
          zoneName: getZoneDisplayName(zoneName),
          timestamp: new Date(),
          processedByName: user?.name || 'Staff',
        });

        return;
      }

      setSubmitting(true);
      try {
        const response = await scanStaffZone({
          ...(readerMode === 'rfid' ? { rfidId: qrToken } : { qrToken }),
          zone: zoneName,
          eventId: selectedEventId,
          action: scanMode,
          method: readerMode === 'rfid' ? 'rfid' : 'qr',
        });

        const payload = response.data?.data || {};
        const isExit = scanMode === 'EXIT';

        setResult({
          state: payload.accessGranted ? 'success' : 'error',
          attendee: payload.attendee,
          message: payload.accessGranted
            ? isExit
              ? 'Zone Exit permitted'
              : 'Zone Entry permitted'
            : isExit
            ? 'Zone Exit Denied'
            : 'Zone Access Denied',
          detail: payload.accessGranted
            ? isExit
              ? 'Attendee exited zone successfully.'
              : 'Attendee permitted to enter zone.'
            : payload.denialReason || 'Zone validation failed.',
          meta: [
            { label: 'Zone', value: getZoneDisplayName(zoneName) },
            { label: 'Mode', value: scanMode },
            {
              label: 'Ticket Category',
              value: payload.attendee?.categoryName,
            },
          ],
        });

        if (payload.accessGranted) {
          setLastScan({
            action: isExit ? 'ZONE EXIT' : 'ZONE ENTRY',
            name: payload.attendee?.fullName || 'Attendee',
            categoryName:
              payload.attendee?.categoryName || 'Standard Ticket',
            zoneName: getZoneDisplayName(zoneName),
            timestamp: new Date(),
            processedByName: user?.name || 'Staff',
          });
        }

        playFeedbackTone(payload.accessGranted);
        triggerHaptic(payload.accessGranted);
        setManualToken('');
        refreshLogs();
        fetchStats();
      } catch (error) {
        const data = error?.response?.data || {};
        const detailMsg = data.message || 'Zone permission validation failed.';

        setResult({
          state: 'error',
          attendee: data.data?.attendee || null,
          message: 'Access Denied',
          detail: detailMsg,
          meta: [
            { label: 'Zone', value: getZoneDisplayName(zoneName) },
            { label: 'Mode', value: scanMode },
            { label: 'Reason', value: detailMsg },
          ],
        });

        playFeedbackTone(false);
        triggerHaptic(false);
        refreshLogs();
        fetchStats();
      } finally {
        setSubmitting(false);
      }
    },
    [
      zoneName,
      selectedEventId,
      submitting,
      scanMode,
      readerMode,
      isOnline,
      user,
      fetchStats,
      refreshLogs,
      getZoneDisplayName,
      rfidEnabled,
    ]
  );

  const tabItems = [
    { id: 'scan', label: 'Scanner', icon: CameraIcon },
    { id: 'manual', label: 'Manual', icon: DevicePhoneMobileIcon },
    { id: 'stats', label: 'Stats', icon: ChartBarIcon },
    { id: 'logs', label: 'Logs', icon: ListBulletIcon },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl space-y-3 px-3 pb-24 sm:space-y-5 sm:px-6">
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

          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold ${
              isOnline
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'animate-pulse border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {isOnline ? (
              <SignalIcon className="h-3.5 w-3.5" />
            ) : (
              <SignalSlashIcon className="h-3.5 w-3.5" />
            )}
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-sm sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-teal-500 ring-4 ring-teal-500/20" />
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Zone Access
            </p>
          </div>

          <h1 className="mt-1.5 sm:mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-3xl leading-tight">
            Zone Terminal
          </h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500">
            Active zone:{' '}
            <span className="font-semibold text-slate-800">
              {getZoneDisplayName(zoneName)}
            </span>
          </p>
        </div>

        {/* Last Scan Card */}
        {lastScan ? (
          <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  lastScan.action === 'ZONE EXIT'
                    ? 'bg-teal-50 text-teal-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                Last{' '}
                {lastScan.action === 'ZONE EXIT' ? 'Exit' : 'Entry'}
              </span>
              <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                {new Date(lastScan.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:gap-4">
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Attendee
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                  {lastScan.name}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Ticket Type
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-600">
                  {lastScan.categoryName}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Zone
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-teal-600">
                  {lastScan.zoneName}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Staff
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-600">
                  {lastScan.processedByName || 'System'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-5 sm:py-6 text-center">
            <p className="text-xs font-medium text-slate-400">
              No successful scans yet
            </p>
          </div>
        )}

        {/* Tabs */}
        <nav className="flex gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-sm">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setResult({ state: 'idle' });
                  setLogsPage(1);
                }}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-3 sm:py-3.5 text-[10px] font-semibold uppercase tracking-wider transition touch-manipulation sm:flex-row sm:gap-1.5 sm:text-xs ${
                  active
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-500 active:bg-slate-50 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ===================== TAB CONTENT ===================== */}
        <div className="space-y-3 sm:space-y-5">
          {/* SCANNER TAB */}
          {activeTab === 'scan' && (
            <div className="space-y-3 sm:space-y-5">
              {/* Entry / Exit toggle */}
              <div className="flex gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setScanMode('ENTRY')}
                  className={`flex-1 rounded-xl py-3.5 sm:py-3 text-xs font-semibold uppercase tracking-wider transition touch-manipulation ${
                    scanMode === 'ENTRY'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-500 active:bg-teal-50 hover:bg-teal-50 hover:text-teal-700'
                  }`}
                >
                  Entry
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('EXIT')}
                  className={`flex-1 rounded-xl py-3.5 sm:py-3 text-xs font-semibold uppercase tracking-wider transition touch-manipulation ${
                    scanMode === 'EXIT'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-500 active:bg-teal-50 hover:bg-teal-50 hover:text-teal-700'
                  }`}
                >
                  Exit
                </button>
              </div>

              {/* QR / RFID toggle */}
              <div className="flex gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setReaderMode('qr')}
                  className={`flex-1 rounded-xl py-3.5 sm:py-3 text-xs font-semibold transition touch-manipulation ${
                    readerMode === 'qr'
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-500 active:bg-slate-50'
                  }`}
                >
                  QR Camera
                </button>
                {rfidEnabled && (
                  <button
                    type="button"
                    onClick={() => setReaderMode('rfid')}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-3.5 sm:py-3 text-xs font-semibold transition touch-manipulation ${
                      readerMode === 'rfid'
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-500 active:bg-slate-50'
                    }`}
                  >
                    <IdentificationIcon className="h-4 w-4" />
                    RFID
                  </button>
                )}
              </div>

              {readerMode === 'qr' ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-900 shadow-sm">
                  <div className="aspect-[4/3] w-full sm:aspect-video">
                    <QRScannerComponent
                      onScanSuccess={handleScan}
                      onScanError={() => {}}
                      fps={12}
                      qrbox={260}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-teal-200 bg-teal-50 p-5 sm:p-8 text-center">
                  <IdentificationIcon className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-teal-600" />
                  <p className="mt-2.5 sm:mt-3 text-base sm:text-lg font-bold text-slate-900">
                    RFID Reader Ready
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-snug">
                    Tap a card to submit zone access automatically.
                  </p>
                  <input
                    ref={rfidInputRef}
                    value={manualToken}
                    onChange={(e) =>
                      setManualToken(
                        e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleScan(manualToken);
                      }
                    }}
                    autoFocus
                    maxLength={64}
                    inputMode="text"
                    placeholder="Waiting for card..."
                    className="mt-4 sm:mt-5 w-full rounded-xl border border-teal-300 bg-white px-3 py-3.5 sm:px-4 sm:py-4 text-center font-mono text-lg sm:text-xl tracking-[0.25em] outline-none focus:ring-2 focus:ring-teal-500 touch-manipulation"
                  />
                  <p className="mt-2.5 sm:mt-3 text-[11px] sm:text-xs font-semibold text-teal-700">
                    Reader focused and waiting
                  </p>
                </div>
              )}

              {result.state !== 'idle' && (
                <ResultCard
                  state={result.state}
                  attendee={result.attendee}
                  message={result.message}
                  detail={result.detail}
                  meta={result.meta}
                />
              )}
            </div>
          )}

          {/* MANUAL TAB */}
          {activeTab === 'manual' && (
            <div className="space-y-3 sm:space-y-5 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Manual Zone Permission
                </h2>
                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500 leading-snug">
                  Type or paste the QR token. Camera is paused to save battery.
                </p>
              </div>

              <div className="flex gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setScanMode('ENTRY')}
                  className={`flex-1 rounded-xl py-3.5 sm:py-3 text-xs font-semibold uppercase tracking-wider transition touch-manipulation ${
                    scanMode === 'ENTRY'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-500 active:bg-teal-50 hover:bg-teal-50 hover:text-teal-700'
                  }`}
                >
                  Entry
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('EXIT')}
                  className={`flex-1 rounded-xl py-3.5 sm:py-3 text-xs font-semibold uppercase tracking-wider transition touch-manipulation ${
                    scanMode === 'EXIT'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-500 active:bg-teal-50 hover:bg-teal-50 hover:text-teal-700'
                  }`}
                >
                  Exit
                </button>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <SearchBar
                  value={manualToken}
                  onChange={setManualToken}
                  placeholder="Paste / type QR token here..."
                  autoFocus
                />

                <button
                  type="button"
                  disabled={!manualToken.trim() || submitting}
                  onClick={() => handleScan(manualToken)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-xs font-semibold uppercase tracking-wider text-white transition active:bg-teal-700 hover:bg-teal-700 disabled:opacity-40 touch-manipulation"
                >
                  <BoltIcon className="h-5 w-5" />
                  {submitting ? 'Validating...' : 'Verify Zone Token'}
                </button>
              </div>

              {result.state !== 'idle' && (
                <div className="border-t border-slate-100 pt-4 sm:pt-5">
                  <ResultCard
                    state={result.state}
                    attendee={result.attendee}
                    message={result.message}
                    detail={result.detail}
                    meta={result.meta}
                  />
                </div>
              )}
            </div>
          )}

          {/* STATS TAB */}
          {activeTab === 'stats' && (
            <div className="space-y-3 sm:space-y-5">
              <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Active Zone Setup
                </h2>
                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500">
                  Configure zone parameters
                </p>

                <div className="mt-4 sm:mt-5 grid gap-3 sm:gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Select Event
                    </label>
                    <select
                      value={selectedEventId}
                      onChange={(e) => handleEventChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 sm:px-4 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white touch-manipulation"
                    >
                      {events.map((event) => (
                        <option key={event._id} value={event._id}>
                          {event.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Select Zone
                    </label>
                    {availableZones.length > 1 ? (
                      <select
                        value={zoneName}
                        onChange={(e) => setZoneName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 sm:px-4 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white touch-manipulation"
                      >
                        {availableZones.map((zone) => (
                          <option
                            key={zone.id || zone.name}
                            value={zone.name || zone.id}
                          >
                            {zone.name || zone.id}
                          </option>
                        ))}
                      </select>
                    ) : availableZones.length === 1 && zoneLocked ? (
                      <div className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 sm:px-4 text-sm font-medium text-slate-700">
                        {getZoneDisplayName(zoneName)}
                      </div>
                    ) : availableZones.length === 1 ? (
                      <select
                        value={zoneName}
                        onChange={(e) => setZoneName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 sm:px-4 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white touch-manipulation"
                      >
                        {availableZones.map((zone) => (
                          <option
                            key={zone.id || zone.name}
                            value={zone.name || zone.id}
                          >
                            {zone.name || zone.id}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={zoneInput}
                        onChange={(e) => setZoneInput(e.target.value)}
                        onBlur={() => setZoneName(zoneInput)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setZoneName(zoneInput);
                        }}
                        placeholder="Zone name"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 sm:px-4 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white touch-manipulation"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Today’s Zone Metrics
                </h2>

                <div className="mt-4 sm:mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="rounded-2xl border border-slate-200/70 bg-white px-3 py-3.5 sm:px-5 sm:py-5 shadow-sm">
                    <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Scans
                    </p>
                    <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold tracking-tight text-teal-600 tabular-nums">
                      {stats.total}
                    </p>
                    <p className="mt-0.5 sm:mt-1 text-[9px] sm:text-xs text-slate-500">
                      Total
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white px-3 py-3.5 sm:px-5 sm:py-5 shadow-sm">
                    <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Allowed
                    </p>
                    <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold tracking-tight text-emerald-600 tabular-nums">
                      {stats.success}
                    </p>
                    <p className="mt-0.5 sm:mt-1 text-[9px] sm:text-xs text-slate-500">
                      OK
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white px-3 py-3.5 sm:px-5 sm:py-5 shadow-sm">
                    <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Denied
                    </p>
                    <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold tracking-tight text-rose-600 tabular-nums">
                      {stats.failed}
                    </p>
                    <p className="mt-0.5 sm:mt-1 text-[9px] sm:text-xs text-slate-500">
                      Blocked
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LOGS TAB */}
          {activeTab === 'logs' &&
            (() => {
              const pageSize = 10;
              const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
              const pagedLogs = logs.slice(
                (logsPage - 1) * pageSize,
                logsPage * pageSize
              );

              return (
                <div className="space-y-3 sm:space-y-4">
                  <ActivityList
                    title={`Zone Scans (Page ${logsPage})`}
                    items={pagedLogs}
                    emptyMessage="No zone scanning history today."
                  />

                  {logs.length > 0 && (
                    <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-sm sm:flex-row sm:px-5 sm:py-4">
                      <p className="text-xs font-medium text-slate-500 order-2 sm:order-1">
                        Showing{' '}
                        {logs.length === 0
                          ? 0
                          : (logsPage - 1) * pageSize + 1}
                        –{Math.min(logsPage * pageSize, logs.length)} of{' '}
                        {logs.length}
                      </p>

                      <div className="flex items-center gap-2 order-1 sm:order-2">
                        <button
                          type="button"
                          disabled={logsPage <= 1}
                          onClick={() =>
                            setLogsPage((c) => Math.max(1, c - 1))
                          }
                          className="min-h-[44px] min-w-[64px] rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition active:bg-slate-100 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                        >
                          Prev
                        </button>
                        <div className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-700 tabular-nums">
                          {logsPage} / {totalPages}
                        </div>
                        <button
                          type="button"
                          disabled={logsPage >= totalPages}
                          onClick={() =>
                            setLogsPage((c) => Math.min(totalPages, c + 1))
                          }
                          className="min-h-[44px] min-w-[64px] rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition active:bg-slate-100 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffZoneAccessPage;