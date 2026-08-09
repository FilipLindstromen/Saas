import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getSettings } from '../utils/settings';
import {
  normalizePresentationAnimationRules,
  resolveAnimationForSentence,
  getEnterDurationMs,
  getExitDurationMs,
  getExitAnimation,
} from '../utils/textAnimations';
import { buildPresentSceneList } from '../utils/sentences';
import { isVideoBackgroundUrl } from '../utils/stockMediaSource';
import { buildLineRevealRowsSimple } from '../utils/lineReveal';
import {
  stripPresentImagePlaceholderLines,
  processPresentRevealRows,
  isPresentImageOnlyScene,
  sceneUsesPresentImagePlaceholder,
} from '../utils/presentImagePlaceholder';
import PresentSentence from './PresentSentence';
import PresentRotateLines from './PresentRotateLines';
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


function backgroundUrlForSceneItem(item, sectionsData) {
  if (!item) return '';
  const fromScene = item.imageUrl && String(item.imageUrl).trim();
  if (fromScene) return fromScene;
  const sectionData = item.sectionId ? sectionsData[item.sectionId] : null;
  return sectionData?.backgroundImageUrl || '';
}

function samePresentBackground(urlA, urlB) {
  const a = String(urlA ?? '').trim();
  const b = String(urlB ?? '').trim();
  return a.length > 0 && a === b;
}

export default function PresentView({ sectionOrder, sectionsData, onExit, onPresentIndexChange, initialIndex = 0, animationRules, settingsVersion = 0 }) {
  const settings = getSettings();
  const fontFamily = `'${settings.presentationFont || 'Poppins'}', sans-serif`;
  const baseFontSize = FONT_SIZE_MAP[settings.presentationFontSize] ?? FONT_SIZE_MAP.medium;
  const fontSizePercent = typeof settings.presentationFontSizePercent === 'number'
    ? settings.presentationFontSizePercent
    : 100;
  const fontSize = fontSizePercent === 100 ? baseFontSize : `calc((${baseFontSize}) * ${fontSizePercent / 100})`;
  const textWidthPercent = typeof settings.presentationTextWidthPercent === 'number'
    ? settings.presentationTextWidthPercent
    : 90;
  const aspectRatio = ['16:9', '1:1', '9:16'].includes(settings.presentationAspectRatio)
    ? settings.presentationAspectRatio
    : 'full';
  const lineHeight = ['1.2', '1.3', '1.4', '1.5', '1.6', '1.8', '2'].includes(settings.presentationLineHeight)
    ? settings.presentationLineHeight
    : '1.4';
  const bgOpacity = typeof settings.presentationBackgroundOpacity === 'number'
    ? settings.presentationBackgroundOpacity
    : 0.35;
  const bgAnimation = Boolean(settings.presentationBackgroundAnimation);
  const bgAnimationDuration = Math.min(30, Math.max(1, Number(settings.presentationBackgroundAnimationDuration) || 10));
  const bgAnimationScale = Math.min(1.5, Math.max(1, Number(settings.presentationBackgroundAnimationScale) || 1.15));
  const rules = useMemo(
    () => normalizePresentationAnimationRules(animationRules),
    [animationRules, settingsVersion]
  );

  useEffect(() => {
    loadGoogleFont(settings.presentationFont || 'Poppins');
  }, [settings.presentationFont]);

  const sentencesWithSection = useMemo(
    () => buildPresentSceneList(sectionOrder, sectionsData),
    [sectionOrder, sectionsData]
  );

  const sentences = useMemo(() => sentencesWithSection.map((x) => x.text), [sentencesWithSection]);

  const safeStartIndex = useMemo(() => {
    const max = sentences.length - 1;
    if (max < 0) return 0;
    return Math.min(Math.max(0, initialIndex), max);
  }, [sentences.length, initialIndex]);

  const [currentIndex, setCurrentIndex] = useState(safeStartIndex);
  const [revealStep, setRevealStep] = useState(0);
  const [rotateAnimKey, setRotateAnimKey] = useState(0);
  const [sentencePhase, setSentencePhase] = useState('enter');
  const [displayBgUrl, setDisplayBgUrl] = useState('');
  const [bgLayerOpacity, setBgLayerOpacity] = useState(0);
  const [webcamError, setWebcamError] = useState(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [screenRecordError, setScreenRecordError] = useState(null);
  const transitionLockRef = useRef(false);
  const transitionTimersRef = useRef([]);
  const videoRef = useRef(null);

  const clearTransitionTimers = useCallback(() => {
    transitionTimersRef.current.forEach((id) => clearTimeout(id));
    transitionTimersRef.current = [];
  }, []);

  const queueTransitionTimer = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    transitionTimersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => () => clearTransitionTimers(), [clearTransitionTimers]);

  useEffect(() => {
    const max = Math.max(0, sentences.length - 1);
    setCurrentIndex((i) => (sentences.length === 0 ? 0 : Math.min(i, max)));
  }, [sentences.length]);

  useEffect(() => {
    if (sentences.length === 0) return;
    setSentencePhase('enter');
    clearTransitionTimers();
    transitionLockRef.current = false;
    const sentence = sentences[safeStartIndex] ?? '';
    const animation = resolveAnimationForSentence(sentence, rules);
    const enterMs = getEnterDurationMs(sentence, animation, rules);
    queueTransitionTimer(() => setSentencePhase('idle'), enterMs || 0);
    setCurrentIndex(safeStartIndex);
    setRevealStep(0);
    setRotateAnimKey((k) => k + 1);
  }, [safeStartIndex, sentences, settingsVersion, rules, clearTransitionTimers, queueTransitionTimer]);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const screenStreamRef = useRef(null);
  const screenRecorderRef = useRef(null);
  const screenChunksRef = useRef([]);
  const screenCaptureInFlightRef = useRef(false);

  const webcamEnabled = Boolean(settings.presentationWebcamEnabled);
  const webcamSize = ['small', 'medium', 'large'].includes(settings.presentationWebcamSize) ? settings.presentationWebcamSize : 'medium';
  const recordScreenEnabled = Boolean(settings.presentationRecordScreen);
  const cameraId = settings.presentationCameraId?.trim() || '';
  const microphoneId = settings.presentationMicrophoneId?.trim() || '';

  const displayIndex = sentences.length === 0 ? 0 : Math.min(currentIndex, Math.max(0, sentences.length - 1));

  const currentItem = sentencesWithSection[displayIndex];
  const currentAnimation = useMemo(() => {
    const sentence = sentences[displayIndex] ?? '';
    return resolveAnimationForSentence(sentence, rules);
  }, [sentences, displayIndex, rules]);
  const displayBgIsVideo = isVideoBackgroundUrl(displayBgUrl);
  const sceneLayout = currentItem?.layout ?? 'center';
  const hasDarkTextPresent = Boolean(currentItem?.darkText);

  const sentence = sentences[displayIndex] ?? '';
  const displaySentence = useMemo(() => stripPresentImagePlaceholderLines(sentence), [sentence]);
  const styledParts = currentItem?.styledParts;
  const rotateSpans = currentItem?.rotateSpans ?? [];
  const bulletSpans = currentItem?.bulletSpans ?? [];
  const useLineRevealPresent =
    rotateSpans.length > 0 || bulletSpans.length > 0;
  const lineRevealRowsRaw = useMemo(
    () =>
      useLineRevealPresent
        ? buildLineRevealRowsSimple(sentence, rotateSpans, bulletSpans, revealStep)
        : null,
    [useLineRevealPresent, sentence, rotateSpans, bulletSpans, revealStep]
  );
  const { rows: lineRevealRows, stepImageOnly } = useMemo(
    () => processPresentRevealRows(lineRevealRowsRaw),
    [lineRevealRowsRaw]
  );
  const sceneImageOnly = isPresentImageOnlyScene(sentence, { rows: lineRevealRows });
  const usesImagePlaceholder = sceneUsesPresentImagePlaceholder(sentence);
  const imageOnlyPresent =
    Boolean(String(displayBgUrl ?? '').trim()) && (sceneImageOnly || stepImageOnly);
  const effectiveBgOpacity = useMemo(() => {
    const hasBg = Boolean(String(displayBgUrl ?? '').trim());
    if (!hasBg) return 0;
    if (usesImagePlaceholder) {
      return imageOnlyPresent ? 1 : 0;
    }
    return imageOnlyPresent ? 1 : bgOpacity;
  }, [displayBgUrl, usesImagePlaceholder, imageOnlyPresent, bgOpacity]);
  const showLineRevealPresent = useLineRevealPresent && (lineRevealRows?.length ?? 0) > 0;
  const hasBulletPresent = bulletSpans.length > 0;
  const hasRotatePresent = rotateSpans.length > 0;

  useEffect(() => {
    onPresentIndexChange?.(displayIndex);
  }, [displayIndex, onPresentIndexChange]);

  useEffect(() => {
    const item = sentencesWithSection[displayIndex];
    const url = backgroundUrlForSceneItem(item, sectionsData);
    setDisplayBgUrl((prev) => (samePresentBackground(prev, url) ? prev : url));
  }, [displayIndex, sentencesWithSection, sectionsData]);

  useEffect(() => {
    const trimmed = String(displayBgUrl ?? '').trim();
    setBgLayerOpacity(trimmed ? effectiveBgOpacity : 0);
  }, [displayBgUrl, effectiveBgOpacity]);

  const navigateTo = useCallback(
    (newIndex, initialRevealStep = 0) => {
      if (transitionLockRef.current) return;
      if (newIndex < 0 || newIndex >= sentences.length) return;
      if (newIndex === currentIndex && initialRevealStep === revealStep) return;

      transitionLockRef.current = true;
      clearTransitionTimers();

      const leavingItem = sentencesWithSection[currentIndex];
      const currentBgUrl = backgroundUrlForSceneItem(leavingItem, sectionsData);
      const newItem = sentencesWithSection[newIndex];
      const newBgUrl = backgroundUrlForSceneItem(newItem, sectionsData);
      const persistBackground = samePresentBackground(currentBgUrl, newBgUrl);

      const leavingSentence = sentences[currentIndex] ?? '';
      const leavingAnimation = resolveAnimationForSentence(leavingSentence, rules);
      const exitAnimation = getExitAnimation(leavingAnimation);
      const exitMs = getExitDurationMs(exitAnimation, leavingSentence, rules);

      if (!persistBackground) {
        setBgLayerOpacity(0);
      }
      setSentencePhase('exit');

      queueTransitionTimer(() => {
        setCurrentIndex(newIndex);
        setRevealStep(initialRevealStep);
        setRotateAnimKey((k) => k + 1);
        if (!persistBackground) {
          setDisplayBgUrl(newBgUrl);
          requestAnimationFrame(() => setBgLayerOpacity(newBgUrl ? bgOpacity : 0));
        }
        setSentencePhase('enter');

        const enteringSentence = sentences[newIndex] ?? '';
        const enterAnimation = resolveAnimationForSentence(enteringSentence, rules);
        const enterMs = getEnterDurationMs(enteringSentence, enterAnimation, rules);

        queueTransitionTimer(() => {
          setSentencePhase('idle');
          transitionLockRef.current = false;
        }, enterMs || 0);
      }, exitMs || 0);
    },
    [currentIndex, revealStep, sentences, sentencesWithSection, sectionsData, rules, bgOpacity, clearTransitionTimers, queueTransitionTimer]
  );

  const goNext = useCallback(() => {
    const item = sentencesWithSection[currentIndex];
    const steps = item?.lineRevealStepCount ?? item?.rotateStepCount ?? 1;
    const hasLineReveal =
      (item?.rotateSpans?.length ?? 0) > 0 || (item?.bulletSpans?.length ?? 0) > 0;
    if (hasLineReveal && revealStep < steps - 1) {
      setRevealStep((s) => s + 1);
      setRotateAnimKey((k) => k + 1);
      return;
    }
    navigateTo(Math.min(currentIndex + 1, sentences.length - 1), 0);
  }, [navigateTo, currentIndex, sentences.length, sentencesWithSection, revealStep]);

  const goPrev = useCallback(() => {
    if (revealStep > 0) {
      setRevealStep((s) => s - 1);
      setRotateAnimKey((k) => k + 1);
      return;
    }
    const prevIndex = currentIndex - 1;
    if (prevIndex < 0) return;
    const prevItem = sentencesWithSection[prevIndex];
    const prevSteps = prevItem?.lineRevealStepCount ?? prevItem?.rotateStepCount ?? 1;
    const hasLineReveal =
      (prevItem?.rotateSpans?.length ?? 0) > 0 || (prevItem?.bulletSpans?.length ?? 0) > 0;
    navigateTo(prevIndex, hasLineReveal ? Math.max(0, prevSteps - 1) : 0);
  }, [navigateTo, currentIndex, revealStep, sentencesWithSection]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        onExit?.(displayIndex);
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
  }, [goNext, goPrev, onExit, displayIndex]);

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

  const aspectRatioParts = aspectRatio === '16:9' ? [16, 9] : aspectRatio === '1:1' ? [1, 1] : aspectRatio === '9:16' ? [9, 16] : null;
  const bgFit = aspectRatio === 'full' ? 'cover' : 'contain';

  return (
    <div
      className={[
        'present-view present-view--fullscreen present-view--advance-on-click',
        imageOnlyPresent && 'present-view--image-only',
        aspectRatio !== 'full' && 'present-view--letterboxed',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ fontFamily, ['--present-text-width']: `${textWidthPercent}vw` }}
      onClick={goNext}
      role="presentation"
    >
      <div
        className="present-view__frame"
        style={aspectRatioParts ? {
          aspectRatio: `${aspectRatioParts[0]} / ${aspectRatioParts[1]}`,
          ['--present-ratio-w']: aspectRatioParts[0],
          ['--present-ratio-h']: aspectRatioParts[1],
        } : undefined}
      >
      <div className="present-view__capture">
      {displayBgUrl && !displayBgIsVideo && (
        <div
          className={`present-view__bg${bgAnimation ? ' present-view__bg--animated' : ''}`}
          style={{
            backgroundImage: `url(${displayBgUrl})`,
            backgroundSize: bgAnimation ? undefined : bgFit,
            opacity: bgLayerOpacity,
            ...(bgAnimation ? {
              ['--present-bg-duration']: `${bgAnimationDuration}s`,
              ['--present-bg-scale-max']: `${bgAnimationScale * 100}%`,
            } : {}),
          }}
          aria-hidden="true"
        />
      )}
      {displayBgUrl && displayBgIsVideo && (
        <video
          className={`present-view__bg present-view__bg-video${bgAnimation ? ' present-view__bg--animated' : ''}`}
          src={displayBgUrl}
          autoPlay
          muted
          loop
          playsInline
          style={{
            objectFit: bgFit,
            opacity: bgLayerOpacity,
            ...(bgAnimation ? {
              ['--present-bg-duration']: `${bgAnimationDuration}s`,
              ['--present-bg-scale-max']: `${bgAnimationScale * 100}%`,
            } : {}),
          }}
          aria-hidden="true"
        />
      )}
      <div
        className={[
          'present-view__inner',
          sceneLayout === 'left' && 'present-view__inner--layout-left',
          hasBulletPresent && 'present-view__inner--bullets',
            hasRotatePresent && 'present-view__inner--text-rotate',
            hasDarkTextPresent && 'present-view__inner--dark-text',
          ]
            .filter(Boolean)
            .join(' ')}
      >
        <div
          className={[
            'present-view__sentence-stage',
            hasBulletPresent && 'present-view__sentence-stage--bullets',
            hasRotatePresent && 'present-view__sentence-stage--text-rotate',
            sceneLayout === 'left' && 'present-view__sentence-stage--layout-left',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {showLineRevealPresent ? (
            <PresentRotateLines
              rows={lineRevealRows}
              styledParts={styledParts}
              fontSize={fontSize}
              lineHeight={lineHeight}
              animKey={rotateAnimKey}
              phase={sentencePhase}
              animation={currentAnimation}
              rules={rules}
            />
          ) : displaySentence.trim() ? (
            <PresentSentence
              text={displaySentence}
              styledParts={styledParts}
              animation={currentAnimation}
              phase={sentencePhase}
              rules={rules}
              style={{ fontSize, lineHeight }}
            />
          ) : null}
        </div>
      </div>
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
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}
