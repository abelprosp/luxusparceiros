'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { Camera, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ICCID_PATTERN = /^89\d{17,20}$/;
const INVALID_ICCID_MESSAGE =
  'Código ignorado. Aponte para o código de barras inferior, cujo número começa com 89.';

export function normalizeIccid(value: string) {
  return value.replace(/\D/g, '').slice(0, 22);
}

export function isValidIccid(value: string) {
  return ICCID_PATTERN.test(normalizeIccid(value));
}

function isMobileDevice() {
  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };

  if (navigatorWithUserAgentData.userAgentData?.mobile) return true;

  return (
    /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Permissão da câmera negada. Libere o acesso nas configurações do navegador e tente novamente.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'Nenhuma câmera foi encontrada neste dispositivo.';
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'A câmera está em uso por outro aplicativo. Feche-o e tente novamente.';
    }
  }

  return 'Não foi possível abrir a câmera. Verifique as permissões e tente novamente.';
}

interface IccidScannerProps {
  value: string;
  onScan: (iccid: string) => void;
}

export function IccidScanner({ value, onScan }: IccidScannerProps) {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const acceptedRef = useRef(false);
  const previousValueRef = useRef(value);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;

    const video = videoRef.current;
    if (video?.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    const valueChanged = value !== previousValueRef.current;
    previousValueRef.current = value;

    if (open && valueChanged) {
      setOpen(false);
    }
  }, [open, value]);

  useEffect(() => {
    // Alguns navegadores móveis ocultam as câmeras antes da permissão.
    // A disponibilidade real será confirmada somente ao abrir o scanner.
    setAvailable(isMobileDevice() && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      setError('');
      setScanning(true);
      acceptedRef.current = false;

      try {
        const { BarcodeFormat, BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 200,
          delayBetweenScanSuccess: 500,
        });
        reader.possibleFormats = [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.CODABAR,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.ITF,
        ];

        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result) => {
            if (cancelled || acceptedRef.current || !result) return;

            const iccid = normalizeIccid(result.getText());
            if (!ICCID_PATTERN.test(iccid)) {
              setError(INVALID_ICCID_MESSAGE);
              return;
            }

            acceptedRef.current = true;
            stopCamera();
            onScan(iccid);
            setOpen(false);
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (scanError) {
        if (!cancelled) {
          setError(cameraErrorMessage(scanError));
          setScanning(false);
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [attempt, onScan, open, stopCamera]);

  if (!available) return null;

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Camera className="mr-2 h-4 w-4" />
        Escanear ICCID
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Aponte para o código de barras inferior do chip</p>
        <Button type="button" variant="ghost" size="icon" aria-label="Fechar scanner" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative overflow-hidden rounded-md bg-black">
        <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
        {scanning && (
          <div className="pointer-events-none absolute inset-x-8 top-1/2 border-t-2 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        )}
      </div>

      {error && scanning && (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{error}</p>
      )}

      {error && !scanning && (
        <Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
