import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import api from '../../api/client';
export default function HardwarePage() {
  const [eventId, setEventId] = useState('');
  const [readers, setReaders] = useState([]);
  const [form, setForm] = useState({ name: '', transport: 'keyboard', format: 'numeric10', prefix: '', suffix: '', gateName: '' });
  const [readerId, setReaderId] = useState('');
  const [scan, setScan] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState('');
  async function run(task) {
    setBusy(true); setMessage('');
    try { await task(); } catch (e) { setMessage(e.response?.data?.message || 'Request failed'); }
    finally { setBusy(false); }
  }
  async function load() { const res = await api.get('/readers', { params: { eventId } }); setReaders(res.data.data); }
  return <DashboardLayout><main className="max-w-4xl mx-auto p-6 space-y-6">
    <Link to="/admin/rfid" className="text-teal-600">← RFID inventory</Link>
    <h1 className="text-3xl font-bold">Reader hardware & event insights</h1>
    <p>Connect a keyboard reader directly. Serial, NFC and network readers require a local bridge that sends authenticated scans. Reader profiles never grant access on their own.</p>
    <label className="block">Event ID<input className="border rounded p-2 w-full" value={eventId} onChange={e => { setEventId(e.target.value); setReaders([]); setReaderId(''); setSummary(''); }} /></label>
    <button disabled={busy || !eventId} onClick={() => run(load)} className="bg-teal-700 text-white rounded px-4 py-2">Load readers</button>
    <form className="bg-white border rounded-xl p-5 space-y-3" onSubmit={e => { e.preventDefault(); run(async () => { await api.post('/readers', { ...form, eventId }); await load(); setMessage('Reader registered'); }); }}>
      <h2 className="text-xl font-semibold">Register reader</h2>
      {['name', 'gateName', 'prefix', 'suffix'].map(key => <label key={key} className="block">{key}<input required={key === 'name'} maxLength={key === 'prefix' || key === 'suffix' ? 32 : 80} className="border rounded p-2 w-full" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
      <label className="block">Connection<select className="border p-2 ml-3" value={form.transport} onChange={e => setForm({ ...form, transport: e.target.value })}>{['keyboard', 'serial-bridge', 'http-bridge', 'nfc-bridge'].map(x => <option key={x}>{x}</option>)}</select></label>
      <label className="block">Identifier format<select className="border p-2 ml-3" value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}>{['numeric10', 'decimal', 'hex', 'alphanumeric'].map(x => <option key={x}>{x}</option>)}</select></label>
      <button disabled={busy || !eventId} className="bg-teal-700 text-white rounded px-4 py-2">Register</button>
    </form>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Registered readers</h2>
      {readers.map(reader => <div key={reader._id} className="border rounded p-3 flex justify-between gap-3"><span>{reader.name} · {reader.format} · {reader.enabled ? 'Enabled' : 'Disabled'}<small className="block">{reader._id}</small></span><button disabled={busy} onClick={() => run(async () => { await api.patch(`/readers/${reader._id}`, { eventId, enabled: !reader.enabled }); await load(); })}>{reader.enabled ? 'Disable' : 'Enable'}</button></div>)}
    </section>
    <form className="border rounded-xl p-5 space-y-3" onSubmit={e => { e.preventDefault(); run(async () => { const res = await api.post('/readers/preview', { eventId, readerId, scan }); setMessage(`Normalized credential: ${res.data.data.credential}. Preview only; no entry recorded.`); }); }}>
      <h2 className="text-xl font-semibold">Test a scan</h2><select required className="border p-2 w-full" value={readerId} onChange={e => setReaderId(e.target.value)}><option value="">Select reader</option>{readers.filter(x => x.enabled).map(x => <option key={x._id} value={x._id}>{x.name}</option>)}</select>
      <input aria-label="Raw reader scan" placeholder="Scan a tag here" required maxLength={256} className="border rounded p-2 w-full" value={scan} onChange={e => setScan(e.target.value)} />
      <button disabled={busy || !readerId} className="border rounded px-4 py-2">Preview identifier</button>
    </form>
    <section className="border rounded-xl p-5 space-y-3"><h2 className="text-xl font-semibold">AI operations summary</h2><p>Optional. Sends aggregate counts only. Suggestions require human review.</p><button disabled={busy || !eventId} className="border rounded px-4 py-2" onClick={() => run(async () => { const res = await api.post('/ai/event-summary', { eventId }); setSummary(res.data.data.summary); })}>Generate summary</button><p className="whitespace-pre-wrap">{summary}</p></section>
    <p role="status" className="whitespace-pre-wrap">{busy ? 'Working…' : message}</p>
  </main></DashboardLayout>;
}
