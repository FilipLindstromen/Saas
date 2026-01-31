import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { getSettings } from '../utils/settings';
import {
  getSentenceStarts,
  getSentenceSegments,
  contentOffsetToNormalized,
  normalizedOffsetToSentenceIndex,
} from '../utils/sentences';
import { searchUnsplashFirst } from '../services/unsplash';
import UnsplashPicker from './UnsplashPicker';
import './EditView.css';

function EditStep({
  sectionId,
  sectionTitle,
  content,
  sentenceImages = [],
  onContentChange,
  onOpenSentencePicker,
  onSentenceImageChange,
  onSentencePositionChange,
  onActiveSentenceChange,
}) {
  const textareaRef = useRef(null);
  const wrapRef = useRef(null);
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState(null);
  const [cursorSentenceIndex, setCursorSentenceIndex] = useState(null);

  const { sentences, starts } = getSentenceStarts(content);
  const hasSentences = sentences.length > 0;
  const segments = getSentenceSegments(content, sentenceImages);

  const highlightParts = useMemo(() => {
    const parts = [];
    let last = 0;
    for (const seg of segments) {
      if (seg.start > last) {
        parts.push({ text: content.slice(last, seg.start), highlight: false });
      }
      parts.push({ text: content.slice(seg.start, seg.end), highlight: seg.hasImage });
      last = seg.end;
    }
    if (last < content.length) {
      parts.push({ text: content.slice(last), highlight: false });
    }
    return parts.length ? parts : [{ text: content, highlight: false }];
  }, [content, segments]);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    const wrap = wrapRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const h = Math.max(el.scrollHeight, 80);
    el.style.height = h + 'px';
    if (wrap) wrap.style.minHeight = h + 'px';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

  const updateCursorSentence = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !hasSentences) {
      setCursorSentenceIndex(null);
      return;
    }
    const normStart = contentOffsetToNormalized(content, el.selectionStart);
    const idx = normalizedOffsetToSentenceIndex(normStart, starts);
    setCursorSentenceIndex(idx);
    onSentencePositionChange?.(sectionId, idx);
    onActiveSentenceChange?.(sectionId, idx);
  }, [content, hasSentences, starts, sectionId, onSentencePositionChange, onActiveSentenceChange]);

  const handleMouseUp = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end || !hasSentences) {
      setSelectedSentenceIndex(null);
      updateCursorSentence();
      return;
    }
    const normStart = contentOffsetToNormalized(content, start);
    const idx = normalizedOffsetToSentenceIndex(normStart, starts);
    setSelectedSentenceIndex(idx);
    onSentencePositionChange?.(sectionId, idx);
    updateCursorSentence();
    onOpenSentencePicker?.(sectionId, idx);
  }, [content, hasSentences, starts, sectionId, onSentencePositionChange, onActiveSentenceChange, updateCursorSentence, onOpenSentencePicker]);

  const handleSelectImageForSentence = useCallback(() => {
    if (selectedSentenceIndex === null) return;
    onOpenSentencePicker?.(sectionId, selectedSentenceIndex);
    setSelectedSentenceIndex(null);
  }, [sectionId, selectedSentenceIndex, onOpenSentencePicker]);

  const cursorImageUrl = cursorSentenceIndex != null ? (sentenceImages[cursorSentenceIndex] || '') : '';
  const showCursorPreview = cursorSentenceIndex != null && cursorImageUrl;

  return (
    <div className="edit-step">
      <div className="edit-step__header-row">
        <div className="edit-step__label">{sectionTitle}</div>
      </div>
      <div ref={wrapRef} className="edit-step__content-wrap">
        <div className="edit-step__content-mirror" aria-hidden="true">
          {highlightParts.map((part, i) =>
            part.highlight ? (
              <span key={i} className="edit-step__content-highlight">
                {part.text}
              </span>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </div>
        <textarea
          ref={textareaRef}
          className="edit-step__content"
          value={content}
          onChange={(e) => {
            onContentChange(sectionId, e.target.value);
            adjustHeight();
          }}
          onMouseUp={handleMouseUp}
          onClick={updateCursorSentence}
          onKeyUp={updateCursorSentence}
          onFocus={() => {
            adjustHeight();
            updateCursorSentence();
          }}
          placeholder="Story text for this step…"
          rows={3}
        />
      </div>
    </div>
  );
}

export default function EditView({
  sectionOrder,
  sectionDefs,
  sectionsData,
  onContentChange,
  onSentenceImageChange,
  onBackgroundOpacityChange,
  onPresentStartChange,
}) {
  const [pickerSentence, setPickerSentence] = useState(null);
  const [activeSentence, setActiveSentence] = useState(null);
  const [magicLoadingAll, setMagicLoadingAll] = useState(false);
  const [opacity, setOpacity] = useState(() => getSettings().presentationBackgroundOpacity ?? 0.35);
  const [webcamError, setWebcamError] = useState(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const webcamVideoRef = useRef(null);
  const webcamStreamRef = useRef(null);

  const settings = getSettings();
  const webcamEnabled = Boolean(settings.presentationWebcamEnabled);
  const webcamSize = ['small', 'medium', 'large'].includes(settings.presentationWebcamSize) ? settings.presentationWebcamSize : 'medium';
  const cameraId = settings.presentationCameraId?.trim() || '';

  const handleActiveSentenceChange = useCallback((payload) => {
    setActiveSentence(payload == null ? null : { sectionId: payload.sectionId, sentenceIndex: payload.sentenceIndex });
  }, []);

  const handleSentencePositionChange = useCallback(
    (sectionId, sentenceIndexInSection) => {
      if (typeof onPresentStartChange !== 'function') return;
      let globalIndex = 0;
      for (const sid of sectionOrder) {
        if (sid === sectionId) {
          globalIndex += sentenceIndexInSection;
          break;
        }
        const content = sectionsData[sid]?.content ?? '';
        const { sentences } = getSentenceStarts(content);
        globalIndex += sentences.length;
      }
      onPresentStartChange(globalIndex);
    },
    [sectionOrder, sectionsData, onPresentStartChange]
  );

  const pickerOpen = pickerSentence !== null;
  const pickerInitialQuery =
    pickerSentence != null
      ? (() => {
          const section = sectionsData[pickerSentence.sectionId];
          const content = section?.content ?? '';
          const { sentences } = getSentenceStarts(content);
          const s = sentences[pickerSentence.sentenceIndex];
          return s ? s.slice(0, 60).trim() : '';
        })()
      : '';

  const handleOpacityChange = useCallback(
    (e) => {
      const v = parseFloat(e.target.value);
      setOpacity(v);
      onBackgroundOpacityChange?.(v);
    },
    [onBackgroundOpacityChange]
  );

  const handlePickerSelect = useCallback(
    (url, credit) => {
      if (pickerSentence) {
        onSentenceImageChange?.(pickerSentence.sectionId, pickerSentence.sentenceIndex, url, credit);
        setPickerSentence(null);
      }
    },
    [pickerSentence, onSentenceImageChange]
  );

  const handleOpenSentencePicker = useCallback((sectionId, sentenceIndex) => {
    setPickerSentence({ sectionId, sentenceIndex });
  }, []);

  const activeSentenceImageUrl = activeSentence
    ? (sectionsData[activeSentence.sectionId]?.sentenceImages?.[activeSentence.sentenceIndex] || '')
    : '';
  const activeSentenceText = activeSentence
    ? (() => {
        const content = sectionsData[activeSentence.sectionId]?.content ?? '';
        const { sentences } = getSentenceStarts(content);
        return sentences[activeSentence.sentenceIndex] ?? '';
      })()
    : '';

  const handleMagicAIAll = useCallback(async () => {
    setMagicLoadingAll(true);
    try {
      for (const sectionId of sectionOrder) {
        const section = sectionsData[sectionId];
        const content = section?.content ?? '';
        const { sentences } = getSentenceStarts(content);
        const existing = section?.sentenceImages ?? [];
        for (let i = 0; i < sentences.length; i++) {
          const hasImage = Array.isArray(existing) && (existing[i] ?? '').toString().trim() !== '';
          if (hasImage) continue;
          const query = sentences[i].slice(0, 80).trim();
          if (!query) continue;
          const result = await searchUnsplashFirst(query);
          if (result) {
            onSentenceImageChange?.(sectionId, i, result.url, result.credit);
          }
        }
      }
    } finally {
      setMagicLoadingAll(false);
    }
  }, [sectionOrder, sectionsData, onSentenceImageChange]);

  useEffect(() => {
    if (!webcamEnabled || !navigator.mediaDevices?.getUserMedia) return;
    setWebcamError(null);
    const videoConstraints = cameraId ? { deviceId: { exact: cameraId } } : true;
    navigator.mediaDevices
      .getUserMedia({ video: videoConstraints, audio: false })
      .then((stream) => {
        webcamStreamRef.current = stream;
        if (webcamVideoRef.current) webcamVideoRef.current.srcObject = stream;
        setWebcamActive(true);
      })
      .catch((err) => {
        setWebcamError(err.message || 'Camera access failed');
      });
    return () => {
      const s = webcamStreamRef.current;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        webcamStreamRef.current = null;
      }
      setWebcamActive(false);
    };
  }, [webcamEnabled, cameraId]);

  useEffect(() => {
    if (webcamVideoRef.current && webcamStreamRef.current) {
      webcamVideoRef.current.srcObject = webcamStreamRef.current;
    }
  }, [webcamActive]);

  return (
    <div className="edit-view">
      <div className="edit-view__main">
        <div className="edit-view__opacity">
          <span className="edit-view__opacity-label">Background image transparency</span>
          <input
            type="range"
            className="edit-view__opacity-slider"
            min="0"
            max="1"
            step="0.05"
            value={opacity}
            onChange={handleOpacityChange}
            aria-label="Background image transparency"
          />
        </div>
        {sectionOrder.map((sectionId) => {
          const def = sectionDefs[sectionId];
          const section = sectionsData[sectionId];
          return (
            <EditStep
              key={sectionId}
              sectionId={sectionId}
              sectionTitle={def?.title ?? sectionId}
              content={section?.content ?? ''}
              sentenceImages={section?.sentenceImages ?? []}
              onContentChange={onContentChange}
              onOpenSentencePicker={handleOpenSentencePicker}
              onSentenceImageChange={onSentenceImageChange}
              onSentencePositionChange={handleSentencePositionChange}
              onActiveSentenceChange={(sid, idx) => (sid == null ? handleActiveSentenceChange(null) : handleActiveSentenceChange({ sectionId: sid, sentenceIndex: idx }))}
            />
          );
        })}
      </div>
      <aside
        className={`edit-view__side${pickerSentence !== null ? ' edit-view__side--picker-open' : ''}`}
        aria-label="Sentence image"
        onMouseDown={(e) => {
          const focusable = e.target.closest('input, textarea, select, button, [contenteditable="true"], [tabindex]:not([tabindex="-1"])');
          if (!focusable) e.preventDefault();
        }}
      >
        <h2 className="edit-view__side-title">Sentence image</h2>
        {pickerSentence !== null ? (
          <div className="edit-view__side-picker">
            <UnsplashPicker
              isOpen={true}
              inline={true}
              onClose={() => setPickerSentence(null)}
              onSelect={handlePickerSelect}
              initialQuery={pickerInitialQuery}
            />
          </div>
        ) : activeSentence !== null ? (
          <>
            <p className="edit-view__side-sentence">{activeSentenceText || 'This sentence'}</p>
            {activeSentenceImageUrl ? (
              <div className="edit-view__side-preview">
                <img
                  className="edit-view__side-thumb"
                  src={activeSentenceImageUrl}
                  alt="Sentence background"
                />
                <div className="edit-view__side-actions">
                  <button
                    type="button"
                    className="edit-view__side-btn edit-view__side-btn--primary"
                    onClick={() => handleOpenSentencePicker(activeSentence.sectionId, activeSentence.sentenceIndex)}
                  >
                    Swap image
                  </button>
                </div>
              </div>
            ) : (
              <div className="edit-view__side-actions">
                <button
                  type="button"
                  className="edit-view__side-btn edit-view__side-btn--primary"
                  onClick={() => handleOpenSentencePicker(activeSentence.sectionId, activeSentence.sentenceIndex)}
                >
                  Select image
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="edit-view__side-hint">Click in or select a sentence to set its background image.</p>
        )}
      </aside>
      {webcamEnabled && (
        <div className={`edit-view__webcam-wrap edit-view__webcam-wrap--${webcamSize}`}>
          {webcamError ? (
            <div className="edit-view__webcam-error">{webcamError}</div>
          ) : (
            <video
              ref={webcamVideoRef}
              className="edit-view__webcam"
              autoPlay
              playsInline
              muted
              aria-label="Webcam preview"
            />
          )}
        </div>
      )}
    </div>
  );
}
