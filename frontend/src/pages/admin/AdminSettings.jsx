import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import Card, { CardHeader } from '../../components/ui/Card';
import toast from 'react-hot-toast';
import { getAdminSettings, updateAdminSettings } from '../../api/admin';

const AdminSettings = () => {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAdminSettings()
      .then((response) => setSettings(response.data?.data?.settings || null))
      .catch(() => toast.error('Failed to load settings'));
  }, []);

  const updateField = (section, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  const updateNestedField = (section, path, value) => {
    setSettings((prev) => {
      const newSettings = { ...prev };
      let current = newSettings[section];
      for (let i = 0; i < path.length - 1; i++) {
        current[path[i]] = { ...current[path[i]] };
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newSettings;
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await updateAdminSettings(settings);
      setSettings(response.data?.data?.settings || settings);
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">Loading settings...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-semibold">System Controls</p>
          <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
          <p className="text-sm text-slate-500">Persistent communication, retention, security, and template defaults for the EventGate admin layer.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader title="Communication Providers" subtitle="Operational sender defaults and provider visibility" />
            <div className="grid gap-4 lg:grid-cols-2">
              <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Sender email" value={settings.communication?.senderEmail || ''} onChange={(e) => updateField('communication', 'senderEmail', e.target.value)} />
              <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="SMS sender (Phone Number)" value={settings.communication?.smsSender || ''} onChange={(e) => updateField('communication', 'smsSender', e.target.value)} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Email provider: {settings.communication?.emailProvider || 'smtp'}</div>
              <div className="rounded-xl border border-slate-200 bg-white">
                <select className="w-full bg-transparent px-4 py-3 text-sm text-slate-900 outline-none" value={settings.communication?.smsProvider || 'mock'} onChange={(e) => updateField('communication', 'smsProvider', e.target.value)}>
                  <option value="mock">Mock SMS (Console Logging)</option>
                  <option value="twilio">Twilio</option>
                </select>
              </div>
            </div>
            
            {settings.communication?.smsProvider === 'twilio' && (
              <div className="mt-4 grid gap-4 lg:grid-cols-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <input className="rounded-lg border border-slate-200 px-4 py-2 text-sm" placeholder="Twilio Account SID" value={settings.communication?.twilioSid || ''} onChange={(e) => updateField('communication', 'twilioSid', e.target.value)} />
                <input type="password" className="rounded-lg border border-slate-200 px-4 py-2 text-sm" placeholder="Twilio Auth Token" value={settings.communication?.twilioAuthToken || ''} onChange={(e) => updateField('communication', 'twilioAuthToken', e.target.value)} />
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Templates" subtitle="Default text for invite, confirmation, and rejection flows" />
            <div className="grid gap-4">
              <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Invite email subject" value={settings.templates?.invite?.subject || ''} onChange={(e) => setSettings((current) => ({ ...current, templates: { ...current.templates, invite: { ...current.templates.invite, subject: e.target.value } } }))} />
              <textarea className="rounded-xl border border-slate-200 px-4 py-3 text-sm" rows="3" placeholder="Confirmation SMS template" value={settings.templates?.confirmation?.sms || ''} onChange={(e) => setSettings((current) => ({ ...current, templates: { ...current.templates, confirmation: { ...current.templates.confirmation, sms: e.target.value } } }))} />
              <textarea className="rounded-xl border border-slate-200 px-4 py-3 text-sm" rows="3" placeholder="Rejection SMS template" value={settings.templates?.rejection?.sms || ''} onChange={(e) => setSettings((current) => ({ ...current, templates: { ...current.templates, rejection: { ...current.templates.rejection, sms: e.target.value } } }))} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Security and Retention" subtitle="Defaults for token lifespan, mode, and data retention" />
            <div className="grid gap-4 lg:grid-cols-3">
              <select className="rounded-xl border border-slate-200 px-4 py-3 text-sm" value={settings.security?.mode || 'strict'} onChange={(e) => updateField('security', 'mode', e.target.value)}>
                <option value="strict">Strict</option>
                <option value="balanced">Balanced</option>
                <option value="open">Open</option>
              </select>
              <input type="number" className="rounded-xl border border-slate-200 px-4 py-3 text-sm" value={settings.security?.jwtTtlHours || 24} onChange={(e) => updateField('security', 'jwtTtlHours', Number(e.target.value))} />
              <input type="number" className="rounded-xl border border-slate-200 px-4 py-3 text-sm" value={settings.retention?.logsDays || 365} onChange={(e) => updateField('retention', 'logsDays', Number(e.target.value))} />
            </div>
          

          </Card>

        {/* Payment Configuration Section */}
        <Card>
          <CardHeader title="Payment Configuration" subtitle="Enable/disable gateways, Bank Transfer, and Cash at Entrance settings" />
          
          {/* Card Gateways */}
          <div className="border-b border-slate-100 pb-5 mb-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Credit/Debit Card Gateways</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex items-center">
                <input type="checkbox" checked={settings.payment?.gateways?.stripe?.enabled || false}
                  onChange={(e) => updateNestedField('payment', ['gateways', 'stripe', 'enabled'], e.target.checked)} />
                <label className="ml-2 text-sm text-slate-700">Enable Stripe</label>
              </div>
              <div className="flex items-center">
                <input type="checkbox" checked={settings.payment?.gateways?.payhere?.enabled || false}
                  onChange={(e) => updateNestedField('payment', ['gateways', 'payhere', 'enabled'], e.target.checked)} />
                <label className="ml-2 text-sm text-slate-700">Enable PayHere</label>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Default Gateway</label>
                <select className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
                  value={settings.payment?.defaultGateway || ''}
                  onChange={(e) => updateNestedField('payment', ['defaultGateway'], e.target.value)}>
                  {settings.payment?.gateways?.stripe?.enabled && <option value="stripe">Stripe</option>}
                  {settings.payment?.gateways?.payhere?.enabled && <option value="payhere">PayHere</option>}
                </select>
              </div>
            </div>
          </div>

          {/* Bank Transfer */}
          <div className="border-b border-slate-100 pb-5 mb-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Direct Bank Transfer</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="col-span-2 flex items-center mb-2">
                <input type="checkbox" checked={settings.payment?.bankTransfer?.enabled !== false}
                  onChange={(e) => updateNestedField('payment', ['bankTransfer', 'enabled'], e.target.checked)} />
                <label className="ml-2 text-sm text-slate-700 font-medium">Enable Direct Bank Transfer</label>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Bank Accounts (Comma separated)</label>
                <input className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" 
                  placeholder="e.g. Bank A - 123, Bank B - 456" 
                  value={settings.payment?.bankTransfer?.accounts || ''} 
                  onChange={(e) => updateNestedField('payment', ['bankTransfer', 'accounts'], e.target.value)} 
                  disabled={settings.payment?.bankTransfer?.enabled === false} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Verification SLA (Hours)</label>
                <input type="number" className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" 
                  value={settings.payment?.bankTransfer?.verificationSlaHours || 48} 
                  onChange={(e) => updateNestedField('payment', ['bankTransfer', 'verificationSlaHours'], Number(e.target.value))} 
                  disabled={settings.payment?.bankTransfer?.enabled === false} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Receipt Upload Limit (MB)</label>
                <input type="number" className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" 
                  value={settings.payment?.bankTransfer?.receiptUploadLimitMb || 5} 
                  onChange={(e) => updateNestedField('payment', ['bankTransfer', 'receiptUploadLimitMb'], Number(e.target.value))} 
                  disabled={settings.payment?.bankTransfer?.enabled === false} />
              </div>
            </div>
          </div>

          {/* Cash at Entrance */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Cash at Entrance</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="col-span-2 flex items-center mb-2">
                <input type="checkbox" checked={settings.payment?.cashAtEntrance?.enabled !== false}
                  onChange={(e) => updateNestedField('payment', ['cashAtEntrance', 'enabled'], e.target.checked)} />
                <label className="ml-2 text-sm text-slate-700 font-medium">Enable Cash at Entrance</label>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Reservation Expiry (Hours before event)</label>
                <input type="number" className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" 
                  value={settings.payment?.cashAtEntrance?.reservationExpiryHours || 48} 
                  onChange={(e) => updateNestedField('payment', ['cashAtEntrance', 'reservationExpiryHours'], Number(e.target.value))} 
                  disabled={settings.payment?.cashAtEntrance?.enabled === false} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Reservation Terms / Reminder Message</label>
                <textarea className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" rows="2"
                  value={settings.payment?.cashAtEntrance?.terms || ''} 
                  onChange={(e) => updateNestedField('payment', ['cashAtEntrance', 'terms'], e.target.value)} 
                  disabled={settings.payment?.cashAtEntrance?.enabled === false} />
              </div>
            </div>
          </div>
        </Card>

        <div className="flex gap-3">

            <Button type="submit" loading={saving} className="bg-teal-600 hover:bg-teal-500">Save Settings</Button>
            <Button type="button" variant="outline" onClick={() => window.location.assign('/admin/dashboard?section=settings')}>Open Dashboard Settings</Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default AdminSettings;
