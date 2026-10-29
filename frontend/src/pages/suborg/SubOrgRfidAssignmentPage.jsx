import React, { useEffect, useState, useRef } from 'react';
import {
  ArrowLeftIcon,
  QrCodeIcon,
  IdentificationIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QRScannerComponent from '../../components/events/QRScannerComponent';
import { getMyEvents } from '../../api/events';
import {
  getAttendeeByQr,
  getEventRfidStatus,
  assignRfidToAttendee,
} from '../../api/entry';
import { validateRfidTag, unassignRfidTag } from '../../api/rfid';
import { useAuth } from '../../context/AuthContext';
import { playFeedbackTone, triggerHaptic } from './suborgUtils';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const SubOrgRfidAssignmentPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [eventRfidStatus, setEventRfidStatus] = useState(null);

  const [scanStep, setScanStep] = useState('qr');
  const [qrToken, setQrToken] = useState('');
  const [attendee, setAttendee] = useState(null);
  const [rfidTag, setRfidTag] = useState('');
  const [rfidValidation, setRfidValidation] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidatingRfid, setIsValidatingRfid] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentResult, setAssignmentResult] = useState(null);

  const rfidInputRef = useRef(null);

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
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      getEventRfidStatus(selectedEventId)
        .then((response) => {
          setEventRfidStatus(response.data?.data || { rfidEnabled: false });
        })
        .catch(() => {
          setEventRfidStatus({ rfidEnabled: false });
        });
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (scanStep === 'rfid' && rfidInputRef.current) {
      setTimeout(() => rfidInputRef.current?.focus(), 100);
    }
  }, [scanStep]);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    resetAssignment();
  };

  const resetAssignment = () => {
    setScanStep('qr');
    setQrToken('');
    setAttendee(null);
    setRfidTag('');
    setRfidValidation(null);
    setIsProcessing(false);
    setIsValidatingRfid(false);
    setIsAssigning(false);
    setAssignmentResult(null);
  };

  const handleQrScan = async (rawToken) => {
    const token = rawToken.trim();
    if (!token || !selectedEventId) return;

    setQrToken(token);
    setIsProcessing(true);

    try {
      const response = await getAttendeeByQr(token, selectedEventId);
      const data = response.data?.data;

      if (data && data.attendee) {
        if (data.attendee.rfidTag) {
          playFeedbackTone(false);
          triggerHaptic(false);
          toast.error(
            'This attendee already has an RFID tag assigned. Cannot assign another.'
          );
          setQrToken('');
          return;
        }

        setAttendee(data.attendee);
        playFeedbackTone(true);
        triggerHaptic(true);
        setScanStep('rfid');
        toast.success('Attendee found');
      } else {
        playFeedbackTone(false);
        triggerHaptic(false);
        toast.error('Attendee not found for this QR token');
        setQrToken('');
      }
    } catch (error) {
      playFeedbackTone(false);
      triggerHaptic(false);
      toast.error(error.response?.data?.message || 'Failed to lookup attendee');
      setQrToken('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRfidInputChange = async (e) => {
    const value = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    setRfidTag(value);

    if (e.nativeEvent?.inputType === 'insertFromPaste' && value.length > 0 && attendee) {
      await validateRfid(value);
    }
  };

  const validateRfid = async (tagValue) => {
    const tag = tagValue || rfidTag;
    if (!(/^[a-zA-Z0-9_-]{1,64}$/.test(tag))) return;

    setIsValidatingRfid(true);
    try {
      const response = await validateRfidTag(tag, {
        eventId: selectedEventId,
        categoryId: attendee?.categoryId,
      });
      const data = response.data?.data;
      setRfidValidation(data);
    } catch (error) {
      setRfidValidation({
        valid: false,
        available: false,
        message: error.response?.data?.message || 'Validation failed',
      });
    } finally {
      setIsValidatingRfid(false);
    }
  };

  const handleAssignRfid = async () => {
    if (!attendee || !qrToken || !(/^[a-zA-Z0-9_-]{1,64}$/.test(rfidTag))) return;

    setIsAssigning(true);
    try {
      const response = await assignRfidToAttendee({
        qrToken,
        rfidTag,
        eventId: selectedEventId,
      });
      const data = response.data?.data;

      setAssignmentResult({
        success: true,
        attendee: data.attendee,
        rfidTag: data.rfidTag,
        message: 'RFID assigned successfully',
      });
      setScanStep('complete');
      playFeedbackTone(true);
      triggerHaptic(true);
      toast.success('RFID tag assigned to attendee');
    } catch (error) {
      setAssignmentResult({
        success: false,
        message: error.response?.data?.message || 'Assignment failed',
      });
      playFeedbackTone(false);
      triggerHaptic(false);
      toast.error(error.response?.data?.message || 'Failed to assign RFID');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignRfid = async () => {
    if (!attendee?.rfidTag) return;

    setIsProcessing(true);
    try {
      await unassignRfidTag(
        attendee.rfidTag,
        'Sub-organiser initiated unassignment'
      );
      setAttendee((prev) => ({ ...prev, rfidTag: null }));
      toast.success('RFID tag unassigned');
      playFeedbackTone(true);
      triggerHaptic(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to unassign RFID');
      playFeedbackTone(false);
      triggerHaptic(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartNewAssignment = () => {
    resetAssignment();
  };

  const canProceedToRfid =
    scanStep === 'rfid' &&
    (/^[a-zA-Z0-9_-]{1,64}$/.test(rfidTag)) &&
    rfidValidation?.valid &&
    rfidValidation?.available;

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl space-y-3 sm:space-y-5 px-3 sm:px-6 pb-20 sm:pb-24">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/suborg/dashboard')}
            className="flex items-center gap-1.5 rounded-lg px-1 py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 active:bg-slate-100 hover:text-slate-900 touch-manipulation"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Exit
          </button>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 sm:px-6 sm:py-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-teal-500 ring-4 ring-teal-500/20" />
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              RFID Assignment
            </p>
          </div>
          <h1 className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
            QR-to-RFID Assignment
          </h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500 leading-snug">
            Scan QR, then assign an available RFID tag
          </p>
        </div>

        {/* Event selector */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Event
            </label>
            {eventRfidStatus && (
              <span
                className={`flex items-center gap-1.5 rounded-lg px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-semibold ${
                  eventRfidStatus.rfidEnabled
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    eventRfidStatus.rfidEnabled
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                />
                {eventRfidStatus.rfidEnabled ? 'RFID On' : 'RFID Off'}
              </span>
            )}
          </div>
          <select
            value={selectedEventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:bg-white touch-manipulation"
          >
            <option value="">Select an event</option>
            {events.map((event) => (
              <option key={event._id} value={event._id}>
                {event.name}
              </option>
            ))}
          </select>
        </div>

        {/* Progress — compact on mobile */}
        {selectedEventId && (
          <div className="flex items-center justify-between gap-1 sm:justify-center sm:gap-4 px-1">
            <div
              className={`flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 ${
                scanStep === 'qr' ? 'text-teal-600' : 'text-slate-400'
              }`}
            >
              <QrCodeIcon className="h-5 w-5" />
              <span className="text-[9px] sm:text-xs font-semibold">1. QR</span>
            </div>
            <div
              className={`h-0.5 flex-1 max-w-[2.5rem] sm:max-w-none sm:w-16 ${
                scanStep !== 'qr' ? 'bg-teal-600' : 'bg-slate-200'
              }`}
            />
            <div
              className={`flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 ${
                scanStep === 'rfid'
                  ? 'text-teal-600'
                  : scanStep === 'complete'
                  ? 'text-emerald-600'
                  : 'text-slate-400'
              }`}
            >
              <IdentificationIcon className="h-5 w-5" />
              <span className="text-[9px] sm:text-xs font-semibold">
                2. RFID
              </span>
            </div>
            <div
              className={`h-0.5 flex-1 max-w-[2.5rem] sm:max-w-none sm:w-16 ${
                scanStep === 'complete' ? 'bg-emerald-600' : 'bg-slate-200'
              }`}
            />
            <div
              className={`flex flex-col sm:flex-row items-center gap-0.5 sm:gap-2 ${
                scanStep === 'complete' ? 'text-emerald-600' : 'text-slate-400'
              }`}
            >
              <CheckCircleIcon className="h-5 w-5" />
              <span className="text-[9px] sm:text-xs font-semibold">
                3. Done
              </span>
            </div>
          </div>
        )}

        {/* Step 1: QR Scanner */}
        {selectedEventId && scanStep === 'qr' && (
          <div className="space-y-3 sm:space-y-5">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5 sm:p-5 shadow-sm">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Step 1: Scan QR
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                Position the QR code in the frame
              </p>

              <div className="mt-3 sm:mt-5 overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-900 shadow-sm">
                <div className="aspect-[4/3] w-full sm:aspect-video">
                  <QRScannerComponent
                    onScanSuccess={(value) => handleQrScan(value)}
                    onScanError={() => {}}
                    fps={12}
                    qrbox={260}
                  />
                </div>
              </div>

              {isProcessing && (
                <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2 text-teal-600">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                  <span className="text-sm font-medium">Looking up…</span>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5 sm:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">
                Manual QR Entry
              </h3>
              <input
                type="text"
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && qrToken) handleQrScan(qrToken);
                }}
                placeholder="Paste or type QR token…"
                className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-mono text-sm touch-manipulation"
                disabled={isProcessing}
              />
              <button
                type="button"
                onClick={() => handleQrScan(qrToken)}
                disabled={!qrToken || isProcessing}
                className="mt-3 w-full min-h-[48px] rounded-xl bg-teal-600 py-3 text-xs font-semibold uppercase tracking-wider text-white active:bg-teal-700 hover:bg-teal-700 disabled:opacity-40 touch-manipulation"
              >
                {isProcessing ? 'Looking up…' : 'Lookup Attendee'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: RFID */}
        {scanStep === 'rfid' && attendee && (
          <div className="space-y-3 sm:space-y-5">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5 sm:p-5 shadow-sm">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <UserIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                    {attendee.fullName}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-slate-600">
                      {attendee.categoryName || 'General'}
                    </span>
                    {attendee.rfidTag ? (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-emerald-700">
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        RFID: {attendee.rfidTag}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-amber-700">
                        No RFID
                      </span>
                    )}
                  </div>
                  {attendee.checkedIn && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] sm:text-xs font-medium text-emerald-600">
                      <ClockIcon className="h-3.5 w-3.5" />
                      Inside venue
                    </p>
                  )}
                </div>
                {attendee.rfidTag && (
                  <button
                    type="button"
                    onClick={handleUnassignRfid}
                    disabled={isProcessing}
                    className="shrink-0 text-[11px] sm:text-xs font-medium text-rose-600 active:text-rose-700 touch-manipulation"
                  >
                    Unassign
                  </button>
                )}
              </div>
            </div>

            {!eventRfidStatus?.rfidEnabled ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 sm:p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <XCircleIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-amber-800">
                      RFID Disabled
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-amber-700 leading-snug">
                      Enable RFID in Event Settings before assigning tags.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5 sm:p-5 shadow-sm">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Step 2: Scan RFID
                </h2>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                  Tap or enter a RFID tag
                </p>

                <div className="mt-3 sm:mt-5 rounded-2xl border-2 border-teal-200 bg-teal-50 p-4 sm:p-6 text-center">
                  <IdentificationIcon className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-teal-600" />
                  <p className="mt-2 sm:mt-3 font-semibold text-slate-900 text-sm sm:text-base">
                    RFID Reader Ready
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-slate-600">
                    Tap a card or enter the tag ID
                  </p>

                  <input
                    ref={rfidInputRef}
                    type="text"
                    value={rfidTag}
                    onChange={handleRfidInputChange}
                    onBlur={() => { if (rfidTag) validateRfid(rfidTag); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); if (canProceedToRfid) handleAssignRfid(); else validateRfid(rfidTag); }
                    }}
                    maxLength={64}
                    inputMode="text"
                    placeholder="Waiting for RFID…"
                    className="mt-4 sm:mt-5 w-full rounded-xl border border-teal-300 bg-white px-4 py-4 text-center font-mono text-lg sm:text-xl tracking-[0.3em] outline-none focus:ring-2 focus:ring-teal-500 touch-manipulation"
                  />

                  {isValidatingRfid && (
                    <p className="mt-3 text-sm text-teal-600">Validating…</p>
                  )}
                  {rfidValidation && !isValidatingRfid && (
                    <div
                      className={`mt-3 flex items-center justify-center gap-2 ${
                        rfidValidation.valid
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {rfidValidation.valid ? (
                        <>
                          <CheckCircleIcon className="h-5 w-5" />
                          <span className="text-sm font-medium">
                            {rfidValidation.message || 'Tag available'}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-5 w-5" />
                          <span className="text-sm font-medium">
                            {rfidValidation.message || 'Tag not available'}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  {!rfidValidation && (/^[a-zA-Z0-9_-]{1,64}$/.test(rfidTag)) && (
                    <p className="mt-3 text-sm text-amber-600">
                      Waiting for validation…
                    </p>
                  )}
                  {!(/^[a-zA-Z0-9_-]{1,64}$/.test(rfidTag)) && (
                    <p className="mt-3 text-xs sm:text-sm text-slate-500">
                      Enter RFID tag
                    </p>
                  )}
                </div>

                <div className="mt-4 sm:mt-5 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={resetAssignment}
                    className="w-full sm:flex-1 min-h-[48px] rounded-xl border border-slate-200 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600 active:bg-slate-50 touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAssignRfid}
                    disabled={!(/^[a-zA-Z0-9_-]{1,64}$/.test(rfidTag)) || isAssigning}
                    className="w-full sm:flex-1 min-h-[48px] rounded-xl bg-teal-600 py-3 text-xs font-semibold uppercase tracking-wider text-white active:bg-teal-700 hover:bg-teal-700 disabled:opacity-40 touch-manipulation"
                  >
                    {isAssigning ? 'Assigning…' : 'Assign RFID'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Complete */}
        {scanStep === 'complete' && assignmentResult && (
          <div className="space-y-3 sm:space-y-5">
            <div
              className={`rounded-2xl border p-3.5 sm:p-5 shadow-sm ${
                assignmentResult.success
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-rose-200 bg-rose-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {assignmentResult.success ? (
                  <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircleIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                ) : (
                  <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                    <XCircleIcon className="h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2
                    className={`text-base sm:text-lg font-bold ${
                      assignmentResult.success
                        ? 'text-emerald-900'
                        : 'text-rose-900'
                    }`}
                  >
                    {assignmentResult.success
                      ? 'RFID Assigned'
                      : 'Assignment Failed'}
                  </h2>
                  <p
                    className={`text-xs sm:text-sm leading-snug ${
                      assignmentResult.success
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {assignmentResult.message}
                  </p>
                </div>
              </div>

              {assignmentResult.success && (
                <div className="mt-3 sm:mt-4 rounded-xl bg-white/60 p-3 sm:p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-medium text-slate-600">
                      RFID Tag
                    </span>
                    <span className="font-mono text-base sm:text-lg font-bold text-emerald-700">
                      {assignmentResult.rfidTag}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-medium text-slate-600">
                      Attendee
                    </span>
                    <span className="text-sm font-medium text-slate-900 truncate max-w-[60%]">
                      {assignmentResult.attendee?.fullName}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleStartNewAssignment}
              className="w-full min-h-[48px] rounded-xl bg-teal-600 py-3.5 sm:py-4 text-xs font-semibold uppercase tracking-wider text-white active:bg-teal-700 hover:bg-teal-700 touch-manipulation"
            >
              Assign Another RFID
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubOrgRfidAssignmentPage;