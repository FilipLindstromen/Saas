"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

type PhotoCaptureTriggerProps = {
  onFile: (file: File) => void | Promise<void>;
  /** e.g. bottom bar vs next to FAB */
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
};

export function PhotoCaptureTrigger({
  onFile,
  className = "",
  buttonClassName = "",
  disabled = false,
}: PhotoCaptureTriggerProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setWebcamOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      setMenuOpen(false);
      if (f) await Promise.resolve(onFile(f));
    },
    [onFile]
  );

  const openWebcam = useCallback(async () => {
    setMenuOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setWebcamOpen(true);
      requestAnimationFrame(() => {
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          void v.play().catch(() => {});
        }
      });
    } catch {
      stopWebcam();
    }
  }, [stopWebcam]);

  const captureFromWebcam = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    stopWebcam();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (blob) {
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      await Promise.resolve(onFile(file));
    }
  }, [onFile, stopWebcam]);

  return (
    <>
      <div ref={wrapRef} className={`bd-photo-capture-wrap ${className}`.trim()} style={{ position: "relative" }}>
        <button
          type="button"
          className={`bd-bottom-camera-btn ${buttonClassName}`.trim()}
          disabled={disabled}
          onClick={() => setMenuOpen((o) => !o)}
          title={t("bottom.photoDump")}
          aria-label={t("bottom.photoDump")}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </button>
        {menuOpen && (
          <div className="bd-photo-capture-menu" role="menu" aria-label={t("bottom.photoCaptureMenuAria")}>
            <button type="button" role="menuitem" className="bd-photo-capture-menu-item" onClick={() => cameraInputRef.current?.click()}>
              {t("bottom.photoFromCamera")}
            </button>
            <button type="button" role="menuitem" className="bd-photo-capture-menu-item" onClick={() => filePickerRef.current?.click()}>
              {t("bottom.photoFromLibrary")}
            </button>
            <button type="button" role="menuitem" className="bd-photo-capture-menu-item" onClick={() => void openWebcam()}>
              {t("bottom.photoWebcam")}
            </button>
          </div>
        )}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="bd-photo-input-hidden"
          onChange={handleFileChange}
          aria-hidden
        />
        <input
          ref={filePickerRef}
          type="file"
          accept="image/*"
          className="bd-photo-input-hidden"
          onChange={handleFileChange}
          aria-hidden
        />
      </div>

      {webcamOpen && (
        <div className="bd-modal-backdrop" style={{ zIndex: 1200 }} role="presentation" onClick={stopWebcam}>
          <div
            className="bd-panel bd-modal-panel"
            style={{ width: "min(100%, 420px)", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{t("center.webcamCapture")}</h3>
            <video ref={videoRef} autoPlay playsInline muted className="bd-webcam-preview" style={{ width: "100%", borderRadius: "var(--card-radius)", background: "#000" }} />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="bd-btn" onClick={stopWebcam}>
                {t("center.webcamCancel")}
              </button>
              <button type="button" className="bd-btn bd-btn-primary" onClick={() => void captureFromWebcam()}>
                {t("center.webcamCapturePhoto")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
