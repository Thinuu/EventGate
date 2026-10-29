import React, { useRef, useState, useCallback, useEffect } from 'react';
import { XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import Button from '../ui/Button';

const CameraCapture = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Could not access camera. Please ensure you have given permission.');
    }
  }, [facingMode, stream]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      // Mirror front camera
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], 'camera-capture.jpg', {
              type: 'image/jpeg',
            });
            onCapture(file);
            onClose();
          }
        },
        'image/jpeg',
        0.9
      );
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-md max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-slate-200/20 bg-slate-900 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/60 bg-slate-900/90 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-2 w-2 rounded-full bg-rose-500 ring-4 ring-rose-500/20" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              Identity Verification
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Camera viewport */}
        <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 rounded-2xl bg-rose-500/10 p-4">
                <XMarkIcon className="h-8 w-8 text-rose-500" />
              </div>
              <p className="max-w-xs text-sm font-medium text-slate-300">
                {error}
              </p>
              <Button
                variant="outline"
                className="mt-6 border-slate-600 text-slate-300 hover:bg-slate-800"
                onClick={startCamera}
              >
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Face alignment guide */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative aspect-[3/4] h-[68%] max-h-[78%] rounded-[2.5rem] border-2 border-dashed border-white/25">
                  {/* Corner accents */}
                  <div className="absolute -left-1 -top-1 h-7 w-7 rounded-tl-2xl border-l-[3px] border-t-[3px] border-teal-500" />
                  <div className="absolute -right-1 -top-1 h-7 w-7 rounded-tr-2xl border-r-[3px] border-t-[3px] border-teal-500" />
                  <div className="absolute -bottom-1 -left-1 h-7 w-7 rounded-bl-2xl border-b-[3px] border-l-[3px] border-teal-500" />
                  <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-br-2xl border-b-[3px] border-r-[3px] border-teal-500" />

                  <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">
                      Align Face Here
                    </p>
                  </div>
                </div>
              </div>

              {/* Live indicator */}
              <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-white/10 bg-slate-900/70 px-3.5 py-1.5 backdrop-blur">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
                  Live • {facingMode === 'user' ? 'Front' : 'Rear'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900 px-6 py-5">
          <button
            onClick={toggleCamera}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            title="Switch Camera"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>

          {/* Capture button */}
          <button
            onClick={capturePhoto}
            disabled={!!error || !stream}
            className="group relative flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-slate-700 bg-slate-950 p-1 transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            <div className="h-full w-full rounded-full bg-white shadow-lg transition group-hover:bg-teal-50" />
          </button>

          {/* Spacer for balance */}
          <div className="h-12 w-12" />
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default CameraCapture;