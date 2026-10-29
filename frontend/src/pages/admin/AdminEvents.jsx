import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getAllEventsAdmin, assignOrganiser, publishEvent, updateEvent, deleteEvent, duplicateAdminEvent } from '../../api/events';
import { getUsers } from '../../api/users';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const statusColor = { draft: 'gray', published: 'green', ongoing: 'blue', completed: 'gray', cancelled: 'red' };

const AdminEvents = () => {
  const [events, setEvents] = useState([]);
  const [organisers, setOrganisers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filters, setFilters] = useState({ status: '', search: '', from: '', to: '' });
  const [duplicateModal, setDuplicateModal] = useState({ isOpen: false, eventId: null, name: '', startDate: '', endDate: '' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, eventId: null, name: '' });

  const load = async (nextPage = page) => {
    setLoading(true);
    try {
      const response = await getAllEventsAdmin({
        page: nextPage,
        limit: 12,
        status: filters.status || undefined,
        search: filters.search || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
      setEvents(response.data?.data?.events || []);
      setPage(response.data?.data?.page || 1);
      setPages(response.data?.data?.pages || 1);
    } catch (err) {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getUsers({ role: 'MainOrganiser', limit: 200 }).then((res) => setOrganisers(res.data?.data?.users || []));
  }, []);

  useEffect(() => { load(1); }, [filters.status, filters.search, filters.from, filters.to]);

  const handleAssign = async (eventId, organiserId) => {
    try {
      await assignOrganiser(eventId, organiserId);
      toast.success('Organiser assigned');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assignment failed');
    }
  };

  const handlePublishToggle = async (event) => {
    try {
      if (event.status === 'published') {
        await updateEvent(event._id, { status: 'draft' });
        toast.success('Event unpublished');
      } else {
        await publishEvent(event._id);
        toast.success('Event published');
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const handleDelete = (event) => {
    // Open delete confirmation modal
    setDeleteModal({ isOpen: true, eventId: event._id, name: event.name });
  };

  const confirmDelete = async () => {
    try {
      await deleteEvent(deleteModal.eventId);
      // Success feedback handled via UI update
      load();
    } catch (err) {
      // Error feedback handled via UI; no toast
    } finally {
      setDeleteModal({ isOpen: false, eventId: null, name: '' });
    }
  };

  const handleDuplicateSubmit = async (e) => {
    e.preventDefault();
    if (!duplicateModal.name || !duplicateModal.startDate || !duplicateModal.endDate) {
      return toast.error('Please fill in all fields.');
    }
    try {
      await duplicateAdminEvent(duplicateModal.eventId, {
        newName: duplicateModal.name,
        newStartDate: duplicateModal.startDate,
        newEndDate: duplicateModal.endDate,
      });
      toast.success('Event duplicated successfully');
      setDuplicateModal({ isOpen: false, eventId: null, name: '', startDate: '', endDate: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Duplication failed');
    }
  };

  const filteredCountLabel = useMemo(() => {
    if (!filters.search && !filters.status && !filters.from && !filters.to) return 'All events';
    return 'Filtered results';
  }, [filters]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-semibold">Events Registry</p>
            <h1 className="text-3xl font-bold text-slate-900">All Events</h1>
            <p className="text-sm text-slate-500">Manage every event, status, and organiser assignment.</p>
          </div>
          <Link to="/admin/events/new"><Button className="bg-teal-600 hover:bg-teal-500">Create New Event</Button></Link>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.6fr]">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search by event name"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
            />
          </div>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          />
          <div className="relative">
            <FunnelIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-8 text-xs font-black uppercase tracking-widest text-slate-600"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700">{filteredCountLabel}</p>
            <p className="text-xs text-slate-400">Page {page} of {pages}</p>
          </div>
          <Table>
            <thead className="bg-slate-50/60">
              <tr>
                <Th>Event Name</Th>
                <Th>Date</Th>
                <Th>Venue</Th>
                <Th>Status</Th>
                <Th>Ticket Categories</Th>
                <Th>Total Attendees</Th>
                <Th>Organiser</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <Tr key={event._id}>
                  <Td className="font-semibold text-slate-900">{event.name}</Td>
                  <Td>{event.startDate ? format(new Date(event.startDate), 'MMM d, yyyy') : '-'}</Td>
                  <Td>{event.venue?.name || '-'}</Td>
                  <Td><Badge color={statusColor[event.status] || 'gray'}>{event.status}</Badge></Td>
                  <Td>{event.ticketCategoryCount || 0}</Td>
                  <Td>{event.totalAttendees || 0}</Td>
                  <Td>
                    <select
                      onChange={(e) => handleAssign(event._id, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                      value={event.mainOrganiser?._id || ''}
                    >
                      <option value="">Unassigned</option>
                      {organisers.map((org) => (
                        <option key={org._id} value={org._id}>{org.name}</option>
                      ))}
                    </select>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <Link to={`/events/${event.slug || event._id}`} className="text-slate-600 hover:text-slate-900">View</Link>
                      <Link to={`/admin/events/${event._id}/edit`} className="text-teal-600 hover:text-teal-700">Edit</Link>
                      <Link to={`/admin/rfid?eventId=${event._id}`} className="text-emerald-600 hover:text-emerald-700">RFID Inventory</Link>
                      <button onClick={() => handlePublishToggle(event)} className="text-teal-600 hover:text-teal-700">
                        {event.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button onClick={() => {
                        setDuplicateModal({ isOpen: true, eventId: event._id, name: event.name + ' (Copy)', startDate: '', endDate: '' });
                      }} className="text-emerald-600 hover:text-emerald-700">Duplicate</button>
                      <button onClick={() => handleDelete(event)} className="text-rose-600 hover:text-rose-700">Delete</button>
                    </div>
                  </Td>
                </Tr>
              ))}
              {!loading && events.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-10 text-center text-sm text-slate-500">
                    No events match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">Use filters to refine results.</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</Button>
              <Button variant="outline" disabled={page >= pages} onClick={() => load(page + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </div>

      {duplicateModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Duplicate Event</h3>
              <form onSubmit={handleDuplicateSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Event Name</label>
                  <input
                    type="text"
                    required
                    value={duplicateModal.name}
                    onChange={(e) => setDuplicateModal({ ...duplicateModal, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Start Date</label>
                  <input
                    type="datetime-local"
                    required
                    value={duplicateModal.startDate}
                    onChange={(e) => setDuplicateModal({ ...duplicateModal, startDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New End Date</label>
                  <input
                    type="datetime-local"
                    required
                    value={duplicateModal.endDate}
                    onChange={(e) => setDuplicateModal({ ...duplicateModal, endDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDuplicateModal({ isOpen: false, eventId: null, name: '', startDate: '', endDate: '' })}>Cancel</Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500">Duplicate</Button>
                </div>
              </form>
            </div>
          </div>
        )}
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Delete Event</h3>
              <p className="text-sm text-slate-700 mb-4">Are you sure you want to delete <strong>{deleteModal.name}</strong>? This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDeleteModal({ isOpen: false, eventId: null, name: '' })}>Cancel</Button>
                <Button type="button" className="bg-rose-600 hover:bg-rose-500" onClick={confirmDelete}>Delete</Button>
              </div>
            </div>
          </div>
        )}
    </DashboardLayout>
  );
};

export default AdminEvents;
