import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from '../../utils/realtime';
import { getSocketUrl } from '../../utils/backend';
import {
  BoltIcon,
  CameraIcon,
  CheckCircleIcon,
  DevicePhoneMobileIcon,
  ArrowLeftIcon,
  ChartBarIcon,
  ListBulletIcon,
  SignalIcon,
  SignalSlashIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QRScannerComponent from '../../components/events/QRScannerComponent';
import ResultCard from '../../components/staff/ResultCard';
import ActivityList from '../../components/staff/ActivityList';
import SearchBar from '../../components/staff/SearchBar';
import { checkInAttendee, getEntryLogs, getEntryStats } from '../../api/entry';
import { getMyEvents } from '../../api/events';
import { scanStaffEntry } from '../../api/staff';
import { assignRfidToAttendee } from '../../api/rfid';
import { useAuth } from '../../context/AuthContext';
import { playFeedbackTone, triggerHaptic, parseScannedValue } from './staffUtils';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const normalizeEntryError = (error) => {
  const data = error?.response?.data || {};
  const reason = data.reason;
  const messageMap = {
    NOT_FOUND: 'Invalid ticket',
    ALREADY_CHECKED_IN: 'Already used',
    NOT_CHECKED_IN: 'Not currently inside',
    NOT_CONFIRMED: 'Not confirmed',
    DEACTIVATED: 'Invalid ticket',
  };

  return {
    accessGranted: false,
    attendee: data.data?.attendee || null,
    detail: messageMap[reason] || data.message || 'Entry validation failed',
    reason: reason || 'DENIED',
    suggestCheckOut: data.data?.suggestCheckOut || false,
  };
};

const StaffScanPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [gateName, setGateName] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [scanMode, setScanMode] = useState('check_in');
  const [readerMode, setReaderMode] = useState('qr');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState({ state: 'idle' });
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const rfidInputRef = React.useRef(null);

  const [activeTab, setActiveTab] = useState('scan');
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });
  const [lastScan, setLastScan] = useState(null);
  const [lastQrToken, setLastQrToken] = useState('');
  const [assignmentTag, setAssignmentTag] = useState('');
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const currentEvent = useMemo(
    () => events.find((event) => event._id === selectedEventId),
    [events, selectedEventId]
  );
  const rfidEnabled = currentEvent?.settings?.rfidEnabled === true;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('entrynex:offline-scans')) || [];
    } catch {
      return [];
    }
  });

  const availableGates = useMemo(
    () => (user?.assignedGates || []).filter(Boolean),
    [user]
  );
  const gateLocked = availableGates.length > 0;

  // Get event-specific gates intersected with assigned gates, or fallback to event gates or default
  const eventGates = useMemo(() => {
    const eventGatesList = currentEvent?.gates || [];
    
    // If user has assigned gates, show only the intersection with event gates
    if (gateLocked && availableGates.length > 0) {
      if (eventGatesList.length > 0) {
        // Return only gates that are both assigned to user AND exist in the event
        const intersection = availableGates.filter(gate => 
          eventGatesList.includes(gate)
        );
        // If intersection is empty, show event gates (user's assigned gates don't match this event)
        return intersection.length > 0 ? intersection : eventGatesList;
      }
      // If event has no gates configured, use assigned gates
      return availableGates;
    }
    
    // If user has no assigned gates, use event-specific gates
    if (eventGatesList.length > 0) {
      return eventGatesList;
    }
    
    // Fallback to default gates
    return ['Gate A', 'Gate B', 'Gate C', 'VIP Entry'];
  }, [currentEvent, availableGates, gateLocked]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored. Syncing pending scans...');
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
        localStorage.removeItem('entrynex:offline-scans');

        let successfulSyncCount = 0;
        for (const scan of queueToProcess) {
          try {
            await scanStaffEntry({
              ...(scan.method === 'rfid'
                ? { rfidId: scan.rfidId }
                : { qrToken: scan.qrToken }),
              gateId: scan.gateId,
              gateName: scan.gateName,
              eventId: scan.eventId,
              action: scan.action,
              method: scan.method || 'manual',
            });
            successfulSyncCount++;
          } catch (err) {
            console.error('Offline scan sync failure:', err);
          }
        }

        if (successfulSyncCount > 0) {
          toast.success(`Synced ${successfulSyncCount} offline scans`);
        }
        refreshLogs();
        fetchStats();
      };

      syncScans();
    }
  }, [isOnline, offlineQueue]);

  useEffect(() => {
    localStorage.setItem(
      'entrynex:offline-scans',
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
    // Reset gate to first available gate when event changes
    if (eventGates.length > 0) {
      setGateName(eventGates[0]);
    } else {
      setGateName('Main Gate');
    }
  }, [selectedEventId, eventGates]);

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
    if (!selectedEventId) return;
    try {
      const response = await getEntryLogs({
        eventId: selectedEventId,
        gateId: gateName,
        limit: 10,
      });
      const nextLogs = (response.data?.data?.logs || []).map((item) => ({
        id: item._id,
        attendeeName: item.attendee?.fullName || item.snapshot?.fullName,
        zoneName: item.gateName || item.zoneName,
        action: item.accessGranted
          ? item.action === 'check_out'
            ? 'Exit processed'
            : 'Access granted'
          : item.denialReason || 'Denied',
        status: item.accessGranted ? 'success' : 'error',
        timestamp: item.timestamp,
        accessGranted: item.accessGranted,
      }));
      setLogs(nextLogs);
    } catch {
      setLogs([]);
    }
  }, [selectedEventId, gateName]);

  const fetchStats = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const response = await getEntryStats({
        eventId: selectedEventId,
        gateId: gateName,
      });
      const data = response.data?.data?.today || {};
      setStats({
        total: data.totalScanned || 0,
        success: data.successfulEntries || 0,
        failed: data.deniedEntries || 0,
      });
    } catch (err) {
      console.warn('Failed to load today stats:', err);
    }
  }, [selectedEventId, gateName]);

  useEffect(() => {
    refreshLogs();
    fetchStats();
  }, [refreshLogs, fetchStats]);

  useEffect(() => {
    if (!selectedEventId) return;

    const socket = io(getSocketUrl());
    socket.emit('join_event', { eventId: selectedEventId });
    socket.emit('join_dashboard', { eventId: selectedEventId });

    const handleRealtimeUpdate = (data) => {
      if (data.eventId === selectedEventId) {
        if (data.accessGranted) {
          setLastScan({
            action: data.action || 'CHECK-IN',
            name: data.name || 'Attendee',
            categoryName: data.categoryName || 'General Entry',
            zoneName: data.zoneName || 'Main Gate',
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

    socket.on('entry_update', handleRealtimeUpdate);
    socket.on('zone_update', handleRealtimeUpdate);

    return () => {
      socket.off('entry_update', handleRealtimeUpdate);
      socket.off('zone_update', handleRealtimeUpdate);
      socket.disconnect();
    };
  }, [selectedEventId, refreshLogs]);

  const handleScan = useCallback(
    async (rawToken, method = 'qr') => {
      const qrToken = parseScannedValue(rawToken);
      if (!qrToken || !selectedEventId || !gateName || scanning) return;
      if (method === 'rfid' && !rfidEnabled) {
        toast.error('RFID access is disabled for this event.');
        return;
      }
      if (method === 'qr') setLastQrToken(qrToken);

      if (!isOnline) {
        playFeedbackTone(true);
        triggerHaptic(true);

        const simulatedAttendee = {
          fullName: 'Offline Attendee',
          categoryName: 'Standard Ticket',
          checkedIn: scanMode === 'check_in',
          confirmationStatus: 'confirmed',
        };

        setResult({
          state: 'success',
          attendee: simulatedAttendee,
          message:
            scanMode === 'check_out'
              ? 'Exit Recorded (Offline)'
              : 'Access Granted (Offline)',
          detail:
            'Ticket saved locally. Will sync automatically when online.',
          meta: [
            { label: 'Gate', value: gateName },
            {
              label: 'Mode',
              value: scanMode === 'check_out' ? 'Exit' : 'Entry',
            },
            { label: 'Network', value: 'Offline Cache' },
          ],
        });

        setOfflineQueue((prev) => [
          ...prev,
          {
            ...(method === 'rfid' ? { rfidId: qrToken } : { qrToken }),
            method,
            gateId: gateName,
            gateName,
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
          action: scanMode === 'check_out' ? 'CHECK-OUT' : 'CHECK-IN',
          name: 'Offline Attendee',
          categoryName: 'Standard Ticket',
          zoneName: gateName,
          timestamp: new Date(),
          processedByName: user?.name || 'Staff',
        });

        return;
      }

      setScanning(true);
      try {
        const response = await scanStaffEntry({
          ...(method === 'rfid' ? { rfidId: qrToken } : { qrToken }),
          gateId: gateName,
          gateName,
          eventId: selectedEventId,
          action: scanMode,
          method,
        });

        const payload = response.data?.data || {};
        const isExit = scanMode === 'check_out';

        setResult({
          state: payload.accessGranted ? 'success' : 'error',
          attendee: payload.attendee,
          message: payload.accessGranted
            ? isExit
              ? 'Exit Recorded'
              : 'Access Granted'
            : isExit
            ? 'Exit Denied'
            : 'Access Denied',
          detail: payload.accessGranted
            ? isExit
              ? 'Attendee checked out successfully.'
              : 'Ticket validated successfully.'
            : payload.denialReason || 'Ticket validation failed',
          meta: [
            { label: 'Gate', value: gateName },
            { label: 'Mode', value: isExit ? 'Exit' : 'Entry' },
            {
              label: 'Ticket Category',
              value: payload.attendee?.categoryName,
            },
          ],
        });

        if (payload.accessGranted) {
          setLastScan({
            action: isExit ? 'CHECK-OUT' : 'CHECK-IN',
            name: payload.attendee?.fullName || 'Attendee',
            categoryName:
              payload.attendee?.categoryName || 'Standard Ticket',
            zoneName: gateName,
            timestamp: new Date(),
            processedByName: user?.name || 'Staff',
          });
        }

        playFeedbackTone(true);
        triggerHaptic(true);
        setManualToken('');
        refreshLogs();
        fetchStats();
      } catch (error) {
        const denied = normalizeEntryError(error);

        if (denied.reason === 'ALREADY_CHECKED_IN' && denied.suggestCheckOut) {
          setScanMode('check_out');
          toast((t) => (
            <span className="flex items-center gap-2">
              <span className="text-amber-600">Already checked in</span>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-xs text-teal-600 underline"
              >
                Switched to Exit mode
              </button>
            </span>
          ));
        }

        setResult({
          state: 'error',
          attendee: denied.attendee,
          message: 'Access Denied',
          detail: denied.detail,
          meta: [
            { label: 'Gate', value: gateName },
            {
              label: 'Mode',
              value: scanMode === 'check_out' ? 'Exit' : 'Entry',
            },
            { label: 'Reason', value: denied.detail },
          ],
          suggestCheckOut: denied.suggestCheckOut,
        });
        playFeedbackTone(false);
        triggerHaptic(false);
        refreshLogs();
        fetchStats();
      } finally {
        setScanning(false);
      }
    },
    [
      selectedEventId,
      gateName,
      scanMode,
      scanning,
      refreshLogs,
      fetchStats,
      isOnline,
      user,
      rfidEnabled,
    ]
  );

  const assignScannedRfid = async (event) => {
    event.preventDefault();
    if (!lastQrToken || !/^[a-zA-Z0-9_-]{1,64}$/.test(assignmentTag)) return;
    setAssignmentSaving(true);
    try {
      const response = await assignRfidToAttendee(lastQrToken, assignmentTag);
      setResult((current) => ({
        ...current,
        attendee: {
          ...current.attendee,
          rfidTag: response.data?.data?.tag?.rfidTag || assignmentTag,
        },
        message: 'RFID Assigned Successfully',
        detail: 'This attendee can now use QR or RFID for access.',
      }));
      setAssignmentTag('');
      toast.success('RFID assigned successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'RFID assignment failed');
    } finally {
      setAssignmentSaving(false);
    }
  };

  const handleManualCheckIn = useCallback(async () => {
    if (!result?.attendee?._id || result.state !== 'error') return;

    try {
      await checkInAttendee({
        attendeeId: result.attendee._id,
        gateId: gateName,
        gateName,
        method: 'manual',
      });
      toast.success('Manual check-in completed.');
      setResult((current) => ({
        ...current,
        state: 'success',
        message: 'Access Granted',
        detail: 'Manual check-in completed successfully.',
      }));
      setLastScan({
        action: 'CHECK-IN',
        name: result.attendee?.fullName || 'Attendee',
        categoryName: result.attendee?.categoryName || 'Standard Ticket',
        zoneName: gateName,
        timestamp: new Date(),
        processedByName: user?.name || 'Staff',
      });
      refreshLogs();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Manual check-in failed.');
    }
  }, [result, gateName, refreshLogs, fetchStats, user]);

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
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Gate Scanner
            </p>
          </div>

          <h1 className="mt-1.5 sm:mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-3xl leading-tight">
            Entry Terminal
          </h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500">
            Station:{' '}
            <span className="font-semibold text-slate-800">{gateName}</span>
          </p>
        </div>

        {/* Last Scan Card */}
        {lastScan ? (
          <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  lastScan.action === 'CHECK-OUT'
                    ? 'bg-teal-50 text-teal-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                Last{' '}
                {lastScan.action === 'CHECK-OUT' ? 'Check-Out' : 'Check-In'}
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
                  Location
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

        {/* Tabs — larger touch targets */}
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
                  onClick={() => setScanMode('check_in')}
                  className={`flex-1 rounded-xl py-3.5 sm:py-3 text-xs font-semibold uppercase tracking-wider transition touch-manipulation ${
                    scanMode === 'check_in'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-500 active:bg-teal-50 hover:bg-teal-50 hover:text-teal-700'
                  }`}
                >
                  Entry
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('check_out')}
                  className={`flex-1 rounded-xl py-3.5 sm:py-3 text-xs font-semibold uppercase tracking-wider transition touch-manipulation ${
                    scanMode === 'check_out'
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
                      onScanSuccess={(value) => handleScan(value, 'qr')}
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
                    Tap a card. The reader value is submitted on Enter.
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
                        handleScan(manualToken, 'rfid');
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

              {/* Result */}
              {result.state !== 'idle' && (
                <ResultCard
                  state={result.state}
                  attendee={result.attendee}
                  message={result.message}
                  detail={result.detail}
                  meta={result.meta}
                  actions={
                    result.state === 'success' &&
                    rfidEnabled &&
                    result.attendee &&
                    !result.attendee.rfidTag &&
                    lastQrToken ? (
                      <form
                        onSubmit={assignScannedRfid}
                        className="space-y-2 rounded-xl border border-teal-100 bg-teal-50 p-3 text-left"
                      >
                        <p className="text-xs font-semibold text-teal-800">
                          No RFID tag yet. Scan a tag to assign it.
                        </p>
                        <input
                          value={assignmentTag}
                          onChange={(event) =>
                            setAssignmentTag(
                              event.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter')
                              assignScannedRfid(event);
                          }}
                          maxLength={64}
                          inputMode="text"
                          placeholder="Waiting for RFID scan..."
                          className="w-full rounded-lg border border-teal-200 px-3 py-2.5 font-mono text-sm touch-manipulation"
                        />
                        <button
                          type="submit"
                          disabled={
                            assignmentSaving || !(/^[a-zA-Z0-9_-]{1,64}$/.test(assignmentTag))
                          }
                          className="w-full rounded-lg bg-teal-600 py-2.5 text-xs font-semibold text-white disabled:opacity-50 touch-manipulation"
                        >
                          {assignmentSaving ? 'Assigning...' : 'Assign RFID'}
                        </button>
                      </form>
                    ) : result.state === 'error' && result.attendee ? (
                      <button
                        type="button"
                        onClick={handleManualCheckIn}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-xs font-semibold uppercase tracking-wider text-white transition active:bg-slate-800 hover:bg-slate-800 touch-manipulation"
                      >
                        <CheckCircleIcon className="h-5 w-5" />
                        Override Manual Entry
                      </button>
                    ) : null
                  }
                />
              )}
            </div>
          )}

          {/* MANUAL TAB */}
          {activeTab === 'manual' && (
            <div className="space-y-3 sm:space-y-5 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Manual Entry Validation
                </h2>
                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500 leading-snug">
                  Type or paste the QR token. Camera is paused to save battery.
                </p>
              </div>

              <div className="flex gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setScanMode('check_in')}
                  className={`flex-1 rounded-xl py-3.5 sm:py-3 text-xs font-semibold uppercase tracking-wider transition touch-manipulation ${
                    scanMode === 'check_in'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-500 active:bg-teal-50 hover:bg-teal-50 hover:text-teal-700'
                  }`}
                >
                  Entry
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('check_out')}
                  className={`flex-1 rounded-xl py-3.5 sm:py-3 text-xs font-semibold uppercase tracking-wider transition touch-manipulation ${
                    scanMode === 'check_out'
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
                  disabled={!manualToken.trim() || scanning}
                  onClick={() => handleScan(manualToken, 'manual')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-xs font-semibold uppercase tracking-wider text-white transition active:bg-teal-700 hover:bg-teal-700 disabled:opacity-40 touch-manipulation"
                >
                  <BoltIcon className="h-5 w-5" />
                  {scanning ? 'Validating...' : 'Verify Token'}
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
                    actions={
                      result.state === 'error' && result.attendee ? (
                        <div className="space-y-2">
                          {result.suggestCheckOut ? (
                            <button
                              type="button"
                              onClick={() => {
                                setScanMode('check_out');
                                setResult((prev) => ({
                                  ...prev,
                                  state: 'idle',
                                }));
                              }}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-xs font-semibold uppercase tracking-wider text-white transition active:bg-teal-700 hover:bg-teal-700 touch-manipulation"
                            >
                              <ArrowLeftIcon className="h-5 w-5" />
                              Switch to Exit Mode
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleManualCheckIn}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-xs font-semibold uppercase tracking-wider text-white transition active:bg-slate-800 hover:bg-slate-800 touch-manipulation"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                              Override Manual Entry
                            </button>
                          )}
                        </div>
                      ) : null
                    }
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
                  Active Gate Setup
                </h2>
                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500">
                  Configure scanner parameters
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
                      Select Gate
                    </label>
                    {gateLocked ? (
                      eventGates.length > 1 ? (
                        <select
                          value={gateName}
                          onChange={(e) => setGateName(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 sm:px-4 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white touch-manipulation"
                        >
                          {eventGates.map((gate) => (
                            <option key={gate} value={gate}>
                              {gate}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 sm:px-4 text-sm font-medium text-slate-700">
                          {gateName}
                        </div>
                      )
                    ) : (
                      <select
                        value={gateName}
                        onChange={(e) => setGateName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 sm:px-4 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white touch-manipulation"
                      >
                        {eventGates.map((gate) => (
                          <option key={gate} value={gate}>
                            {gate}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-6">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Today’s Scanner Metrics
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
                      Valid
                    </p>
                    <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold tracking-tight text-emerald-600 tabular-nums">
                      {stats.success}
                    </p>
                    <p className="mt-0.5 sm:mt-1 text-[9px] sm:text-xs text-slate-500">
                      Allowed
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
                    title={`Gate Scans (Page ${logsPage})`}
                    items={pagedLogs}
                    emptyMessage="No scanning history today."
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

export default StaffScanPage;