import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CheckBadgeIcon,
  ShieldCheckIcon,
  PhotoIcon,
  InformationCircleIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';
import PublicLayout from '../../components/layout/PublicLayout';
import { getConfirmInviteInfo, submitConfirmInviteDetails } from '../../api/confirm';
import { photoQualityChecker, photoEnhancer } from '../../utils/photoQualityChecker';
import CameraCapture from '../../components/shared/CameraCapture';

const AttendeeIdentityConfirmPage = () => {
  const { inviteToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    idNumber: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    photo: null,
  });
  const [preview, setPreview] = useState(null);
  const [enhancedPreview, setEnhancedPreview] = useState(null);
  const [activeFilter, setActiveFilter] = useState('none');
  const [qualityAnalysis, setQualityAnalysis] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [allowOverride, setAllowOverride] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadFailed, setModelLoadFailed] = useState(false);
  const [faceAnalysis, setFaceAnalysis] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const smsEnabled = !!inviteInfo?.event?.smsEnabled;
  const imageRef = useRef(null);
  const overlayRef = useRef(null);
  const enhancedCanvasRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await getConfirmInviteInfo(inviteToken);
        const data = response.data.data;
        setInviteInfo(data);
        setForm((prev) => ({
          ...prev,
          fullName: data?.attendee?.fullName || '',
          email: data?.attendee?.email || prev.email,
          phone: data?.attendee?.phone || prev.phone,
        }));
      } catch (err) {
        // handled by empty state
      } finally {
        setLoading(false);
      }
    };
    if (inviteToken) load();
  }, [inviteToken]);

  useEffect(() => {
    const loadFaceApi = async () => {
      try {
        if (!window.faceapi) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
          script.crossOrigin = 'anonymous';
          document.body.appendChild(script);
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });
        }

        const faceapiLib = window.faceapi;
        if (!faceapiLib) throw new Error('faceapi not available');

        const modelPaths = [
          '/models',
          'https://justadudewhohacks.github.io/face-api.js/models',
        ];

        let loaded = false;
        let lastError = null;
        for (const modelPath of modelPaths) {
          try {
            await faceapiLib.nets.ssdMobilenetv1.loadFromUri(modelPath);
            await faceapiLib.nets.faceLandmark68Net.loadFromUri(modelPath);
            await faceapiLib.nets.faceRecognitionNet.loadFromUri(modelPath);
            await faceapiLib.nets.faceExpressionNet.loadFromUri(modelPath);
            loaded = true;
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (!loaded) throw lastError || new Error('Unable to load face-api models');
        setModelsLoaded(true);
      } catch (err) {
        console.error('Failed to load face-api models', err);
        setModelLoadFailed(true);
        toast.error('Face matching is temporarily unavailable. You can still submit your photo.');
      }
    };
    loadFaceApi();
  }, []);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const computeBrightness = (imageData) => {
    const { data } = imageData;
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    return total / (data.length / 4);
  };

  const computeSharpness = (imageData) => {
    const { data, width, height } = imageData;
    const toGray = (x, y) => {
      const i = (y * width + x) * 4;
      return (data[i] + data[i + 1] + data[i + 2]) / 3;
    };
    let sum = 0;
    let sumSq = 0;
    let pixels = 0;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const gx =
          -1 * toGray(x - 1, y - 1) -
          2 * toGray(x - 1, y) -
          1 * toGray(x - 1, y + 1) +
          1 * toGray(x + 1, y - 1) +
          2 * toGray(x + 1, y) +
          1 * toGray(x + 1, y + 1);
        const gy =
          -1 * toGray(x - 1, y - 1) -
          2 * toGray(x, y - 1) -
          1 * toGray(x + 1, y - 1) +
          1 * toGray(x - 1, y + 1) +
          2 * toGray(x, y + 1) +
          1 * toGray(x + 1, y + 1);
        const mag = Math.sqrt(gx * gx + gy * gy);
        sum += mag;
        sumSq += mag * mag;
        pixels += 1;
      }
    }
    const mean = sum / pixels;
    return sumSq / pixels - mean * mean;
  };

  const drawBoundingBox = (box) => {
    const canvas = overlayRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !box) return;
    const ctx = canvas.getContext('2d');
    const ratio = img.naturalWidth / img.clientWidth;
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(box.x / ratio, box.y / ratio, box.width / ratio, box.height / ratio);
  };

  const analyzePhoto = async (file) => {
    if (!modelsLoaded) {
      return {
        faceCount: 0,
        confidence: 0,
        boundingBox: null,
        brightness: 0,
        sharpness: 0,
        descriptor: [],
        errors: [],
        skipped: true,
      };
    }

    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const brightness = computeBrightness(imageData);
    const sharpness = computeSharpness(imageData);

    const faceapiLib = window.faceapi;
    const detection = await faceapiLib
      .detectSingleFace(img, new faceapiLib.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    const errors = [];
    let faceCount = 0;
    let confidence = 0;
    let boundingBox = null;
    let descriptor = [];

    if (!detection) {
      errors.push('No face detected');
    } else {
      faceCount = 1;
      confidence = detection.detection.score;
      boundingBox = detection.detection.box;
      descriptor = Array.from(detection.descriptor || []);
      if (!descriptor.length) errors.push('Face descriptor extraction failed');
    }

    return {
      faceCount,
      confidence,
      boundingBox,
      brightness: Math.round(brightness),
      sharpness: Math.round(sharpness),
      descriptor,
      errors,
    };
  };

  const applyEnhancementFilter = (filterType) => {
    if (!preview) return;
    const img = new Image();
    img.onload = () => {
      const canvas = enhancedCanvasRef.current || document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const enhancedDataURL = photoEnhancer.applyFilter(canvas, filterType);
      setEnhancedPreview(enhancedDataURL);
      setActiveFilter(filterType);
    };
    img.src = preview;
  };

  const resetPreview = () => {
    setEnhancedPreview(null);
    setActiveFilter('none');
  };

  const validatePhoto = async (file) => {
    const quality = await photoQualityChecker.analyzePhoto(file);
    setQualityAnalysis(quality);
    const allErrors = [...quality.errors, ...quality.warnings];
    const face = await analyzePhoto(file);
    setFaceAnalysis(face);
    if (face.errors.length > 0) allErrors.push(...face.errors);
    if (face.boundingBox && imageRef.current) drawBoundingBox(face.boundingBox);
    return allErrors;
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const errors = await validatePhoto(file);
    setValidationErrors(errors);
    setAllowOverride(errors.length > 0);
    setEnhancedPreview(null);
    setActiveFilter('none');
    setForm((prev) => ({ ...prev, photo: file }));
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email) {
      toast.error('Full name and email are required.');
      return;
    }
    if (!form.photo) {
      toast.error('Please upload an identity verification photo.');
      return;
    }
    if (validationErrors.length > 0 && !allowOverride) {
      toast.error('Please fix photo validation issues or allow override.');
      return;
    }
    if (modelsLoaded && !faceAnalysis?.descriptor?.length) {
      toast.error('Unable to compute face descriptor; please try another photo.');
      return;
    }

    const payload = new FormData();
    payload.append('fullName', form.fullName);
    payload.append('idNumber', form.idNumber);
    payload.append('dateOfBirth', form.dateOfBirth);
    payload.append('email', form.email);
    payload.append('phone', form.phone);
    payload.append('photo', form.photo);
    payload.append('faceValidationPassed', String(validationErrors.length === 0 || allowOverride));
    payload.append('faceCount', String(faceAnalysis?.faceCount ?? 0));
    payload.append('faceConfidence', String(faceAnalysis?.confidence ?? 0));
    payload.append('brightness', String(faceAnalysis?.brightness ?? 0));
    payload.append('sharpness', String(faceAnalysis?.sharpness ?? 0));
    payload.append('faceDescriptor', JSON.stringify(faceAnalysis?.descriptor || []));
    payload.append('skipFaceMatch', String(!modelsLoaded || modelLoadFailed));

    setSubmitting(true);
    try {
      await submitConfirmInviteDetails(inviteToken, payload);
      setSubmitted(true);
      toast.success('Identity details submitted for verification.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-teal-600 border-t-transparent" />
            <p className="text-sm font-medium text-slate-500">Verifying secure link...</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (!inviteInfo) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <InformationCircleIcon className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Access Link Invalid
          </h1>
          <p className="mt-3 text-sm text-slate-500 max-w-sm mx-auto">
            This invitation link has expired, been revoked, or already used.
          </p>
        </div>
      </PublicLayout>
    );
  }

  if (submitted) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-600">
            <CheckBadgeIcon className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Submission Received
          </h1>
          <p className="mt-3 text-sm text-slate-500 max-w-sm mx-auto">
            Your identity details are under verification. You’ll receive your final{' '}
            {inviteInfo?.attendee?.isPass ? 'Pass QR' : 'Ticket QR'} email once approved.
          </p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="relative min-h-screen bg-slate-50 pb-16">
        {/* Header */}
        <div className="bg-slate-950 px-4 pt-14 pb-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-teal-400 mb-3">
              Identity Verification
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Secure Attendance
            </h1>
            <p className="mt-3 text-base text-slate-400">
              Confirming {inviteInfo?.attendee?.isPass ? 'Pass' : 'Entry'} for{' '}
              <span className="font-medium text-white">{inviteInfo.event?.name}</span>
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="relative mx-auto -mt-14 max-w-3xl px-4 sm:px-6 lg:px-8">
          <form
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
          >
            <div className="bg-slate-900 px-5 sm:px-6 py-4 flex items-center gap-2.5">
              <ShieldCheckIcon className="h-5 w-5 text-teal-400" />
              <h2 className="text-base font-semibold text-white">Attendee Profile Form</h2>
            </div>

            <div className="p-5 sm:p-7 space-y-8">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Left column */}
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Full Identity Name *
                    </label>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(e) => handleChange('fullName', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                      placeholder="Current full name"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      NIC / Passport Number
                    </label>
                    <input
                      type="text"
                      value={form.idNumber}
                      onChange={(e) => handleChange('idNumber', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                    />
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Contact Email *
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      readOnly
                      className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-sm font-medium text-slate-500 cursor-not-allowed"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Phone Number {smsEnabled ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      required={smsEnabled}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                      placeholder="+94 77 123 4567"
                    />
                  </div>

                  {/* Photo upload */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Identity Photo (Selfie) *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="group relative flex h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 transition-all hover:border-teal-400 hover:bg-teal-50/30">
                        {form.photo ? (
                          <div className="relative h-full w-full p-1.5">
                            <img
                              src={enhancedPreview || preview}
                              alt="Preview"
                              ref={imageRef}
                              className="h-full w-full rounded-xl object-cover"
                            />
                            <canvas
                              ref={overlayRef}
                              className="pointer-events-none absolute inset-1.5 h-[calc(100%-12px)] w-[calc(100%-12px)]"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <PhotoIcon className="mb-1.5 h-7 w-7 text-slate-300 group-hover:text-teal-500" />
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-teal-600">
                              Upload
                            </p>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="group flex h-32 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 transition-all hover:border-teal-400 hover:bg-teal-50/30"
                      >
                        <CameraIcon className="mb-1.5 h-7 w-7 text-slate-300 group-hover:text-teal-500" />
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-teal-600">
                          Take Photo
                        </p>
                      </button>
                    </div>

                    {showCamera && (
                      <CameraCapture
                        onCapture={async (file) => {
                          const errors = await validatePhoto(file);
                          setValidationErrors(errors);
                          setAllowOverride(errors.length > 0);
                          setEnhancedPreview(null);
                          setActiveFilter('none');
                          setForm((prev) => ({ ...prev, photo: file }));
                          setPreview(URL.createObjectURL(file));
                        }}
                        onClose={() => setShowCamera(false)}
                      />
                    )}

                    {modelLoadFailed && (
                      <p className="text-xs text-amber-600 mt-1">
                        Advanced face matching is temporarily unavailable. Your photo can still be
                        submitted for manual review.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Quality analysis */}
              {qualityAnalysis && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">
                      Photo Quality: {qualityAnalysis.qualityRating?.rating || 'Pending'}
                    </span>
                    <span className="text-sm font-medium text-slate-600">
                      Score {qualityAnalysis.qualityRating?.score || 0}%
                    </span>
                  </div>
                  <div className="grid gap-1.5 text-xs text-slate-500 sm:grid-cols-2">
                    {qualityAnalysis.resolution && (
                      <div>
                        Resolution: {qualityAnalysis.resolution.dimensions?.width}×
                        {qualityAnalysis.resolution.dimensions?.height}
                      </div>
                    )}
                    {qualityAnalysis.brightness && (
                      <div>Brightness: {qualityAnalysis.brightness.brightness}</div>
                    )}
                    {qualityAnalysis.blur && (
                      <div>Sharpness: {qualityAnalysis.blur.sharpness}</div>
                    )}
                    {qualityAnalysis.contrast && (
                      <div>Contrast: {qualityAnalysis.contrast.contrast}</div>
                    )}
                    {faceAnalysis && <div>Face count: {faceAnalysis.faceCount}</div>}
                    {faceAnalysis && (
                      <div>
                        Face confidence: {(faceAnalysis.confidence * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['none', 'brighten', 'enhance', 'vivid'].map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() =>
                          filter === 'none' ? resetPreview() : applyEnhancementFilter(filter)
                        }
                        className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                          activeFilter === filter
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {filter === 'none' ? 'Original' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <ul className="space-y-1 text-sm text-amber-800">
                    {validationErrors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                  <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={allowOverride}
                      onChange={(e) => setAllowOverride(e.target.checked)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    Ignore warnings and proceed
                  </label>
                </div>
              )}

              {/* Submit */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-6">
                <div className="flex items-center gap-2 text-teal-600">
                  <CheckBadgeIcon className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Secure Verification Link
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={submitting || (validationErrors.length > 0 && !allowOverride)}
                  className="w-full sm:w-auto rounded-2xl bg-teal-600 hover:bg-teal-500 px-8 py-3.5 text-sm font-semibold text-white shadow-sm shadow-teal-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Confirm My Identity'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
};

export default AttendeeIdentityConfirmPage;