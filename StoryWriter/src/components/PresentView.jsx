import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getSettings } from '../utils/settings';
import './PresentView.css';

const FONT_SIZE_MAP = {
  small: 'clamp(1.2rem, 3vw, 2rem)',
  medium: 'clamp(1.5rem, 4vw, 2.75rem)',
  large: 'clamp(1.8rem, 5vw, 3.5rem)',
};

function loadGoogleFont(family) {
  if (!family) return;
  const id = 'presentation-google-font';
  let link = document.getElementById(id);
  const encoded = encodeURIComponent(family).replace(/%20/g, '+');
  const href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@700&display=swap`;
  if (link) {
    link.href = href;
    return;
  }
  link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/** Split text into sentences (by . ! ? followed by space or end). */
function getSentences(text) {
  if (!text || !String(text).trim()) return [];
  const trimmed = String(text).trim();
  return trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function PresentView({ sectionOrder, sectionsData, onExit, initialIndex = 0 }) {
  const settings = getSettings();
  const fontFamily = `'${settings.presentationFont || 'Poppins'}', sans-serif`;
  const fontSize = FONT_SIZE_MAP[settings.presentationFontSize] ?? FONT_SIZE_MAP.medium;
  const lineHeight = ['1.2', '1.3', '1.4', '1.5', '1.6', '1.8', '2'].includes(settings.presentationLineHeight)
    ? settings.presentationLineHeight
    : '1.4';
  const bgOpacity = typeof settings.presentationBackgroundOpacity === 'number'
    ? settings.presentationBackgroundOpacity
    : 0.35;
  const bgAnimation = Boolean(settings.presentationBackgroundAnimation);
  const bgAnimationDuration = Math.min(30, Math.max(1, Number(settings.presentationBackgroundAnimationDuration) || 10));
  const bgAnimationScale = Math.min(1.5, Math.max(1, Number(settings.presentationBackgroundAnimationScale) || 1.15));
  const textAnimation = ['slide-up', 'fade', 'slide-left', 'slide-right', 'scale', 'none'].includes(settings.presentationTextAnimation)
    ? settings.presentationTextAnimation
    : 'slide-up';

  useEffect(() => {
    loadGoogleFont(settings.presentationFont || 'Poppins');
  }, [settings.presentationFont]);

  const sentencesWithSection = useMemo(() => {
    const out = [];
    for (const sectionId of sectionOrder) {
      const content = sectionsData[sectionId]?.content ?? '';
      const text = String(content).trim().replace(/\n+/g, ' ');
      const list = getSentences(text);
      list.forEach((s, sentenceIndexInSection) => {
        out.push({ text: s, sectionId, sentenceIndexInSection });
      });
    }
    return out;
  }, [sectionOrder, sectionsData]);

  const sentences = useMemo(() => sentencesWithSection.map((x) => x.text), [sentencesWithSection]);

  const safeStartIndex = useMemo(() => {
    const max = sentences.length - 1;
    if (max < 0) return 0;
    return Math.min(Math.max(0, initialIndex), max);
  }, [sentences.length, initialIndex]);

  const [currentIndex, setCurrentIndex] = useState(safeStartIndex);

  useEffect(() => {
    const max = Math.max(0, sentences.length - 1);
    setCurrentIndex((i) => (sentences.length === 0 ? 0 : Math.min(i, max)));
  }, [sentences.length]);

  const [displayBgUrl, setDisplayBgUrl] = useState('');
  const [bgLayerOpacity, setBgLayerOpacity] = useState(0);
  const fadeRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [webcamError, setWebcamError] = useState(null);
  const [webcamActive, setWebcamActive] = useState(false);

  const webcamEnabled = Boolean(settings.presentationWebcamEnabled);
  const webcamSize = ['small', 'medium', 'large'].includes(settings.presentationWebcamSize) ? settings.presentationWebcamSize : 'medium';
  const recordScreenEnabled = Boolean(settings.presentationRecordScreen);
  const cameraId = settings.presentationCameraId?.trim() || '';
  const microphoneId = settings.presentationMicrophoneId?.trim() || '';

  const screenStreamRef = useRef(null);
  const screenRecorderRef = useRef(null);
  const screenChunksRef = useRef([]);
  const screenCaptureInFlightRef = useRef(false);
  const [screenRecordError, setScreenRecordError] = useState(null);

  const displayIndex = sentences.length === 0 ? 0 : Math.min(currentIndex, Math.max(0, sentences.length - 1));
  const currentItem = sentencesWithSection[displayIndex];
  const currentSectionId = currentItem?.sectionId;
  const sentenceIndexInSection = currentItem?.sentenceIndexInSection ?? 0;
  const sectionData = currentSectionId ? sectionsData[currentSectionId] : null;
  const sentenceImages = sectionData?.sentenceImages;
  const sentenceImageUrl = Array.isArray(sentenceImages) ? (sentenceImages[sentenceIndexInSection] || '') : '';
  const currentSectionBgUrl = sentenceImageUrl || (sectionData?.backgroundImageUrl || '');

  useEffect(() => {
    if (currentSectionBgUrl === displayBgUrl) return;
    const targetUrl = currentSectionBgUrl;
    if (displayBgUrl) {
      setBgLayerOpacity(0);
      const t = setTimeout(() => {
        setDisplayBgUrl(targetUrl);
        setBgLayerOpacity(targetUrl ? bgOpacity : 0);
        fadeRef.current = null;
      }, 400);
      fadeRef.current = t;
      return () => clearTimeout(t);
    }
    setDisplayBgUrl(targetUrl);
    setBgLayerOpacity(targetUrl ? bgOpacity : 0);
  }, [currentSectionBgUrl, displayBgUrl, bgOpacity]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, sentences.length - 1));
  }, [sentences.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        onExit?.();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goNext();
      }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, onExit]);

  useEffect(() => {
    document.documentElement.requestFullscreen().catch(() => {});
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Webcam overlay + optional webcam-only recording (when screen recording is off)
  useEffect(() => {
    if (!webcamEnabled || !navigator.mediaDevices?.getUserMedia) return;
    setWebcamError(null);
    const videoConstraints = cameraId ? { deviceId: { exact: cameraId } } : true;
    const audioConstraints = recordScreenEnabled ? false : (microphoneId ? { deviceId: { exact: microphoneId } } : true);
    navigator.mediaDevices
      .getUserMedia({ video: videoConstraints, audio: audioConstraints })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setWebcamActive(true);
        if (!recordScreenEnabled) {
          try {
            const recorder = new MediaRecorder(stream, {
              mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm',
              videoBitsPerSecond: 2500000,
              audioBitsPerSecond: 128000,
            });
            chunksRef.current = [];
            recorder.ondataavailable = (e) => {
              if (e.data.size) chunksRef.current.push(e.data);
            };
            recorder.start(1000);
            recorderRef.current = recorder;
          } catch (err) {
            console.warn('MediaRecorder failed:', err);
          }
        }
      })
      .catch((err) => {
        setWebcamError(err.message || 'Camera/microphone access failed');
      });
    return () => {
      if (!recordScreenEnabled) {
        const rec = recorderRef.current;
        const streamToStop = streamRef.current;
        if (rec && rec.state !== 'inactive') {
          try {
            rec.requestData();
          } catch (_) {}
          rec.stop();
          rec.onstop = () => {
            requestAnimationFrame(() => {
              if (chunksRef.current.length && rec.mimeType) {
                const blob = new Blob(chunksRef.current, { type: rec.mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `presentation-recording-${Date.now()}.webm`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 5000);
              }
              if (streamToStop) streamToStop.getTracks().forEach((t) => t.stop());
              streamRef.current = null;
            });
          };
        } else {
          const s = streamRef.current;
          if (s) {
            s.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
        }
      } else {
        const s = streamRef.current;
        if (s) {
          s.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      }
      setWebcamActive(false);
    };
  }, [webcamEnabled, recordScreenEnabled, cameraId, microphoneId]);

  // Screen + microphone recording when "Record screen and audio" is on
  useEffect(() => {
    if (!recordScreenEnabled || !navigator.mediaDevices?.getDisplayMedia) return;
    if (screenCaptureInFlightRef.current) return;
    screenCaptureInFlightRef.current = true;
    setScreenRecordError(null);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    navigator.mediaDevices
      .getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      })
      .then((screen) => {
        const audioConstraints = microphoneId ? { deviceId: { exact: microphoneId } } : true;
        return navigator.mediaDevices.getUserMedia({ audio: audioConstraints }).then((mic) => {
          const combined = new MediaStream([...screen.getVideoTracks(), ...mic.getAudioTracks()]);
          screenStreamRef.current = combined;
          const recorder = new MediaRecorder(combined, {
            mimeType,
            videoBitsPerSecond: 2500000,
            audioBitsPerSecond: 128000,
          });
          screenChunksRef.current = [];
          recorder.ondataavailable = (e) => {
            if (e.data.size) screenChunksRef.current.push(e.data);
          };
          recorder.start(1000);
          screenRecorderRef.current = recorder;
          screenCaptureInFlightRef.current = false;
        });
      })
      .catch((err) => {
        setScreenRecordError(err.message || 'Screen or microphone access failed');
        screenCaptureInFlightRef.current = false;
      });
    return () => {
      const rec = screenRecorderRef.current;
      const streamToStop = screenStreamRef.current;
      if (rec && rec.state !== 'inactive') {
        try {
          rec.requestData();
        } catch (_) {}
        rec.stop();
        rec.onstop = () => {
          requestAnimationFrame(() => {
            if (screenChunksRef.current.length && rec.mimeType) {
              const blob = new Blob(screenChunksRef.current, { type: rec.mimeType });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `presentation-screen-recording-${Date.now()}.webm`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 5000);
            }
            if (streamToStop) streamToStop.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
            screenRecorderRef.current = null;
          });
        };
      } else {
        if (streamToStop) streamToStop.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        screenRecorderRef.current = null;
      }
    };
  }, [recordScreenEnabled, microphoneId]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [webcamActive]);

  if (sentences.length === 0) {
    return (
      <div className="present-view present-view--fullscreen" style={{ fontFamily }}>
        <div className="present-view__inner">
          <p className="present-view__empty">No content yet. Write or edit your story first.</p>
          <p className="present-view__hint">Press Esc to go back.</p>
        </div>
      </div>
    );
  }

  const sentence = sentences[displayIndex];

  return (
    <div className="present-view present-view--fullscreen" style={{ fontFamily }}>
      {displayBgUrl && (
        <div
          className={`present-view__bg${bgAnimation ? ' present-view__bg--animated' : ''}`}
          style={{
            backgroundImage: `url(${displayBgUrl})`,
            opacity: bgLayerOpacity,
            ...(bgAnimation ? {
              ['--present-bg-duration']: `${bgAnimationDuration}s`,
              ['--present-bg-scale-max']: `${bgAnimationScale * 100}%`,
            } : {}),
          }}
          aria-hidden="true"
        />
      )}
      <div className="present-view__inner">
        <div
          key={displayIndex}
          className={`present-view__sentence present-view__sentence--${textAnimation}`}
          style={{ fontSize, lineHeight }}
        >
          {sentence}
        </div>
      </div>
      {recordScreenEnabled && (
        <div className="present-view__recording-badge">
          {screenRecordError ? (
            <span className="present-view__recording-error" title={screenRecordError}>Recording failed</span>
          ) : (
            <>
              <span className="present-view__recording-dot" aria-hidden="true" />
              <span>Recording</span>
            </>
          )}
        </div>
      )}
      {webcamEnabled && (
        <div className={`present-view__webcam-wrap present-view__webcam-wrap--${webcamSize}`}>
          {webcamError ? (
            <div className="present-view__webcam-error">{webcamError}</div>
          ) : (
            <video
              ref={videoRef}
              className="present-view__webcam"
              autoPlay
              playsInline
              muted
              aria-label="Webcam"
            />
          )}
        </div>
      )}
    </div>
  );
}
