import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import { getAssetUrl } from '../../utils/backend';

const emptyZone = () => ({ id: `${Date.now()}-${Math.random()}`, name: '', description: '', capacity: 0 });
const emptyCategory = () => ({
  id: `${Date.now()}-${Math.random()}`,
  name: '',
  description: '',
  price: 0,
  capacity: 0,
  allowedZones: [],
  isVisible: true,
});
const emptyCustomField = () => ({ name: '', type: 'text', required: false, options: [] });

const tabs = ['Basic Info', 'Ticket Categories', 'Zones', 'Customization', 'Event Features & Integrations', 'Advanced Settings'];

const EventForm = ({ initialData, onSubmit, loading, companyOptions = [], organiserOptions = [] }) => {
  const [tab, setTab] = useState('Basic Info');
  const [form, setForm] = useState({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    description: initialData?.description || '',
    eventType: initialData?.eventType || 'cricket',
    companyId: initialData?.company?._id || initialData?.company || '',
    organiserIds: Array.isArray(initialData?.organiser) ? initialData.organiser.map(o => o._id) : (initialData?.organiser?._id ? [initialData.organiser._id] : []),
    startDate: initialData?.startDate ? new Date(initialData.startDate).toISOString().slice(0, 16) : '',
    endDate: initialData?.endDate ? new Date(initialData.endDate).toISOString().slice(0, 16) : '',
    venueName: initialData?.venue?.name || '',
    venueAddress: initialData?.venue?.address || '',
    venueCity: initialData?.venue?.city || '',
    venueCountry: initialData?.venue?.country || '',
    venueMapUrl: initialData?.venue?.mapUrl || '',
    publish: initialData?.status === 'published',
    timezone: initialData?.timezone || 'Asia/Colombo',
    branding: {
      themeColor: initialData?.branding?.themeColor || '#2563EB',
    }
  });
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [logoImageFile, setLogoImageFile] = useState(null);
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [zones, setZones] = useState(initialData?.zones?.length ? initialData.zones : [emptyZone()]);
  const [categories, setCategories] = useState(initialData?.categories?.length ? initialData.categories : [emptyCategory()]);
  const [customFields, setCustomFields] = useState(initialData?.customFields?.length ? initialData.customFields : []);
  const [settings, setSettings] = useState({
    requirePhotoVerification: initialData?.settings?.requirePhotoVerification ?? true,
    allowSelfConfirmation: initialData?.settings?.allowSelfConfirmation ?? true,
    confirmationDeadlineHours: initialData?.settings?.confirmationDeadlineHours ?? 48,
    maxTicketsPerOrder: initialData?.settings?.maxTicketsPerOrder ?? 10,
    rfidEnabled: initialData?.settings?.rfidEnabled ?? false,
    paymentMethods: initialData?.settings?.paymentMethods || {
      card: true,
      bank_transfer: true,
      cash: true,
    },
    communicationChannels: initialData?.settings?.communicationChannels || {
      email: true,
      sms: false,
    },
    mfaEnforced: initialData?.settings?.mfaEnforced ?? false,
    sponsorModuleEnabled: initialData?.settings?.sponsorModuleEnabled ?? true,
    publicRegistrationEnabled: initialData?.settings?.publicRegistrationEnabled ?? true,
    ticketTransfersEnabled: initialData?.settings?.ticketTransfersEnabled ?? false,
  });

  const zoneOptions = useMemo(() => zones.filter((z) => z.name.trim().length > 0), [zones]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanedCategories = categories
      .filter((cat) => cat.name && cat.name.trim().length > 0)
      .map((cat) => ({
        ...cat,
        capacity: Number(cat.capacity) || 0,
        price: Number(cat.price) || 0,
      }));
    const invalidCategory = cleanedCategories.find((cat) => cat.capacity < 1);
    if (invalidCategory) {
      toast.error('Ticket category capacity must be at least 1.');
      return;
    }
    const cleanedZones = zones.filter((zone) => zone.name && zone.name.trim().length > 0);

    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      description: form.description,
      eventType: form.eventType,
      companyId: form.companyId,
      organiserIds: form.organiserIds,
      startDate: form.startDate,
      endDate: form.endDate,
      venue: {
        name: form.venueName,
        address: form.venueAddress,
        city: form.venueCity,
        country: form.venueCountry,
        mapUrl: form.venueMapUrl,
      },
      categories: cleanedCategories,
      zones: cleanedZones,
      customFields,
      settings,
      branding: form.branding,
      timezone: form.timezone,
      status: form.publish ? 'published' : 'draft',
    };
    onSubmit(payload, { coverImage: coverImageFile, logoImage: logoImageFile, bannerImage: bannerImageFile });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap gap-3 border-b border-slate-200 pb-3">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest ${
              tab === item ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'Basic Info' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold text-slate-500">Event Name *</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Slug</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Venue Name *</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" required value={form.venueName} onChange={(e) => setForm((f) => ({ ...f, venueName: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Event Category</label>
            <select className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.eventType} onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}>
              <option value="cricket">Cricket</option>
              <option value="concert">Concert</option>
              <option value="conference">Conference</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Company/Organization *</label>
            <select className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" required value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value, organiserIds: [] }))}>
              <option value="">Select Company</option>
              {companyOptions.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Event Timezone *</label>
            <select 
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"
              required 
              value={form.timezone || 'Asia/Colombo'} 
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
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
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold text-slate-500">Main Organisers (Max 2) *</label>
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-2 min-h-[44px] p-2 rounded-xl border border-slate-200 bg-slate-50">
                {form.organiserIds.map(id => {
                  const org = organiserOptions.find(o => o._id === id);
                  return (
                    <div key={id} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-xs font-bold border border-teal-200">
                      {org?.name || id}
                      <button type="button" onClick={() => setForm(f => ({ ...f, organiserIds: f.organiserIds.filter(oid => oid !== id) }))} className="hover:text-teal-900 font-black">×</button>
                    </div>
                  );
                })}
                {form.organiserIds.length === 0 && <span className="text-slate-400 text-xs py-1.5 px-2 font-medium">Select organisers assigned to this company</span>}
              </div>
              <select className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value="" onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                if (form.organiserIds.length >= 2) { toast.error('Max 2 organisers allowed'); return; }
                if (form.organiserIds.includes(id)) return;
                setForm(f => ({ ...f, organiserIds: [...f.organiserIds, id] }));
              }} disabled={!form.companyId || form.organiserIds.length >= 2}>
                <option value="">{!form.companyId ? 'Select a company first' : 'Add Organiser...'}</option>
                {organiserOptions.filter(o => o.company === form.companyId && !form.organiserIds.includes(o._id)).map((option) => (
                  <option key={option._id} value={option._id}>{option.name} ({option.email})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold text-slate-500">Description</label>
            <textarea className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" rows="4" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Start Date & Time *</label>
            <input type="datetime-local" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" required value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">End Date & Time *</label>
            <input type="datetime-local" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" required value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Venue Address</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.venueAddress} onChange={(e) => setForm((f) => ({ ...f, venueAddress: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">City</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.venueCity} onChange={(e) => setForm((f) => ({ ...f, venueCity: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Country</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.venueCountry} onChange={(e) => setForm((f) => ({ ...f, venueCountry: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Venue Map (image URL placeholder)</label>
            <input className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" value={form.venueMapUrl} onChange={(e) => setForm((f) => ({ ...f, venueMapUrl: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3 lg:col-span-2">
            <input type="checkbox" checked={form.publish} onChange={(e) => setForm((f) => ({ ...f, publish: e.target.checked }))} />
            <span className="text-sm font-semibold text-slate-600">Publish immediately</span>
          </div>
        </div>
      )}

      {tab === 'Event Features & Integrations' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-slate-700">Communication</h3>
            <div className="mt-2 flex gap-4 items-center">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={settings.communicationChannels.email} onChange={(e) => setSettings(s => ({ ...s, communicationChannels: { ...s.communicationChannels, email: e.target.checked } }))} />
                <span className="text-sm">Enable Email Notifications</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={settings.communicationChannels.sms} onChange={(e) => setSettings(s => ({ ...s, communicationChannels: { ...s.communicationChannels, sms: e.target.checked } }))} />
                <span className="text-sm">Enable SMS Notifications</span>
              </label>
            </div>
          </div>

          <div>

          </div>

          <div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.rfidEnabled}
                onChange={(e) => setSettings((s) => ({ ...s, rfidEnabled: e.target.checked }))}
                className="rounded text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm">Enable RFID Access Control</span>
            </label>
            <p className="mt-1.5 text-[11px] text-slate-500 ml-6">
              Allow RFID-based entry scanning alongside QR codes. Requires RFID inventory setup.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={settings.mfaEnforced} onChange={(e) => setSettings(s => ({ ...s, mfaEnforced: e.target.checked }))} />
              <span className="text-sm">Enable MFA Enforcement</span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={settings.sponsorModuleEnabled} onChange={(e) => setSettings(s => ({ ...s, sponsorModuleEnabled: e.target.checked }))} />
              <span className="text-sm">Enable Sponsor Module</span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={settings.publicRegistrationEnabled} onChange={(e) => setSettings(s => ({ ...s, publicRegistrationEnabled: e.target.checked }))} />
              <span className="text-sm">Enable Public Registration</span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={settings.ticketTransfersEnabled} onChange={(e) => setSettings(s => ({ ...s, ticketTransfersEnabled: e.target.checked }))} />
              <span className="text-sm">Enable Ticket Transfers</span>
            </label>
          </div>
        </div>
      )}

      {tab === 'Ticket Categories' && (
        <div className="space-y-4">
          {categories.map((cat, index) => (
            <div key={cat.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-slate-900">Category {index + 1}</p>
                {categories.length > 1 && (
                  <button type="button" className="text-xs text-rose-600" onClick={() => setCategories((prev) => prev.filter((c) => c.id !== cat.id))}>
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Name (VIP, General)" value={cat.name} onChange={(e) => setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, name: e.target.value } : c))} />
                <input type="number" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Price" value={cat.price} onChange={(e) => setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, price: Number(e.target.value) } : c))} />
                <input type="number" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Capacity" value={cat.capacity} onChange={(e) => setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, capacity: Number(e.target.value) } : c))} />
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Description" value={cat.description} onChange={(e) => setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, description: e.target.value } : c))} />
                <label className="flex items-center gap-2 px-1">
                  <input 
                    type="checkbox" 
                    checked={cat.isVisible !== false} 
                    onChange={(e) => setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, isVisible: e.target.checked } : c))} 
                  />
                  <span className="text-xs font-semibold text-slate-600">Visible to public</span>
                </label>
              </div>
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500 mb-2">Allowed Zones</p>
                <div className="flex flex-wrap gap-2">
                  {zoneOptions.map((zone) => (
                    <label key={zone.id} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={cat.allowedZones.includes(zone.id)}
                        onChange={(e) => {
                          const nextZones = e.target.checked
                            ? [...cat.allowedZones, zone.id]
                            : cat.allowedZones.filter((z) => z !== zone.id);
                          setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, allowedZones: nextZones } : c));
                        }}
                      />
                      {zone.name}
                    </label>
                  ))}
                  {zoneOptions.length === 0 && <p className="text-xs text-slate-400">Add zones first to assign access.</p>}
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => setCategories((prev) => [...prev, emptyCategory()])}>Add Category</Button>
        </div>
      )}

      {tab === 'Zones' && (
        <div className="space-y-4">
          {zones.map((zone, index) => (
            <div key={zone.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-slate-900">Zone {index + 1}</p>
                {zones.length > 1 && (
                  <button type="button" className="text-xs text-rose-600" onClick={() => setZones((prev) => prev.filter((z) => z.id !== zone.id))}>
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Zone name" value={zone.name} onChange={(e) => setZones((prev) => prev.map((z) => z.id === zone.id ? { ...z, name: e.target.value } : z))} />
                <input type="number" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Capacity" value={zone.capacity} onChange={(e) => setZones((prev) => prev.map((z) => z.id === zone.id ? { ...z, capacity: Number(e.target.value) } : z))} />
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Description" value={zone.description} onChange={(e) => setZones((prev) => prev.map((z) => z.id === zone.id ? { ...z, description: e.target.value } : z))} />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => setZones((prev) => [...prev, emptyZone()])}>Add Zone</Button>
        </div>
      )}

      {tab === 'Customization' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Theme Color</label>
              <div className="mt-3 flex items-center gap-4">
                <input 
                  type="color" 
                  value={form.branding.themeColor} 
                  onChange={(e) => setForm(f => ({ ...f, branding: { ...f.branding, themeColor: e.target.value } }))} 
                  className="h-12 w-20 cursor-pointer rounded-lg border border-slate-200"
                />
                <input 
                  type="text" 
                  value={form.branding.themeColor} 
                  onChange={(e) => setForm(f => ({ ...f, branding: { ...f.branding, themeColor: e.target.value } }))} 
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-mono"
                  placeholder="#2563EB"
                />
              </div>
              <p className="mt-2 text-[10px] text-slate-400 font-medium italic">This color will be used for buttons, badges, and accents on the public event page.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Event Logo</label>
              {initialData?.branding?.logoImage && !logoImageFile && (
                <div className="mt-2 h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                  <img src={initialData.branding.logoImage.startsWith('http') ? initialData.branding.logoImage : getAssetUrl(initialData.branding.logoImage)} alt="current logo" className="h-full w-full object-contain" />
                </div>
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => setLogoImageFile(e.target.files?.[0] || null)} 
                className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <p className="mt-2 text-[10px] text-slate-400 font-medium italic">Small square or circular logo (PNG preferred).</p>
            </div>

            <div className="lg:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Cover Image (Card View)</label>
              {initialData?.coverImage && !coverImageFile && (
                <div className="mt-2 h-32 w-full max-w-md overflow-hidden rounded-xl border border-slate-200">
                  <img src={initialData.coverImage.startsWith('http') ? initialData.coverImage : getAssetUrl(initialData.coverImage)} alt="current cover" className="h-full w-full object-cover" />
                </div>
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => setCoverImageFile(e.target.files?.[0] || null)} 
                className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <p className="mt-2 text-[10px] text-slate-400 font-medium italic">This image appears on the event listing cards. Best: 800x450px.</p>
            </div>

            <div className="lg:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Hero Banner Image</label>
              {initialData?.branding?.bannerImage && !bannerImageFile && (
                <div className="mt-2 h-32 w-full overflow-hidden rounded-xl border border-slate-200">
                  <img src={initialData.branding.bannerImage.startsWith('http') ? initialData.branding.bannerImage : getAssetUrl(initialData.branding.bannerImage)} alt="current banner" className="h-full w-full object-cover" />
                </div>
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => setBannerImageFile(e.target.files?.[0] || null)} 
                className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <p className="mt-2 text-[10px] text-slate-400 font-medium italic">Large landscape image for the top of the event page. Recommended: 1920x600px.</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'Advanced Settings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

            <label className="flex items-center gap-3 text-sm font-semibold text-slate-600">
              <input type="checkbox" checked={settings.allowSelfConfirmation} onChange={(e) => setSettings((s) => ({ ...s, allowSelfConfirmation: e.target.checked }))} />
              Allow Self Confirmation
            </label>
            <label className="text-sm font-semibold text-slate-600">
              Confirmation Deadline (hours)
              <input type="number" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={settings.confirmationDeadlineHours} onChange={(e) => setSettings((s) => ({ ...s, confirmationDeadlineHours: Number(e.target.value) }))} />
            </label>
            <label className="text-sm font-semibold text-slate-600">
              Max Tickets Per Order
              <input type="number" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={settings.maxTicketsPerOrder} onChange={(e) => setSettings((s) => ({ ...s, maxTicketsPerOrder: Number(e.target.value) }))} />
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-600">
              <input type="checkbox" checked={settings.rfidEnabled} onChange={(e) => setSettings((s) => ({ ...s, rfidEnabled: e.target.checked }))} />
              RFID Enabled
            </label>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Communication Channels</h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-400 bg-slate-50/50 rounded-xl border border-slate-100 p-4">
                <input type="checkbox" checked={true} disabled />
                Email (Required)
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-600 rounded-xl border border-slate-200 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={settings.communicationChannels?.sms ?? false} 
                  onChange={(e) => setSettings((s) => ({ 
                    ...s, 
                    communicationChannels: { ...s.communicationChannels, sms: e.target.checked, email: true } 
                  }))} 
                />
                SMS Notifications
              </label>
            </div>
            <p className="mt-2 text-[10px] text-slate-400 font-medium italic">Enforce Email as primary communication while making SMS an optional feature.</p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Allowed Payment Methods</h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-600 rounded-xl border border-slate-200 p-4">
                <input type="checkbox" checked={settings.paymentMethods?.card} onChange={(e) => setSettings((s) => ({ ...s, paymentMethods: { ...s.paymentMethods, card: e.target.checked } }))} />
                Debit / Credit Card
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-600 rounded-xl border border-slate-200 p-4">
                <input type="checkbox" checked={settings.paymentMethods?.bank_transfer} onChange={(e) => setSettings((s) => ({ ...s, paymentMethods: { ...s.paymentMethods, bank_transfer: e.target.checked } }))} />
                Bank Transfer
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-600 rounded-xl border border-slate-200 p-4">
                <input type="checkbox" checked={settings.paymentMethods?.cash} onChange={(e) => setSettings((s) => ({ ...s, paymentMethods: { ...s.paymentMethods, cash: e.target.checked } }))} />
                Cash at Entrance
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Custom Attendee Fields</h3>
              <Button type="button" variant="outline" onClick={() => setCustomFields((prev) => [...prev, emptyCustomField()])}>Add Field</Button>
            </div>
            <div className="space-y-3">
              {customFields.map((field, idx) => (
                <div key={`${field.name}-${idx}`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                    <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Field name" value={field.name} onChange={(e) => setCustomFields((prev) => prev.map((f, i) => i === idx ? { ...f, name: e.target.value } : f))} />
                    <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={field.type} onChange={(e) => setCustomFields((prev) => prev.map((f, i) => i === idx ? { ...f, type: e.target.value } : f))}>
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="select">Select</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={field.required} onChange={(e) => setCustomFields((prev) => prev.map((f, i) => i === idx ? { ...f, required: e.target.checked } : f))} />
                      Required
                    </label>
                    <button type="button" className="text-xs text-rose-600 justify-self-end" onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
                  </div>
                  {field.type === 'select' && (
                    <input
                      className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Options (comma separated)"
                      value={field.options?.join(', ') || ''}
                      onChange={(e) => setCustomFields((prev) => prev.map((f, i) => i === idx ? { ...f, options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) } : f))}
                    />
                  )}
                </div>
              ))}
              {customFields.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  Add custom fields to capture extra attendee data.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button type="submit" loading={loading} className="bg-teal-600 hover:bg-teal-500">Save Event</Button>
        <Button type="button" variant="outline" onClick={() => setTab('Basic Info')}>Back to Top</Button>
      </div>
    </form>
  );
};

export default EventForm;
