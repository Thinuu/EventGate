import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { getPendingPhotos, verifyPhoto } from '../../api/photoVerification';
import PhotoReviewModal from '../../components/photo/PhotoReviewModal';

const REASONS = [
  'Photo is blurry or low quality',
  'Face not clearly visible',
  'Photo does not match the person / ID',
  'Wearing sunglasses or hat',
  'Other (please specify)',
];

const PhotoVerifyPage = () => {
  const [attendees, setAttendees] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterEvent, setFilterEvent] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState(REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  const load = (eventId = filterEvent) => {
    setLoading(true);
    getPendingPhotos(eventId ? { eventId } : undefined)
      .then((res) => setAttendees(res.data?.data?.attendees || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();

    const handleEventSelect = (e) => {
      const newId = e.detail;
      setFilterEvent(newId);
      load(newId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, [filterEvent]);

  const events = useMemo(() => {
    const map = new Map();
    attendees.forEach((a) => {
      if (a.event?._id && !map.has(a.event._id)) {
        map.set(a.event._id, a.event);
      }
    });
    return Array.from(map.values());
  }, [attendees]);

  const handleVerify = async (ids) => {
    try {
      await Promise.all(ids.map((id) => verifyPhoto({ attendeeId: id, status: 'verified' })));
      toast.success('Photos verified');
      setSelectedIds([]);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    const reason = rejectReason === 'Other (please specify)' ? customReason : rejectReason;
    if (!reason) {
      toast.error('Please provide a reason');
      return;
    }
    try {
      await verifyPhoto({ attendeeId: selected._id, status: 'rejected', reason });
      toast.success('Photo rejected');
      setShowReject(false);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Photo Verification</h1>
            <p className="text-sm text-slate-500">Review pending attendee photos and approve or reject.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleVerify(selectedIds)} disabled={selectedIds.length === 0}>Verify Selected</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            <option value="">All Events</option>
            {events.map((event) => (
              <option key={event._id} value={event._id}>{event.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {attendees.map((attendee) => (
            <div key={attendee._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(attendee._id)}
                    onChange={(e) => {
                      setSelectedIds((prev) => e.target.checked
                        ? [...prev, attendee._id]
                        : prev.filter((id) => id !== attendee._id)
                      );
                    }}
                  />
                  Select
                </label>
                <span className="text-[10px] uppercase tracking-widest text-amber-600">Pending</span>
              </div>
              <div className="mt-3 h-40 rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
                {attendee.photo ? (
                  <img src={attendee.photo} alt="Attendee" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No photo</div>
                )}
              </div>
              <div className="mt-3">
                <p className="font-semibold text-slate-900">{attendee.fullName || attendee.email}</p>
                <p className="text-xs text-slate-500">{attendee.event?.name || '-'}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => { setSelected(attendee); }}>Review</Button>
              </div>
            </div>
          ))}
          {!loading && attendees.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              No pending photos.
            </div>
          )}
        </div>
      </div>

      <PhotoReviewModal
        open={!!selected}
        attendee={selected}
        onClose={() => setSelected(null)}
        onVerify={() => selected && handleVerify([selected._id])}
        onReject={() => setShowReject(true)}
      />

      <Modal open={showReject} onClose={() => setShowReject(false)} title="Reject Photo">
        <div className="space-y-4">
          <div className="space-y-2">
            {REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input type="radio" name="reason" checked={rejectReason === r} onChange={() => setRejectReason(r)} />
                {r}
              </label>
            ))}
          </div>
          {rejectReason === 'Other (please specify)' && (
            <input
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="Enter custom reason"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />
          )}
          <div className="flex gap-3">
            <Button onClick={handleReject} className="bg-red-600 hover:bg-red-500">Submit Rejection</Button>
            <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default PhotoVerifyPage;
