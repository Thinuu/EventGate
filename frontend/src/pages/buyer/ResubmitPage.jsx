import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getResubmitInfo, resubmitPhoto } from '../../api/attendees';
import { getAssetUrl } from '../../utils/backend';
import { photoQualityChecker, photoEnhancer } from '../../utils/photoQualityChecker';
import toast from 'react-hot-toast';
import CameraCapture from '../../components/shared/CameraCapture';
import {
  CameraIcon,
  PhotoIcon,
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

const useIsMobileDevice = () => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (event) => setIsMobile(event.matches);
    handleChange(mediaQuery);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
};

const ResubmitPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [attendee, setAttendee] = useState(null);
  const [event, setEvent] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelLoadFailed, setModelLoadFailed] = useState(false);
  const [faceAnalysis, setFaceAnalysis] = useState(null);
  const [allowOverride, setAllowOverride] = useState(false);
  const [faceMatchThreshold, setFaceMatchThreshold] = useState(0.5);
  const [qualityAnalysis, setQualityAnalysis] = useState(null);
  const [enhancedPreview, setEnhancedPreview] = useState(null);
  const [activeFilter, setActiveFilter] = useState('none');
  const [showCamera, setShowCamera] = useState(false);
  const [invalidated, setInvalidated] = useState(null);
  const isMobile = useIsMobileDevice();

  const imageRef = useRef(null);
  const overlayRef = useRef(null);
  const enhancedCanvasRef = useRef(null);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const response = await getResubmitInfo(token);
        setAttendee(response.data.data.attendee);
        setEvent(response.data.data.event);
      } catch (err) {
        const payload = err.response?.data;
        if (payload?.data?.invalidated) {
          setInvalidated(payload.data);
          return;
        }
        toast.error(payload?.message || 'Invalid resubmit link');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [token, navigate]);

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
        toast.error('Face matching is temporarily unavailable. You can still resubmit your photo.');
      }
    };

    loadFaceApi();
  }, []);

  const computeBrightness = (imageData) => {
    const { data } = imageData;
    let total = 0;
    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      total += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    return total / (len / 4);
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
          -1 * toGray(x - 1, y - 1) - 2 * toGray(x - 1, y) - 1 * toGray(x - 1, y + 1) +
          1 * toGray(x + 1, y - 1) + 2 * toGray(x + 1, y) + 1 * toGray(x + 1, y + 1);
        const gy =
          -1 * toGray(x - 1, y - 1) - 2 * toGray(x, y - 1) - 1 * toGray(x + 1, y - 1) +
          1 * toGray(x - 1, y + 1) + 2 * toGray(x, y + 1) + 1 * toGray(x + 1, y + 1);
        const mag = Math.sqrt(gx * gx + gy * gy);
        sum += mag;
        sumSq += mag * mag;
        pixels += 1;
      }
    }

    const mean = sum / pixels;
    return sumSq / pixels - mean * mean;
  };

  const euclideanDistance = (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return null;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  };

  const similarityFromDistance = (distance) => {
    if (typeof distance !== 'number' || Number.isNaN(distance)) return 0;
    return Math.max(0, Math.min(1, 1 - distance));
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
        matchDistance: null,
        matchSimilarity: null,
        matchThreshold: faceMatchThreshold,
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
    if (!faceapiLib) {
      return {
        faceCount: 0,
        confidence: 0,
        brightness: Math.round(brightness),
        sharpness: Math.round(sharpness),
        boundingBox: null,
        errors: ['Face API not loaded'],
      };
    }

    const detection = await faceapiLib
      .detectSingleFace(img, new faceapiLib.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    const errors = [];
    let faceCount = 0;
    let confidence = 0;
    let boundingBox = null;
    let descriptor = null;

    if (!detection) {
      errors.push('No face detected');
    } else {
      faceCount = 1;
      confidence = detection.detection.score;
      boundingBox = detection.detection.box;
      descriptor = Array.from(detection.descriptor);

      if (!descriptor.length) errors.push('Face descriptor extraction failed');

      if (attendee?.faceDescriptor?.length > 0) {
        const distance = euclideanDistance(attendee.faceDescriptor, descriptor);
        const similarity = similarityFromDistance(distance);

        if (distance === null) {
          errors.push('Descriptor size mismatch for comparison');
        } else if (similarity < faceMatchThreshold) {
          errors.push(
            `Face similarity too low (${(similarity * 100).toFixed(1)}%) against saved profile at threshold ${(faceMatchThreshold * 100).toFixed(1)}%`
          );
        }

        return {
          faceCount,
          confidence,
          boundingBox,
          brightness: Math.round(brightness),
          sharpness: Math.round(sharpness),
          descriptor,
          matchDistance: distance,
          matchSimilarity: similarity,
          matchThreshold: faceMatchThreshold,
          errors,
        };
      }
    }

    return {
      faceCount,
      confidence,
      boundingBox,
      brightness: Math.round(brightness),
      sharpness: Math.round(sharpness),
      descriptor,
      matchDistance: null,
      matchSimilarity: null,
      matchThreshold: faceMatchThreshold,
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
      setEnhancedPreview(photoEnhancer.applyFilter(canvas, filterType));
      setActiveFilter(filterType);
    };
    img.src = preview;
  };

  const resetPreview = () => {
    setEnhancedPreview(null);
    setActiveFilter('none');
  };

  const validatePhoto = async (file) => {
    const analysis = await photoQualityChecker.analyzePhoto(file);
    setQualityAnalysis(analysis);
    const allErrors = [...analysis.errors, ...analysis.warnings];
    const faceAnalysisResult = await analyzePhoto(file);
    setFaceAnalysis(faceAnalysisResult);
    if (faceAnalysisResult.errors.length > 0) allErrors.push(...faceAnalysisResult.errors);
    if (faceAnalysisResult.boundingBox && imageRef.current) {
      drawBoundingBox(faceAnalysisResult.boundingBox);
    }
    return allErrors;
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const errors = await validatePhoto(file);
    setValidationErrors(errors);
    setAllowOverride(errors.length > 0);
    setEnhancedPreview(null);
    setActiveFilter('none');
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleCapturedPhoto = async (file) => {
    const errors = await validatePhoto(file);
    setValidationErrors(errors);
    setAllowOverride(errors.length > 0);
    setEnhancedPreview(null);
    setActiveFilter('none');
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setShowCamera(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photo) return toast.error('Please select a photo');
    if (validationErrors.length > 0 && !allowOverride) {
      return toast.error('Please fix photo validation errors or enable override');
    }
    if (modelsLoaded && attendee?.faceDescriptor?.length > 0 && !faceAnalysis?.descriptor?.length) {
      return toast.error('Unable to compute face descriptor; please try another photo');
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('photo', photo);
      formData.append('token', token);
      formData.append('faceValidationPassed', String(validationErrors.length === 0 || allowOverride));
      formData.append('faceCount', String(faceAnalysis?.faceCount ?? '0'));
      formData.append('faceConfidence', String(faceAnalysis?.confidence ?? '0'));
      formData.append('brightness', String(faceAnalysis?.brightness ?? '0'));
      formData.append('sharpness', String(faceAnalysis?.sharpness ?? '0'));
      formData.append('faceDescriptor', JSON.stringify(faceAnalysis?.descriptor || []));
      formData.append('threshold', String(faceMatchThreshold));
      formData.append('faceMatchDistance', String(faceAnalysis?.matchDistance ?? 0));
      formData.append('faceMatchSimilarity', String(faceAnalysis?.matchSimilarity ?? 0));
      formData.append('skipFaceMatch', String(!modelsLoaded || modelLoadFailed));
      await resubmitPhoto(formData);
      toast.success('Photo resubmitted for review');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Resubmit failed');
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

  if (!attendee && !invalidated) return null;

  // ─── Invalidated ──────────────────────────────────────────────────
  if (invalidated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-slate-100 bg-white text-center shadow-sm">
          <div className="bg-rose-50 px-8 py-10">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-100">
              <ExclamationTriangleIcon className="h-10 w-10 text-rose-600" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">
              Ticket Invalidated
            </h2>
          </div>
          <div className="space-y-4 px-8 py-8">
            <p className="text-sm leading-relaxed text-slate-500">
              Maximum photo resubmissions were reached. This ticket is no longer valid.
            </p>
            {invalidated.refundAmount > 0 && (
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                Refund initiated:{' '}
                {invalidated.currency || invalidated.event?.settings?.currency || 'LKR'}{' '}
                {Number(invalidated.refundAmount).toLocaleString()}
              </p>
            )}
            {invalidated.ticketNumber && (
              <p className="text-xs font-mono text-slate-400">
                Ticket #{invalidated.ticketNumber}
              </p>
            )}
            <p className="text-xs text-slate-400">
              The ticket has been returned to public availability where applicable. Refunds are
              processed to the original payment method.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const eventName = event?.name || 'Event';
  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Date to be announced';

  return (
    <div className="min-h-screen bg-slate-50 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* ────────────── Hero ────────────── */}
      <div className="relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-main/20 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-white/60 transition hover:text-white"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-white/50">
            Photo Resubmission
          </p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
            Resubmit Photo
          </h1>
          <p className="mt-3 max-w-xl text-sm font-medium text-white/70">
            {isMobile
              ? 'Use your camera for the clearest face photo, then submit for organizer review.'
              : 'Upload a clear replacement photo from your device for organizer review.'}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-5">
          {/* ────────────── Left: Context ────────────── */}
          <div className="space-y-4 lg:col-span-2">
            {/* Rejection reason */}
            <div className="overflow-hidden rounded-[28px] border border-rose-100 bg-white shadow-sm">
              <div className="bg-rose-50 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100">
                    <ExclamationTriangleIcon className="h-5 w-5 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-rose-900">
                      Rejection Reason
                    </h3>
                    <p className="mt-0.5 text-xs font-bold text-rose-600">
                      Resubmission {attendee.resubmitCount || 0}/3
                    </p>
                  </div>
                </div>
              </div>
              <p className="px-6 py-5 text-sm leading-relaxed text-slate-600">
                {attendee.rejectionReason ||
                  'Your previous photo did not meet verification requirements.'}
              </p>
            </div>

            {/* Event info */}
            {event && (
              <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm">
                <div className="space-y-0 divide-y divide-slate-50">
                  <div className="px-6 py-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Event
                    </p>
                    <p className="mt-1.5 text-sm font-bold text-slate-900">{eventName}</p>
                  </div>
                  <div className="flex items-center gap-3 px-6 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-brand-main">
                      <CalendarIcon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">{eventDate}</span>
                  </div>
                  {event?.venue?.name && (
                    <div className="flex items-center gap-3 px-6 py-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-brand-main">
                        <MapPinIcon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-600">
                        {event.venue.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Previous photo */}
            {attendee.photo && (
              <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-50 bg-slate-50/50 px-6 py-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">
                    Previous Photo
                  </h3>
                </div>
                <div className="p-4">
                  <img
                    src={getAssetUrl(attendee.photo)}
                    alt="Previous submission"
                    className="w-full rounded-2xl object-cover"
                  />
                </div>
              </div>
            )}

            {/* Requirements */}
            <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-50 bg-slate-50/50 px-6 py-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">
                  Photo Requirements
                </h3>
              </div>
              <ul className="space-y-2 px-6 py-5 text-sm text-slate-600">
                <li>• Clear face visible, facing the camera</li>
                <li>• Good lighting, no heavy shadows</li>
                <li>• No blur, sunglasses, or hats</li>
                <li>• Recent photo (JPG or PNG, 50KB–5MB)</li>
              </ul>
              {modelLoadFailed && (
                <p className="border-t border-slate-50 px-6 py-4 text-xs text-amber-700">
                  Advanced face matching is temporarily unavailable. Your photo can still be
                  submitted for manual review.
                </p>
              )}
            </div>
          </div>

          {/* ────────────── Right: Upload Form ────────────── */}
          <div className="lg:col-span-3">
            <form
              onSubmit={handleSubmit}
              className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm"
            >
              <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-5">
                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-900">
                  New Photo
                </h2>
              </div>

              <div className="space-y-6 p-6 sm:p-8">
                {/* Threshold */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Face-match Threshold ({(faceMatchThreshold * 100).toFixed(0)}%)
                  </label>
                  <input
                    type="range"
                    min="0.4"
                    max="0.6"
                    step="0.01"
                    value={faceMatchThreshold}
                    onChange={(e) => setFaceMatchThreshold(Number(e.target.value))}
                    className="w-full accent-brand-main"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Adjust similarity threshold between 40% and 60%
                  </p>
                </div>

                {/* Upload / Camera */}
                <div>
                  <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-slate-500">
                    {isMobile ? 'Take or Upload New Photo' : 'Upload New Photo'}
                  </label>
                  <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {isMobile && (
                      <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="flex min-h-[112px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-main/30 bg-brand-main/5 px-4 py-5 transition hover:border-brand-main/50 hover:bg-brand-main/10"
                      >
                        <CameraIcon className="h-7 w-7 text-brand-main" />
                        <span className="mt-2 text-[10px] font-black uppercase tracking-widest text-brand-main">
                          Use Camera
                        </span>
                        <span className="mt-1 text-[11px] text-brand-main/70">
                          Recommended on mobile
                        </span>
                      </button>
                    )}

                    <label className="group relative flex min-h-[112px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 transition hover:border-brand-main/40 hover:bg-brand-main/5">
                      <PhotoIcon className="h-7 w-7 text-slate-300 transition group-hover:text-brand-main" />
                      <span className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand-main">
                        {isMobile ? 'Choose from Gallery' : 'Upload File'}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/*"
                        capture={isMobile ? 'user' : undefined}
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                    </label>

                    {!isMobile && (
                      <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="group flex min-h-[112px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 transition hover:border-brand-main/40 hover:bg-brand-main/5"
                      >
                        <CameraIcon className="h-7 w-7 text-slate-300 transition group-hover:text-brand-main" />
                        <span className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand-main">
                          Use Webcam
                        </span>
                      </button>
                    )}
                  </div>

                  {showCamera && (
                    <div className="mt-4">
                      <CameraCapture
                        onCapture={handleCapturedPhoto}
                        onClose={() => setShowCamera(false)}
                      />
                    </div>
                  )}
                </div>

                {/* Validation errors */}
                {validationErrors.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                    <ul className="space-y-1 text-sm font-medium text-amber-900">
                      {validationErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Preview & Analysis */}
                {preview && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900">
                      Preview & Quality Analysis
                    </h3>

                    {qualityAnalysis && (
                      <div
                        className="rounded-2xl border-2 p-4"
                        style={{
                          borderColor:
                            {
                              Good: '#10b981',
                              Medium: '#f59e0b',
                              Poor: '#ef4444',
                            }[qualityAnalysis.qualityRating?.rating] || '#e2e8f0',
                          backgroundColor:
                            {
                              Good: '#ecfdf5',
                              Medium: '#fffbeb',
                              Poor: '#fef2f2',
                            }[qualityAnalysis.qualityRating?.rating] || '#f8fafc',
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-800">
                            Quality: {qualityAnalysis.qualityRating?.rating}
                          </span>
                          <span className="text-xs font-semibold text-slate-600">
                            Score {qualityAnalysis.qualityRating?.score}%
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          {qualityAnalysis.resolution && (
                            <div>
                              <span className="text-slate-500">Resolution:</span>
                              <span
                                className={
                                  qualityAnalysis.resolution.valid
                                    ? ' text-emerald-600'
                                    : ' text-rose-600'
                                }
                              >
                                {' '}
                                {qualityAnalysis.resolution.dimensions?.width}x
                                {qualityAnalysis.resolution.dimensions?.height}
                              </span>
                            </div>
                          )}
                          {qualityAnalysis.brightness && (
                            <div>
                              <span className="text-slate-500">Brightness:</span>
                              <span
                                className={
                                  qualityAnalysis.brightness.valid
                                    ? ' text-emerald-600'
                                    : ' text-rose-600'
                                }
                              >
                                {' '}
                                {qualityAnalysis.brightness.brightness}
                              </span>
                            </div>
                          )}
                          {qualityAnalysis.blur && (
                            <div>
                              <span className="text-slate-500">Sharpness:</span>
                              <span
                                className={
                                  qualityAnalysis.blur.valid
                                    ? ' text-emerald-600'
                                    : ' text-rose-600'
                                }
                              >
                                {' '}
                                {qualityAnalysis.blur.sharpness}
                              </span>
                            </div>
                          )}
                          {qualityAnalysis.contrast && (
                            <div>
                              <span className="text-slate-500">Contrast:</span>
                              <span
                                className={
                                  qualityAnalysis.contrast.valid
                                    ? ' text-emerald-600'
                                    : ' text-rose-600'
                                }
                              >
                                {' '}
                                {qualityAnalysis.contrast.contrast}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      <img
                        ref={imageRef}
                        src={enhancedPreview || preview}
                        alt="Preview"
                        className="max-h-[min(70vh,28rem)] w-full object-contain"
                      />
                      <canvas
                        ref={overlayRef}
                        className="pointer-events-none absolute inset-0 h-full w-full"
                      />
                    </div>

                    {/* Enhance filters */}
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Auto-Enhance
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'none', label: 'Original' },
                          { id: 'brighten', label: 'Brighten' },
                          { id: 'enhance', label: 'Enhance' },
                          { id: 'vivid', label: 'Vivid' },
                        ].map((filter) => (
                          <button
                            key={filter.id}
                            type="button"
                            onClick={() =>
                              filter.id === 'none'
                                ? resetPreview()
                                : applyEnhancementFilter(filter.id)
                            }
                            className={`rounded-xl px-3.5 py-2 text-[10px] font-black uppercase tracking-wider transition ${
                              activeFilter === filter.id
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {faceAnalysis && (
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                        <p>
                          Face count: <strong className="text-slate-700">{faceAnalysis.faceCount}</strong>
                        </p>
                        <p>
                          Confidence:{' '}
                          <strong className="text-slate-700">
                            {(faceAnalysis.confidence * 100).toFixed(1)}%
                          </strong>
                        </p>
                        {faceAnalysis.matchDistance != null && (
                          <>
                            <p>
                              Match similarity:{' '}
                              <strong className="text-slate-700">
                                {(faceAnalysis.matchSimilarity * 100).toFixed(1)}%
                              </strong>
                            </p>
                            <p>
                              Threshold:{' '}
                              <strong className="text-slate-700">
                                {(faceAnalysis.matchThreshold * 100).toFixed(1)}%
                              </strong>
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Override */}
                {validationErrors.length > 0 && (
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={allowOverride}
                      onChange={(e) => setAllowOverride(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-main focus:ring-brand-main"
                    />
                    <span className="leading-relaxed">
                      Ignore warnings and proceed (not recommended)
                    </span>
                  </label>
                )}

                {/* Submit */}
                <div className="sticky bottom-0 -mx-6 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                  <button
                    type="submit"
                    disabled={submitting || (validationErrors.length > 0 && !allowOverride)}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:bg-brand-main hover:shadow-[0_0_30px_rgba(37,99,235,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Submitting…' : 'Submit Photo for Review'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResubmitPage;