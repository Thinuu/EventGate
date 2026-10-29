import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CalendarDaysIcon,
  CheckBadgeIcon,
  MapPinIcon,
  TicketIcon,
  CameraIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { confirmInvite, getInviteInfo, respondToInvite } from '../../api/attendees';
import toast from 'react-hot-toast';
import CameraCapture from '../../components/shared/CameraCapture';
import PhotoValidationFeedback from '../../components/shared/PhotoValidationFeedback';
import { usePhotoAiValidation } from '../../hooks/usePhotoAiValidation';

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

const formatVenue = (venue) => {
  if (!venue) return 'Venue will be announced';
  if (typeof venue === 'string') return venue;
  return [venue.name, venue.city, venue.address].filter(Boolean).join(', ');
};

const formatDate = (value) => {
  if (!value) return 'Date to be announced';
  return new Date(value).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const InviteAcceptPage = () => {
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState('preview');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    nicPassport: '',
  });
  const [photo, setPhoto] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [preview, setPreview] = useState(null);

  const {
    validationErrors,
    allowOverride,
    setAllowOverride,
    qualityAnalysis,
    faceAnalysis,
    validating,
    validateFile,
    resetValidation,
    appendValidationToFormData,
    canSubmitPhoto,
    modelLoadFailed,
    imageRef,
    overlayRef,
  } = usePhotoAiValidation();

  useEffect(() => {
    getInviteInfo(token)
      .then((response) => {
        const payload = response.data?.data?.invite;
        setInvite(payload);

        if (payload?.attendee) {
          setForm({
            fullName: payload.attendee.fullName || '',
            email: payload.attendee.email || '',
            phone: payload.attendee.phone || '',
            dateOfBirth: payload.attendee.dateOfBirth
              ? payload.attendee.dateOfBirth.split('T')[0]
              : '',
            nicPassport: payload.attendee.nationalId || '',
          });
        }

        if ((payload?.inviteStatus || 'PENDING') === 'ACCEPTED') {
          setStep('form');
        } else {
          setStep('preview');
        }
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Invalid or expired invitation link');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const venueText = useMemo(() => formatVenue(invite?.eventVenue), [invite]);

  const handleAccept = async () => {
    setResponding(true);
    try {
      const { data } = await respondToInvite({ token, response: 'ACCEPTED' });
      setInvite((current) => ({
        ...current,
        inviteStatus: data?.data?.inviteStatus || 'ACCEPTED',
        inviteRespondedAt: data?.data?.respondedAt || new Date().toISOString(),
      }));
      setStep('form');
      toast.success('Invitation accepted. Please complete your details.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to accept invitation.');
    } finally {
      setResponding(false);
    }
  };

  const handlePhotoSelect = async (file) => {
    if (!file) return;
    await validateFile(file);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhoto(null);
    setPreview(null);
    resetValidation?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.fullName) return toast.error('Full Name is required');
    if (!form.email) return toast.error('Email is required');
    if (!photo) return toast.error('Identity Verification Photo is required');
    if (!canSubmitPhoto(true)) {
      return toast.error('Please fix photo validation issues or allow override.');
    }
    if (form.phone && !phoneRegex.test(form.phone.trim())) {
      return toast.error('Enter a valid international phone number (e.g. +1234567890)');
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('token', token);
      fd.append('fullName', form.fullName);
      fd.append('nicPassport', form.nicPassport);
      fd.append('phone', form.phone);
      fd.append('dateOfBirth', form.dateOfBirth);
      if (form.email) fd.append('email', form.email);
      if (photo) fd.append('photo', photo);
      appendValidationToFormData(fd);

      await confirmInvite(fd);
      setDone(true);
      toast.success('Invite accepted and identity confirmed!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm invite.');
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
              Invitation Accepted
            </h2>
          </div>
          <div className="px-8 py-8">
            <p className="text-sm leading-relaxed text-slate-500">
              Your details have been submitted successfully. You’ll receive the final ticket
              confirmation shortly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-main focus:outline-none focus:ring-2 focus:ring-brand-main/20';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ────────────── Hero ────────────── */}
      <div className="relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-main/20 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-white/50">
            Event Invitation
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
            {invite?.eventName || 'Invitation'}
          </h1>
          <p className="mt-3 text-sm font-medium text-white/70">
            You have been invited to this event
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-5">
          {/* ────────────── Event Info ────────────── */}
          <div className="space-y-4 lg:col-span-2">
            <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm">
              <div className="space-y-0 divide-y divide-slate-50">
                <div className="flex items-start gap-3 px-6 py-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-brand-main">
                    <CalendarDaysIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Event Date
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {formatDate(invite?.eventStartDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 px-6 py-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-brand-main">
                    <MapPinIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Venue
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{venueText}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 px-6 py-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-brand-main">
                    <TicketIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Category
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {invite?.categoryName || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {invite?.inviteExpiresAt && (
              <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-4 text-sm font-medium text-amber-800">
                Invitation expires on{' '}
                <strong>{new Date(invite.inviteExpiresAt).toLocaleString()}</strong>
              </div>
            )}
          </div>

          {/* ────────────── Action Panel ────────────── */}
          <div className="lg:col-span-3">
            {step === 'preview' && (
              <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
                <div className="p-8">
                  <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
                    Review Invitation
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">
                    Accept this invitation to continue to the attendee confirmation form and
                    complete your entry details.
                  </p>

                  <button
                    onClick={handleAccept}
                    disabled={responding}
                    className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:bg-brand-main hover:shadow-[0_0_30px_rgba(37,99,235,0.35)] disabled:opacity-60"
                  >
                    {responding ? 'Accepting…' : 'Accept Invitation'}
                  </button>
                </div>
              </div>
            )}

            {step === 'form' && (
              <form
                onSubmit={handleSubmit}
                className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm"
              >
                <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                    Complete Your Details
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Fill in your information to confirm this invitation
                  </p>
                </div>

                <div className="space-y-5 p-8">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Full Name *
                    </label>
                    <input
                      value={form.fullName}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, fullName: e.target.value }))
                      }
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      readOnly
                      className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Phone
                    </label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                      className={inputClass}
                      placeholder="+1234567890 (Optional)"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                      NIC / Passport
                    </label>
                    <input
                      value={form.nicPassport}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, nicPassport: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, dateOfBirth: e.target.value }))
                      }
                      className={inputClass}
                    />
                  </div>

                  {/* Photo */}
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Identity Verification Photo *
                    </label>

                    <div className="flex gap-3">
                      {/* Upload */}
                      <label className="group relative flex h-28 flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-brand-main/40 hover:bg-brand-main/5">
                        {photo && preview ? (
                          <div className="relative h-full w-full p-2">
                            <img
                              ref={imageRef}
                              src={preview}
                              alt="Preview"
                              className="h-full w-full rounded-xl object-cover"
                            />
                            <canvas
                              ref={overlayRef}
                              className="pointer-events-none absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)] rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                clearPhoto();
                              }}
                              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow"
                            >
                              <XMarkIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <PhotoIcon className="mb-1.5 h-6 w-6 text-slate-300 transition group-hover:text-brand-main" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand-main">
                              Upload
                            </p>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            await handlePhotoSelect(e.target.files?.[0]);
                          }}
                          className="hidden"
                        />
                      </label>

                      {/* Camera */}
                      <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="group flex h-28 flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition hover:border-brand-main/40 hover:bg-brand-main/5"
                      >
                        <CameraIcon className="mb-1.5 h-6 w-6 text-slate-300 transition group-hover:text-brand-main" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand-main">
                          Live Photo
                        </p>
                      </button>
                    </div>

                    {showCamera && (
                      <CameraCapture
                        onCapture={async (file) => {
                          await handlePhotoSelect(file);
                          setShowCamera(false);
                        }}
                        onClose={() => setShowCamera(false)}
                      />
                    )}

                    {photo && (
                      <div className="mt-3">
                        <PhotoValidationFeedback
                          validationErrors={validationErrors}
                          qualityAnalysis={qualityAnalysis}
                          faceAnalysis={faceAnalysis}
                          allowOverride={allowOverride}
                          onAllowOverrideChange={setAllowOverride}
                          modelLoadFailed={modelLoadFailed}
                          validating={validating}
                        />
                      </div>
                    )}

                    <p className="mt-2 text-xs text-slate-400">
                      Required for entry verification
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-2 flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:bg-brand-main hover:shadow-[0_0_30px_rgba(37,99,235,0.35)] disabled:opacity-60"
                  >
                    {submitting ? 'Submitting…' : 'Submit Confirmation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteAcceptPage;