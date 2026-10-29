import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getConfirmInfo, confirmIdentity } from '../../api/attendees';
import {
  CheckBadgeIcon,
  UserIcon,
  IdentificationIcon,
  CalendarDaysIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const AttendeeConfirmPage = () => {
  const { token } = useParams();
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    nationalId: '',
    passportNumber: '',
    nationality: '',
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    getConfirmInfo(token)
      .then((r) => {
        const a = r.data.data.attendee;
        setInfo(a);
        if (a.confirmationStatus === 'confirmed') {
          setDone(true);
        } else {
          setForm({
            fullName: a.fullName || '',
            email: a.email || '',
            phone: a.phone || '',
            dateOfBirth: a.dateOfBirth
              ? new Date(a.dateOfBirth).toISOString().split('T')[0]
              : '',
            nationalId: a.nationalId || '',
            passportNumber: a.passportNumber || '',
            nationality: a.nationality || '',
          });
        }
      })
      .catch((err) => {
        console.error('Fetch info error:', err);
        toast.error('Failed to load attendee information');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email) return toast.error('Name and email are required');

    const smsEnabled = info?.event?.settings?.communicationChannels?.sms;
    if (smsEnabled && !form.phone) {
      return toast.error('Phone number is required for SMS notifications');
    }
    if (form.phone && !phoneRegex.test(form.phone.trim())) {
      return toast.error('Enter a valid international phone number (e.g. +1234567890)');
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      if (photo) fd.append('photo', photo);
      await confirmIdentity(token, fd);
      setDone(true);
      toast.success('Identity confirmed successfully!');
    } catch (err) {
      console.error('CONFIRMATION_ERROR:', err);
      toast.error(err.response?.data?.message || 'Confirmation failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-brand-main border-t-transparent" />
      </div>
    );
  }

  // ─── Success ──────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-slate-100 bg-white text-center shadow-sm">
          <div className="bg-emerald-50 px-8 py-10">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100">
              <CheckBadgeIcon className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
              Identity Confirmed
            </h2>
          </div>
          <div className="px-8 py-8">
            <p className="text-sm leading-relaxed text-slate-500">
              Your ticket has been confirmed. You will receive a final confirmation notification
              with your QR code once all tickets in the order are confirmed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const smsRequired = !!info?.event?.settings?.communicationChannels?.sms;

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-main focus:outline-none focus:ring-2 focus:ring-brand-main/20';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ────────────── Hero ────────────── */}
      <div className="relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-main/20 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-2xl px-4 py-14 sm:px-6">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-white/50">
            Ticket Verification
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
            Confirm Your Identity
          </h1>
          <p className="mt-3 text-sm font-medium text-white/70">
            Complete the form below to verify your attendance details
          </p>
          {info?.event?.name && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white/90 backdrop-blur-sm">
              {info.event.name}
            </p>
          )}
        </div>
      </div>

      {/* ────────────── Form ────────────── */}
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-brand-main">
                  <UserIcon className="h-5 w-5" />
                </div>
                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                  Personal Information
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 p-8 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Full Name *
                </label>
                <input
                  required
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className={inputClass}
                  placeholder="Enter your full name as per ID document"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Phone Number {smsRequired ? '*' : ''}
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputClass}
                  placeholder="+1234567890"
                  required={smsRequired}
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  {smsRequired
                    ? 'Required for SMS notifications'
                    : 'International format: +[country code][number]'}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Nationality
                </label>
                <input
                  value={form.nationality}
                  onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. Sri Lankan"
                />
              </div>
            </div>
          </div>

          {/* Identification */}
          <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-brand-main">
                  <IdentificationIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                    Identification
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-400">Optional</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 p-8 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  National ID / NIC
                </label>
                <input
                  value={form.nationalId}
                  onChange={(e) => setForm((f) => ({ ...f, nationalId: e.target.value }))}
                  className={inputClass}
                  placeholder="Enter your National ID number"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Passport Number
                </label>
                <input
                  value={form.passportNumber}
                  onChange={(e) => setForm((f) => ({ ...f, passportNumber: e.target.value }))}
                  className={inputClass}
                  placeholder="Enter your passport number"
                />
              </div>
            </div>
          </div>

          {/* Date of Birth */}
          <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-brand-main">
                  <CalendarDaysIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                    Date of Birth
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-400">Optional</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          {/* Photo Upload */}
          <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-brand-main">
                  <PhotoIcon className="h-5 w-5" />
                </div>
                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                  Verification Photo
                </h2>
              </div>
            </div>

            <div className="p-8">
              <input
                type="file"
                id="photo-upload"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />

              {!photoPreview ? (
                <label
                  htmlFor="photo-upload"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 transition hover:border-brand-main/40 hover:bg-brand-main/5"
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <PhotoIcon className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">Click to upload a photo</p>
                  <p className="mt-1 text-xs text-slate-400">JPG or PNG · clear face photo</p>
                </label>
              ) : (
                <div className="relative inline-block">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="h-40 w-40 rounded-2xl border-2 border-slate-100 object-cover shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white shadow-md transition hover:bg-rose-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}

              <ul className="mt-4 space-y-1 text-xs text-slate-500">
                <li>✓ Clear photo of your face</li>
                <li>✓ Good lighting, face fully visible</li>
                <li>✓ Will be verified by event staff</li>
              </ul>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:bg-brand-main hover:shadow-[0_0_30px_rgba(37,99,235,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Confirming…' : 'Confirm My Identity'}
          </button>

          <p className="text-center text-[11px] text-slate-400">
            Your information is secure and will only be used for event verification purposes.
          </p>
        </form>
      </div>
    </div>
  );
};

export default AttendeeConfirmPage;