import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, ImageUp, RefreshCcw } from "lucide-react";
import { toast } from "react-toastify";

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const dataUrlToBlob = async (dataUrl) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const DeliveryProofCapture = ({ value, onChange, disabled = false }) => {
  const videoRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImageDataUrl, setCapturedImageDataUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState(value || "");

  const canUpload = useMemo(
    () => Boolean(cloudName && uploadPreset && capturedImageDataUrl && !uploading),
    [capturedImageDataUrl, uploading],
  );

  const stopCamera = () => {
    if (!mediaStreamRef.current) return;

    mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setCameraReady(false);
  };

  const startCamera = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      toast.error("Camera is not supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      toast.error("Unable to access camera");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImageDataUrl(dataUrl);
    stopCamera();
  };

  const uploadPhoto = async () => {
    if (!canUpload) return;

    if (!cloudName || !uploadPreset) {
      toast.error("Cloudinary config is missing");
      return;
    }

    try {
      setUploading(true);
      const imageBlob = await dataUrlToBlob(capturedImageDataUrl);
      const formData = new FormData();
      formData.append("file", imageBlob, `proof-${Date.now()}.jpg`);
      formData.append("upload_preset", uploadPreset);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const payload = await response.json();
      const secureUrl = String(payload?.secure_url || "").trim();
      if (!secureUrl) {
        throw new Error("Upload URL missing");
      }

      setUploadedUrl(secureUrl);
      if (typeof onChange === "function") {
        onChange(secureUrl);
      }
      toast.success("Proof photo uploaded");
    } catch {
      toast.error("Unable to upload proof photo");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (value && value !== uploadedUrl) {
      setUploadedUrl(value);
    }
  }, [uploadedUrl, value]);

  useEffect(
    () => () => {
      stopCamera();
    },
    [],
  );

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">Proof Photo</p>
        {uploadedUrl ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 size={12} />
            Uploaded
          </span>
        ) : null}
      </div>

      {capturedImageDataUrl ? (
        <img
          src={capturedImageDataUrl}
          alt="Delivery proof preview"
          className="h-40 w-full rounded-lg object-cover"
        />
      ) : (
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-40 w-full rounded-lg bg-slate-200 object-cover"
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        {!capturedImageDataUrl ? (
          <>
            <button
              type="button"
              onClick={startCamera}
              disabled={disabled || cameraReady}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Camera size={14} />
              {cameraReady ? "Camera Ready" : "Open Camera"}
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              disabled={disabled || !cameraReady}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Camera size={14} />
              Capture
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setCapturedImageDataUrl("");
                setUploadedUrl("");
                if (typeof onChange === "function") {
                  onChange("");
                }
              }}
              disabled={disabled || uploading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw size={14} />
              Retake
            </button>
            <button
              type="button"
              onClick={uploadPhoto}
              disabled={disabled || !canUpload}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ImageUp size={14} />
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </>
        )}
      </div>

      {!cloudName || !uploadPreset ? (
        <p className="text-xs text-amber-700">
          Missing `VITE_CLOUDINARY_CLOUD_NAME` or `VITE_CLOUDINARY_UPLOAD_PRESET`.
        </p>
      ) : null}
    </div>
  );
};

export default DeliveryProofCapture;
