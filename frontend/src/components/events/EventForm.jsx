import React, { useState } from 'react';
import { format } from 'date-fns';
import Button from '../ui/Button';
import Card from '../ui/Card';

/** Set a nested value by dot-path, e.g. "settings.paymentMethods.card" */
const setByPath = (obj, path, value) => {
  const keys = path.split('.');
  const next = { ...obj };
  let cursor = next;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const child = cursor[key];
    cursor[key] =
      child && typeof child === 'object' && !Array.isArray(child)
        ? { ...child }
        : {};
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return next;
};

const EventForm = ({ initialData = {}, onSubmit, onCancel, loading, organisers = [], isAdmin = false }) => {
  const [form, setForm] = useState(() => {
    const initialGates = Array.isArray(initialData.gates) && initialData.gates.length > 0
      ? initialData.gates.map((g) => (typeof g === 'string' ? g : g?.name || '')).filter(Boolean)
      : ['Gate A'];

    return {
      name: '',
      description: '',
      venue: { name: '', city: '', country: 'Sri Lanka', address: '', mapUrl: '' },
      startDate: '',
      endDate: '',
      mainOrganiser: '',
      categories: [],
      zones: [],
      gates: initialGates,
      branding: {
        themeColor: '#2563EB',
        logoImage: '',
        bannerImage: '',
        coverImage: '',
        ...(initialData.branding || {}),
      },
      settings: {
        requirePhotoVerification: true,
        allowSelfConfirmation: true,
        rfidEnabled: false,
        maxTicketsPerOrder: 10,
        confirmationDeadlineHours: 48,
        inviteSystemEnabled: true,
        manualApprovalEnabled: false,
        autoConfirmEnabled: false,
        mfaEnforced: false,
        sponsorModuleEnabled: true,
        publicRegistrationEnabled: true,
        ticketTransfersEnabled: false,
        currency: 'LKR',
        paymentMethods: {
          card: true,
          bank_transfer: true,
          cash: true,
        },
        communicationChannels: {
          email: true,
          sms: false,
        },
        ...(initialData.settings || {}),
        paymentMethods: {
          card: true,
          bank_transfer: true,
          cash: true,
          ...(initialData.settings?.paymentMethods || {}),
        },
        communicationChannels: {
          email: true,
          sms: false,
          ...(initialData.settings?.communicationChannels || {}),
        },
        mfaEnforced: initialData?.settings?.mfaEnforced ?? false,
        sponsorModuleEnabled: initialData?.settings?.sponsorModuleEnabled ?? true,
        publicRegistrationEnabled: initialData?.settings?.publicRegistrationEnabled ?? true,
        ticketTransfersEnabled: initialData?.settings?.ticketTransfersEnabled ?? false,
      },
      timezone: initialData.timezone || 'Asia/Colombo',
      ...initialData,
      // Keep structured objects after spread so they are not overwritten by flat initialData
      venue: {
        name: '',
        city: '',
        country: 'Sri Lanka',
        address: '',
        mapUrl: '',
        ...(typeof initialData.venue === 'object' && initialData.venue ? initialData.venue : {}),
      },
      gates: initialGates,
      branding: {
        themeColor: '#2563EB',
        logoImage: '',
        bannerImage: '',
        coverImage: '',
        ...(initialData.branding || {}),
      },
      settings: {
        requirePhotoVerification: true,
        allowSelfConfirmation: true,
        rfidEnabled: false,
        maxTicketsPerOrder: 10,
        confirmationDeadlineHours: 48,
        inviteSystemEnabled: true,
        manualApprovalEnabled: false,
        autoConfirmEnabled: false,
        mfaEnforced: initialData?.settings?.mfaEnforced ?? false,
        sponsorModuleEnabled: initialData?.settings?.sponsorModuleEnabled ?? true,
        publicRegistrationEnabled: initialData?.settings?.publicRegistrationEnabled ?? true,
        ticketTransfersEnabled: initialData?.settings?.ticketTransfersEnabled ?? false,
        currency: initialData?.settings?.currency || 'LKR',
        paymentMethods: {
          card: true,
          bank_transfer: true,
          cash: true,
          ...(initialData.settings?.paymentMethods || {}),
        },
        communicationChannels: {
          email: true,
          sms: false,
          ...(initialData.settings?.communicationChannels || {}),
        },
        ...(initialData.settings || {}),
        // Re-apply nested so spread of settings does not wipe paymentMethods / channels
        paymentMethods: {
          card: true,
          bank_transfer: true,
          cash: true,
          ...(initialData.settings?.paymentMethods || {}),
        },
        communicationChannels: {
          email: true,
          sms: false,
          ...(initialData.settings?.communicationChannels || {}),
        },
      },
      startDate: initialData.startDate
        ? format(new Date(initialData.startDate), "yyyy-MM-dd'T'HH:mm")
        : '',
      endDate: initialData.endDate
        ? format(new Date(initialData.endDate), "yyyy-MM-dd'T'HH:mm")
        : '',
    };
  });

  const tabs = [
    'Basic Info',
    'Categories',
    'Zones',
    'Gates',
    'Branding',
    'Payment',
    'Settings',
  ];

  const [activeTab, setActiveTab] = useState('Basic Info');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;

    if (name.includes('.')) {
      setForm((prev) => setByPath(prev, name, val));
    } else {
      setForm((prev) => ({ ...prev, [name]: val }));
    }
  };

  const addItem = (field, item) =>
    setForm((prev) => ({ ...prev, [field]: [...(prev[field] || []), item] }));

  const removeItem = (field, index) =>
    setForm((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index),
    }));

  const handleSubmit = (e) => {
    e.preventDefault();

    // Normalize gates to unique non-empty strings before submit
    const normalizedGates = [
      ...new Set(
        (Array.isArray(form.gates) ? form.gates : [])
          .map((g) => (typeof g === 'string' ? g : g?.name || '').trim())
          .filter(Boolean)
      ),
    ];

    const submissionData = {
      ...form,
      gates: normalizedGates,
      eventDetails: form.eventDetails || {},
    };

    console.log('[EventForm] submit gates=', normalizedGates, 'eventId=', form._id || form.id);
    onSubmit(submissionData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'border-teal-600 text-teal-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl">
        {activeTab === 'Basic Info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name *</label>
                <input
                  name="venue.name"
                  value={form.venue?.name || ''}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  name="venue.city"
                  value={form.venue?.city || ''}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Timezone *</label>
                <select
                  name="timezone"
                  value={form.timezone || 'Asia/Colombo'}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                >
                  <option value="Asia/Colombo">Asia/Colombo (UTC+5:30)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
                  <option value="Asia/Singapore">Asia/Singapore (UTC+8:00)</option>
                  <option value="Asia/Dubai">Asia/Dubai (UTC+4:00)</option>
                  <option value="Europe/London">Europe/London (UTC+0:00)</option>
                  <option value="Europe/Paris">Europe/Paris (UTC+1:00)</option>
                  <option value="America/New_York">America/New_York (UTC-5:00)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (UTC-8:00)</option>
                  <option value="Australia/Sydney">Australia/Sydney (UTC+10:00)</option>
                  <option value="UTC">UTC (UTC+0:00)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 col-span-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="datetime-local"
                    name="startDate"
                    value={form.startDate}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input
                    type="datetime-local"
                    name="endDate"
                    value={form.endDate}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows="3"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, coverImageFile: e.target.files?.[0] || null }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                {form.coverImage && (
                  <div className="mt-2">
                    <img src={form.coverImage} alt="Current cover" className="w-32 h-20 object-cover rounded" />
                  </div>
                )}
              </div>
              {organisers.length > 0 && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Main Organiser</label>
                  <select
                    name="mainOrganiser"
                    value={form.mainOrganiser?._id || form.mainOrganiser || ''}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">- Unassigned -</option>
                    {organisers.map((o) => (
                      <option key={o._id} value={o._id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Categories' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700">Ticket Categories</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  addItem('categories', {
                    id: `cat-${Date.now()}`,
                    name: '',
                    price: 0,
                    capacity: 0,
                    allowedZones: [],
                    isVisible: true,
                  })
                }
              >
                + Add Category
              </Button>
            </div>
            {(form.categories || []).map((cat, idx) => (
              <div
                key={cat.id || idx}
                className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex flex-wrap gap-3 items-end"
              >
                <div className="w-40">
                  <label className="block text-xs text-gray-500 mb-1">Name *</label>
                  <input
                    required
                    value={cat.name}
                    onChange={(e) => {
                      const nc = [...form.categories];
                      nc[idx] = { ...nc[idx], name: e.target.value };
                      setForm({ ...form, categories: nc });
                    }}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-gray-500 mb-1">Price *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={cat.price}
                    onChange={(e) => {
                      const nc = [...form.categories];
                      nc[idx] = { ...nc[idx], price: Number(e.target.value) };
                      setForm({ ...form, categories: nc });
                    }}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-gray-500 mb-1">Capacity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={cat.capacity}
                    onChange={(e) => {
                      const nc = [...form.categories];
                      nc[idx] = { ...nc[idx], capacity: Number(e.target.value) };
                      setForm({ ...form, categories: nc });
                    }}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    id={`visible-${idx}`}
                    checked={cat.isVisible !== false}
                    onChange={(e) => {
                      const nc = [...form.categories];
                      nc[idx] = { ...nc[idx], isVisible: e.target.checked };
                      setForm({ ...form, categories: nc });
                    }}
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor={`visible-${idx}`} className="text-xs text-gray-600 font-medium">
                    Visible to Public
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem('categories', idx)}
                  className="text-red-500 text-sm pb-1"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Zones' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700">Event Zones</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  addItem('zones', { id: `zone-${Date.now()}`, name: '', description: '' })
                }
              >
                + Add Zone
              </Button>
            </div>
            {(form.zones || []).map((zone, idx) => (
              <div
                key={zone.id || idx}
                className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex gap-3 items-end"
              >
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Zone Name *</label>
                  <input
                    required
                    value={zone.name}
                    onChange={(e) => {
                      const nz = [...form.zones];
                      nz[idx] = { ...nz[idx], name: e.target.value };
                      setForm({ ...form, zones: nz });
                    }}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <input
                    value={zone.description || ''}
                    onChange={(e) => {
                      const nz = [...form.zones];
                      nz[idx] = { ...nz[idx], description: e.target.value };
                      setForm({ ...form, zones: nz });
                    }}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem('zones', idx)}
                  className="text-red-500 text-sm pb-1"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Gates' && (
          <div className="space-y-4">
            <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 mb-6">
              <h4 className="text-sm font-semibold text-teal-900 mb-2">Main Entry Gates</h4>
              <p className="text-xs text-teal-700">
                Configure the physical gates at the main venue entrance where attendees check in/out.
                Gates are stored on this event only.
              </p>
            </div>
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-700">Gate Names</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const len = form.gates?.length || 0;
                  const label = `Gate ${String.fromCharCode(65 + (len % 26))}${
                    len >= 26 ? Math.floor(len / 26) : ''
                  }`;
                  addItem('gates', label);
                }}
              >
                + Add Gate
              </Button>
            </div>
            {(form.gates || []).map((gate, idx) => (
              <div
                key={`gate-${idx}`}
                className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex gap-3 items-center"
              >
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Gate Name *</label>
                  <input
                    required
                    value={typeof gate === 'string' ? gate : gate?.name || ''}
                    onChange={(e) => {
                      const ng = [...(form.gates || [])];
                      ng[idx] = e.target.value;
                      setForm({ ...form, gates: ng });
                    }}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    placeholder="e.g., Gate A, Main Entrance, VIP Entry"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem('gates', idx)}
                  className="text-red-500 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
            {(!form.gates || form.gates.length === 0) && (
              <div className="text-center py-8 text-gray-500 text-sm">
                No gates configured. Click &quot;+ Add Gate&quot; to add the first gate.
              </div>
            )}
          </div>
        )}

        {activeTab === 'Branding' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Logo URL</label>
                <input
                  name="branding.logoImage"
                  value={form.branding?.logoImage || ''}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image URL</label>
                <input
                  name="branding.bannerImage"
                  value={form.branding?.bannerImage || ''}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL</label>
                <input
                  name="branding.coverImage"
                  value={form.branding?.coverImage || ''}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Payment' && (
          <div className="space-y-6">
            <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 mb-6">
              <h4 className="text-sm font-semibold text-teal-900 mb-2">Payment Settings</h4>
              <p className="text-xs text-teal-700">
                Select which payment methods are accepted for this event.
              </p>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  name="settings.paymentMethods.card"
                  checked={form.settings?.paymentMethods?.card !== false}
                  onChange={handleChange}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-gray-900">Credit / Debit Card</span>
                  <span className="text-xs text-gray-500">
                    Processed via Stripe or PayHere (as configured in Global Settings)
                  </span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  name="settings.paymentMethods.bank_transfer"
                  checked={form.settings?.paymentMethods?.bank_transfer !== false}
                  onChange={handleChange}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-gray-900">
                    Bank Transfer / Cash Deposit
                  </span>
                  <span className="text-xs text-gray-500">
                    Requires manual verification of deposit slips
                  </span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  name="settings.paymentMethods.cash"
                  checked={form.settings?.paymentMethods?.cash !== false}
                  onChange={handleChange}
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <div className="flex-1">
                  <span className="block text-sm font-semibold text-gray-900">On-Site Cash Payment</span>
                  <span className="text-xs text-gray-500">
                    Only available for registered physical outlets or gates
                  </span>
                </div>
              </label>
            </div>
            <div className="pt-4 mt-6 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Currency</label>
              <select
                name="settings.currency"
                value={form.settings?.currency || 'LKR'}
                onChange={handleChange}
                className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="LKR">LKR (Rs.)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'Settings' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2">Identity & Verification</h4>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="settings.requirePhotoVerification"
                    checked={!!form.settings.requirePhotoVerification}
                    onChange={handleChange}
                    id="requirePhoto"
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="requirePhoto" className="text-sm text-gray-700 font-medium">
                    Require Photo Verification
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="settings.allowSelfConfirmation"
                    checked={!!form.settings.allowSelfConfirmation}
                    onChange={handleChange}
                    id="allowSelf"
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="allowSelf" className="text-sm text-gray-700 font-medium">
                    Allow Attendee Self-Confirmation
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="settings.rfidEnabled"
                    checked={!!form.settings.rfidEnabled}
                    onChange={handleChange}
                    id="rfid"
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="rfid" className="text-sm text-gray-700 font-medium">
                    Enable RFID/Wristband tracking
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2">Registration Logic</h4>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="settings.inviteSystemEnabled"
                    checked={form.settings.inviteSystemEnabled !== false}
                    onChange={handleChange}
                    id="inviteSys"
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="inviteSys" className="text-sm text-gray-700 font-medium">
                    Enable Invitation System
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="settings.manualApprovalEnabled"
                    checked={!!form.settings.manualApprovalEnabled}
                    onChange={handleChange}
                    id="manualAppr"
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="manualAppr" className="text-sm text-gray-700 font-medium">
                    Manual Order Approval
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="settings.autoConfirmEnabled"
                    checked={!!form.settings.autoConfirmEnabled}
                    onChange={handleChange}
                    id="autoConf"
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="autoConf" className="text-sm text-gray-700 font-medium">
                    Auto-confirm Paid Tickets
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="settings.publicRegistrationEnabled"
                    checked={!!form.settings.publicRegistrationEnabled}
                    onChange={handleChange}
                    id="publicReg"
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="publicReg" className="text-sm text-gray-700 font-medium">
                    Enable Public Registration
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="settings.ticketTransfersEnabled"
                    checked={!!form.settings.ticketTransfersEnabled}
                    onChange={handleChange}
                    id="ticketTransfers"
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="ticketTransfers" className="text-sm text-gray-700 font-medium">
                    Enable Ticket Transfers
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2">Communication Channels</h4>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="settings.communicationChannels.email"
                    checked={form.settings?.communicationChannels?.email !== false}
                    onChange={handleChange}
                    id="emailChannel"
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="emailChannel" className="text-sm text-gray-700 font-medium">
                    Enable Email Notifications
                  </label>
                </div>

                <div className="flex items-center gap-3 opacity-80">
                  <input
                    type="checkbox"
                    name="settings.communicationChannels.sms"
                    checked={form.settings?.communicationChannels?.sms === true}
                    disabled={!isAdmin}
                    onChange={handleChange}
                    id="smsChannel"
                    className={`w-4 h-4 rounded ${
                      isAdmin ? 'text-teal-600' : 'text-gray-400 bg-gray-100'
                    }`}
                  />
                  <div className="flex flex-col">
                    <label
                      htmlFor="smsChannel"
                      className={`text-sm font-medium ${isAdmin ? 'text-gray-700' : 'text-gray-500'}`}
                    >
                      Enable SMS Notifications (Twilio)
                    </label>
                    {!isAdmin && (
                      <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                        Admin Only Setting
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 border-b pb-2">Features & Integrations</h4>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="settings.mfaEnforced"
                    checked={!!form.settings.mfaEnforced}
                    onChange={handleChange}
                    id="mfaEnforced"
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="mfaEnforced" className="text-sm text-gray-700 font-medium">
                    Enable MFA Enforcement
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="settings.sponsorModuleEnabled"
                    checked={form.settings.sponsorModuleEnabled !== false}
                    onChange={handleChange}
                    id="sponsorModule"
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                  <label htmlFor="sponsorModule" className="text-sm text-gray-700 font-medium">
                    Enable Sponsor Module
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Tickets Per Order
                </label>
                <input
                  type="number"
                  name="settings.maxTicketsPerOrder"
                  value={form.settings.maxTicketsPerOrder || 10}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmation Deadline (Hours)
                </label>
                <input
                  type="number"
                  name="settings.confirmationDeadlineHours"
                  value={form.settings.confirmationDeadlineHours || 48}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4 pt-6 border-t border-gray-100">
        <Button type="submit" loading={loading} className="px-8">
          Save Event Details
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

export default EventForm;
