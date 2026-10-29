import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { BoltIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

const QRScannerComponent = ({
  onScanSuccess,
  onScanError,
  fps = 10,
  qrbox = 250,
  aspectRatio = 1.0,
  scanCooldownMs = 2000,
}) => {
  const scannerRef = useRef(null);
  const elementIdRef = useRef(`reader-${Math.random().toString(36).slice(2, 10)}`);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanErrorRef = useRef(onScanError);
  const isRunningRef = useRef(false);
  const lastScanRef = useRef({ value: '', timestamp: 0 });

  const [status, setStatus] = useState('Starting camera...');
  const [cameras, setCameras] = useState([]);
  const [currentCameraId, setCurrentCameraId] = useState('');
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    onScanErrorRef.current = onScanError;
  }, [onScanError]);

  useEffect(() => {
    let mounted = true;
    let scannerInstance = null;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(elementIdRef.current);
        scannerRef.current = scanner;
        scannerInstance = scanner;

        const cameraList = await Html5Qrcode.getCameras();
        if (!mounted) return;

        if (!cameraList?.length) {
          setStatus('No camera found on this device.');
          onScanErrorRef.current?.('NotFoundError');
          return;
        }

        setCameras(cameraList);

        const backCamera = cameraList.find((camera) =>
          /back|rear|environment/i.test(`${camera.label || ''}`)
        );

        const selectedId = backCamera?.id || cameraList[0].id;
        setCurrentCameraId(selectedId);

        setStatus('Point the camera at the attendee QR code.');

        if (!mounted) return;

        await scanner.start(
          selectedId,
          {
            fps,
            qrbox: { width: qrbox, height: qrbox },
            aspectRatio,
          },
          (decodedText, decodedResult) => {
            const now = Date.now();
            if (
              lastScanRef.current.value === decodedText &&
              now - lastScanRef.current.timestamp < scanCooldownMs
            ) {
              return;
            }
            lastScanRef.current = { value: decodedText, timestamp: now };
            onScanSuccessRef.current?.(decodedText, decodedResult);
          },
          () => {}
        );

        if (!mounted) {
          // If unmounted while start was awaiting, cleanly stop and clear
          try {
            if (scanner.isScanning) {
              await scanner.stop().catch(() => {});
            }
            scanner.clear();
          } catch {}
          return;
        }

        isRunningRef.current = true;

        // Detect torch support
        try {
          const track = scanner.getRunningTrack();
          if (track?.getCapabilities) {
            const capabilities = track.getCapabilities();
            setHasTorch(!!capabilities?.torch);
          }
        } catch (err) {
          console.warn('Unable to query torch capabilities', err);
        }
      } catch (error) {
        if (!mounted) return;
        const message = `${error?.message || error || 'Unable to open camera.'}`;
        if (
          error?.name === 'AbortError' ||
          message.includes('interrupted because the media was removed')
        ) {
          return;
        }
        setStatus(message);
        isRunningRef.current = false;
        if (
          message.includes('NotAllowedError') ||
          message.includes('Permission') ||
          message.includes('NotFoundError')
        ) {
          onScanErrorRef.current?.(message);
        }
      }
    };

    const startPromise = startScanner();

    return () => {
      mounted = false;
      isRunningRef.current = false;
      const scanner = scannerInstance || scannerRef.current;
      scannerRef.current = null;

      if (scanner) {
        startPromise
          .catch(() => {})
          .finally(async () => {
            try {
              if (scanner.isScanning) {
                await scanner.stop().catch(() => {});
              }
              scanner.clear();
            } catch {
              // Ignore cleanup errors during React dev remounts
            }
          });
      }
    };
  }, [aspectRatio, fps, qrbox, scanCooldownMs]);

  const toggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner || !isRunningRef.current || !hasTorch) return;

    try {
      const nextState = !isTorchOn;
      await scanner.applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('Flashlight toggle failed:', err);
    }
  };

  const switchCamera = async () => {
    const scanner = scannerRef.current;
    if (!scanner || cameras.length <= 1) return;

    try {
      const currentIndex = cameras.findIndex((c) => c.id === currentCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCamera = cameras[nextIndex];

      setStatus('Switching camera...');
      setIsTorchOn(false);
      setHasTorch(false);

      if (scanner.isScanning) {
        await scanner.stop().catch(() => {});
        isRunningRef.current = false;
      }

      setCurrentCameraId(nextCamera.id);

      await scanner.start(
        nextCamera.id,
        {
          fps,
          qrbox: { width: qrbox, height: qrbox },
          aspectRatio,
        },
        (decodedText, decodedResult) => {
          const now = Date.now();
          if (
            lastScanRef.current.value === decodedText &&
            now - lastScanRef.current.timestamp < scanCooldownMs
          ) {
            return;
          }
          lastScanRef.current = { value: decodedText, timestamp: now };
          onScanSuccessRef.current?.(decodedText, decodedResult);
        },
        () => {}
      );

      isRunningRef.current = true;
      setStatus('Point the camera at the attendee QR code.');

      try {
        const track = scanner.getRunningTrack();
        if (track?.getCapabilities) {
          const capabilities = track.getCapabilities();
          setHasTorch(!!capabilities?.torch);
        }
      } catch (err) {
        console.warn('Unable to query torch capabilities', err);
      }
    } catch (error) {
      if (
        error?.name === 'AbortError' ||
        error?.message?.includes('interrupted because the media was removed')
      ) {
        return;
      }
      setStatus(`Switching camera failed: ${error.message || error}`);
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-900 shadow-sm">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            #${elementIdRef.current} video {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
            }
          `,
        }}
      />

      <div className="relative aspect-square w-full bg-black sm:aspect-[4/3]">
        <div id={elementIdRef.current} className="h-full w-full" />

        {/* Scan guide overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-56 w-56 rounded-2xl border-2 border-dashed border-teal-400/60 sm:h-64 sm:w-64">
            {/* Corner accents */}
            <div className="absolute -left-1 -top-1 h-6 w-6 rounded-tl-xl border-l-[3px] border-t-[3px] border-teal-500" />
            <div className="absolute -right-1 -top-1 h-6 w-6 rounded-tr-xl border-r-[3px] border-t-[3px] border-teal-500" />
            <div className="absolute -bottom-1 -left-1 h-6 w-6 rounded-bl-xl border-b-[3px] border-l-[3px] border-teal-500" />
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-br-xl border-b-[3px] border-r-[3px] border-teal-500" />
          </div>
        </div>

        {/* Floating controls */}
        <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between">
          {hasTorch ? (
            <button
              type="button"
              onClick={toggleTorch}
              className={`rounded-xl border border-white/10 p-3 shadow-md backdrop-blur-md transition active:scale-95 ${
                isTorchOn
                  ? 'bg-amber-400/90 text-slate-900'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
              title="Toggle Flashlight"
            >
              <BoltIcon className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-11 w-11" />
          )}

          {cameras.length > 1 && (
            <button
              type="button"
              onClick={switchCamera}
              className="rounded-xl border border-white/10 bg-white/15 p-3 text-white shadow-md backdrop-blur-md transition hover:bg-white/25 active:scale-95"
              title="Switch Camera"
            >
              <ArrowsRightLeftIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 text-center">
        <p className="text-xs font-medium tracking-wide text-slate-400">
          {status}
        </p>
      </div>
    </div>
  );
};

export default QRScannerComponent;