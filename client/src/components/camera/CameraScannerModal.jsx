import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { runOCR } from '../../services/ocrService';
import { useToast } from '../../context/ToastContext';
import {
  Camera,
  Upload,
  RefreshCw,
  Zap,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  CheckCircle,
} from 'lucide-react';

export const CameraScannerModal = ({
  isOpen,
  onClose,
  onOCRComplete,
}) => {
  const toast = useToast();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState({ status: '', progress: 0 });
  const [useUploadFallback, setUseUploadFallback] = useState(false);

  // Start camera stream when modal opens
  useEffect(() => {
    let activeStream = null;

    if (isOpen && !useUploadFallback && !capturedImage) {
      const startCamera = async () => {
        try {
          setCameraError(null);
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment', // Prefer back camera on mobile
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          });
          activeStream = mediaStream;
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        } catch (err) {
          console.warn('Camera access denied or unavailable:', err);
          setCameraError('Camera access denied or unavailable on this device. You can upload an image instead.');
          setUseUploadFallback(true);
        }
      };

      startCamera();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, useUploadFallback, capturedImage]);

  const stopCameraStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    stopCameraStream();
    setCapturedImage(dataUrl);
    processImageWithOCR(dataUrl);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (dataUrl) {
        stopCameraStream();
        setCapturedImage(dataUrl);
        processImageWithOCR(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const processImageWithOCR = async (imageDataUrl) => {
    try {
      setIsProcessing(true);
      const ocrResult = await runOCR(imageDataUrl, (p) => {
        setOcrProgress(p);
      });

      toast.success('Document scanned and information extracted');
      onOCRComplete({
        ...ocrResult,
        capturedImage: imageDataUrl,
      });
      handleClose();
    } catch (err) {
      console.error('OCR Extraction Error:', err);
      toast.error('Unable to read text clearly from the image. Please retake or type manually.');
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setIsProcessing(false);
    setOcrProgress({ status: '', progress: 0 });
    setUseUploadFallback(false);
  };

  const handleClose = () => {
    stopCameraStream();
    setCapturedImage(null);
    setIsProcessing(false);
    setOcrProgress({ status: '', progress: 0 });
    setCameraError(null);
    setUseUploadFallback(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <span>Document Scanner & OCR</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/50">
            <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500" />
            Python Deep Learning OCR
          </span>
        </div>
      }
      subtitle="Position the patient document, wristband, or over duty sheet in the scanning frame"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Viewfinder / Capture Box */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center border border-slate-800 shadow-inner">
          {/* 1. Live Camera View */}
          {!capturedImage && !useUploadFallback && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Document Target Scanning Frame */}
              <div className="absolute inset-8 sm:inset-12 border-2 border-brand-400/80 rounded-lg pointer-events-none z-10 flex flex-col justify-between">
                {/* Corner Markers */}
                <div className="flex justify-between p-1">
                  <div className="w-5 h-5 border-t-4 border-l-4 border-white rounded-tl-sm"></div>
                  <div className="w-5 h-5 border-t-4 border-r-4 border-white rounded-tr-sm"></div>
                </div>
                {/* Laser scan line */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-brand-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-scan-line relative"></div>
                <div className="flex justify-between p-1">
                  <div className="w-5 h-5 border-b-4 border-l-4 border-white rounded-bl-sm"></div>
                  <div className="w-5 h-5 border-b-4 border-r-4 border-white rounded-br-sm"></div>
                </div>
              </div>

              {/* Framing Hint */}
              <div className="absolute bottom-3 left-0 right-0 text-center z-10">
                <span className="bg-slate-900/80 text-white/90 text-xs px-3 py-1 rounded-full backdrop-blur-sm shadow">
                  Align text within frame and hold steady
                </span>
              </div>
            </>
          )}

          {/* 2. Captured Image View */}
          {capturedImage && (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img
                src={capturedImage}
                alt="Captured Document"
                className="max-h-full max-w-full object-contain"
              />

              {/* Processing Overlay */}
              {isProcessing && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-white text-center z-20">
                  <div className="relative mb-3">
                    <Loader2 className="w-12 h-12 text-brand-400 animate-spin" />
                    <Zap className="w-5 h-5 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  {ocrProgress.engine && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      {ocrProgress.engine}
                    </span>
                  )}
                  <p className="font-semibold text-sm sm:text-base max-w-sm">{ocrProgress.status || 'Processing image...'}</p>
                  <div className="w-64 max-w-full bg-slate-800 rounded-full h-2 mt-4 overflow-hidden border border-slate-700">
                    <div
                      className="bg-gradient-to-r from-brand-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${Math.round(ocrProgress.progress * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2 font-mono">
                    {Math.round(ocrProgress.progress * 100)}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 3. File Upload Fallback */}
          {!capturedImage && useUploadFallback && (
            <div className="p-8 text-center flex flex-col items-center justify-center w-full h-full bg-slate-900 text-white">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center mb-3 text-brand-400">
                <Upload className="w-7 h-7" />
              </div>
              <h4 className="font-semibold text-sm sm:text-base">Upload Document Image</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Select a high-resolution photo of the patient record or token for OCR extraction
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                Browse Files
              </button>
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Camera Error / Warning */}
        {cameraError && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>{cameraError}</p>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Fallback switch button */}
          {!capturedImage && (
            <button
              type="button"
              onClick={() => setUseUploadFallback(!useUploadFallback)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors py-1.5 px-2 rounded-lg hover:bg-slate-100"
            >
              {useUploadFallback ? (
                <>
                  <Camera className="w-4 h-4 text-brand-600" />
                  Use Live Camera
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-brand-600" />
                  Upload Image File
                </>
              )}
            </button>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-2 ml-auto">
            {capturedImage && !isProcessing && (
              <button
                type="button"
                onClick={handleRetake}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retake
              </button>
            )}

            {!capturedImage && !useUploadFallback && (
              <button
                type="button"
                onClick={handleCapture}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-md shadow-brand-600/30 transition-all active:scale-95"
              >
                <Camera className="w-4 h-4" />
                Capture Document
              </button>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
