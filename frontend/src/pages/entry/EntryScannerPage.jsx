import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMyEvents } from '../../api/events';
import { checkInAttendee, getEntryStats, lookupEntry, scanEntry } from '../../api/entry';
import QRScannerComponent from '../../components/events/QRScannerComponent';
import toast from 'react-hot-toast';
import { getAssetUrl } from '../../utils/backend';
import { getAudioContext } from '../../pages/suborg/suborgUtils';

import {
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  ExclamationTriangleIcon,
  TagIcon,
  MagnifyingGlassIcon,
  BoltIcon,
  Cog6ToothIcon,
  CameraIcon,
  DeviceTabletIcon,
  IdentificationIcon
} from '@heroicons/react/24/solid';

/* ─── helpers ─────────────────────────────────────────────────── */
const parseScannedValue = (value) => {
  const raw = (value || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return parsed.attendeeToken || parsed.token || parsed.qrToken || raw;
  } catch {
    return raw;
  }
};

const buildAssetUrl = (photoPath) => {
  if (!photoPath) return '';
  if (photoPath.startsWith('http')) return photoPath;
  return getAssetUrl(photoPath);
};

const playBeep = (granted) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = granted ? 880 : 220;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* ignore audio restriction */ }
};

const fmt = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/* ─── sub-components ──────────────────────────────────────────── */
const StatPill = ({ label, value, color = 'gray' }) => {
  const colors = {
    indigo: 'bg-teal-900/60 text-teal-300 border-teal-700',
    red:   'bg-rose-900/60 text-rose-300 border-rose-700',
    blue:  'bg-teal-900/60 text-teal-300 border-teal-700',
    gray:  'bg-gray-800/60 text-gray-300 border-gray-700',
  };
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border px-6 py-4 ${colors[color]}`}>
      <span className="text-4xl font-black tabular-nums leading-none">{value ?? 0}</span>
      <span className="mt-1 text-xs font-semibold uppercase tracking-widest opacity-70">{label}</span>
    </div>
  );
};

const ZoneBadge = ({ zone }) => (
  <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
    {zone}
  </span>
);

/* ─── result overlay ──────────────────────────────────────────── */
const ResultOverlay = ({ result, gateId, onDismiss, onIssueWristband, issuingWristband }) => {
  const granted = !!result?.accessGranted;
  const attendee = result?.attendee;

  useEffect(() => {
    if (!granted) return;
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [granted, onDismiss]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 transition-all duration-300 ${
      granted
        ? 'bg-gradient-to-br from-teal-900 via-teal-800 to-teal-900'
        : 'bg-gradient-to-br from-rose-900 via-red-900 to-rose-900'
    }`}>
      {/* Banner */}
      <div className={`mb-8 flex items-center gap-4 rounded-3xl px-10 py-5 text-white shadow-2xl ${
        granted ? 'bg-teal-500/30 border-2 border-teal-400' : 'bg-rose-500/30 border-2 border-rose-400'
      }`}>
        <div className="flex items-center justify-center p-2 rounded-2xl bg-white/20">
          {granted ? <CheckCircleIcon className="h-16 w-16" /> : <XCircleIcon className="h-16 w-16" />}
        </div>
        <div>
          <p className="text-5xl font-black tracking-tight leading-none">
            {granted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
          </p>
          {!granted && result?.denialReason && (
            <p className="mt-2 text-xl font-medium opacity-80">{result.denialReason}</p>
          )}
        </div>
      </div>

      {/* Attendee card */}
      {attendee && (
        <div className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-3xl bg-white/10 p-8 backdrop-blur-sm border border-white/20 shadow-2xl">
          {/* Photo */}
          {attendee.photo ? (
            <img
              src={buildAssetUrl(attendee.photo)}
              alt={attendee.fullName}
              className="h-40 w-40 rounded-2xl border-4 border-white object-cover shadow-2xl"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-2xl border-4 border-white/40 bg-white/10 text-white/40">
              <UserIcon className="h-20 w-20" />
            </div>
          )}

          {/* Identity */}
          <div className="text-center text-white">
            <p className="text-4xl font-black">{attendee.fullName}</p>
            <p className="mt-2 text-xl font-semibold opacity-70">{attendee.categoryName}</p>

            {/* Notes / flags */}
            {attendee.notes && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/20 border border-amber-400/50 px-4 py-2 text-amber-200">
                <ExclamationTriangleIcon className="h-6 w-6" />
                <span className="font-medium">{attendee.notes}</span>
              </div>
            )}

            {/* Zones */}
            {attendee.allowedZones?.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-60">Zone Access</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {attendee.allowedZones.map((z) => <ZoneBadge key={z} zone={z} />)}
                </div>
              </div>
            )}

            {/* Wristband */}
            {attendee.wristbandId && (
              <p className="mt-3 text-sm opacity-60 flex items-center justify-center">
                <TagIcon className="h-4 w-4 mr-1" /> Wristband: {attendee.wristbandId}
              </p>
            )}
            {result?.scannedRfid && (
              <p className="mt-3 text-sm font-mono opacity-80">RFID: {result.scannedRfid}</p>
            )}
          </div>

          {/* Actions */}
          {granted && (
            <div className="flex w-full gap-3">
              {!attendee.wristbandId && (
                <button
                  onClick={onIssueWristband}
                  disabled={issuingWristband}
                  className="flex-1 rounded-2xl bg-white py-4 text-lg font-bold text-teal-800 shadow-lg hover:bg-teal-50 disabled:opacity-60 transition-colors"
                >
                  {issuingWristband ? '⏳ Issuing...' : <><TagIcon className="h-5 w-5 inline mr-2" /> Issue Wristband</>}
                </button>
              )}
              {attendee.wristbandId && (
                <div className="flex-1 rounded-2xl bg-white/20 py-4 text-center text-lg font-bold text-white border border-white/30">
                  <CheckCircleIcon className="h-6 w-6 inline-block mr-2 pb-1" /> Wristband Issued
                </div>
              )}
              <button
                onClick={onDismiss}
                className="flex-1 rounded-2xl border-2 border-white/30 py-4 text-lg font-bold text-white hover:bg-white/10 transition-colors"
              >
                Next Scan →
              </button>
            </div>
          )}

          {!granted && (
            <button
              onClick={onDismiss}
              className="w-full rounded-2xl border-2 border-white/40 py-4 text-xl font-bold text-white hover:bg-white/10 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Auto-dismiss bar */}
      {granted && (
        <p className="mt-5 text-sm text-white/50">Auto-dismisses in 8 seconds | or tap Next Scan</p>
      )}
    </div>
  );
};

/* ─── manual lookup panel ─────────────────────────────────────── */
const ManualLookup = ({ selectedEvent, gateId, onCheckin, scanning }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await lookupEntry({ eventId: selectedEvent, q: query.trim(), limit: 8 });
        setResults(res.data?.data?.attendees || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [query, selectedEvent]);

  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-6 w-6" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, email or ID…"
          className="w-full rounded-2xl border border-gray-700 bg-gray-800 pl-12 pr-4 py-4 text-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {loading && <p className="text-center text-gray-500 py-4">Searching…</p>}
        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-700 p-8 text-center text-gray-500">
            No attendees found
          </div>
        )}
        {results.map((a) => {
          const isReserved = a.confirmationStatus?.toLowerCase() === 'reserved' || a.orderId?.status === 'RESERVED';
          return (
            <div key={a._id} className="rounded-2xl border border-gray-700 bg-gray-800 p-4 flex items-center gap-4">
              {a.photo
                ? <img src={buildAssetUrl(a.photo)} alt={a.fullName} className="h-14 w-14 rounded-xl object-cover border border-gray-600 flex-shrink-0" />
                : <div className="h-14 w-14 rounded-xl bg-gray-700 flex items-center justify-center flex-shrink-0 text-gray-400"><UserIcon className="h-8 w-8" /></div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{a.fullName}</p>
                <p className="text-sm text-gray-400">{a.categoryName} · {a.phone || a.email || ''}</p>
                <div className="flex gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isReserved 
                      ? 'bg-amber-900 text-amber-300' 
                      : a.confirmationStatus === 'confirmed' 
                        ? 'bg-teal-900 text-teal-300' 
                        : 'bg-teal-900 text-teal-300'
                  }`}>
                    {isReserved ? 'Reserved (Unpaid)' : a.confirmationStatus}
                  </span>
                  {a.checkedIn && <span className="text-xs px-2 py-0.5 rounded-full bg-teal-900 text-teal-300 font-medium">Already In</span>}
                  {a.wristbandId && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900 text-purple-300 font-medium flex items-center"><TagIcon className="h-3 w-3 mr-1" /> Wristband</span>}
                </div>
              </div>
              
              {isReserved ? (
                <button
                  onClick={() => onCheckin(a)}
                  disabled={scanning}
                  className="rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-40 transition-colors flex-shrink-0"
                >
                  Confirm & Check In
                </button>
              ) : (
                <button
                  onClick={() => onCheckin(a)}
                  disabled={scanning || a.checkedIn}
                  className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  {a.checkedIn ? 'Done' : 'Check In'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── main kiosk page ─────────────────────────────────────────── */
const EntryScannerPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [gateId, setGateId] = useState('Gate A');
  const [stats, setStats] = useState({ totalScanned: 0, successfulEntries: 0, deniedEntries: 0 });
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [issuingWristband, setIssuingWristband] = useState(false);
  const [mode, setMode] = useState('camera'); // 'camera' | 'text' | 'lookup'
  const [scanInput, setScanInput] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const inputRef = useRef(null);

  const assignedGates = useMemo(() => (user?.assignedGates || []).filter(Boolean), [user]);
  const gateLocked = ['staff', 'volunteer'].includes(user?.role) && assignedGates.length > 0;

  // Get the selected event object
  const selectedEventData = useMemo(() => events.find((e) => e._id === selectedEvent), [events, selectedEvent]);

  // Get available gates for the selected event
  const availableGates = useMemo(() => {
    const eventGates = selectedEventData?.gates || [];
    
    // If user has assigned gates (and is staff/volunteer), show only the intersection with event gates
    if (gateLocked && assignedGates.length > 0) {
      if (eventGates.length > 0) {
        // Return only gates that are both assigned to user AND exist in the event
        const intersection = assignedGates.filter(gate => 
          eventGates.includes(gate)
        );
        // If intersection is empty, show event gates (user's assigned gates don't match this event)
        return intersection.length > 0 ? intersection : eventGates;
      }
      // If event has no gates configured, use assigned gates
      return assignedGates;
    }
    
    // If user has no assigned gates (or is not staff/volunteer), use event-specific gates
    if (eventGates.length > 0) {
      return eventGates;
    }
    
    // Fallback to default gates
    return ['Gate A', 'Gate B', 'Gate C', 'VIP Entry'];
  }, [selectedEventData, assignedGates, gateLocked]);

  // Load events
  useEffect(() => {
    getMyEvents().then((r) => {
      const evs = r.data?.data?.events || [];
      setEvents(evs);
      if (evs.length) setSelectedEvent(evs[0]._id);
    });
  }, []);

  // Set default gate when event changes or when assigned gates change
  useEffect(() => {
    const eventGates = selectedEventData?.gates || [];
    
    if (assignedGates.length > 0) {
      // If user has assigned gates, find intersection with event gates
      if (eventGates.length > 0) {
        const intersection = assignedGates.filter(g => eventGates.includes(g));
        setGateId(intersection.length > 0 ? intersection[0] : assignedGates[0]);
      } else {
        setGateId(assignedGates[0]);
      }
    } else if (eventGates.length > 0) {
      // If no assigned gates, use event gates
      setGateId(eventGates[0]);
    } else {
      // Fallback to default
      setGateId('Gate A');
    }
  }, [selectedEvent, assignedGates, selectedEventData]);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!selectedEvent) return;
    try {
      const r = await getEntryStats({ eventId: selectedEvent, gateId: gateId || undefined });
      setStats(r.data?.data?.today || { totalScanned: 0, successfulEntries: 0, deniedEntries: 0 });
    } catch { /* ignore */ }
  }, [selectedEvent, gateId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Keep the HID keyboard-wedge target ready whenever RFID mode is active.
  useEffect(() => {
    if ((mode === 'text' || mode === 'rfid') && inputRef.current) inputRef.current.focus();
  }, [mode]);

  const handleScanToken = useCallback(async (rawToken, method = 'qr') => {
    const token = parseScannedValue(rawToken);
    if (!token || !selectedEvent || !gateId || scanning) return;
    setScanning(true);
    try {
      const payload = { gateId, gateName: gateId, eventId: selectedEvent, action: 'check_in', method };
      if (method === 'rfid') payload.rfidId = token;
      else payload.qrToken = token;
      const { data } = await scanEntry(payload);
      setResult({ ...data.data, scannedRfid: method === 'rfid' ? token : undefined });
      playBeep(data.data.accessGranted);
      setScanInput('');
      loadStats();
    } catch (err) {
      const fallback = {
        accessGranted: false,
        denialReason: err.response?.data?.message || 'Scan failed',
        attendee: err.response?.data?.data?.attendee || null,
        scannedRfid: method === 'rfid' ? token : undefined,
      };
      setResult(fallback);
      playBeep(false);
      loadStats();
    } finally {
      setScanning(false);
    }
  }, [selectedEvent, gateId, scanning, loadStats]);

  const handleManualCheckin = useCallback(async (attendee) => {
    if (!selectedEvent || !gateId || scanning) return;
    setScanning(true);
    try {
      const isReserved = attendee.confirmationStatus?.toLowerCase() === 'reserved' || attendee.orderId?.status === 'RESERVED';
      if (isReserved && attendee.orderId?._id) {
        // Confirm cash payment first
        toast.loading('Confirming cash payment...', { id: 'cash-confirm' });
        try {
          await api.post(`/entrance/confirm/${attendee.orderId._id}`);
          toast.success('Cash payment confirmed', { id: 'cash-confirm' });
        } catch (confirmErr) {
          toast.error(confirmErr.response?.data?.message || 'Failed to confirm cash payment', { id: 'cash-confirm' });
          setScanning(false);
          return;
        }
      }
      
      await checkInAttendee({ attendeeId: attendee._id, gateId, gateName: gateId, method: 'manual' });
      setResult({
        accessGranted: true,
        attendee: { ...attendee, checkedIn: true },
      });
      playBeep(true);
      loadStats();
      toast.success(`${attendee.fullName} checked in`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-in failed');
      playBeep(false);
    } finally {
      setScanning(false);
    }
  }, [selectedEvent, gateId, scanning, loadStats]);

  const handleIssueWristband = useCallback(async () => {
    if (!result?.attendee?._id) return;
    setIssuingWristband(true);
    try {
      const res = await checkInAttendee({ attendeeId: result.attendee._id, gateId, gateName: gateId, method: 'manual' });
      const wb = res.data?.data?.wristbandId;
      setResult((prev) => ({ ...prev, attendee: { ...prev.attendee, wristbandId: wb } }));
      toast.success(`Wristband issued: ${wb}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Wristband issuance failed');
    } finally {
      setIssuingWristband(false);
    }
  }, [result, gateId]);

  const dismissResult = useCallback(() => {
    setResult(null);
    if ((mode === 'text' || mode === 'rfid') && inputRef.current) setTimeout(() => inputRef.current?.focus(), 50);
  }, [mode]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-gray-950 text-white select-none" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Result overlay */}
      {result && (
        <ResultOverlay
          result={result}
          gateId={gateId}
          onDismiss={dismissResult}
          onIssueWristband={handleIssueWristband}
          issuingWristband={issuingWristband}
        />
      )}

      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-gray-800 bg-gray-900/80 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-main text-white">
            <img src="/brand/eventgate-mark.svg" alt="Logo" className="h-5 w-5 object-contain" onError={(e) => e.target.style.display='none'} />
          </div>
          <div>
            <p className="text-sm font-black tracking-tight">EventGate Entry Gate</p>
            <p className="text-xs text-gray-500">{selectedEventData?.name || 'Loading…'} · {gateId}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSetup((s) => !s)}
            className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <Cog6ToothIcon className="h-4 w-4 inline mr-1" /> Setup
          </button>
          <div className={`h-2.5 w-2.5 rounded-full ${scanning ? 'bg-teal-400 animate-pulse' : 'bg-teal-400'}`} />
        </div>
      </div>

      {/* Setup drawer */}
      {showSetup && (
        <div className="absolute left-0 right-0 top-16 z-40 border-b border-gray-800 bg-gray-900 p-5 shadow-2xl">
          <div className="mx-auto max-w-2xl grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500">Event</label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {events.map((ev) => <option key={ev._id} value={ev._id}>{ev.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-gray-500">Gate</label>
              {gateLocked ? (
                <div className="rounded-xl border border-orange-800 bg-orange-900/40 px-4 py-2.5 text-sm text-orange-300">{gateId}</div>
              ) : (
                <select
                  value={gateId}
                  onChange={(e) => setGateId(e.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {availableGates.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="mt-3 text-center">
            <button onClick={() => setShowSetup(false)} className="text-sm text-gray-500 hover:text-white transition-colors">Close ✕</button>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* Stats bar */}
        <div className="flex gap-3 p-4 pb-0">
          <StatPill label="Scanned Today" value={stats.totalScanned} color="gray" />
          <StatPill label="Entries" value={stats.successfulEntries} color="green" />
          <StatPill label="Denied" value={stats.deniedEntries} color="red" />
          <div className="flex-1" />
          {/* Mode tabs */}
          <div className="flex items-center rounded-2xl border border-gray-800 bg-gray-900 p-1 gap-1">
            {[
              { key: 'camera', label: 'Camera', icon: CameraIcon },
              { key: 'rfid', label: 'RFID Reader', icon: IdentificationIcon },
              { key: 'text',   label: 'Text',   icon: DeviceTabletIcon },
              { key: 'lookup', label: 'Lookup', icon: MagnifyingGlassIcon },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                  mode === key ? 'bg-teal-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Main area */}
        <div className="flex flex-1 gap-4 overflow-hidden p-4">
          {/* Scanner / lookup panel */}
          <div className="flex flex-1 flex-col rounded-3xl border border-gray-800 bg-gray-900 overflow-hidden">
            {mode === 'camera' && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
                <div className="w-full max-w-lg">
                  <div className="rounded-2xl overflow-hidden border-2 border-brand-main shadow-[0_0_40px_rgba(38,132,255,0.3)]">
                    <QRScannerComponent
                      onScanSuccess={(text) => handleScanToken(text, 'qr')}
                      onScanError={() => {}}
                      fps={12}
                      qrbox={280}
                    />
                  </div>
                </div>
                <div className="text-center">
                  <p className="flex items-center justify-center gap-2 text-2xl font-bold text-gray-200"><CameraIcon className="h-8 w-8" /> Point camera at QR code</p>
                  <p className="mt-1 text-gray-500">Position the attendee's ticket QR code inside the blue frame</p>
                </div>
                {scanning && (
                  <div className="flex items-center gap-3 rounded-2xl bg-teal-900/50 border border-teal-700 px-6 py-3">
                    <div className="h-4 w-4 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                    <span className="text-teal-300 font-semibold">Processing scan…</span>
                  </div>
                )}
              </div>
            )}

            {mode === 'text' && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
                <div className="w-full max-w-lg text-center">
                  <p className="flex items-center justify-center gap-2 text-3xl font-black text-gray-100 mb-2"><DeviceTabletIcon className="h-8 w-8" /> Manual Token Entry</p>
                  <p className="text-gray-500 mb-8">Paste or type the QR token from the attendee's ticket</p>
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleScanToken(scanInput, 'qr'); }}
                    className="flex flex-col gap-4"
                  >
                    <input
                      ref={inputRef}
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      placeholder="Paste QR token here..."
                      className="w-full rounded-2xl border border-gray-700 bg-gray-800 px-6 py-5 text-xl font-mono text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-main text-center"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!scanInput.trim() || scanning}
                      className="w-full rounded-2xl bg-brand-main py-5 text-xl font-black text-white hover:bg-brand-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {scanning ? '⏳ Processing...' : <><CheckCircleIcon className="h-6 w-6 inline mr-2" /> Process Scan</>}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {mode === 'rfid' && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
                <div className="w-full max-w-lg text-center">
                  <p className="flex items-center justify-center gap-2 text-3xl font-black text-gray-100 mb-2">
                    <IdentificationIcon className="h-8 w-8" /> RFID Reader
                  </p>
                  <p className="text-gray-500 mb-8">Tap a 125 kHz card on the USB reader. It will submit automatically.</p>
                  <form onSubmit={(e) => { e.preventDefault(); handleScanToken(scanInput, 'rfid'); }} className="flex flex-col gap-4">
                    <input
                      ref={inputRef}
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleScanToken(scanInput, 'rfid');
                        }
                      }}
                      inputMode="text"
                      maxLength={64}
                      placeholder="Waiting for RFID card..."
                      className="w-full rounded-2xl border-2 border-teal-500/60 bg-gray-800 px-6 py-5 text-center text-2xl font-mono tracking-[0.3em] text-white placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-teal-500/30"
                      autoFocus
                    />
                    <div className="flex items-center justify-center gap-2 text-sm text-teal-300">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-400" /> Reader focused and ready
                    </div>
                  </form>
                </div>
              </div>
            )}

            {mode === 'lookup' && (
              <div className="flex flex-1 flex-col p-6 overflow-hidden">
                <div className="mb-4">
                  <p className="flex items-center gap-2 text-2xl font-black text-gray-100"><MagnifyingGlassIcon className="h-8 w-8 text-gray-300" /> Manual Attendee Lookup</p>
                  <p className="text-gray-500 text-sm mt-1">Search by name, phone, email or ID number</p>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ManualLookup
                    selectedEvent={selectedEvent}
                    gateId={gateId}
                    onCheckin={handleManualCheckin}
                    scanning={scanning}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Side info panel */}
          <div className="hidden xl:flex w-72 flex-col gap-4">
            {/* Gate info */}
            <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Gate Status</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-3 w-3 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                <span className="text-lg font-bold text-white">{gateId}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Operator</span>
                  <span className="font-semibold text-gray-200 truncate max-w-32">{user?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Event</span>
                  <span className="font-semibold text-gray-200 truncate max-w-32">{selectedEventData?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mode</span>
                  <span className="font-semibold text-teal-400 capitalize">{mode}</span>
                </div>
              </div>
            </div>

            {/* Gate selector */}
            {!gateLocked && (
              <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Switch Gate</p>
                <div className="grid grid-cols-2 gap-2">
                  {availableGates.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGateId(g)}
                      className={`rounded-xl py-2.5 text-sm font-bold transition-colors ${
                        gateId === g
                          ? 'bg-teal-600 text-white'
                          : 'border border-gray-700 bg-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Instructions</p>
              <div className="space-y-3 text-sm text-gray-400">
                <div className="flex gap-2">
                  <span className="text-teal-400 font-bold">1.</span>
                  <span>Select event & gate from Setup if not pre-assigned</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-teal-400 font-bold">2.</span>
                  <span>Use Camera mode for fast QR scanning</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-teal-400 font-bold">3.</span>
                  <span>Use Lookup if QR is damaged or missing</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-teal-400 font-bold">4.</span>
                  <span>Issue wristband after ACCESS GRANTED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntryScannerPage;
