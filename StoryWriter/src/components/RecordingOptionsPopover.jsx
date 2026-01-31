import { useState, useEffect, useRef } from 'react';
import { getSettings, saveSettings } from '../utils/settings';
import './RecordingOptionsPopover.css';

function useDevices(isOpen) {
  const [cameras, setCameras] = useState([]);
  const [mics, setMics] = useState([]);

  useEffect(() => {
    if (!isOpen || !navigator.mediaDevices?.enumerateDevices) return;
    let cancelled = false;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      if (cancelled) return;
      setCameras(devices.filter((d) => d.kind === 'videoinput'));
      setMics(devices.filter((d) => d.kind === 'audioinput'));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen]);

  return { cameras, mics };
}

export default function RecordingOptionsPopover({ onApply }) {
  const [open, setOpen] = useState(false);
  const [recordScreen, setRecordScreen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [webcamSize, setWebcamSize] = useState('medium');
  const [cameraId, setCameraId] = useState('');
  const [microphoneId, setMicrophoneId] = useState('');
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);

  const { cameras, mics } = useDevices(open);

  useEffect(() => {
    if (open) {
      const s = getSettings();
      setRecordScreen(Boolean(s.presentationRecordScreen));
      setShowCamera(Boolean(s.presentationWebcamEnabled) || Boolean(s.presentationCameraId?.trim()));
      setWebcamSize(['small', 'medium', 'large'].includes(s.presentationWebcamSize) ? s.presentationWebcamSize : 'medium');
      setCameraId(s.presentationCameraId || '');
      setMicrophoneId(s.presentationMicrophoneId || '');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="recording-options-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="app-settings-btn recording-options-btn"
        onClick={() => setOpen((v) => !v)}
        title="Recording options"
        aria-label="Recording options"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div ref={popoverRef} className="recording-options-popover" role="dialog" aria-label="Recording options">
          <div className="recording-options-popover__title">Recording options</div>
          <label className="recording-options-popover__label recording-options-popover__label--checkbox">
            <input
              type="checkbox"
              checked={recordScreen}
              onChange={(e) => {
                const v = e.target.checked;
                setRecordScreen(v);
                persist({ presentationRecordScreen: v });
              }}
            />
            <span>Record screen and audio in Present mode</span>
          </label>
          <label className="recording-options-popover__label recording-options-popover__label--checkbox">
            <input
              type="checkbox"
              checked={showCamera}
              onChange={(e) => {
                const v = e.target.checked;
                setShowCamera(v);
                persist({ presentationWebcamEnabled: v });
              }}
            />
            <span>Show camera in Edit and Present (round, lower right)</span>
          </label>
          <label className="recording-options-popover__label">
            Webcam size
            <select
              className="recording-options-popover__select"
              value={webcamSize}
              onChange={(e) => {
                const v = e.target.value;
                setWebcamSize(v);
                persist({ presentationWebcamSize: v });
              }}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label className="recording-options-popover__label">
            Camera
            <select
              className="recording-options-popover__select"
              value={cameraId}
              onChange={(e) => {
                const v = e.target.value;
                setCameraId(v);
                if (v) setShowCamera(true);
                persist({
                  presentationCameraId: v,
                  ...(v ? { presentationWebcamEnabled: true } : {}),
                });
              }}
            >
              <option value="">Default camera</option>
              {cameras.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </label>
          <label className="recording-options-popover__label">
            Microphone
            <select
              className="recording-options-popover__select"
              value={microphoneId}
              onChange={(e) => {
                const v = e.target.value;
                setMicrophoneId(v);
                persist({ presentationMicrophoneId: v });
              }}
            >
              <option value="">Default microphone</option>
              {mics.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
