import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getUsers, createUser, updateUser, deleteUser, resendUserCredentials } from '../../api/users';
import { getAllEventsAdmin } from '../../api/events';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { ROLES } from '../../utils/rbac';
import { UserPlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

const roleColors = {
  [ROLES.MAIN_ADMIN]: 'green',
  [ROLES.MAIN_ORGANISER]: 'blue',
  [ROLES.SUB_ORGANISER]: 'indigo',
  [ROLES.STAFF]: 'cyan',
  [ROLES.VOLUNTEER]: 'sky',
  [ROLES.AUDITOR]: 'blue',
  [ROLES.ATTENDEE]: 'gray',
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filterRole, setFilterRole] = useState('');
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', phone: '', role: ROLES.MAIN_ORGANISER, password: '' });

  const load = async (nextPage = page) => {
    setLoading(true);
    try {
      const response = await getUsers({ page: nextPage, limit: 20, role: filterRole || undefined });
      setUsers(response.data?.data?.users || []);
      setPage(response.data?.data?.page || 1);
      setPages(response.data?.data?.pages || 1);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [filterRole]);

  useEffect(() => {
    getAllEventsAdmin({ limit: 100 }).then((res) => setEvents(res.data?.data?.events || []));
  }, []);

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    return users.filter((u) =>
      `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: inviteForm.name,
        email: inviteForm.email,
        phone: inviteForm.phone,
        role: inviteForm.role,
        password: inviteForm.password || `Temp${Math.random().toString(36).slice(2, 8)}!`,
      };
      await createUser(payload);
      toast.success('User invited');
      setShowInvite(false);
      setInviteForm({ name: '', email: '', phone: '', role: ROLES.MAIN_ORGANISER, password: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invite failed');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    try {
      await updateUser(editingUser._id, {
        role: editingUser.role,
        status: editingUser.status,
        assignedEvent: editingUser.assignedEvent || null,
      });
      toast.success('User updated');
      setShowEdit(false);
      setEditingUser(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await deleteUser(userId);
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleResendCredentials = async (userId) => {
    try {
      await resendUserCredentials(userId);
      toast.success('Login details email sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send login details');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-semibold">Identity Management</p>
            <h1 className="text-3xl font-bold text-slate-900">All Users / Organisers</h1>
            <p className="text-sm text-slate-500">Manage roles, access, and assignments across the system.</p>
          </div>
          <Button className="bg-teal-600 hover:bg-teal-500" onClick={() => setShowInvite(true)}>
            <UserPlusIcon className="h-4 w-4 mr-2" /> Invite New Organiser
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr_0.4fr]">
          <input
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-600"
          >
            <option value="">All Roles</option>
            {Object.values(ROLES).map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <Button variant="outline" onClick={() => { setSearch(''); setFilterRole(''); }}>Reset</Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <Table>
            <thead className="bg-slate-50/60">
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Role</Th>
                <Th>Assigned Event</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <Tr key={user._id}>
                  <Td className="font-semibold text-slate-900">{user.name}</Td>
                  <Td>{user.email}</Td>
                  <Td>{user.phone || '-'}</Td>
                  <Td><Badge color={roleColors[user.role] || 'gray'}>{user.role}</Badge></Td>
                  <Td>{user.assignedEvents?.[0]?.name || 'Unassigned'}</Td>
                  <Td>
                    <Badge color={user.status === 'Active' ? 'green' : 'gray'}>
                      {user.status || 'Active'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingUser({ ...user, assignedEvent: user.assignedEvents?.[0]?._id || '' }); setShowEdit(true); }}
                        className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
                      >
                        <PencilSquareIcon className="h-4 w-4" /> Edit
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await updateUser(user._id, { status: user.status === 'Active' ? 'Inactive' : 'Active' });
                            toast.success('Status updated');
                            load();
                          } catch (err) {
                            toast.error('Failed to update status');
                          }
                        }}
                        className={`text-xs ${user.status === 'Active' ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'} flex items-center gap-1`}
                      >
                        {user.status === 'Active' ? 'Disable' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleResendCredentials(user._id)}
                        className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
                      >
                        Resend login
                      </button>
                      <button
                        onClick={() => handleDelete(user._id)}
                        className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"
                      >
                        <TrashIcon className="h-4 w-4" /> Delete
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-10 text-center text-sm text-slate-500">No users found.</td>
                </tr>
              )}
            </tbody>
          </Table>
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</Button>
              <Button variant="outline" disabled={page >= pages} onClick={() => load(page + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite New Organiser">
        <form onSubmit={handleInvite} className="space-y-4">
          <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Full name" value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} required />
          <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Email" type="email" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} required />
          <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Phone" value={inviteForm.phone} onChange={(e) => setInviteForm((f) => ({ ...f, phone: e.target.value }))} />
          <select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}>
            {[ROLES.MAIN_ORGANISER, ROLES.SUB_ORGANISER, ROLES.STAFF, ROLES.VOLUNTEER, ROLES.AUDITOR].map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <input className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Temporary password" value={inviteForm.password} onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))} />
          <div className="flex gap-3">
            <Button type="submit" loading={saving} className="bg-teal-600 hover:bg-teal-500">Send Invite</Button>
            <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit User">
        {editingUser && (
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="text-sm font-semibold text-slate-800">{editingUser.name}</div>
            <select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={editingUser.role} onChange={(e) => setEditingUser((u) => ({ ...u, role: e.target.value }))}>
              {Object.values(ROLES).map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={editingUser.assignedEvent || ''} onChange={(e) => setEditingUser((u) => ({ ...u, assignedEvent: e.target.value }))}>
              <option value="">Unassigned</option>
              {events.map((event) => (
                <option key={event._id} value={event._id}>{event.name}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <Button type="submit" loading={saving} className="bg-teal-600 hover:bg-teal-500">Save</Button>
              <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default AdminUsers;
