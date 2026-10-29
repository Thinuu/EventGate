import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getMyEvents } from '../../api/events';
import { assignInventoryRfid } from '../../api/rfid';
import { lookupAttendee } from '../../api/entry';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';
import { QrCodeIcon, IdentificationIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const RfidAssignmentPage = () => {
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const hasPermission = permissions.canAssignRfid;

  if (!hasPermission) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-red-600 text-lg font-semibold">You do not have permission to assign RFID.</p>
        </div>
      </DashboardLayout>
    );
  }
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [step, setStep] = useState('scan-qr'); // 'scan-qr', 'scan-rfid', 'confirm', 'success'
  const [qrInput, setQrInput] = useState('');
  const [rfidInput, setRfidInput] = useState('');
  const [attendee, setAttendee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await getMyEvents();
      const nextEvents = response.data?.data?.events || [];
      setEvents(nextEvents);
      const lastEventId = localStorage.getItem('lastSelectedEventId');
      const current = nextEvents.find((e) => e._id === lastEventId) || nextEvents[0];
      if (current) setSelectedEvent(current);
    } catch (err) {
      toast.error('Failed to load events');
    }
  };

  const handleQrSubmit = async (e) => {
    e.preventDefault();
    if (!qrInput.trim()) return;
    if (!((selectedEvent?.settings?.rfidEnabled || selectedEvent?.rfidEnabled) || selectedEvent?.rfidEnabled)) {
      toast.error('RFID is disabled for this event');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await lookupAttendee(qrInput.trim());
      const foundAttendee = response.data?.data?.attendee;
      if (!foundAttendee) {
        setError('Attendee not found. Please scan a valid QR code.');
        return;
      }
      if (foundAttendee.event?._id !== selectedEvent._id) {
        setError('This attendee belongs to a different event.');
        return;
      }
      if (foundAttendee.rfidTag) {
        setError('This attendee already has an RFID tag assigned.');
        return;
      }
      setAttendee(foundAttendee);
      setStep('scan-rfid');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to find attendee');
    } finally {
      setLoading(false);
    }
  };

  const handleRfidSubmit = async (e) => {
    e.preventDefault();
    if (!rfidInput.trim()) return;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(rfidInput.trim())) {
      setError('RFID must be 1–64 letters, digits, underscores or hyphens');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await assignInventoryRfid(attendee._id, rfidInput.trim(), false);
      if (response.data?.success) {
        setStep('success');
        toast.success('RFID assigned successfully');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign RFID');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('scan-qr');
    setQrInput('');
    setRfidInput('');
    setAttendee(null);
    setError('');
  };

  const handleReplace = async () => {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(rfidInput.trim())) {
      setError('RFID must be 1–64 letters, digits, underscores or hyphens');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await assignInventoryRfid(attendee._id, rfidInput.trim(), true);
      if (response.data?.success) {
        setStep('success');
        toast.success('RFID reassigned successfully');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reassign RFID');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedEvent && events.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-500">No events assigned to you</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-600">RFID Assignment</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Assign RFID to Attendee</h1>
          <p className="mt-1 text-sm text-slate-500">
            Scan attendee QR code, then scan RFID tag to assign. Both credentials will work for check-in.
          </p>
        </div>

        {events.length > 1 && (
          <div>
            <label className="text-xs font-semibold text-slate-500">Select Event</label>
            <select
              value={selectedEvent?._id || ''}
              onChange={(e) => {
                const event = events.find((ev) => ev._id === e.target.value);
                setSelectedEvent(event);
                localStorage.setItem('lastSelectedEventId', e.target.value);
                handleReset();
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"
            >
              {events.map((event) => (
                <option key={event._id} value={event._id}>
                  {event.name} {event.settings?.rfidEnabled ? '(RFID Enabled)' : '(RFID Disabled)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {!((selectedEvent?.settings?.rfidEnabled || selectedEvent?.rfidEnabled) || selectedEvent?.rfidEnabled) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">RFID is disabled for this event</p>
            <p className="mt-1 text-xs text-amber-600">
              Only QR scanning is available. Contact an administrator to enable RFID for this event.
            </p>
          </div>
        )}

        {(selectedEvent?.settings?.rfidEnabled || selectedEvent?.rfidEnabled) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step === 'scan-qr' ? 'bg-teal-600 text-white' : step === 'scan-rfid' || step === 'confirm' || step === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                1
              </div>
              <div className={`h-1 w-12 ${step === 'scan-qr' ? 'bg-slate-200' : 'bg-emerald-600'}`} />
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step === 'scan-rfid' ? 'bg-teal-600 text-white' : step === 'confirm' || step === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                2
              </div>
              <div className={`h-1 w-12 ${step === 'confirm' || step === 'success' ? 'bg-emerald-600' : 'bg-slate-200'}`} />
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${step === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                3
              </div>
            </div>

            {/* Step 1: Scan QR */}
            {step === 'scan-qr' && (
              <div className="space-y-4">
                <div className="text-center">
                  <QrCodeIcon className="mx-auto h-16 w-16 text-teal-600" />
                  <h2 className="mt-4 text-xl font-bold text-slate-900">Scan Attendee QR Code</h2>
                  <p className="mt-2 text-sm text-slate-500">Scan or enter the QR code from the attendee's ticket</p>
                </div>
                <form onSubmit={handleQrSubmit}>
                  <input
                    type="text"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder="Scan QR code or enter token..."
                    className="w-full rounded-xl border border-teal-300 bg-teal-50 px-4 py-4 text-center font-mono text-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    autoFocus
                  />
                  {error && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                      <XCircleIcon className="h-5 w-5" />
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={loading || !qrInput.trim()}
                    className="mt-4 w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-teal-500"
                  >
                    {loading ? 'Looking up attendee...' : 'Find Attendee'}
                  </button>
                </form>
              </div>
            )}

            {/* Step 2: Scan RFID */}
            {step === 'scan-rfid' && attendee && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-bold text-slate-900">Attendee Found</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><span className="font-semibold">Name:</span> {attendee.fullName}</p>
                    <p><span className="font-semibold">Category:</span> {attendee.categoryName}</p>
                    <p><span className="font-semibold">Ticket:</span> {attendee.ticket?.ticketNumber || '-'}</p>
                  </div>
                </div>

                <div className="text-center">
                  <IdentificationIcon className="mx-auto h-16 w-16 text-emerald-600" />
                  <h2 className="mt-4 text-xl font-bold text-slate-900">Scan RFID Tag</h2>
                  <p className="mt-2 text-sm text-slate-500">Tap RFID card to assign to this attendee</p>
                </div>
                <form onSubmit={handleRfidSubmit}>
                  <input
                    type="text"
                    value={rfidInput}
                    onChange={(e) => setRfidInput(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))}
                    placeholder="Tap RFID card..."
                    className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-4 text-center font-mono text-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    inputMode="text"
                    maxLength={64}
                    autoFocus
                  />
                  {error && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                      <XCircleIcon className="h-5 w-5" />
                      {error}
                    </div>
                  )}
                  <div className="mt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !rfidInput.trim()}
                      className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:bg-emerald-500"
                    >
                      {loading ? 'Assigning...' : 'Assign RFID'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 3: Success */}
            {step === 'success' && (
              <div className="space-y-4 text-center">
                <CheckCircleIcon className="mx-auto h-20 w-20 text-emerald-600" />
                <h2 className="text-2xl font-bold text-slate-900">RFID Assigned Successfully</h2>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
                  <h3 className="font-bold text-slate-900">Assignment Details</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><span className="font-semibold">Attendee:</span> {attendee?.fullName}</p>
                    <p><span className="font-semibold">RFID Tag:</span> {rfidInput}</p>
                    <p><span className="font-semibold">Event:</span> {selectedEvent?.name}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-500">
                  The attendee can now use either their QR code or RFID tag for check-in/check-out.
                </p>
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-500"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Assign Another RFID
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RfidAssignmentPage;
