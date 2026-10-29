import React, { useRef, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import QRScannerComponent from '../events/QRScannerComponent';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

import {
  QrCodeIcon,
  SignalIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  XMarkIcon,
  CheckBadgeIcon,
  ClockIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const parseScannedValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return parsed.attendeeToken || parsed.token || parsed.qrToken || raw;
  } catch {
    return raw;
  }
};

const formatActionLabel = (action, scannerType) => {
  if (scannerType === 'zone') {
    if (action === 'ENTRY') return 'Zone Entry';
    if (action === 'EXIT') return 'Zone Exit';
    return action;
  }
  // entry scanner
  const a = String(action || '').toUpperCase();
  if (a === 'CHECK_IN' || a === 'CHECK-IN' || a === 'CHECKIN') return 'Check-In';
  if (a === 'CHECK_OUT' || a === 'CHECK-OUT' || a === 'CHECKOUT' || a === 'EXIT') return 'Check-Out';
  return action;
};

const ScannerComponent = ({
  title,
  description,
  zones = [],
  activeZone,
  onZoneChange,
  onSubmit,
  onAssignRfid,
  submitting,
  result,
  rfidEnabled = false,
  scannerType = 'entry', // 'entry' | 'zone'
  onSwitchToCheckOut,
  onSwitchToCheckIn,
  action: controlledAction, // optional controlled action from parent
}) => {
  const defaultAction = scannerType === 'zone' ? 'ENTRY' : 'CHECK_IN';
  const [scanMode, setScanMode] = useState('qr');
  const [internalAction, setInternalAction] = useState(defaultAction);
  const [manualValue, setManualValue] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [assignRfidMode, setAssignRfidMode] = useState(false);
  const [assignRfidValue, setAssignRfidValue] = useState('');
  const [assignRfidSubmitting, setAssignRfidSubmitting] = useState(false);
  const inputRef = useRef(null);

  // Support controlled or uncontrolled action
  const action = controlledAction ?? internalAction;
  const setAction = (next) => {
    setInternalAction(next);
  };

  // Auto-switch when backend says already checked in
  useEffect(() => {
    if (!result) return;

    if (result.suggestCheckOut || result.reason === 'ALREADY_CHECKED_IN') {
      const next = scannerType === 'zone' ? 'EXIT' : 'CHECK_OUT';
      setAction(next);
      onSwitchToCheckOut?.();
      toast.error('Already checked in. Switched to Exit mode.');
    }

    if (result.reason === 'NOT_CHECKED_IN') {
      const next = scannerType === 'zone' ? 'ENTRY' : 'CHECK_IN';
      setAction(next);
      onSwitchToCheckIn?.();
      toast.error('Not checked in. Switched to Entry mode.');
    }

    if (
      result.reason === 'ALREADY_INSIDE' ||
      (result.denialReason && String(result.denialReason).toLowerCase().includes('already inside'))
    ) {
      setAction('EXIT');
      toast.error('Already inside this zone. Switched to Exit mode.');
    }

    if (
      result.reason === 'ALREADY_OUTSIDE' ||
      (result.denialReason && String(result.denialReason).toLowerCase().includes('already outside'))
    ) {
      setAction('ENTRY');
      toast.error('Already outside this zone. Switched to Entry mode.');
    }

    if (
      result.reason === 'MAIN_ENTRY_REQUIRED' ||
      (result.denialReason && String(result.denialReason).toLowerCase().includes('main entry'))
    ) {
      toast.error('Must check in at Main Entry first.');
    }
  }, [result, scannerType]);

  // Focus RFID input when mode changes
  useEffect(() => {
    if (scanMode === 'rfid' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [scanMode, result]);

  const clearResult = () => {
    onSubmit?.({
      value: '',
      mode: scanMode,
      zoneId: activeZone,
      action: 'CLEAR',
    });
  };

  const submitValue = async (value) => {
    const nextValue = parseScannedValue(value);
    if (!nextValue) return;

    // Map UI action to backend-friendly action
    let payloadAction = action;
    if (scannerType === 'entry') {
      if (action === 'CHECK_IN') payloadAction = 'check_in';
      if (action === 'CHECK_OUT') payloadAction = 'check_out';
    }

    await onSubmit({
      value: nextValue,
      mode: scanMode,
      zoneId: activeZone,
      action: payloadAction,
    });

    setManualValue('');
    inputRef.current?.focus();
  };

  const handleAssignRfid = async () => {
    if (!assignRfidValue.trim() || !onAssignRfid) return;
    setAssignRfidSubmitting(true);
    try {
      await onAssignRfid(assignRfidValue.trim());
      setAssignRfidMode(false);
      setAssignRfidValue('');
      toast.success('RFID assigned successfully. Attendee can use QR or RFID.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign RFID');
    } finally {
      setAssignRfidSubmitting(false);
    }
  };

  const actionLabel = formatActionLabel(action, scannerType);
  const zoneLabel =
    zones.find((z) => String(z.id || z.name) === String(activeZone))?.name ||
    activeZone ||
    '—';

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      {/* Controls */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              scannerType === 'zone'
                ? 'bg-teal-50 text-teal-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {scannerType === 'zone' ? (
              <QrCodeIcon className="h-5 w-5" />
            ) : (
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {/* Zone / Entry point */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              {scannerType === 'zone' ? 'Select Zone' : 'Entry Point'}
            </label>
            <select
              value={activeZone || ''}
              onChange={(e) => {
                onZoneChange?.(e.target.value);
                // Reset to entry action when zone changes
                setAction(scannerType === 'zone' ? 'ENTRY' : 'CHECK_IN');
                clearResult();
              }}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            >
              {scannerType !== 'zone' && (
                <option value="main-entry">Main Entry</option>
              )}
              {zones.map((zone) => (
                <option key={zone.id || zone.name} value={zone.id || zone.name}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          {/* Action toggle */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAction(scannerType === 'zone' ? 'ENTRY' : 'CHECK_IN');
                  clearResult();
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  action === (scannerType === 'zone' ? 'ENTRY' : 'CHECK_IN')
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                {scannerType === 'zone' ? 'Entry' : 'Check-In'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAction(scannerType === 'zone' ? 'EXIT' : 'CHECK_OUT');
                  clearResult();
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  action === (scannerType === 'zone' ? 'EXIT' : 'CHECK_OUT')
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700'
                }`}
              >
                <ArrowLeftOnRectangleIcon className="h-4 w-4" />
                {scannerType === 'zone' ? 'Exit' : 'Check-Out'}
              </button>
            </div>
          </div>

          {/* Credential mode */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Credential
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScanMode('qr')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  scanMode === 'qr'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700'
                }`}
              >
                <QrCodeIcon className="h-4 w-4" />
                QR
              </button>
              <button
                type="button"
                onClick={() => setScanMode('rfid')}
                disabled={!rfidEnabled}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  !rfidEnabled
                    ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400'
                    : scanMode === 'rfid'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700'
                }`}
              >
                <SignalIcon className="h-4 w-4" />
                RFID
              </button>
            </div>
            {!rfidEnabled && (
              <p className="mt-1.5 text-xs text-slate-400">RFID disabled for this event</p>
            )}
          </div>

          {/* Manual / wedge input */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await submitValue(manualValue);
            }}
            className="space-y-3"
          >
            <input
              ref={inputRef}
              value={manualValue}
              onChange={(e) =>
                setManualValue(
                  scanMode === 'rfid'
                    ? e.target.value.replace(/\D/g, '').slice(0, 10)
                    : e.target.value
                )
              }
              onKeyDown={(e) => {
                if (scanMode === 'rfid' && e.key === 'Enter') {
                  e.preventDefault();
                  submitValue(manualValue);
                }
              }}
              inputMode={scanMode === 'rfid' ? 'numeric' : undefined}
              maxLength={scanMode === 'rfid' ? 10 : undefined}
              placeholder={
                scanMode === 'qr' ? 'Paste or scan QR token' : 'Tap RFID card / enter 10-digit ID'
              }
              className={`w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 ${
                scanMode === 'rfid'
                  ? 'border-amber-300 bg-amber-50 font-mono tracking-widest text-center focus:border-amber-500 focus:ring-amber-500/20'
                  : 'border-slate-200 focus:border-teal-500 focus:ring-teal-500/20'
              }`}
            />
            {scanMode === 'rfid' && (
              <p className="text-center text-xs text-amber-700">Reader focused — waiting for card</p>
            )}
            <Button
              type="submit"
              disabled={submitting || !activeZone}
              className={`w-full py-2.5 text-white disabled:opacity-60 ${
                action === 'ENTRY' || action === 'CHECK_IN'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-amber-600 hover:bg-amber-500'
              }`}
            >
              {submitting ? 'Processing…' : `Submit ${actionLabel}`}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setShowCamera((v) => !v)}
            disabled={scanMode !== 'qr'}
            className="w-full rounded-xl border border-teal-200 px-3.5 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showCamera ? 'Hide camera' : 'Open camera scanner'}
          </button>
        </div>
      </div>

      {/* Result + camera */}
      <div className="space-y-5">
        {showCamera && scanMode === 'qr' && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              Camera
            </p>
            <QRScannerComponent
              onScanSuccess={(value) => {
                submitValue(value);
                setShowCamera(false);
              }}
              onScanError={() => {}}
              fps={12}
              qrbox={260}
              scanCooldownMs={1800}
            />
          </div>
        )}

        <div
          className={`relative rounded-2xl p-6 shadow-sm ${
            result?.accessGranted
              ? 'bg-emerald-600 text-white'
              : result
                ? 'bg-rose-600 text-white'
                : 'border border-dashed border-slate-200 bg-slate-50 text-slate-500'
          }`}
        >
          {result && (
            <button
              type="button"
              onClick={clearResult}
              className="absolute right-4 top-4 rounded-full p-1 transition hover:bg-white/20"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}

          {!result ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider">Ready to Scan</p>
              <p className="mt-2 text-base font-medium">
                Scan attendee {actionLabel.toLowerCase()} credential
              </p>
              {activeZone && (
                <p className="mt-3 text-sm opacity-80">
                  {scannerType === 'zone' ? 'Zone: ' : 'Entry: '}
                  <span className="font-semibold">{zoneLabel}</span>
                  <span className="mx-2">·</span>
                  <span className="font-semibold">{actionLabel}</span>
                </p>
              )}
              <p className="mt-4 text-xs opacity-70">
                QR and RFID share the same check-in state. Once checked in, use Exit before
                checking in again.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <p className="text-[11px] font-bold uppercase tracking-wider">
                  {result.accessGranted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                </p>
                {result.accessGranted && <CheckBadgeIcon className="h-5 w-5" />}
              </div>

              <h3 className="text-2xl font-bold">
                {result.attendee?.fullName || 'Unknown attendee'}
              </h3>

              {result.action && (
                <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1">
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {formatActionLabel(result.action, scannerType)}
                  </span>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm opacity-80">Ticket Category</p>
                  <p className="text-lg font-semibold">
                    {result.attendee?.categoryName || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm opacity-80">
                    {scannerType === 'zone' ? 'Zone' : 'Entry Point'}
                  </p>
                  <p className="text-lg font-semibold">
                    {result.zone?.name || result.zoneName || zoneLabel}
                  </p>
                </div>
              </div>

              {/* Photo + status */}
              <div className="flex items-center gap-4 border-t border-white/20 pt-2">
                {result.attendee?.photo ? (
                  <img
                    src={result.attendee.photo}
                    alt="Attendee"
                    className="h-16 w-16 flex-shrink-0 rounded-xl border-2 border-white/30 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-slate-700">
                    <span className="text-2xl font-bold text-white">
                      {(result.attendee?.fullName || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-xs opacity-80">Photo Status</p>
                  <div className="mt-1 flex items-center gap-2">
                    {result.attendee?.photoVerificationStatus === 'verified' ? (
                      <>
                        <CheckBadgeIcon className="h-5 w-5 text-emerald-300" />
                        <span className="font-semibold text-emerald-200">Photo Verified</span>
                      </>
                    ) : result.attendee?.photoVerificationStatus === 'pending' ? (
                      <>
                        <ClockIcon className="h-5 w-5 text-amber-300" />
                        <span className="font-semibold text-amber-200">Pending Review</span>
                      </>
                    ) : result.attendee?.photoVerificationStatus === 'rejected' ? (
                      <>
                        <XMarkIcon className="h-5 w-5 text-rose-300" />
                        <span className="font-semibold text-rose-200">Photo Rejected</span>
                      </>
                    ) : (
                      <span className="font-semibold text-slate-200">Not Submitted</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-80">Main Entry</p>
                  <p className="text-lg font-semibold">
                    {result.attendee?.checkedIn ? (
                      <span className="text-emerald-200">Checked In</span>
                    ) : (
                      <span className="text-slate-200">Not Checked In</span>
                    )}
                  </p>
                </div>
              </div>

              {result.attendee?.rfidTag ? (
                <div className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-1.5">
                  <SignalIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">RFID: {result.attendee.rfidTag}</span>
                </div>
              ) : result.accessGranted &&
                !result.attendee?.rfidTag &&
                rfidEnabled &&
                onAssignRfid ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <p className="text-sm font-medium">RFID Not Assigned</p>
                  <p className="mt-1 text-xs text-amber-700">
                    Assign RFID so this attendee can use either QR or RFID next time.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 bg-amber-600 text-white hover:bg-amber-500"
                    onClick={() => setAssignRfidMode(true)}
                  >
                    Assign RFID
                  </Button>
                </div>
              ) : null}

              {/* Switch mode helpers */}
              {!result.accessGranted &&
                (result.suggestCheckOut || result.reason === 'ALREADY_CHECKED_IN') &&
                scannerType === 'entry' && (
                  <div className="border-t border-white/20 pt-3">
                    <Button
                      className="w-full bg-teal-600 text-white hover:bg-teal-500"
                      onClick={() => {
                        clearResult();
                        setAction('CHECK_OUT');
                        onSwitchToCheckOut?.();
                      }}
                    >
                      <ArrowLeftIcon className="mr-2 h-4 w-4" />
                      Switch to Exit Mode
                    </Button>
                  </div>
                )}

              {!result.accessGranted &&
                scannerType === 'zone' &&
                (result.reason === 'ALREADY_INSIDE' ||
                  String(result.denialReason || '')
                    .toLowerCase()
                    .includes('already')) && (
                  <div className="border-t border-white/20 pt-3">
                    <Button
                      className="w-full bg-amber-600 text-white hover:bg-amber-500"
                      onClick={() => {
                        clearResult();
                        setAction('EXIT');
                      }}
                    >
                      <ArrowLeftIcon className="mr-2 h-4 w-4" />
                      Switch to Exit Mode
                    </Button>
                  </div>
                )}

              <p className="border-t border-white/20 pt-2 text-sm font-medium">
                {result.denialReason || result.message}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* RFID assign modal */}
      <Modal
        open={assignRfidMode}
        onClose={() => {
          setAssignRfidMode(false);
          setAssignRfidValue('');
        }}
        title="Assign RFID Tag"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Scan or enter an available 10-digit RFID tag for this attendee.
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">RFID Tag</label>
            <input
              type="text"
              value={assignRfidValue}
              onChange={(e) =>
                setAssignRfidValue(e.target.value.replace(/\D/g, '').slice(0, 10))
              }
              placeholder="Scan RFID tag..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-sm tracking-widest text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              autoFocus
              maxLength={10}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setAssignRfidMode(false);
                setAssignRfidValue('');
              }}
              disabled={assignRfidSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignRfid}
              disabled={!assignRfidValue.trim() || assignRfidSubmitting}
              className="bg-amber-600 text-white hover:bg-amber-500"
            >
              {assignRfidSubmitting ? 'Assigning...' : 'Assign RFID'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ScannerComponent;