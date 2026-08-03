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
import TextContextMenu from './TextContextMenu';
import { resolveSentenceBackgroundImage } from '../services/sentenceBackgroundAi';
import UnsplashPicker from './UnsplashPicker';
import SketchBackgroundPanel from './SketchBackgroundPanel';
import ImportImagePanel from './ImportImagePanel';
import './EditView.css';
import './UnifiedStoryEditor.css';

function UnifiedEditEditor({
  sectionOrder,
  sectionsData,
  onUnifiedContentChange,
  onHeadlineSpansChange,
  onOpenSentencePicker,
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
      onOpenSentencePicker?.(located.sectionId, located.sentenceIndex);
    }
  }, [
    sectionOrder,
    sectionsData,
    updateCursorSentence,
    onSentencePositionChange,
    onOpenSentencePicker,
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
      if (range) {
        const sectionContent = sectionsData[range.sectionId]?.content ?? '';
        isHeadline = selectionIsHeadline(
          sectionsData[range.sectionId]?.headlineSpans ?? [],
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
  onSentenceImageChange,
  onBackgroundOpacityChange,
  onPresentStartChange,
}) {
  const [pickerSentence, setPickerSentence] = useState(null);
  const [pickerAutoSearch, setPickerAutoSearch] = useState(true);
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

  const handleOpenSentencePicker = useCallback(
    (sectionId, sentenceIndex) => {
      setPickerAutoSearch(!useImport);
      setPickerSentence({ sectionId, sentenceIndex });
    },
    [useImport]
  );

  const handleLineClick = useCallback(
    (sectionId, sentenceIndex) => {
      if (imageSearchOnLineClick) {
        setPickerAutoSearch(!useImport);
        setPickerSentence({ sectionId, sentenceIndex });
      } else {
        setPickerSentence(null);
      }
    },
    [imageSearchOnLineClick, useImport]
  );

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

  const handleSentenceImageSourceChange = useCallback((e) => {
    const next = e.target.value;
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
      const source = getSettings().editSentenceImageSource;
      const openaiApiKey = getSettings().openaiApiKey;
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
          onOpenSentencePicker={handleOpenSentencePicker}
          onSentencePositionChange={handleSentencePositionChange}
          onActiveSentenceChange={handleActiveSentenceChange}
          onLineClick={handleLineClick}
        />
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
        <div className="edit-view__side-options">
          <label className="edit-view__side-option edit-view__side-option--select edit-view__side-option--stack">
            <span className="edit-view__side-option-label">Background source</span>
            <select
              className="edit-view__side-select edit-view__side-select--wide"
              value={sentenceImageSource}
              onChange={handleSentenceImageSourceChange}
              aria-label="Sentence background source"
            >
              {SENTENCE_IMAGE_SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="edit-view__side-option">
            <input
              type="checkbox"
              checked={imageSearchOnLineClick}
              onChange={handleImageSearchOnLineClickChange}
            />
            <span>
              {useImport
                ? 'Open import when clicking a sentence'
                : useAiSketch
                  ? 'Generate sketch when clicking a sentence'
                  : 'Search Unsplash when clicking a sentence'}
            </span>
          </label>
          {!useAiSketch && !useImport && (
            <label className="edit-view__side-option edit-view__side-option--select">
              <span className="edit-view__side-option-label">Results shown</span>
              <select
                className="edit-view__side-select"
                value={unsplashResultsCount}
                onChange={handleUnsplashResultsCountChange}
                aria-label="Number of Unsplash results"
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
            ) : (
              <UnsplashPicker
                isOpen={true}
                inline={true}
                onClose={() => setPickerSentence(null)}
                onSelect={handlePickerSelect}
                initialQuery={pickerInitialQuery}
                autoSearch={pickerAutoSearch}
                resultsCount={unsplashResultsCount}
              />
            )}
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
                    {useImport ? 'Replace image' : useAiSketch ? 'Regenerate sketch' : 'Swap image'}
                  </button>
                  <button
                    type="button"
                    className="edit-view__side-btn edit-view__side-btn--secondary"
                    onClick={() => onSentenceImageChange?.(activeSentence.sectionId, activeSentence.sentenceIndex, '')}
                  >
                    Delete image
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
                  {useImport ? 'Import image' : useAiSketch ? 'Generate sketch' : 'Select image'}
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
