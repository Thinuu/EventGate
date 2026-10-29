import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
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
import { scanSubEntry, assignSubRfid } from '../../api/sub';
import { useAuth } from '../../context/AuthContext';
import { playFeedbackTone, triggerHaptic, parseScannedValue } from './suborgUtils';
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

const SubOrgEntryScannerPage = () => {
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
  const rfidInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('scan');
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });
  const [lastScan, setLastScan] = useState(null);
  const [lastQrToken, setLastQrToken] = useState('');
  const [assignmentTag, setAssignmentTag] = useState('');
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const currentEvent = useMemo(() => events.find((event) => event._id === selectedEventId), [events, selectedEventId]);
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

  // Focus RFID input when mode changes
  useEffect(() => {
    if (readerMode === 'rfid' && activeTab === 'scan') rfidInputRef.current?.focus();
  }, [readerMode, activeTab]);

  useEffect(() => {
    // Reset gate to first available gate when event changes
    if (eventGates.length > 0) {
      setGateName(eventGates[0]);
    } else {
      setGateName('Main Gate');
    }
  }, [selectedEventId, eventGates]);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(new CustomEvent('entrynex:event-select', { detail: nextId }));
  };

  const refreshLogs = useCallback(async () => {
    if (!selectedEventId || !gateName) return;
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
    if (!selectedEventId || !gateName) return;
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

  // Socket.IO
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
            zoneName: data.zoneName || gateName,
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
  }, [selectedEventId, refreshLogs, gateName]);

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
          detail: 'Ticket saved locally. Will sync automatically when online.',
          meta: [
            { label: 'Gate', value: gateName },
            { label: 'Mode', value: scanMode === 'check_out' ? 'Exit' : 'Entry' },
            { label: 'Network', value: 'Offline Cache' },
          ],
        });

        setOfflineQueue((prev) => [
          ...prev,
          {
            ...(method === 'rfid' ? { rfidId: qrToken } : { qrToken }),
            method,
            gateId: gateName,
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
          processedByName: user?.name || 'Sub-Organiser',
        });

        return;
      }

      setScanning(true);
      try {
        const payload = {
          gateId: gateName,
          eventId: selectedEventId,
          action: scanMode, // check_in | check_out
        };
        if (method === 'rfid') payload.rfidId = qrToken;
        else payload.qrToken = qrToken;

        const response = await scanSubEntry(payload);
        const data = response.data?.data || {};
        const isExit = scanMode === 'check_out';

        setResult({
          state: data.accessGranted ? 'success' : 'error',
          attendee: data.attendee,
          message: data.accessGranted
            ? isExit
              ? 'Exit Recorded'
              : 'Access Granted'
            : isExit
            ? 'Exit Denied'
            : 'Access Denied',
          detail: data.accessGranted
            ? isExit
              ? 'Attendee checked out successfully.'
              : 'Ticket validated successfully.'
            : data.denialReason || 'Ticket validation failed',
          meta: [
            { label: 'Gate', value: gateName },
            { label: 'Mode', value: isExit ? 'Exit' : 'Entry' },
            { label: 'Ticket Category', value: data.attendee?.categoryName },
          ],
        });

        if (data.accessGranted) {
          setLastScan({
            action: isExit ? 'CHECK-OUT' : 'CHECK-IN',
            name: data.attendee?.fullName || 'Attendee',
            categoryName: data.attendee?.categoryName || 'Standard Ticket',
            zoneName: gateName,
            timestamp: new Date(),
            processedByName: user?.name || 'Sub-Organiser',
          });

          // Auto-toggle action after success
          setScanMode(isExit ? 'check_in' : 'check_out');
        }

        playFeedbackTone(true);
        triggerHaptic(true);
        setManualToken('');
        refreshLogs();
        fetchStats();
      } catch (error) {
        const denied = normalizeEntryError(error);

        // Auto-switch to exit mode if already checked in
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
            { label: 'Mode', value: scanMode === 'check_out' ? 'Exit' : 'Entry' },
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
    [selectedEventId, gateName, scanMode, scanning, refreshLogs, fetchStats, isOnline, user, rfidEnabled]
  );

  const assignScannedRfid = async (event) => {
    event.preventDefault();
    if (!lastQrToken || !/^[a-zA-Z0-9_-]{1,64}$/.test(assignmentTag)) return;
    setAssignmentSaving(true);
    try {
      const response = await assignSubRfid(result.attendee._id, {
        rfidTag: assignmentTag,
        eventId: selectedEventId,
      });
      setResult((current) => ({ ...current, attendee: { ...current.attendee, rfidTag: response.data?.data?.attendee?.rfidTag || assignmentTag }, message: 'RFID Assigned Successfully', detail: 'This attendee can now use QR or RFID for access.' }));
      setAssignmentTag('');
      toast.success('RFID assigned successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'RFID assignment failed');
    } finally { setAssignmentSaving(false); }
  };

  const handleManualCheckIn = useCallback(async () => {
    if (!result?.attendee?._id || result.state !== 'error') return;

    try {
      await checkInAttendee({
        attendeeId: result.attendee._id,
        gateId: gateName,
        gateName: gateName,
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
        processedByName: user?.name || 'Sub-Organiser',
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

  useEffect(() => {
    getMyEvents()
      .then((response) => {
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

  // Network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored. Syncing pending scans…');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Offline mode — scans will be queued for server validation');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Persist offline queue
  useEffect(() => {
    localStorage.setItem('entrynex:offline-scans', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  // Sync queue when back online (server remains source of truth)
  useEffect(() => {
    if (!isOnline || offlineQueue.length === 0) return;

    const syncScans = async () => {
      const queueToProcess = [...offlineQueue];
      setOfflineQueue([]);
      localStorage.removeItem('entrynex:offline-scans');

      let ok = 0;
      let failed = 0;

      for (const scan of queueToProcess) {
        try {
          await scanSubEntry({
            ...(scan.method === 'rfid'
              ? { rfidId: scan.rfidId }
              : { qrToken: scan.qrToken }),
            gateId: scan.gateId,
            eventId: scan.eventId,
            action: scan.action,
          });
          ok += 1;
        } catch (err) {
          failed += 1;
          console.error('Offline scan sync failure:', err);
        }
      }

      if (ok > 0) toast.success(`Synced ${ok} offline scan(s)`);
      if (failed > 0) {
        toast.error(`${failed} offline scan(s) failed server validation`);
      }
      setResult(null);
    };

    syncScans();
  }, [isOnline]);

  const handleSubmit = async ({ value, mode, zoneId, action: scannerAction }) => {
    if (scannerAction === 'CLEAR') {
      setResult({ state: 'idle' });
      return;
    }

    // Use the new handleScan function
    await handleScan(value, mode);
  };

  const handleAssignRfid = async (rfidTag) => {
    if (!result?.attendee?._id) {
      throw new Error('No attendee selected');
    }

    const response = await assignSubRfid(result.attendee._id, {
      rfidTag,
      eventId: selectedEventId,
    });

    setResult((prev) =>
      prev?.state === 'error' || prev?.state === 'success'
        ? {
            ...prev,
            attendee: { ...prev.attendee, rfidTag },
          }
        : prev
    );

    toast.success('RFID assigned. Attendee can use QR or RFID.');
    return response.data;
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-24 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/suborg/dashboard')}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Exit Console
          </button>

          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
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
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Gate Scanner
            </p>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Entry Terminal
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gate:{' '}
            <span className="font-semibold text-slate-800">{gateName}</span>
          </p>
        </div>

        {/* Last Scan Card */}
        {lastScan ? (
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  lastScan.action === 'CHECK-OUT'
                    ? 'bg-teal-50 text-teal-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                Last {lastScan.action === 'CHECK-OUT' ? 'Check-Out' : 'Check-In'}
              </span>
              <span className="text-[10px] font-medium text-slate-400">
                {new Date(lastScan.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Attendee
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                  {lastScan.name}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Ticket Type
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-600">
                  {lastScan.categoryName}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Location
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-teal-600">
                  {lastScan.zoneName}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Staff
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-600">
                  {lastScan.processedByName || 'System'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center">
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
                onClick={() => {
                  setActiveTab(tab.id);
                  setResult({ state: 'idle' });
                  setLogsPage(1);
                }}
                className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-3 text-[10px] font-semibold uppercase tracking-wider transition sm:flex-row sm:gap-1.5 sm:text-xs ${
                  active
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ===================== TAB CONTENT ===================== */}
        <div className="space-y-5">
          {/* SCANNER TAB */}
          {activeTab === 'scan' && (
            <div className="space-y-5">
              {/* Entry / Exit toggle */}
              <div className="flex gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setScanMode('check_in')}
                  className={`flex-1 rounded-xl py-3 text-xs font-semibold uppercase tracking-wider transition ${
                    scanMode === 'check_in'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-teal-50 hover:text-teal-700'
                  }`}
                >
                  Entry Mode
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('check_out')}
                  className={`flex-1 rounded-xl py-3 text-xs font-semibold uppercase tracking-wider transition ${
                    scanMode === 'check_out'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-teal-50 hover:text-teal-700'
                  }`}
                >
                  Exit Mode
                </button>
              </div>

              {/* Camera */}
              <div className="flex gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-sm">
                <button type="button" onClick={() => setReaderMode('qr')} className={`flex-1 rounded-xl py-3 text-xs font-semibold ${readerMode === 'qr' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}>QR Camera</button>
                {rfidEnabled && <button type="button" onClick={() => setReaderMode('rfid')} className={`flex-1 rounded-xl py-3 text-xs font-semibold ${readerMode === 'rfid' ? 'bg-teal-600 text-white' : 'text-slate-500'}`}><IdentificationIcon className="mr-1 inline h-4 w-4" />RFID Reader</button>}
              </div>
              {readerMode === 'qr' ? <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-900 shadow-sm">
                <div className="aspect-[4/3] w-full sm:aspect-video">
                  <QRScannerComponent
                    onScanSuccess={(value) => handleScan(value, 'qr')}
                    onScanError={() => {}}
                    fps={12}
                    qrbox={260}
                  />
                </div>
              </div> : null}
              {readerMode === 'rfid' && <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                <div className="text-center">
                  <IdentificationIcon className="mx-auto h-12 w-12 text-teal-600" />
                  <p className="mt-3 font-semibold text-slate-900">RFID Reader Ready</p>
                  <p className="mt-1 text-sm text-slate-600">Tap a card or enter the RFID tag ID</p>
                  <input
                    ref={rfidInputRef}
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualToken.length === 10) handleScan(manualToken, 'rfid');
                    }}
                    onInput={(e) => {
                      if (manualToken.length === 10) handleScan(manualToken, 'rfid');
                    }}
                    maxLength={64}
                    inputMode="text"
                    placeholder="Waiting for RFID..."
                    className="mt-5 w-full rounded-xl border border-teal-300 bg-white px-4 py-4 text-center font-mono text-xl tracking-[0.3em] outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>}

              {/* Result Card */}
              {result.state !== 'idle' && (
                <ResultCard
                  state={result.state}
                  attendee={result.attendee}
                  message={result.message}
                  detail={result.detail}
                  meta={result.meta}
                />
              )}
              
              {/* RFID Assignment */}
              {result?.state === 'success' && result?.attendee && !result?.attendee?.rfidTag && rfidEnabled && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <h3 className="font-semibold text-amber-900">Assign RFID Tag</h3>
                  <p className="mt-1 text-sm text-amber-700">
                    Assign an RFID tag so this attendee can use either QR or RFID for access.
                  </p>
                  <form onSubmit={assignScannedRfid} className="mt-4 flex gap-3">
                    <input
                      type="text"
                      value={assignmentTag}
                      onChange={(e) => setAssignmentTag(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))}
                      placeholder="Enter RFID tag"
                      className="flex-1 rounded-xl border border-amber-300 px-4 py-3 font-mono text-sm tracking-widest text-amber-900 outline-none focus:ring-2 focus:ring-amber-500/20"
                      maxLength={64}
                    />
                    <button
                      type="submit"
                      disabled={assignmentSaving || !(/^[a-zA-Z0-9_-]{1,64}$/.test(assignmentTag))}
                      className="rounded-xl bg-amber-600 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-amber-500 disabled:opacity-40"
                    >
                      {assignmentSaving ? 'Assigning...' : 'Assign RFID'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* MANUAL TAB */}
          {activeTab === 'manual' && (
            <div className="space-y-5">
              <SearchBar
                value={manualToken}
                onChange={setManualToken}
                placeholder="Paste / type QR token here..."
              />
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

          {/* STATS TAB */}
          {activeTab === 'stats' && (
            <div className="space-y-5">
              {/* Gate Selector */}
              <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Select Gate
                  </label>
                  {eventGates.length > 0 ? (
                    <select
                      value={gateName}
                      onChange={(e) => setGateName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white"
                    >
                      {eventGates.map((gate) => (
                        <option key={gate} value={gate}>
                          {gate}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                      No gates available
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50 p-5 shadow-sm text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Success</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-700">{stats.success}</p>
                </div>
                <div className="rounded-2xl border border-rose-200/70 bg-rose-50 p-5 shadow-sm text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">Failed</p>
                  <p className="mt-2 text-3xl font-bold text-rose-700">{stats.failed}</p>
                </div>
              </div>
            </div>
          )}

          {/* LOGS TAB */}
          {activeTab === 'logs' && (
            <ActivityList logs={logs} />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SubOrgEntryScannerPage;