import React, { useEffect, useState } from 'react';
import { getRfidInventory } from '../../api/rfid';
import { getMyEvents } from '../../api/events';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  UserIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';

const RfidAssignmentView = ({ embedded = false }) => {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [rfidTags, setRfidTags] = useState([]);
  const [counts, setCounts] = useState({ total: 0, assigned: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    getMyEvents().then((response) => {
      const list = response.data?.data?.events || [];
      setEvents(list);
      if (list.length > 0 && !selectedEventId) {
        const fallback = list[0]._id;
        setSelectedEventId(fallback);
        localStorage.setItem('lastSelectedEventId', fallback);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadRfidData(selectedEventId);
    }
  }, [selectedEventId]);

  const loadRfidData = async (eventId) => {
    setLoading(true);
    try {
      const response = await getRfidInventory({ eventId });
      setRfidTags(response.data?.data?.tags || []);
      setCounts(response.data?.data?.counts || { total: 0, assigned: 0 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load RFID data');
    } finally {
      setLoading(false);
    }
  };

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
  };

  const refreshData = () => {
    if (selectedEventId) loadRfidData(selectedEventId);
  };

  const assignedTags = rfidTags
    .filter((tag) => tag.status === 'ASSIGNED')
    .filter((tag) => {
      const q = searchQuery.toLowerCase();
      return (
        tag.rfidTag?.includes(q) ||
        tag.attendee?.fullName?.toLowerCase().includes(q) ||
        tag.attendee?.email?.toLowerCase().includes(q)
      );
    });

  const content = (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-600">RFID Operations</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Assigned RFID Tags</h2>
          <p className="mt-1 text-sm text-slate-500">View RFID tags assigned to attendees for this event</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedEventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-teal-500"
          >
            {events.map((event) => (
              <option key={event._id} value={event._id}>
                {event.name}
              </option>
            ))}
          </select>
          <button
            onClick={refreshData}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Assigned</p>
          <p className="mt-2 text-2xl font-bold text-teal-600">{loading ? '—' : counts.assigned}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Search Results</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{assignedTags.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by RFID tag or attendee name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500"
        />
      </div>

      {/* Assigned RFID Tags Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <h3 className="font-bold text-slate-900">Attendee Assignments</h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" />
          </div>
        ) : assignedTags.length === 0 ? (
          <div className="py-12 text-center">
            <IdentificationIcon className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">
              {searchQuery ? 'No matching assignments found' : 'No RFID tags assigned yet'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {searchQuery ? 'Try a different search term' : 'Tags will appear here when staff assign them to attendees'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">RFID Tag</th>
                  <th className="px-5 py-3 font-semibold">Attendee</th>
                  <th className="px-5 py-3 font-semibold">Contact</th>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignedTags.map((tag) => (
                  <tr key={tag._id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <span className="font-mono font-semibold text-teal-600">{tag.rfidTag}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                          <UserIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{tag.attendee?.fullName || 'Unknown'}</p>
                          {tag.attendee?.nationalId && (
                            <p className="text-xs text-slate-500">ID: {tag.attendee.nationalId}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-slate-700">{tag.attendee?.email || '-'}</p>
                      <p className="text-xs text-slate-500">{tag.attendee?.phone || '-'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {tag.ticket?.categoryName || tag.attendee?.categoryName || 'General'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {tag.assignedAt
                        ? new Date(tag.assignedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return embedded ? content : <div className="mx-auto max-w-6xl">{content}</div>;
};

export default RfidAssignmentView;