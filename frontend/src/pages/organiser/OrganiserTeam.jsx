import React, { useEffect, useState } from 'react';
import OrganiserLayout from '../../layouts/OrganiserLayout';
import {
  listSubOrganisers,
  createSubOrganiser,
  updateSubOrganiserStatus,
  getOrganiserTicketCategories,
  deleteSubOrganiser,
} from '../../api/organiser';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import {
  TrashIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

const DEFAULT_PERMISSIONS = {
  canCollectCash: false,
  canConfirmCashPayments: false,
  canApproveBankTransfer: false,
  canViewPayments: false,
  canProcessRefunds: false,
  canManagePaymentMethods: false,
  canViewPaymentHistory: false,
  canHandlePaymentDisputes: false,
  canGeneratePaymentReports: false,
  canAddAttendees: false,
  canPhotoVerification: false,
  canSendInvitations: false,
  canExcelBulkImports: false,
  canGateScanAccess: false,
  canViewEvents: false,
  canEditEvents: false,
  canViewAttendees: false,
  canEditAttendees: false,
  canViewTickets: false,
  canEditTickets: false,
  canScanTickets: false,
  canViewZones: false,
  canManageZones: false,
  canViewReports: false,
  canExportReports: false,
  canViewRevenue: false,
  canSendNotifications: false,
};

const OrganiserTeam = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    ...DEFAULT_PERMISSIONS,
  });
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  const load = () => {
    setLoading(true);
    listSubOrganisers()
      .then((res) => setUsers(res.data?.data?.users || []))
      .finally(() => setLoading(false));
  };

  const loadCategories = () => {
    const eventId = localStorage.getItem('lastSelectedEventId');
    if (!eventId) return;
    getOrganiserTicketCategories({ eventId })
      .then((res) => setCategories(res.data?.data?.categories || []))
      .catch((err) => console.error('Failed to load categories', err));
  };

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      ...DEFAULT_PERMISSIONS,
    });
    setSelectedCategories([]);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.password) {
      return toast.error('Please fill in all required fields (including password)');
    }
    setSubmitting(true);
    try {
      const permissions = { ...DEFAULT_PERMISSIONS };
      Object.keys(permissions).forEach((key) => {
        permissions[key] = form[key];
      });

      await createSubOrganiser({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        permissions,
        assignedCategories: selectedCategories,
        // Individual fields for backend compatibility
        ...permissions,
      });
      toast.success('Sub organiser invited successfully');
      setOpen(false);
      resetForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invite failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (user) => {
    setEditMode(true);
    setEditingUserId(user._id);
    const userPermissions = user.permissions || {};

    setForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      canCollectCash: user.canCollectCash || userPermissions.canCollectCash || false,
      canConfirmCashPayments: userPermissions.canConfirmCashPayments || false,
      canApproveBankTransfer: user.canApproveBankTransfer || userPermissions.canApproveBankTransfer || false,
      canViewPayments: userPermissions.canViewPayments || false,
      canProcessRefunds: userPermissions.canProcessRefunds || false,
      canManagePaymentMethods: userPermissions.canManagePaymentMethods || false,
      canViewPaymentHistory: userPermissions.canViewPaymentHistory || false,
      canHandlePaymentDisputes: userPermissions.canHandlePaymentDisputes || false,
      canGeneratePaymentReports: userPermissions.canGeneratePaymentReports || false,
      canAddAttendees: userPermissions.canAddAttendees || false,
      canPhotoVerification: userPermissions.canPhotoVerification || false,
      canSendInvitations: userPermissions.canSendInvitations || false,
      canExcelBulkImports: userPermissions.canExcelBulkImports || false,
      canGateScanAccess: userPermissions.canGateScanAccess || false,
      canViewEvents: userPermissions.canViewEvents || false,
      canEditEvents: userPermissions.canEditEvents || false,
      canViewAttendees: userPermissions.canViewAttendees || false,
      canEditAttendees: userPermissions.canEditAttendees || false,
      canViewTickets: userPermissions.canViewTickets || false,
      canEditTickets: userPermissions.canEditTickets || false,
      canScanTickets: userPermissions.canScanTickets || false,
      canViewZones: userPermissions.canViewZones || false,
      canManageZones: userPermissions.canManageZones || false,
      canViewReports: userPermissions.canViewReports || false,
      canExportReports: userPermissions.canExportReports || false,
      canViewRevenue: userPermissions.canViewRevenue || false,
      canSendNotifications: userPermissions.canSendNotifications || false,
    });

    loadCategories();
    // Mark already assigned categories
    getOrganiserTicketCategories({ eventId: localStorage.getItem('lastSelectedEventId') })
      .then((res) => {
        const cats = res.data?.data?.categories || [];
        setCategories(cats);
        const assigned = cats
          .filter((cat) => (cat.assignedSubOrganisers || []).includes(user._id))
          .map((cat) => cat._id);
        setSelectedCategories(assigned);
      })
      .catch((err) => console.error('Failed to load categories', err));

    setOpen(true);
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await deleteSubOrganiser(userToDelete._id);
      toast.success('Team member deleted successfully');
      setDeleteModalOpen(false);
      setUserToDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      return toast.error('Please fill in all required fields');
    }
    setSubmitting(true);
    try {
      const permissions = { ...DEFAULT_PERMISSIONS };
      Object.keys(permissions).forEach((key) => {
        permissions[key] = form[key];
      });

      const updateData = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        permissions,
        assignedCategories: selectedCategories,
        // Individual fields for backend compatibility
        ...permissions,
      };
      if (form.password) {
        updateData.password = form.password;
      }

      await updateSubOrganiserStatus(editingUserId, updateData);
      toast.success('Team member updated successfully');
      setOpen(false);
      setEditMode(false);
      setEditingUserId(null);
      resetForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setOpen(false);
    setEditMode(false);
    setEditingUserId(null);
    resetForm();
    setCategories([]);
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await updateSubOrganiserStatus(id, {
        status: currentStatus === 'Active' ? 'inactive' : 'active',
      });
      toast.success('Status updated successfully');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  };

  const toggleCashCollection = async (id, currentCanCollectCash) => {
    try {
      await updateSubOrganiserStatus(id, { canCollectCash: !currentCanCollectCash });
      toast.success('Cash collection permission updated successfully');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Permission update failed');
    }
  };

  const togglePermission = (key) => {
    setForm((f) => ({ ...f, [key]: !f[key] }));
  };

  const toggleCategory = (catId) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  // Permission groups for cleaner UI
  const permissionGroups = [
    {
      title: 'Payments',
      keys: [
        'canCollectCash',
        'canConfirmCashPayments',
        'canApproveBankTransfer',
        'canViewPayments',
        'canProcessRefunds',
        'canManagePaymentMethods',
        'canViewPaymentHistory',
        'canHandlePaymentDisputes',
        'canGeneratePaymentReports',
      ],
    },
    {
      title: 'Attendees & Access',
      keys: [
        'canAddAttendees',
        'canPhotoVerification',
        'canSendInvitations',
        'canExcelBulkImports',
        'canGateScanAccess',
        'canViewAttendees',
        'canEditAttendees',
      ],
    },
    {
      title: 'Events & Tickets',
      keys: [
        'canViewEvents',
        'canEditEvents',
        'canViewTickets',
        'canEditTickets',
        'canScanTickets',
        'canViewZones',
        'canManageZones',
      ],
    },
    {
      title: 'Reports & Notifications',
      keys: [
        'canViewReports',
        'canExportReports',
        'canViewRevenue',
        'canSendNotifications',
      ],
    },
  ];

  const permissionLabels = {
    canCollectCash: 'Collect Cash',
    canConfirmCashPayments: 'Confirm Cash Payments',
    canApproveBankTransfer: 'Approve Bank Transfer',
    canViewPayments: 'View Payments',
    canProcessRefunds: 'Process Refunds',
    canManagePaymentMethods: 'Manage Payment Methods',
    canViewPaymentHistory: 'View Payment History',
    canHandlePaymentDisputes: 'Handle Payment Disputes',
    canGeneratePaymentReports: 'Generate Payment Reports',
    canAddAttendees: 'Add Attendees',
    canPhotoVerification: 'Photo Verification',
    canSendInvitations: 'Send Invitations',
    canExcelBulkImports: 'Excel Bulk Imports',
    canGateScanAccess: 'Gate Scan Access',
    canViewEvents: 'View Events',
    canEditEvents: 'Edit Events',
    canViewAttendees: 'View Attendees',
    canEditAttendees: 'Edit Attendees',
    canViewTickets: 'View Tickets',
    canEditTickets: 'Edit Tickets',
    canScanTickets: 'Scan Tickets',
    canViewZones: 'View Zones',
    canManageZones: 'Manage Zones',
    canViewReports: 'View Reports',
    canExportReports: 'Export Reports',
    canViewRevenue: 'View Revenue',
    canSendNotifications: 'Send Notifications',
  };

  return (
    <OrganiserLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Team Management</h1>
            <p className="text-slate-500 mt-1">Manage your sub-organisers and team members</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              loadCategories();
              setOpen(true);
            }}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6"
          >
            + Add Team Member
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-slate-600 text-sm font-medium">Total Members</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{users.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-slate-600 text-sm font-medium">Active</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {users.filter((u) => u.status === 'Active').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-slate-600 text-sm font-medium">Inactive</p>
            <p className="text-2xl font-bold text-slate-500 mt-1">
              {users.filter((u) => u.status !== 'Active').length}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Name</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Email</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Phone</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Cash Collection</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Status</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900">{u.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">ID: {u._id?.slice(-6)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{u.email}</td>
                      <td className="px-6 py-4 text-slate-700">{u.phone || '—'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() =>
                            toggleCashCollection(
                              u._id,
                              u.canCollectCash || u.permissions?.canCollectCash
                            )
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            u.canCollectCash || u.permissions?.canCollectCash
                              ? 'bg-green-600'
                              : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              u.canCollectCash || u.permissions?.canCollectCash
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {u.status === 'Active' ? (
                            <>
                              <CheckCircleIcon className="w-4 h-4 text-green-600" />
                              <span className="inline-flex px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                Active
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircleIcon className="w-4 h-4 text-slate-400" />
                              <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                                Inactive
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(u)} className="text-xs">
                            <PencilIcon className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => toggleStatus(u._id, u.status)} className="text-xs">
                            {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteClick(u)}
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <TrashIcon className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-slate-400 text-4xl mb-3">👥</div>
              <p className="text-slate-500 font-medium">No team members yet</p>
              <p className="text-slate-400 text-sm mt-1">Add your first team member to get started</p>
              <Button size="sm" onClick={() => { resetForm(); loadCategories(); setOpen(true); }} className="mt-4">
                Add First Member
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={open}
        onClose={handleCloseModal}
        title={editMode ? 'Edit Team Member' : 'Add New Team Member'}
        size="lg"
      >
        <div className="mb-6">
          <div className="flex items-center gap-3 p-4 bg-teal-50 rounded-lg border border-teal-200">
            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-teal-900">
                {editMode ? 'Edit Team Member' : 'Add Team Member'}
              </h3>
              <p className="text-sm text-teal-700">
                {editMode
                  ? 'Update team member details and permissions'
                  : 'Create a new sub-organiser account with access to your event'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={editMode ? handleUpdate : handleCreate} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name *</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Enter full name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address *</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="john@example.com"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <p className="text-xs text-slate-500 mt-1">Invitation will be sent to this email</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Phone *</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Password {editMode ? '(leave blank to keep current)' : '*'}
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                type="password"
                placeholder={editMode ? '••••••••' : 'Set a password'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required={!editMode}
              />
            </div>
          </div>

          {/* Ticket Categories */}
          {categories.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Assigned Ticket Categories</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
                {categories.map((cat) => (
                  <label key={cat._id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat._id)}
                      onChange={() => toggleCategory(cat._id)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span>{cat.name || cat.title || cat._id}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Permissions */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Permissions</h4>
            <div className="space-y-4">
              {permissionGroups.map((group) => (
                <div key={group.title} className="border border-slate-200 rounded-lg p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                    {group.title}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.keys.map((key) => (
                      <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form[key]}
                          onChange={() => togglePermission(key)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span>{permissionLabels[key]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={handleCloseModal} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-700 text-white">
              {submitting ? 'Saving…' : editMode ? 'Update Member' : 'Invite Member'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        title="Delete Team Member"
        size="sm"
      >
        <p className="text-slate-600 mb-6">
          Are you sure you want to delete <strong>{userToDelete?.name}</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setDeleteModalOpen(false);
              setUserToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </Button>
        </div>
      </Modal>
    </OrganiserLayout>
  );
};

export default OrganiserTeam;