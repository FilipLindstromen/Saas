import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { getSettings, saveSettings, UNSPLASH_RESULT_COUNT_OPTIONS, SENTENCE_IMAGE_SOURCE_OPTIONS } from '../utils/settings';
import {
  getSentenceStarts,
  getGlobalSceneIndexForSentence,
} from '../utils/sentences';
import {
  joinSectionContents,
  applyUnifiedStoryEdit,
  locateSentenceAtUnifiedOffset,
  unifiedSelectionToSectionRange,
} from '../utils/storyDocument';
import { buildUnifiedMirrorParts } from '../utils/unifiedMirror';
import {
  addHeadlineSpan,
  removeHeadlineSpanOverlap,
  selectionIsHeadline,
} from '../utils/headlines';
import {
  addRotateSpan,
  removeRotateSpanOverlap,
  selectionOverlapsRotate,
  addBulletSpan,
  removeBulletSpanOverlap,
  selectionOverlapsBullet,
  normalizeRotateSpans,
} from '../utils/lineReveal';
import TextContextMenu from './TextContextMenu';
import { resolveSentenceBackgroundImage } from '../services/sentenceBackgroundAi';
import StockMediaPicker from './StockMediaPicker';
import { isStockMediaSource, isVideoBackgroundUrl, stockSourceSearchLabel } from '../utils/stockMediaSource';
import SketchBackgroundPanel from './SketchBackgroundPanel';
import ImportImagePanel from './ImportImagePanel';
import './EditView.css';
import './UnifiedStoryEditor.css';

function UnifiedEditEditor({
  sectionOrder,
  sectionsData,
  onUnifiedContentChange,
  onHeadlineSpansChange,
  onRotateLineSpansChange,
  onBulletLineSpansChange,
  onSentencePositionChange,
  onActiveSentenceChange,
  onLineClick,
}) {
  const textareaRef = useRef(null);
  const wrapRef = useRef(null);
  const [contextMenu, setContextMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    range: null,
    isHeadline: false,
    isRotate: false,
    isBullet: false,
  });
  const content = joinSectionContents(sectionOrder, sectionsData);
  const mirrorParts = useMemo(
    () => buildUnifiedMirrorParts(sectionOrder, sectionsData),
    [sectionOrder, sectionsData]
  );

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    const wrap = wrapRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const h = Math.max(el.scrollHeight, 320);
    el.style.height = `${h}px`;
    if (wrap) wrap.style.minHeight = `${h}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

  const updateCursorSentence = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const located = locateSentenceAtUnifiedOffset(sectionOrder, sectionsData, el.selectionStart);
    if (!located) {
      onActiveSentenceChange?.(null);
      return;
    }
    onSentencePositionChange?.(located.sectionId, located.sentenceIndex);
    onActiveSentenceChange?.({ sectionId: located.sectionId, sentenceIndex: located.sentenceIndex });
  }, [sectionOrder, sectionsData, onSentencePositionChange, onActiveSentenceChange]);

  const handleMouseUp = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) {
      updateCursorSentence();
      const located = locateSentenceAtUnifiedOffset(sectionOrder, sectionsData, start);
      if (located) onLineClick?.(located.sectionId, located.sentenceIndex);
      return;
    }
    const located = locateSentenceAtUnifiedOffset(sectionOrder, sectionsData, start);
    if (located) {
      onSentencePositionChange?.(located.sectionId, located.sentenceIndex);
      updateCursorSentence();
      onLineClick?.(located.sectionId, located.sentenceIndex);
    }
  }, [
    sectionOrder,
    sectionsData,
    updateCursorSentence,
    onSentencePositionChange,
    onLineClick,
  ]);

  const handleContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      const el = textareaRef.current;
      if (!el) return;
      const range = unifiedSelectionToSectionRange(
        sectionOrder,
        sectionsData,
        el.selectionStart,
        el.selectionEnd
      );
      let isHeadline = false;
      let isRotate = false;
      let isBullet = false;
      if (range) {
        const sectionContent = sectionsData[range.sectionId]?.content ?? '';
        isHeadline = selectionIsHeadline(
          sectionsData[range.sectionId]?.headlineSpans ?? [],
          range.start,
          range.end,
          sectionContent.length
        );
        isRotate = selectionOverlapsRotate(
          sectionsData[range.sectionId]?.rotateLineSpans ?? [],
          range.start,
          range.end,
          sectionContent.length
        );
        isBullet = selectionOverlapsBullet(
          sectionsData[range.sectionId]?.bulletLineSpans ?? [],
          range.start,
          range.end,
          sectionContent.length
        );
      }
      setContextMenu({
        open: true,
        x: e.clientX,
        y: e.clientY,
        range,
        isHeadline,
        isRotate,
        isBullet,
      });
    },
    [sectionOrder, sectionsData]
  );

  return (
    <>
    <div ref={wrapRef} className="unified-story-editor__wrap edit-step__content-wrap">
      <div className="unified-story-editor__mirror edit-step__content-mirror" aria-hidden="true">
        {mirrorParts.map((part, i) => {
          const classes = [
            part.headline && 'edit-step__content-headline',
            part.rotate && 'edit-step__content-rotate',
            part.bullet && 'edit-step__content-bullet',
            part.hasImage && 'unified-story-editor__mirror-highlight edit-step__content-highlight',
          ]
            .filter(Boolean)
            .join(' ');
          return classes ? (
            <span key={i} className={classes}>
              {part.text}
            </span>
          ) : (
            <span key={i}>{part.text}</span>
          );
        })}
      </div>
      <textarea
        ref={textareaRef}
        className="unified-story-editor__textarea unified-story-editor__textarea--overlay edit-step__content"
        value={content}
        onChange={(e) => {
          onUnifiedContentChange(e.target.value);
          adjustHeight();
        }}
        onContextMenu={handleContextMenu}
        onMouseUp={handleMouseUp}
        onClick={updateCursorSentence}
        onKeyUp={updateCursorSentence}
        onFocus={() => {
          adjustHeight();
          updateCursorSentence();
        }}
        placeholder="Story text…"
        spellCheck
      />
    </div>
    <TextContextMenu
      open={contextMenu.open}
      x={contextMenu.x}
      y={contextMenu.y}
      onClose={() => setContextMenu((m) => ({ ...m, open: false }))}
      items={[
        {
          id: 'headline-set',
          label: 'Set as headline',
          disabled: !contextMenu.range,
          onClick: () => {
            const { range } = contextMenu;
            if (!range) return;
            const sectionContent = sectionsData[range.sectionId]?.content ?? '';
            const next = addHeadlineSpan(
              sectionsData[range.sectionId]?.headlineSpans ?? [],
              range.start,
              range.end,
              sectionContent.length
            );
            onHeadlineSpansChange?.(range.sectionId, next);
          },
        },
        {
          id: 'headline-clear',
          label: 'Remove headline style',
          disabled: !contextMenu.range || !contextMenu.isHeadline,
          onClick: () => {
            const { range } = contextMenu;
            if (!range) return;
            const sectionContent = sectionsData[range.sectionId]?.content ?? '';
            const next = removeHeadlineSpanOverlap(
              sectionsData[range.sectionId]?.headlineSpans ?? [],
              range.start,
              range.end,
              sectionContent.length
            );
            onHeadlineSpansChange?.(range.sectionId, next);
          },
        },
        {
          id: 'rotate-set',
          label: 'Set as rotating lines (Present)',
          disabled: !contextMenu.range || contextMenu.isRotate,
          onClick: () => {
            const { range } = contextMenu;
            if (!range) return;
            const sectionContent = sectionsData[range.sectionId]?.content ?? '';
            const len = sectionContent.length;
            const nextRotate = normalizeRotateSpans(
              addRotateSpan(
                sectionsData[range.sectionId]?.rotateLineSpans ?? [],
                range.start,
                range.end,
                len
              ),
              len
            );
            onRotateLineSpansChange?.(range.sectionId, nextRotate);
            let clearedBullets = sectionsData[range.sectionId]?.bulletLineSpans ?? [];
            for (const s of nextRotate) {
              clearedBullets = removeBulletSpanOverlap(clearedBullets, s.start, s.end, len);
            }
            onBulletLineSpansChange?.(range.sectionId, clearedBullets);
          },
        },
        {
          id: 'rotate-clear',
          label: 'Remove rotating lines',
          disabled: !contextMenu.range || !contextMenu.isRotate,
          onClick: () => {
            const { range } = contextMenu;
            if (!range) return;
            const sectionContent = sectionsData[range.sectionId]?.content ?? '';
            const next = removeRotateSpanOverlap(
              sectionsData[range.sectionId]?.rotateLineSpans ?? [],
              range.start,
              range.end,
              sectionContent.length
            );
            onRotateLineSpansChange?.(range.sectionId, next);
          },
        },
        {
          id: 'bullet-set',
          label: 'Set as bullet list (Present)',
          disabled: !contextMenu.range || contextMenu.isBullet,
          onClick: () => {
            const { range } = contextMenu;
            if (!range) return;
            const sectionContent = sectionsData[range.sectionId]?.content ?? '';
            const len = sectionContent.length;
            const nextBullet = normalizeRotateSpans(
              addBulletSpan(
                sectionsData[range.sectionId]?.bulletLineSpans ?? [],
                range.start,
                range.end,
                len
              ),
              len
            );
            onBulletLineSpansChange?.(range.sectionId, nextBullet);
            let clearedRotate = sectionsData[range.sectionId]?.rotateLineSpans ?? [];
            for (const s of nextBullet) {
              clearedRotate = removeRotateSpanOverlap(clearedRotate, s.start, s.end, len);
            }
            onRotateLineSpansChange?.(range.sectionId, clearedRotate);
          },
        },
        {
          id: 'bullet-clear',
          label: 'Remove bullet list style',
          disabled: !contextMenu.range || !contextMenu.isBullet,
          onClick: () => {
            const { range } = contextMenu;
            if (!range) return;
            const sectionContent = sectionsData[range.sectionId]?.content ?? '';
            const next = removeBulletSpanOverlap(
              sectionsData[range.sectionId]?.bulletLineSpans ?? [],
              range.start,
              range.end,
              sectionContent.length
            );
            onBulletLineSpansChange?.(range.sectionId, next);
          },
        },
      ]}
    />
    </>
  );
}

export default function EditView({
  sectionOrder,
  sectionsData,
  onUnifiedContentChange,
  onHeadlineSpansChange,
  onRotateLineSpansChange,
  onBulletLineSpansChange,
  onSentenceImageChange,
  onSentenceImageLockChange,
  onBackgroundOpacityChange,
  onPresentStartChange,
}) {
  const [pickerSentence, setPickerSentence] = useState(null);
  const [pickerAutoSearch, setPickerAutoSearch] = useState(false);
  const [activeSentence, setActiveSentence] = useState(null);
  const [imageSearchOnLineClick, setImageSearchOnLineClick] = useState(
    () => getSettings().editImageSearchOnLineClick
  );
  const [unsplashResultsCount, setUnsplashResultsCount] = useState(
    () => getSettings().editUnsplashResultsCount
  );
  const [sentenceImageSource, setSentenceImageSource] = useState(
    () => getSettings().editSentenceImageSource
  );
  const [sketchInstructions, setSketchInstructions] = useState(
    () => getSettings().editSketchGenerationInstructions ?? ''
  );
  const useAiSketch = sentenceImageSource === 'ai-sketch';
  const useImport = sentenceImageSource === 'import';
  const useStock = isStockMediaSource(sentenceImageSource);
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
    setActiveSentence(
      payload == null || payload.sectionId == null
        ? null
        : { sectionId: payload.sectionId, sentenceIndex: payload.sentenceIndex }
    );
  }, []);

  const handleSentencePositionChange = useCallback(
    (sectionId, sentenceIndexInSection) => {
      if (typeof onPresentStartChange !== 'function') return;
      const globalIndex = getGlobalSceneIndexForSentence(
        sectionOrder,
        sectionsData,
        sectionId,
        sentenceIndexInSection
      );
      onPresentStartChange(globalIndex);
    },
    [sectionOrder, sectionsData, onPresentStartChange]
  );

  const pickerOpen = pickerSentence !== null;
  const pickerSentenceText =
    pickerSentence != null
      ? (() => {
          const section = sectionsData[pickerSentence.sectionId];
          const content = section?.content ?? '';
          const { sentences } = getSentenceStarts(content);
          const s = sentences[pickerSentence.sentenceIndex];
          return s ? s.trim() : '';
        })()
      : '';
  const pickerInitialQuery = pickerSentenceText.slice(0, 60).trim();

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

  const isSentenceLocked = useCallback(
    (sectionId, sentenceIndex) => {
      const locks = sectionsData[sectionId]?.sentenceImageLocks;
      return Array.isArray(locks) && Boolean(locks[sentenceIndex]);
    },
    [sectionsData]
  );

  const handleOpenSentencePicker = useCallback(
    (sectionId, sentenceIndex, { autoSearch = false } = {}) => {
      if (isSentenceLocked(sectionId, sentenceIndex)) return;
      setPickerAutoSearch(autoSearch);
      setPickerSentence({ sectionId, sentenceIndex });
    },
    [isSentenceLocked]
  );

  const handleLineClick = useCallback(
    (sectionId, sentenceIndex) => {
      if (isSentenceLocked(sectionId, sentenceIndex)) {
        setPickerSentence(null);
        return;
      }
      if (imageSearchOnLineClick) {
        handleOpenSentencePicker(sectionId, sentenceIndex, { autoSearch: true });
      } else {
        setPickerSentence(null);
      }
    },
    [imageSearchOnLineClick, isSentenceLocked, handleOpenSentencePicker]
  );

  useEffect(() => {
    if (!imageSearchOnLineClick) {
      setPickerSentence(null);
    }
  }, [imageSearchOnLineClick]);

  const handleImageSearchOnLineClickChange = useCallback((e) => {
    const next = e.target.checked;
    setImageSearchOnLineClick(next);
    saveSettings({ ...getSettings(), editImageSearchOnLineClick: next });
  }, []);

  const handleUnsplashResultsCountChange = useCallback((e) => {
    const next = Number(e.target.value);
    setUnsplashResultsCount(next);
    saveSettings({ ...getSettings(), editUnsplashResultsCount: next });
  }, []);

  const handleSentenceImageSourceChange = useCallback((next) => {
    setSentenceImageSource(next);
    saveSettings({ ...getSettings(), editSentenceImageSource: next });
    setPickerSentence(null);
  }, []);

  const handleSketchInstructionsChange = useCallback((e) => {
    const next = e.target.value;
    setSketchInstructions(next);
    saveSettings({ ...getSettings(), editSketchGenerationInstructions: next });
  }, []);

  const activeSentenceImageUrl = activeSentence
    ? (sectionsData[activeSentence.sectionId]?.sentenceImages?.[activeSentence.sentenceIndex] || '')
    : '';
  const activeSentenceLocked = activeSentence
    ? isSentenceLocked(activeSentence.sectionId, activeSentence.sentenceIndex)
    : false;
  const activeSentenceText = activeSentence
    ? (() => {
        const content = sectionsData[activeSentence.sectionId]?.content ?? '';
        const { sentences } = getSentenceStarts(content);
        return sentences[activeSentence.sentenceIndex] ?? '';
      })()
    : '';

  const manualActionLabel = useMemo(() => {
    if (useImport) return 'Import image for sentence';
    if (useAiSketch) return 'Generate sketch for sentence';
    if (useStock && sentenceImageSource.includes('video')) return 'Search video for sentence';
    if (useStock) return 'Search image for sentence';
    return 'Find background for sentence';
  }, [useImport, useAiSketch, useStock, sentenceImageSource]);

  const handleToggleActiveSentenceLock = useCallback(() => {
    if (!activeSentence) return;
    onSentenceImageLockChange?.(
      activeSentence.sectionId,
      activeSentence.sentenceIndex,
      !activeSentenceLocked
    );
    if (!activeSentenceLocked) {
      setPickerSentence(null);
    }
  }, [activeSentence, activeSentenceLocked, onSentenceImageLockChange]);

  const handleMagicAIAll = useCallback(async () => {
    setMagicLoadingAll(true);
    try {
      const source = getSettings().editSentenceImageSource;
      const openaiApiKey = getSettings().openaiApiKey;
      for (const sectionId of sectionOrder) {
        const section = sectionsData[sectionId];
        const content = section?.content ?? '';
        const { sentences } = getSentenceStarts(content);
        const existing = section?.sentenceImages ?? [];
        const locks = section?.sentenceImageLocks ?? [];
        for (let i = 0; i < sentences.length; i++) {
          if (Boolean(locks[i])) continue;
          const hasImage = Array.isArray(existing) && (existing[i] ?? '').toString().trim() !== '';
          if (hasImage) continue;
          const query = sentences[i].slice(0, 80).trim();
          if (!query) continue;
          try {
            const result = await resolveSentenceBackgroundImage({
              sentenceText: query,
              source,
              openaiApiKey,
              sketchInstructions,
            });
            if (result) {
              onSentenceImageChange?.(sectionId, i, result.url, result.credit);
            }
          } catch {
            /* skip sentence on failure */
          }
        }
      }
    } finally {
      setMagicLoadingAll(false);
    }
  }, [sectionOrder, sectionsData, onSentenceImageChange, sketchInstructions]);

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
        <UnifiedEditEditor
          sectionOrder={sectionOrder}
          sectionsData={sectionsData}
          onUnifiedContentChange={onUnifiedContentChange}
          onHeadlineSpansChange={onHeadlineSpansChange}
          onRotateLineSpansChange={onRotateLineSpansChange}
          onBulletLineSpansChange={onBulletLineSpansChange}
          onSentencePositionChange={handleSentencePositionChange}
          onActiveSentenceChange={handleActiveSentenceChange}
          onLineClick={handleLineClick}
        />
      </div>
      <aside
        className={`edit-view__side${pickerSentence !== null ? ' edit-view__side--picker-open' : ''}`}
        aria-label="Sentence image"
        onMouseDown={(e) => {
          if (e.target.closest('.edit-view__side-picker, .sketch-bg-panel, .unsplash-picker-inline, .import-image-panel')) {
            return;
          }
          const focusable = e.target.closest(
            'input, textarea, select, button, label, [contenteditable="true"], [tabindex]:not([tabindex="-1"])'
          );
          if (!focusable) e.preventDefault();
        }}
      >
        <h2 className="edit-view__side-title">Sentence image</h2>
        <div className="edit-view__side-options">
          <fieldset className="edit-view__source-field">
            <legend className="edit-view__side-option-label">Background source</legend>
            <div className="edit-view__source-grid" role="radiogroup" aria-label="Sentence background source">
              {SENTENCE_IMAGE_SOURCE_OPTIONS.map((o) => {
                const checked = sentenceImageSource === o.value;
                return (
                  <label
                    key={o.value}
                    className={`edit-view__source-pill${checked ? ' edit-view__source-pill--active' : ''}`}
                    title={o.label}
                  >
                    <input
                      type="radio"
                      name="sentence-image-source"
                      className="edit-view__source-pill-input"
                      value={o.value}
                      checked={checked}
                      onChange={() => handleSentenceImageSourceChange(o.value)}
                    />
                    <span className="edit-view__source-pill-text">{o.shortLabel ?? o.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {useStock && (
            <label className="edit-view__side-option edit-view__side-option--select">
              <span className="edit-view__side-option-label">Results shown</span>
              <select
                className="edit-view__side-select"
                value={unsplashResultsCount}
                onChange={handleUnsplashResultsCountChange}
                aria-label="Number of stock results"
              >
                {UNSPLASH_RESULT_COUNT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {useAiSketch && (
            <label className="edit-view__side-option edit-view__side-option--stack">
              <span className="edit-view__side-option-label">Sketch instructions (optional)</span>
              <textarea
                className="edit-view__side-textarea"
                value={sketchInstructions}
                onChange={handleSketchInstructionsChange}
                placeholder="e.g. two people at a dinner table, warm mood, minimal props…"
                rows={3}
                aria-label="Extra instructions for sketch generation"
              />
            </label>
          )}
        </div>

        <section className="edit-view__side-section" aria-labelledby="edit-side-selected-image">
          <h3 id="edit-side-selected-image" className="edit-view__side-section-title">
            Selected image
          </h3>
          {activeSentence ? (
            <>
              <p className="edit-view__side-sentence">{activeSentenceText || 'This sentence'}</p>
              {activeSentenceImageUrl ? (
                <div className="edit-view__side-preview">
                  {isVideoBackgroundUrl(activeSentenceImageUrl) ? (
                    <video
                      className="edit-view__side-thumb edit-view__side-thumb--video"
                      src={activeSentenceImageUrl}
                      muted
                      playsInline
                      loop
                      autoPlay
                      aria-label="Sentence background video"
                    />
                  ) : (
                    <img
                      className="edit-view__side-thumb"
                      src={activeSentenceImageUrl}
                      alt="Sentence background"
                    />
                  )}
                </div>
              ) : (
                <p className="edit-view__side-empty">No background set for this sentence yet.</p>
              )}
              <label className="edit-view__side-option edit-view__side-option--lock">
                <input
                  type="checkbox"
                  checked={activeSentenceLocked}
                  onChange={handleToggleActiveSentenceLock}
                />
                <span>Lock image (skip auto-search and bulk fill)</span>
              </label>
              <div className="edit-view__side-actions">
                {!imageSearchOnLineClick && !activeSentenceLocked && (
                  <button
                    type="button"
                    className="edit-view__side-btn edit-view__side-btn--primary"
                    onClick={() =>
                      handleOpenSentencePicker(activeSentence.sectionId, activeSentence.sentenceIndex, {
                        autoSearch: true,
                      })
                    }
                  >
                    {manualActionLabel}
                  </button>
                )}
                {activeSentenceImageUrl && !activeSentenceLocked && (
                  <>
                    <button
                      type="button"
                      className="edit-view__side-btn edit-view__side-btn--secondary"
                      onClick={() =>
                        handleOpenSentencePicker(activeSentence.sectionId, activeSentence.sentenceIndex, {
                          autoSearch: true,
                        })
                      }
                    >
                      {useImport ? 'Replace' : useAiSketch ? 'Regenerate' : 'Replace'}
                    </button>
                    <button
                      type="button"
                      className="edit-view__side-btn edit-view__side-btn--secondary"
                      onClick={() =>
                        onSentenceImageChange?.(activeSentence.sectionId, activeSentence.sentenceIndex, '')
                      }
                    >
                      Remove image
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="edit-view__side-hint">Click a sentence in the story to manage its background.</p>
          )}
        </section>

        <section className="edit-view__side-section" aria-labelledby="edit-side-auto-search">
          <h3 id="edit-side-auto-search" className="edit-view__side-section-title">
            Automatic search
          </h3>
          <label className="edit-view__side-option">
            <input
              type="checkbox"
              checked={imageSearchOnLineClick}
              onChange={handleImageSearchOnLineClickChange}
            />
            <span>
              Search when clicking a sentence
              {useStock ? ` (${stockSourceSearchLabel(sentenceImageSource)})` : ''}
              {useAiSketch ? ' (generate sketch)' : ''}
              {useImport ? ' (open import)' : ''}
            </span>
          </label>
          <p className="edit-view__side-section-hint">
            {imageSearchOnLineClick
              ? 'Clicking or selecting a sentence opens search and runs it automatically (unless locked).'
              : 'Use the button under Selected image to search or generate manually.'}
          </p>
        </section>

        <div className="edit-view__side-body">
        {pickerSentence !== null ? (
          <div className="edit-view__side-picker">
            {useImport ? (
              <ImportImagePanel
                isOpen={true}
                sentenceText={pickerSentenceText}
                onClose={() => setPickerSentence(null)}
                onSelect={handlePickerSelect}
              />
            ) : useAiSketch ? (
              <SketchBackgroundPanel
                isOpen={true}
                sentenceText={pickerSentenceText}
                onClose={() => setPickerSentence(null)}
                onSelect={handlePickerSelect}
                autoGenerate={pickerAutoSearch}
                instructions={sketchInstructions}
              />
            ) : useStock ? (
              <StockMediaPicker
                stockSource={sentenceImageSource}
                isOpen={true}
                inline={true}
                onClose={() => setPickerSentence(null)}
                onSelect={handlePickerSelect}
                initialQuery={pickerInitialQuery}
                autoSearch={pickerAutoSearch}
                resultsCount={unsplashResultsCount}
              />
            ) : null}
          </div>
        ) : (
          <p className="edit-view__side-hint edit-view__side-hint--picker">
            {imageSearchOnLineClick
              ? 'Select a sentence to search, or turn off automatic search above.'
              : 'Use “Search image for sentence” under Selected image.'}
          </p>
        )}
        </div>
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
