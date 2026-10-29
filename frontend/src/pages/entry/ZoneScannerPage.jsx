import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowPathIcon, CheckCircleIcon, IdentificationIcon, QrCodeIcon, XCircleIcon } from '@heroicons/react/24/solid';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QRScannerComponent from '../../components/events/QRScannerComponent';
import { getMyEvents } from '../../api/events';
import { getZoneLogs, scanZoneAccess } from '../../api/zone';
import { useAuth } from '../../context/AuthContext';

const parseScannedValue = (value) => {
  const raw = value?.trim();
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw);
    return parsed.attendeeToken || parsed.token || parsed.qrToken || raw;
  } catch (error) {
    return raw;
  }
};

const statusStyle = {
  idle: {
    wrapper: 'bg-slate-950 text-white',
    accent: 'bg-slate-800 text-slate-200',
    badge: 'bg-slate-800 border-slate-700 text-slate-200',
  },
  success: {
    wrapper: 'bg-teal-600 text-white',
    accent: 'bg-teal-500/30 text-teal-50',
    badge: 'bg-white/15 border-white/20 text-white',
  },
  error: {
    wrapper: 'bg-red-600 text-white',
    accent: 'bg-red-500/30 text-red-50',
    badge: 'bg-white/15 border-white/20 text-white',
  },
};

const ZoneScannerPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [zoneMode, setZoneMode] = useState('auto');
  const [selectedZone, setSelectedZone] = useState('');
  const [scanMode, setScanMode] = useState('qr');
  const [scanInput, setScanInput] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    getMyEvents().then((response) => {
      if (!mounted) return;
      const items = response?.data?.data?.events || [];
      setEvents(items);
      if (items.length) {
        setSelectedEvent(items[0]._id);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedEventData = useMemo(
    () => events.find((event) => event._id === selectedEvent),
    [events, selectedEvent]
  );

  const availableZones = selectedEventData?.zones || [];
  const assignedZones = user?.assignedZones || [];

  const autoDetectedZone = useMemo(() => {
    const matchingAssigned = availableZones.find((zone) => assignedZones.includes(zone.name));
    return matchingAssigned?.name || availableZones[0]?.name || '';
  }, [assignedZones, availableZones]);

  const activeZone = zoneMode === 'auto' ? autoDetectedZone : selectedZone;

  useEffect(() => {
    if (!selectedZone && availableZones.length) {
      setSelectedZone(availableZones[0].name);
    }
  }, [availableZones, selectedZone]);

  useEffect(() => {
    if (inputRef.current && scanMode === 'rfid') {
      inputRef.current.focus();
    }
  }, [showCamera, scanMode, result]);

  const refreshLogs = async () => {
    if (!selectedEvent) return;
    try {
      const response = await getZoneLogs({
        eventId: selectedEvent,
        zone: activeZone || undefined,
        limit: 8,
      });
      setRecentLogs(response?.data?.data?.logs || []);
    } catch (error) {
      setRecentLogs([]);
    }
  };

  useEffect(() => {
    refreshLogs();
  }, [selectedEvent, activeZone]);

  const handleSubmit = async (event, overrideValue) => {
    if (event) event.preventDefault();

    const parsedInput = parseScannedValue(overrideValue || scanInput);
    if (!parsedInput || !activeZone) return;

    setSubmitting(true);
    try {
      const payload = {
        zone: activeZone,
        eventId: selectedEvent,
      };

      if (scanMode === 'rfid') {
        payload.rfidId = parsedInput;
      } else {
        payload.qrToken = parsedInput;
      }

      const response = await scanZoneAccess(payload);
      if (response?.status >= 400 || response?.data?.success === false) {
        throw { response };
      }

      const payloadResult = response?.data?.data;

      setResult({
        state: 'success',
        headline: 'Access Granted',
        detail: `${payloadResult?.action || 'ENTRY'} recorded for ${activeZone}`,
        ...payloadResult,
      });
      setScanInput('');
      setShowCamera(false);
      await refreshLogs();
    } catch (error) {
      const errorData = error.response?.data;
      setResult({
        state: 'error',
        headline: errorData?.message || 'Access Denied',
        detail: errorData?.reason === 'NOT_ALLOWED'
          ? 'Zone not included in ticket'
          : errorData?.reason === 'INVALID_TICKET'
            ? 'Invalid ticket'
            : errorData?.message || 'Scan failed',
        action: errorData?.data?.action || 'ENTRY',
        zoneName: errorData?.data?.zoneName || activeZone,
        attendee: errorData?.data?.attendee || null,
      });
      await refreshLogs();
    } finally {
      setSubmitting(false);
    }
  };

  const style = statusStyle[result?.state || 'idle'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Zone Access Control</h1>
            <p className="text-sm text-slate-500">Scan attendee QR codes or simulate RFID taps for zone entry and exit.</p>
          </div>
          <button
            type="button"
            onClick={refreshLogs}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh Logs
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px,1fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Scanner Setup</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Event</label>
                  <select
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                  >
                    {events.map((event) => (
                      <option key={event._id} value={event._id}>{event.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Zone Selection</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setZoneMode('auto')}
                      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${zoneMode === 'auto' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                    >
                      Auto Detect
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoneMode('manual')}
                      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${zoneMode === 'manual' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                    >
                      Select Zone
                    </button>
                  </div>
                  <div className="mt-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                    Active zone: <span className="font-semibold text-slate-900">{activeZone || 'No zone available'}</span>
                  </div>
                </div>

                {zoneMode === 'manual' && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Zone</label>
                    <select
                      value={selectedZone}
                      onChange={(e) => setSelectedZone(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                    >
                      {availableZones.map((zone) => (
                        <option key={zone.id || zone.name} value={zone.name}>{zone.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Scan Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setScanMode('qr')}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${scanMode === 'qr' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                    >
                      <QrCodeIcon className="h-4 w-4" />
                      QR Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanMode('rfid')}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${scanMode === 'rfid' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                    >
                      <IdentificationIcon className="h-4 w-4" />
                      RFID Sim
                    </button>
                  </div>
                </div>

                {scanMode === 'qr' && (
                  <button
                    type="button"
                    onClick={() => setShowCamera((value) => !value)}
                    className="w-full rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700"
                  >
                    {showCamera ? 'Close Camera Scanner' : 'Open Camera Scanner'}
                  </button>
                )}

                {showCamera && scanMode === 'qr' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <QRScannerComponent onScanSuccess={(text) => handleSubmit(null, text)} onScanError={() => {}} />
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    ref={inputRef}
                    value={scanInput}
                    onChange={(e) => setScanInput(scanMode === 'rfid' ? e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) : e.target.value)}
                    onKeyDown={(e) => {
                      if (scanMode === 'rfid' && e.key === 'Enter') {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    inputMode={scanMode === 'rfid' ? 'numeric' : undefined}
                    maxLength={scanMode === 'rfid' ? 10 : undefined}
                    placeholder={scanMode === 'rfid' ? 'Tap or enter RFID / wristband ID' : 'Scan or paste QR token'}
                    className={`w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 ${scanMode === 'rfid' ? 'border-teal-300 bg-teal-50 font-mono text-center tracking-widest' : 'border-slate-200'}`}
                  />
                  {scanMode === 'rfid' && <p className="text-center text-xs text-teal-700">Reader focused and waiting for a card.</p>}
                  {result?.scannedRfid && <p className="text-center font-mono text-xs text-teal-700">RFID: {result.scannedRfid}</p>}
                  <button
                    type="submit"
                    disabled={submitting || !activeZone}
                    className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Processing Scan...' : `Scan ${scanMode === 'rfid' ? 'RFID' : 'QR'}`}
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Last Scanned Logs</h2>
              <div className="mt-4 space-y-3">
                {recentLogs.length === 0 && (
                  <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No scans recorded for this event yet.</p>
                )}
                {recentLogs.map((log) => (
                  <div key={log._id} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{log.attendeeId?.fullName || log.attendeeSnapshot?.fullName || 'Unknown attendee'}</p>
                        <p className="text-xs text-slate-500">{log.attendeeId?.categoryName || log.attendeeSnapshot?.categoryName || 'Unknown category'}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${log.accessGranted ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}`}>
                        {log.accessGranted ? log.action : log.denialReason}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{log.zoneName} • {new Date(log.timestamp).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`rounded-[2rem] p-8 shadow-2xl transition-colors ${style.wrapper}`}>
            <div className="flex h-full min-h-[680px] flex-col justify-between">
              <div>
                <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] ${style.badge}`}>
                  {result?.state === 'success' ? 'Allowed' : result?.state === 'error' ? 'Denied' : 'Waiting'}
                </div>
                <div className="mt-8 flex items-center gap-5">
                  <div className={`flex h-24 w-24 items-center justify-center rounded-full ${style.accent}`}>
                    {result?.state === 'success' ? (
                      <CheckCircleIcon className="h-14 w-14" />
                    ) : result?.state === 'error' ? (
                      <XCircleIcon className="h-14 w-14" />
                    ) : (
                      <QrCodeIcon className="h-14 w-14" />
                    )}
                  </div>
                  <div>
                    <p className="text-4xl font-black tracking-tight">{result?.headline || 'Ready to Scan'}</p>
                    <p className="mt-2 text-lg text-white/80">{result?.detail || 'Choose a zone and scan the attendee badge.'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.75rem] bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/70">Attendee</p>
                  <p className="mt-3 text-3xl font-bold">{result?.attendee?.fullName || 'Awaiting scan'}</p>
                  <p className="mt-2 text-base text-white/80">{result?.attendee?.categoryName || 'Ticket category will appear here'}</p>
                </div>
                <div className="rounded-[1.75rem] bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/70">Zone Access List</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(result?.attendee?.allowedZones || []).length === 0 && (
                      <span className="text-sm text-white/80">No allowed zones found</span>
                    )}
                    {(result?.attendee?.allowedZones || []).map((zone) => (
                      <span key={zone} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium text-white">
                        {zone}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[1.75rem] bg-white/10 p-5 backdrop-blur-sm">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/70">Zone</p>
                    <p className="mt-2 text-xl font-semibold">{result?.zoneName || activeZone || 'Not selected'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/70">Recorded Action</p>
                    <p className="mt-2 text-xl font-semibold">{result?.action || 'ENTRY'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/70">Validation</p>
                    <p className="mt-2 text-xl font-semibold">{result?.state === 'success' ? 'Access Granted' : result?.detail || 'No result yet'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ZoneScannerPage;
