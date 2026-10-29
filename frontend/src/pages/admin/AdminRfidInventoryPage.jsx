import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { addInventoryRfid, getRfidInventory, uploadInventoryRfid, disableRfidTag, enableRfidTag, deleteRfidFromInventory, unassignRfidTag } from '../../api/rfid';
import { getAllEventsAdmin } from '../../api/events';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import AdminRfidAssignmentsPage from './AdminRfidAssignmentsPage';
import AdminRfidAccessLogsPage from './AdminRfidAccessLogsPage';
import {
  XMarkIcon,
  TrashIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

const ActionModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, confirmStyle, loading }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ExclamationTriangleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-600">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 border-t border-slate-100 p-5">
          <button
            disabled={loading}
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white transition disabled:opacity-50 ${confirmStyle}`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminRfidInventoryPage = ({ embedded = false }) => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    ['inventory', 'assignments', 'access-logs'].includes(tabParam) ? tabParam : 'inventory'
  );

  useEffect(() => {
    if (tabParam && ['inventory', 'assignments', 'access-logs'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tabKey);
    setSearchParams(newParams, { replace: true });
  };

  const [tags, setTags] = useState([]);
  const [counts, setCounts] = useState({ total: 0, available: 0, assigned: 0, disabled: 0 });
  const [events, setEvents] = useState([]);
  const [manualTags, setManualTags] = useState('');
  const [singleTag, setSingleTag] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [eventFilter, setEventFilter] = useState('ALL'); // eventId or 'ALL'

  // Unique event names for the event filter dropdown
  const eventNames = useMemo(() => {
    return events.sort((a, b) => a.name.localeCompare(b.name));
  }, [events]);

  // Filtered tags (server-side filtering only)
  const filteredTags = tags;

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setEventFilter('ALL');
  };

  const handleSelectAll = () => {
    if (selectedTags.size === filteredTags.length) {
      setSelectedTags(new Set());
    } else {
      setSelectedTags(new Set(filteredTags.map((t) => t._id)));
    }
  };

  const handleSelectTag = (tagId) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId);
    } else {
      newSelected.add(tagId);
    }
    setSelectedTags(newSelected);
  };

  const handleBulkUnassign = async () => {
    if (selectedTags.size === 0) return toast.error('No tags selected');
    setBulkActionLoading(true);
    try {
      const selectedTagData = filteredTags.filter((t) => selectedTags.has(t._id));
      const assignedTags = selectedTagData.filter((t) => t.status === 'ASSIGNED');
      
      if (assignedTags.length === 0) {
        return toast.error('No assigned tags selected');
      }

      let successCount = 0;
      for (const tag of assignedTags) {
        try {
          await unassignRfidTag(tag.rfidTag, 'Bulk unassigned by admin');
          successCount++;
        } catch (err) {
          console.error(`Failed to unassign ${tag.rfidTag}:`, err);
        }
      }

      toast.success(`Unassigned ${successCount} of ${assignedTags.length} tags`);
      setSelectedTags(new Set());
      loadTags();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to bulk unassign tags');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDisable = async () => {
    if (selectedTags.size === 0) return toast.error('No tags selected');
    setBulkActionLoading(true);
    try {
      const selectedTagData = filteredTags.filter((t) => selectedTags.has(t._id));
      const availableTags = selectedTagData.filter((t) => t.status === 'AVAILABLE');
      
      if (availableTags.length === 0) {
        return toast.error('No available tags selected (cannot disable assigned tags)');
      }

      let successCount = 0;
      for (const tag of availableTags) {
        try {
          await disableRfidTag(tag.rfidTag, 'Bulk disabled by admin');
          successCount++;
        } catch (err) {
          console.error(`Failed to disable ${tag.rfidTag}:`, err);
        }
      }

      toast.success(`Disabled ${successCount} of ${availableTags.length} tags`);
      setSelectedTags(new Set());
      loadTags();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to bulk disable tags');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTags.size === 0) return toast.error('No tags selected');
    setModalConfig({
      title: 'Delete Selected RFID Tags',
      message: `Are you sure you want to delete ${selectedTags.size} RFID tag(s) from inventory? This action cannot be undone.`,
      confirmText: 'Delete',
      confirmStyle: 'bg-red-600 hover:bg-red-700',
      action: async () => {
        setBulkActionLoading(true);
        try {
          const selectedTagData = filteredTags.filter((t) => selectedTags.has(t._id));
          const deletableTags = selectedTagData.filter((t) => t.status !== 'ASSIGNED');
          
          if (deletableTags.length === 0) {
            setBulkActionLoading(false);
            setModalOpen(false);
            return toast.error('Cannot delete assigned tags. Please unassign them first.');
          }

          let successCount = 0;
          for (const tag of deletableTags) {
            try {
              await deleteRfidFromInventory(tag.rfidTag);
              successCount++;
            } catch (err) {
              console.error(`Failed to delete ${tag.rfidTag}:`, err);
            }
          }

          toast.success(`Deleted ${successCount} of ${deletableTags.length} tags`);
          setSelectedTags(new Set());
          loadTags();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to bulk delete tags');
        } finally {
          setBulkActionLoading(false);
          setModalOpen(false);
        }
      },
      actionData: null,
    });
    setModalOpen(true);
  };

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'ALL' || eventFilter !== 'ALL';

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: '',
    message: '',
    confirmText: 'Confirm',
    confirmStyle: 'bg-teal-600 hover:bg-teal-700',
    action: null,
    actionData: null,
  });

  const loadTags = async () => {
    try {
      const params = {};
      if (eventFilter !== 'ALL') params.eventId = eventFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;

      const response = await getRfidInventory(params);
      setTags(response.data?.data?.tags || []);
      setCounts(response.data?.data?.counts || { total: 0, available: 0, assigned: 0, disabled: 0 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load RFID inventory');
    }
  };

  const loadEvents = async () => {
    try {
      const response = await getAllEventsAdmin({ limit: 1000 });
      setEvents(response.data?.data?.events || []);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  useEffect(() => { loadTags(); loadEvents(); }, []);

  // Reload tags when filters change
  useEffect(() => {
    const params = {};
    if (eventFilter !== 'ALL') params.eventId = eventFilter;
    if (statusFilter !== 'ALL') params.status = statusFilter;
    if (searchTerm) params.search = searchTerm;

    getRfidInventory(params)
      .then((response) => {
        setTags(response.data?.data?.tags || []);
        setCounts(response.data?.data?.counts || { total: 0, available: 0, assigned: 0, disabled: 0 });
      })
      .catch((error) => {
        toast.error(error.response?.data?.message || 'Failed to load RFID inventory');
      });
  }, [eventFilter, statusFilter, searchTerm]);

  // Re-fetch inventory whenever the inventory tab is activated
  useEffect(() => {
    if (activeTab === 'inventory') {
      loadTags();
    }
  }, [activeTab]);

  const addManual = async (e) => {
    e.preventDefault();
    const values = manualTags.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean);
    if (!values.length) return toast.error('Enter at least one RFID code');
    setLoading(true);
    try {
      const response = await addInventoryRfid(values);
      toast.success(`${response.data?.data?.added || 0} RFID tags added`);
      setManualTags('');
      loadTags();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add RFID tags');
    } finally { setLoading(false); }
  };

  const addSingle = async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = singleTag.trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) return toast.error('RFID must be 1–64 letters, digits, underscores or hyphens');
    try {
      const response = await addInventoryRfid([value]);
      if (!response.data?.data?.added) return toast.error('RFID already exists or was invalid');
      toast.success('RFID assigned to inventory');
      setSingleTag('');
      loadTags();
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to add RFID'); }
  };

  const upload = async (e) => {
    const nextFile = e.target.files?.[0];
    setFile(nextFile || null);
    if (!nextFile) return;
    setLoading(true);
    try {
      const response = await uploadInventoryRfid(nextFile);
      toast.success(`${response.data?.data?.added || 0} RFID tags imported`);
      loadTags();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to import RFID Excel file');
    } finally { setLoading(false); setFile(null); e.target.value = ''; }
  };

  // Disable an available RFID tag
  const handleDisable = (rfidTag) => {
    setModalConfig({
      title: 'Disable RFID Tag',
      message: `Are you sure you want to disable RFID ${rfidTag}? It will be marked as disabled and unavailable for assignment.`,
      confirmText: 'Disable',
      confirmStyle: 'bg-amber-600 hover:bg-amber-700',
      action: async () => {
        setActionLoading(rfidTag);
        try {
          await disableRfidTag(rfidTag, 'Manually disabled by admin');
          toast.success(`RFID ${rfidTag} disabled`);
          loadTags();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to disable RFID');
        } finally { setActionLoading(null); setModalOpen(false); }
      },
      actionData: rfidTag,
    });
    setModalOpen(true);
  };

  // Re-enable a disabled RFID tag
  const handleEnable = (rfidTag) => {
    setModalConfig({
      title: 'Enable RFID Tag',
      message: `Are you sure you want to enable RFID ${rfidTag}? It will become available for assignment.`,
      confirmText: 'Enable',
      confirmStyle: 'bg-emerald-600 hover:bg-emerald-700',
      action: async () => {
        setActionLoading(rfidTag);
        try {
          await enableRfidTag(rfidTag);
          toast.success(`RFID ${rfidTag} enabled`);
          loadTags();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to enable RFID');
        } finally { setActionLoading(null); setModalOpen(false); }
      },
      actionData: rfidTag,
    });
    setModalOpen(true);
  };

  // Delete a non-assigned RFID tag from inventory (admin only)
  const handleDelete = (rfidTag) => {
    setModalConfig({
      title: 'Delete RFID Tag',
      message: `Are you sure you want to delete RFID ${rfidTag} from inventory? This action cannot be undone.`,
      confirmText: 'Delete',
      confirmStyle: 'bg-red-600 hover:bg-red-700',
      action: async () => {
        setActionLoading(rfidTag);
        try {
          await deleteRfidFromInventory(rfidTag);
          toast.success(`RFID ${rfidTag} deleted from inventory`);
          loadTags();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to delete RFID');
        } finally { setActionLoading(null); setModalOpen(false); }
      },
      actionData: rfidTag,
    });
    setModalOpen(true);
  };

  // Unassign an RFID from an assigned attendee
  const handleUnassign = (rfidTag) => {
    setModalConfig({
      title: 'Unassign RFID Tag',
      message: `Are you sure you want to unassign RFID ${rfidTag} from its attendee? The tag will become available for reassignment.`,
      confirmText: 'Unassign',
      confirmStyle: 'bg-amber-600 hover:bg-amber-700',
      action: async () => {
        setActionLoading(rfidTag);
        try {
          await unassignRfidTag(rfidTag, 'Manually unassigned by admin');
          toast.success(`RFID ${rfidTag} unassigned and is now available`);
          loadTags();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to unassign RFID');
        } finally { setActionLoading(null); setModalOpen(false); }
      },
      actionData: rfidTag,
    });
    setModalOpen(true);
  };

  const content = (
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => handleTabChange('inventory')}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === 'inventory'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            Physical Tag Inventory
          </button>
          <button
            onClick={() => handleTabChange('assignments')}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === 'assignments'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            Tag Assignments
          </button>
          <button
            onClick={() => handleTabChange('access-logs')}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === 'access-logs'
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            RFID Access Logs
          </button>
        </div>

        {activeTab === 'assignments' ? (
          <AdminRfidAssignmentsPage embedded />
        ) : activeTab === 'access-logs' ? (
          <AdminRfidAccessLogsPage embedded />
        ) : (
          <>

        <div className="grid gap-4 sm:grid-cols-4">
          {[['Total', counts.total, 'text-slate-900'], ['Available', counts.available, 'text-emerald-600'], ['Assigned', counts.assigned, 'text-teal-600'], ['Disabled', counts.disabled, 'text-amber-600']].map(([label, value, color]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p></div>)}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <form onSubmit={addManual} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Add RFID manually</h2>
            <p className="mt-1 text-xs text-slate-500">Tap one card into the focused field, or paste multiple codes below.</p>
            <input value={singleTag} onChange={(e) => setSingleTag(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))} onKeyDown={addSingle} autoFocus maxLength={64} inputMode="text" placeholder="Tap card to add one RFID..." className="mt-4 w-full rounded-xl border border-teal-300 bg-teal-50 p-3 text-center font-mono tracking-[0.2em] outline-none focus:ring-2 focus:ring-teal-500" />
            <textarea value={manualTags} onChange={(e) => setManualTags(e.target.value)} rows={6} placeholder="1234567890\n1234567891" className="mt-4 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm" />
            <button disabled={loading} className="mt-3 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Add RFID tags</button>
          </form>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Import Excel inventory</h2>
            <p className="mt-1 text-xs text-slate-500">Upload an `.xlsx` file with a column named `RFID Tag` or `rfidTag`.</p>
            <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-teal-200 bg-teal-50 px-4 py-10 text-sm font-semibold text-teal-700">
              {file ? file.name : 'Choose Excel file'}
              <input type="file" accept=".xlsx,.xls,.csv" onChange={upload} className="hidden" />
            </label>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Table header + filter bar */}
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-900">RFID Inventory · <a href="/admin/hardware" className="text-teal-600 underline">Hardware & AI</a></span>
              <span className="text-xs font-normal text-slate-500">
                {filteredTags.length} of {tags.length} tags
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {/* Search */}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by RFID or attendee..."
                className="flex-1 min-w-[180px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              />
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              >
                <option value="ALL">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="DISABLED">Disabled</option>
              </select>
              {/* Event filter */}
              {events.length > 0 && (
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="ALL">All Events</option>
                  {events.map((ev) => (
                    <option key={ev._id} value={ev._id}>
                      {ev.name}
                    </option>
                  ))}
                </select>
              )}
              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            {/* Bulk action bar */}
            {selectedTags.size > 0 && (
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-teal-50 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-teal-900">
                    {selectedTags.size} tag{selectedTags.size !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={() => setSelectedTags(new Set())}
                    className="text-xs text-teal-600 hover:text-teal-800 font-medium"
                  >
                    Clear selection
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkUnassign}
                    disabled={bulkActionLoading}
                    className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-50"
                  >
                    Unassign All
                  </button>
                  <button
                    onClick={handleBulkDisable}
                    disabled={bulkActionLoading}
                    className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Disable All
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkActionLoading}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Delete All
                  </button>
                </div>
              </div>
            )}
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedTags.size === filteredTags.length && filteredTags.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                  </th>
                  <th className="px-5 py-3">RFID</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Event</th>
                  <th className="px-5 py-3">Attendee</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTags.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                      {hasActiveFilters ? 'No tags match the current filters.' : 'No RFID tags in inventory.'}
                    </td>
                  </tr>
                ) : (
                  filteredTags.map((tag) => (
                    <tr key={tag._id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          checked={selectedTags.has(tag._id)}
                          onChange={() => handleSelectTag(tag._id)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-5 py-3 font-mono">{tag.rfidTag}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          tag.status === 'ASSIGNED'
                            ? 'bg-teal-50 text-teal-700'
                            : tag.status === 'DISABLED'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {tag.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{tag.event?.name || '-'}</td>
                      <td className="px-5 py-3 text-slate-600">{tag.attendee?.fullName || '-'}</td>
                      <td className="px-5 py-3">
                        {tag.status === 'ASSIGNED' && (
                          <button
                            onClick={() => handleUnassign(tag.rfidTag)}
                            disabled={actionLoading === tag.rfidTag}
                            className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50"
                          >
                            <ArrowPathIcon className="h-3.5 w-3.5" /> Unassign
                          </button>
                        )}
                        {tag.status === 'AVAILABLE' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDisable(tag.rfidTag)}
                              disabled={actionLoading === tag.rfidTag}
                              className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50"
                            >
                              <XMarkIcon className="h-3.5 w-3.5" /> Disable
                            </button>
                            <button
                              onClick={() => handleDelete(tag.rfidTag)}
                              disabled={actionLoading === tag.rfidTag}
                              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            >
                              <TrashIcon className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        )}
                        {tag.status === 'DISABLED' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEnable(tag.rfidTag)}
                              disabled={actionLoading === tag.rfidTag}
                              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-50"
                            >
                              <ArrowPathIcon className="h-3.5 w-3.5" /> Enable
                            </button>
                            <button
                              onClick={() => handleDelete(tag.rfidTag)}
                              disabled={actionLoading === tag.rfidTag}
                              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            >
                              <TrashIcon className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* Action Modal */}
        <ActionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onConfirm={modalConfig.action}
          title={modalConfig.title}
          message={modalConfig.message}
          confirmText={modalConfig.confirmText}
          confirmStyle={modalConfig.confirmStyle}
          loading={actionLoading !== null}
        />
        </>
        )}
      </div>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
};

export default AdminRfidInventoryPage;
