import React, { useEffect, useRef, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QRScannerComponent from '../../components/events/QRScannerComponent';
import { entryAPI } from '../../api';
import { assignInventoryRfid, lookupRfidTag } from '../../api/rfid';
import { getMyEvents } from '../../api/events';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';

const RfidAssignmentPage = () => {
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [attendee, setAttendee] = useState(null);
  const [rfid, setRfid] = useState('');
  const [rfidRecord, setRfidRecord] = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [step, setStep] = useState('qr');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    getMyEvents().then((response) => {
      const events = response.data?.data?.events || [];
      const selected = events.find((item) => item._id === localStorage.getItem('lastSelectedEventId')) || events[0];
      setEvent(selected || null);
    }).catch(() => toast.error('Unable to load assigned events.'));
  }, []);

  useEffect(() => {
    if (step === 'rfid') inputRef.current?.focus();
  }, [step]);

  const reset = () => {
    setAttendee(null);
    setRfid('');
    setRfidRecord(null);
    setReplaceExisting(false);
    setStep('qr');
  };

  const resolveQr = async (value) => {
    if (loading || step !== 'qr') return;
    setLoading(true);
    try {
      const response = await entryAPI.getAttendeeByQR(value);
      const next = response.data?.data?.attendee || response.data?.data;
      if (!next?._id || (event?._id && String(next.event?._id || next.event) !== String(event._id))) {
        throw new Error('Attendee does not belong to the selected event.');
      }
      if (next.rfidTag) {
        setAttendee(next);
        setStep('already-assigned');
      } else {
        setAttendee(next);
        setStep('rfid');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Unable to resolve attendee QR.');
    } finally {
      setLoading(false);
    }
  };

  const confirmAssignment = async () => {
    if (!attendee?._id || !/^[a-zA-Z0-9_-]{1,64}$/.test(rfid)) return;
    setLoading(true);
    try {
      await assignInventoryRfid(attendee._id, rfid, replaceExisting);
      toast.success('RFID assigned successfully. Ready for next attendee.');
      reset();
    } catch (error) {
      toast.error(error.response?.data?.message || 'RFID assignment failed.');
    } finally {
      setLoading(false);
    }
  };

  const resolveRfid = async (value) => {
    const normalized = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    setRfid(normalized);
    setRfidRecord(null);
    if (normalized.length !== 10) return;
    try {
      const response = await lookupRfidTag(normalized);
      setRfidRecord(response.data?.data?.tag || null);
    } catch (error) {
      setRfidRecord({ rfidTag: normalized, status: 'not_registered', message: error.response?.data?.message || 'RFID tag is not registered in inventory.' });
    }
  };

  const { permissions } = usePermissions();
  const hasPermission = permissions.canAssignRfid;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-5 px-4 pb-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">Event Operations</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">RFID Assignment</h1>
          <p className="mt-1 text-sm text-slate-500">Scan an attendee QR, scan an available RFID tag, then confirm the assignment.</p>
        </div>
        {!canAssign ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">RFID assignment is unavailable for this event or account.</div>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Step 1</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Scan attendee QR</h2>
              {step === 'qr' ? (
                <div className="mt-4 overflow-hidden rounded-2xl bg-slate-900">
                  <div className="aspect-video"><QRScannerComponent onScanSuccess={resolveQr} onScanError={() => {}} fps={12} qrbox={240} /></div>
                </div>
              ) : <p className="mt-4 text-sm font-semibold text-emerald-700">Attendee QR resolved.</p>}
            </div>

            {attendee && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Attendee</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{attendee.fullName}</h2>
                <p className="mt-1 text-sm text-slate-500">Ticket: {attendee.ticket?.ticketNumber || attendee.ticket?.categoryName || attendee.categoryName || 'Confirmed ticket'}</p>
                <p className="text-sm text-slate-500">Event: {event?.name || 'Selected event'}</p>
                {step === 'already-assigned' ? (
                  <div className="mt-4 space-y-3 rounded-xl bg-teal-50 p-4 text-sm font-semibold text-teal-800">
                    <p>RFID {attendee.rfidTag} is already assigned.</p>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => { setReplaceExisting(true); setStep('rfid'); }} className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white">Replace RFID</button>
                      <button type="button" onClick={reset} className="rounded-xl border border-teal-200 bg-white px-4 py-2 text-xs font-semibold text-teal-700">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">Step 2</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">Scan available RFID tag</p>
                    <input ref={inputRef} value={rfid} onChange={(input) => resolveRfid(input.target.value)} onKeyDown={(input) => { if (input.key === 'Enter') { input.preventDefault(); if (rfidRecord?.status === 'available') confirmAssignment(); } }} maxLength={64} inputMode="text" placeholder="Waiting for RFID reader..." className="mt-3 w-full rounded-xl border border-teal-300 bg-teal-50 px-4 py-4 text-center font-mono text-xl tracking-[0.25em]" />
                    {rfidRecord && (
                      <div className={`mt-3 rounded-xl p-3 text-sm font-semibold ${rfidRecord.status === 'available' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                        Detected RFID: <span className="font-mono">{rfidRecord.rfidTag}</span><br />
                        Status: {rfidRecord.status === 'not_registered' ? 'NOT REGISTERED' : String(rfidRecord.status || '').toUpperCase()}
                        {rfidRecord.attendee?.fullName ? <><br />Assigned to: {rfidRecord.attendee.fullName}</> : null}
                      </div>
                    )}
                    <div className="mt-4 flex gap-3">
                      <button type="button" onClick={reset} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">Cancel</button>
                      <button type="button" disabled={loading || rfidRecord?.status !== 'available'} onClick={confirmAssignment} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{loading ? 'Assigning...' : 'Assign RFID'}</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RfidAssignmentPage;
