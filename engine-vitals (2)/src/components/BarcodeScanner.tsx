import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, AlertCircle, Flashlight } from 'lucide-react';
import { toast } from 'sonner';

interface BarcodeScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onResult, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode("reader", {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.DATA_MATRIX
      ]
    });
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 300, height: 150 },
        aspectRatio: 1.0
      },
      (decodedText) => {
        onResult(decodedText);
        scanner.stop().catch(console.error);
      },
      (errorMessage) => {
        // parse errors are frequent, ignore them
      }
    ).catch((err) => {
      let errorMessage = "Could not start camera. Please ensure you have granted camera permissions.";
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied') || err?.message?.includes('NotAllowedError')) {
        errorMessage = "Camera access was denied. Please check your browser settings to grant camera permissions, then try again.";
      } else if (err?.name === 'NotFoundError' || err?.message?.includes('Requested device not found')) {
        errorMessage = "No camera found on your device. Please ensure a camera is connected.";
      } else if (err?.name === 'NotReadableError') {
        errorMessage = "Camera is already in use by another application. Please close other apps using the camera and try again.";
      } else if (err?.message) {
        errorMessage = `Camera error: ${err.message}`;
      }
      setError(errorMessage);
      console.error("Camera start error:", err);
    });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onResult]);

  const toggleTorch = () => {
    if (!scannerRef.current?.isScanning) return;
    const nextState = !torchOn;
    scannerRef.current.applyVideoConstraints({
      advanced: [{ torch: nextState } as any]
    }).then(() => {
      setTorchOn(nextState);
    }).catch((err) => {
      console.error("Failed to toggle torch:", err);
      toast.error('Flashlight is not supported on this device/browser.');
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#141414] border border-[#262626] rounded-2xl p-4 w-full max-w-md relative overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4 z-10 relative">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-white font-bold">Scan VIN Barcode</h3>
              <p className="text-[10px] text-[#A3A3A3] uppercase tracking-wider">Supports Code 39 & Data Matrix</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={toggleTorch}
              title="Toggle Flashlight"
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/50 border border-[#262626] text-white hover:text-primary hover:border-primary/50 transition-all focus:outline-none"
            >
              <Flashlight className="w-4 h-4" />
            </button>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/50 border border-[#262626] text-white hover:bg-black/80 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <p className="text-sm text-[#A3A3A3] mb-4 text-center z-10 relative">
          Align the scanner box with the barcode inside the driver's door jamb or on the dashboard.
        </p>

        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-6 rounded-xl text-sm text-center flex flex-col items-center gap-3">
            <AlertCircle className="w-8 h-8" />
            <p className="font-medium">{error}</p>
            <button 
              onClick={onClose}
              className="mt-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors font-bold uppercase tracking-widest text-[10px]"
            >
              Close Scanner
            </button>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden bg-black aspect-square relative flex-grow flex items-center justify-center">
            <div id="reader" className="w-full h-full absolute inset-0 z-0"></div>
            
            {/* Custom Reticle Overlay */}
            <div className="absolute z-10 pointer-events-none w-[300px] h-[150px] border border-white/20 flex items-center justify-center">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl"></div>
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr"></div>
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl"></div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br"></div>
              
              {/* Scanner Line */}
              <div className="w-full h-[2px] bg-primary/70 animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes scan {
                0% { transform: translateY(-70px); }
                50% { transform: translateY(70px); }
                100% { transform: translateY(-70px); }
              }
              /* Hide default html5-qrcode UI elements that overlap */
              #reader img { display: none; }
            `}} />
          </div>
        )}
      </div>
    </div>
  );
}
