import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@shared/components/Button';
import { InlineAlert } from '@shared/components/InlineAlert';
import './SkuCameraScanner.css';

interface SkuCameraScannerProps {
  disabled?: boolean;
  onSkuDetected: (sku: string) => void;
}

function isBarcodeDetectorSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

export function SkuCameraScanner({ disabled = false, onSkuDetected }: SkuCameraScannerProps) {
  const [isSupported] = useState(isBarcodeDetectorSupported);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const scanFrameRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (scanFrameRef.current != null) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function startCamera() {
    if (!isSupported || disabled) return;

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }

      video.srcObject = stream;
      await video.play();

      detectorRef.current = new BarcodeDetector({ formats: ['ean_13', 'code_128', 'qr_code'] });
      setIsActive(true);

      const scan = async () => {
        if (!detectorRef.current || !videoRef.current || videoRef.current.readyState < 2) {
          scanFrameRef.current = requestAnimationFrame(scan);
          return;
        }

        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          const match = barcodes.find((code) => code.rawValue?.trim());
          if (match?.rawValue) {
            onSkuDetected(match.rawValue.trim());
            stopCamera();
            return;
          }
        } catch {
          // Continue scanning until the user stops the camera.
        }

        scanFrameRef.current = requestAnimationFrame(scan);
      };

      scanFrameRef.current = requestAnimationFrame(scan);
    } catch (cameraError) {
      stopCamera();
      if (cameraError instanceof DOMException && cameraError.name === 'NotAllowedError') {
        setError('הגישה למצלמה נדחתה. ניתן להמשיך בסריקה ידנית או במקלדת.');
      } else {
        setError('לא ניתן להפעיל את המצלמה. ניתן להמשיך בסריקה ידנית או במקלדת.');
      }
    }
  }

  if (!isSupported) {
    return null;
  }

  return (
    <div className="skuCameraScanner">
      <div className="skuCameraScanner__actions">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => (isActive ? stopCamera() : void startCamera())}
        >
          {isActive ? 'עצור מצלמה' : 'סריקה במצלמה'}
        </Button>
      </div>
      {error && <InlineAlert variant="warning">{error}</InlineAlert>}
      {isActive && (
        <video
          ref={videoRef}
          className="skuCameraScanner__video"
          playsInline
          muted
          aria-label="תצוגת מצלמה לסריקת מק״ט"
        />
      )}
    </div>
  );
}
