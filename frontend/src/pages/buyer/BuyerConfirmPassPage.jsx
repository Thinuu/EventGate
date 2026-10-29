import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
  PhotoIcon,
  ShieldCheckIcon,
  TicketIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import BuyerLayout from '../../components/layout/BuyerLayout';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import PhotoValidationFeedback from '../../components/shared/PhotoValidationFeedback';
import { usePhotoAiValidation } from '../../hooks/usePhotoAiValidation';
import api from '../../api/client';
import { assignSelfToTicket } from '../../api/buyer';
import { useAuth } from '../../context/AuthContext';

const BuyerConfirmPassPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  const {
    validationErrors,
    allowOverride,
    setAllowOverride,
    qualityAnalysis,
    faceAnalysis,
    validating,
    validateFile,
    appendValidationToFormData,
    canSubmitPhoto,
    modelLoadFailed,
    imageRef,
    overlayRef,
    resetValidation,
  } = usePhotoAiValidation();

  const [form, setForm] = useState({
    fullName: user?.name || '',
    phone: user?.phone || '',
    dateOfBirth: '',
    nationalId: '',
    passportNumber: '',
    nationality: '',
    photo: null,
  });

  useEffect(() => {
    let active = true;

    const loadTicket = async () => {
      try {
        const { data } = await api.get(`/user/ticket/${ticketId}`);
        if (!active) return;
        const loadedTicket = data?.data?.ticket;
        setTicket(loadedTicket);
        setForm((prev) => ({
          ...prev,
          fullName: loadedTicket?.attendee?.fullName || user?.name || prev.fullName,
          phone: loadedTicket?.attendee?.phone || user?.phone || prev.phone,
        }));
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Unable to load this pass.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTicket();
    return () => {
      active = false;
    };
  }, [ticketId, user?.name, user?.phone]);

  const requiresPhoto = !!ticket?.event?.requirePhotoVerification;

  const eventDate = useMemo(() => {
    if (!ticket?.event?.startDate) return 'Date TBD';
    return new Date(ticket.event.startDate).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [ticket?.event?.startDate]);

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await validateFile(file);
    setForm((prev) => ({ ...prev, photo: file }));
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setForm((prev) => ({ ...prev, photo: null }));
    setPhotoPreview(null);
    resetValidation?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.fullName.trim()) return toast.error('Full name is required.');
    if (requiresPhoto && !form.photo && !ticket?.attendee?.photo) {
      return toast.error('A photo is required for this event.');
    }
    if (form.photo && !canSubmitPhoto(true)) {
      return toast.error('Please fix photo validation issues or allow override.');
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('fullName', form.fullName.trim());
      if (form.phone) payload.append('phone', form.phone.trim());
      if (form.dateOfBirth) payload.append('dateOfBirth', form.dateOfBirth);
      if (form.nationalId) payload.append('nationalId', form.nationalId.trim());
      if (form.passportNumber) payload.append('passportNumber', form.passportNumber.trim());
      if (form.nationality) payload.append('nationality', form.nationality.trim());
      if (form.photo) {
        payload.append('photo', form.photo);
        appendValidationToFormData(payload);
      }

      await assignSelfToTicket(ticketId, payload);
      toast.success(
        requiresPhoto
          ? 'Pass submitted for photo verification.'
          : 'Pass confirmed successfully.'
      );
      navigate('/buyer/home');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to confirm pass.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <BuyerLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-brand-main border-t-transparent" />
        </div>
      </BuyerLayout>
    );
  }

  // ─── Not Found ────────────────────────────────────────────────────
  if (!ticket) {
    return (
      <BuyerLayout>
        <div className="mx-auto max-w-lg text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 mx-auto">
            <TicketIcon className="h-10 w-10 text-slate-400" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">
            Pass Not Found
          </h1>
          <p className="mt-3 text-sm font-medium text-slate-500">
            This pass may no longer be available for your account.
          </p>
          <Link
            to="/buyer/home"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-xs font-black uppercase tracking-[0.15em] text-white transition hover:bg-brand-main"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Back link */}
        <Link
          to="/buyer/home"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-brand-main"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {/* ────────────── Pass Header Card ────────────── */}
        <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
          <div className="bg-slate-900 px-8 py-7">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">
              Confirm Pass
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
              {ticket.event?.name || 'Event Pass'}
            </h1>
            <p className="mt-1.5 text-sm font-medium text-white/60">
              Ticket #{ticket.ticketNumber}
            </p>
          </div>

          <div className="flex flex-col gap-4 px-8 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-5 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-brand-main">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <span className="font-medium">{eventDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-brand-main">
                  <MapPinIcon className="h-4 w-4" />
                </div>
                <span className="font-medium">
                  {ticket.event?.venue?.name || 'Venue TBD'}
                </span>
              </div>
            </div>

            <div className="shrink-0 rounded-full bg-slate-100 px-4 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-700">
              {ticket.categoryName || 'Standard'}
            </div>
          </div>
        </div>

        {/* ────────────── Details Form ────────────── */}
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm"
        >
          <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <ShieldCheckIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
                  Your Details
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  These details will be attached to this entry pass.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-8">
            {/* Form fields */}
            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Full Name *"
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                required
              />
              <Input label="Email" value={user?.email || ''} disabled />
              <Input
                label="Phone Number"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+94771234567"
              />
              <Input
                label="Date of Birth"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
              />
              <Input
                label="National ID / NIC"
                value={form.nationalId}
                onChange={(e) => setForm((prev) => ({ ...prev, nationalId: e.target.value }))}
              />
              <Input
                label="Passport Number"
                value={form.passportNumber}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, passportNumber: e.target.value }))
                }
              />
              <Input
                label="Nationality"
                value={form.nationality}
                onChange={(e) => setForm((prev) => ({ ...prev, nationality: e.target.value }))}
              />
            </div>

            {/* Photo Upload */}
            <div className="border-t border-slate-100 pt-6">
              <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                <PhotoIcon className="h-4 w-4 text-brand-main" />
                Verification Photo {requiresPhoto ? '*' : ''}
              </label>

              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handlePhotoChange}
                className="block w-full cursor-pointer text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-teal-50 file:px-4 file:py-2.5 file:text-sm file:font-bold file:text-teal-700 hover:file:bg-teal-100"
              />

              <p className="mt-2 text-xs text-slate-500">
                {requiresPhoto
                  ? 'This event requires a clear face photo before the QR pass can be activated.'
                  : 'Optional, but useful for faster event verification.'}
              </p>

              {photoPreview && (
                <div className="relative mt-5 inline-block">
                  <img
                    ref={imageRef}
                    src={photoPreview}
                    alt="Selected preview"
                    className="h-40 w-40 rounded-2xl border-2 border-slate-100 object-cover shadow-sm"
                  />
                  <canvas
                    ref={overlayRef}
                    className="pointer-events-none absolute inset-0 h-40 w-40 rounded-2xl"
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

              {form.photo && (
                <div className="mt-4">
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
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/buyer/home')}
                className="sm:min-w-[120px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={submitting}
                className="sm:min-w-[160px]"
              >
                Confirm Pass
              </Button>
            </div>
          </div>
        </form>
      </div>
    </BuyerLayout>
  );
};

export default BuyerConfirmPassPage;