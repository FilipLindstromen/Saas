import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { getSettings, saveSettings, SENTENCE_IMAGE_SOURCE_OPTIONS, EDIT_STOCK_RESULTS_COUNT } from '../utils/settings';
import {
  getSentenceStarts,
  getGlobalSceneIndexForSentence,
  buildPresentSceneList,
} from '../utils/sentences';
import {
  joinSectionContents,
  applyUnifiedStoryEdit,
  locateSentenceAtUnifiedOffset,
  unifiedSelectionToSectionRange,
  unifiedOffsetForPresentSceneIndex,
} from '../utils/storyDocument';
import { buildUnifiedMirrorPartsSafe, buildUnifiedLineGutterSafe } from '../utils/unifiedMirror';
import { useUnifiedEditGutter } from '../hooks/useUnifiedEditGutter';
import { measureLineTops } from '../utils/editorLineMeasure';
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
import {
  addPresentStyleSpan,
  removePresentStyleOverlap,
  selectionHasPresentStyle,
} from '../utils/presentStyles';
import TextContextMenu from './TextContextMenu';
import { resolveSentenceBackgroundImage } from '../services/sentenceBackgroundAi';
import StockMediaPicker from './StockMediaPicker';
import { isStockMediaSource, isVideoBackgroundUrl } from '../utils/stockMediaSource';
import SketchBackgroundPanel from './SketchBackgroundPanel';
import ImportImagePanel from './ImportImagePanel';
import PresentPreviewPanel from './PresentPreviewPanel';
import EditViewErrorBoundary from './EditViewErrorBoundary';
import './EditView.css';
import './UnifiedStoryEditor.css';

function UnifiedEditEditor({
  sectionOrder,
  sectionsData,
  onUnifiedContentChange,
  onHeadlineSpansChange,
  onRotateLineSpansChange,
  onBulletLineSpansChange,
  onPresentStyleSpansChange,
  onSentencePositionChange,
  onActiveSentenceChange,
  onLineClick,
  scrollToPresentSceneIndex,
  onPresentSceneScrollDone,
  mainScrollRef,
}) {
  const textareaRef = useRef(null);
  const wrapRef = useRef(null);
  const bodyRef = useRef(null);
  const measureRef = useRef(null);
  const [contextMenu, setContextMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    range: null,
    isHeadline: false,
    isRotate: false,
    isBullet: false,
    isEmphasis: false,
    isCaption: false,
    isLarge: false,
    isWhisper: false,
    isAlignLeft: false,
  });
  const content = joinSectionContents(sectionOrder, sectionsData);
  const mirrorParts = useMemo(
    () => buildUnifiedMirrorPartsSafe(sectionOrder, sectionsData),
    [sectionOrder, sectionsData]
  );
  const gutterLines = useMemo(
    () => buildUnifiedLineGutterSafe(sectionOrder, sectionsData),
    [sectionOrder, sectionsData]
  );

  const { gutterTops, adjustHeight, remeasureGutter } = useUnifiedEditGutter({
    content,
    gutterLineCount: gutterLines.length,
    measureRef,
    wrapRef,
    textareaRef,
    bodyRef,
  });

  useEffect(() => {
    if (scrollToPresentSceneIndex == null) return;
    const offset = unifiedOffsetForPresentSceneIndex(
      sectionOrder,
      sectionsData,
      scrollToPresentSceneIndex
    );
    const el = textareaRef.current;
    if (!el) return;

    const run = () => {
      el.focus({ preventScroll: true });
      el.setSelectionRange(offset, offset);
      remeasureGutter();
      const tops = measureLineTops(measureRef.current, content);
      const lineIndex = Math.max(0, content.slice(0, offset).split('\n').length - 1);
      const top = tops[lineIndex] ?? tops[tops.length - 1] ?? 0;
      const scroller = mainScrollRef?.current;
      if (scroller) {
        scroller.scrollTop = Math.max(0, top - scroller.clientHeight * 0.32);
      }
      const located = locateSentenceAtUnifiedOffset(sectionOrder, sectionsData, offset);
      if (located) {
        onSentencePositionChange?.(located.sectionId, located.sentenceIndex);
        onActiveSentenceChange?.({
          sectionId: located.sectionId,
          sentenceIndex: located.sentenceIndex,
        });
      }
      onPresentSceneScrollDone?.();
    };

    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [
    scrollToPresentSceneIndex,
    sectionOrder,
    sectionsData,
    content,
    remeasureGutter,
    mainScrollRef,
    onSentencePositionChange,
    onActiveSentenceChange,
    onPresentSceneScrollDone,
  ]);

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
      let isEmphasis = false;
      let isCaption = false;
      let isLarge = false;
      let isWhisper = false;
      let isAlignLeft = false;
      if (range) {
        const sectionContent = sectionsData[range.sectionId]?.content ?? '';
        const presentStyles = sectionsData[range.sectionId]?.presentStyleSpans ?? [];
        const len = sectionContent.length;
        isHeadline = selectionIsHeadline(
          sectionsData[range.sectionId]?.headlineSpans ?? [],
          range.start,
          range.end,
          len
        );
        isRotate = selectionOverlapsRotate(
          sectionsData[range.sectionId]?.rotateLineSpans ?? [],
          range.start,
          range.end,
          len
        );
        isBullet = selectionOverlapsBullet(
          sectionsData[range.sectionId]?.bulletLineSpans ?? [],
          range.start,
          range.end,
          len
        );
        isEmphasis = selectionHasPresentStyle(presentStyles, range.start, range.end, len, 'emphasis');
        isCaption = selectionHasPresentStyle(presentStyles, range.start, range.end, len, 'caption');
        isLarge = selectionHasPresentStyle(presentStyles, range.start, range.end, len, 'large');
        isWhisper = selectionHasPresentStyle(presentStyles, range.start, range.end, len, 'whisper');
        isAlignLeft = selectionHasPresentStyle(presentStyles, range.start, range.end, len, 'align-left');
      }
      setContextMenu({
        open: true,
        x: e.clientX,
        y: e.clientY,
        range,
        isHeadline,
        isRotate,
        isBullet,
        isEmphasis,
        isCaption,
        isLarge,
        isWhisper,
        isAlignLeft,
      });
    },
    [sectionOrder, sectionsData]
  );

  const contextMenuItems = useMemo(() => {
    const {
      range,
      isHeadline,
      isRotate,
      isBullet,
      isEmphasis,
      isCaption,
      isLarge,
      isWhisper,
      isAlignLeft,
    } = contextMenu;
    const hasRange = Boolean(range);

    const styleToggle = (style, active, setLabel, removeLabel) => ({
      id: `style-${style}`,
      label: active ? removeLabel : setLabel,
      disabled: !hasRange,
      onClick: () => {
        if (!range) return;
        const sectionContent = sectionsData[range.sectionId]?.content ?? '';
        const len = sectionContent.length;
        const spans = sectionsData[range.sectionId]?.presentStyleSpans ?? [];
        const next = active
          ? removePresentStyleOverlap(spans, range.start, range.end, len, style)
          : addPresentStyleSpan(spans, range.start, range.end, style, len);
        onPresentStyleSpansChange?.(range.sectionId, next);
      },
    });

    return [
      {
        id: 'headline',
        label: isHeadline ? 'Remove headline' : 'Headline',
        disabled: !hasRange,
        onClick: () => {
          if (!range) return;
          const sectionContent = sectionsData[range.sectionId]?.content ?? '';
          const len = sectionContent.length;
          const spans = sectionsData[range.sectionId]?.headlineSpans ?? [];
          const next = isHeadline
            ? removeHeadlineSpanOverlap(spans, range.start, range.end, len)
            : addHeadlineSpan(spans, range.start, range.end, len);
          onHeadlineSpansChange?.(range.sectionId, next);
        },
      },
      {
        id: 'rotate',
        label: isRotate ? 'Remove rotating lines' : 'Rotating lines',
        disabled: !hasRange,
        onClick: () => {
          if (!range) return;
          const sectionContent = sectionsData[range.sectionId]?.content ?? '';
          const len = sectionContent.length;
          if (isRotate) {
            const next = removeRotateSpanOverlap(
              sectionsData[range.sectionId]?.rotateLineSpans ?? [],
              range.start,
              range.end,
              len
            );
            onRotateLineSpansChange?.(range.sectionId, next);
            return;
          }
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
        id: 'bullet',
        label: isBullet ? 'Remove bullet list' : 'Bullet list',
        disabled: !hasRange,
        onClick: () => {
          if (!range) return;
          const sectionContent = sectionsData[range.sectionId]?.content ?? '';
          const len = sectionContent.length;
          if (isBullet) {
            const next = removeBulletSpanOverlap(
              sectionsData[range.sectionId]?.bulletLineSpans ?? [],
              range.start,
              range.end,
              len
            );
            onBulletLineSpansChange?.(range.sectionId, next);
            return;
          }
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
      styleToggle('emphasis', isEmphasis, 'Emphasis', 'Remove emphasis'),
      styleToggle('caption', isCaption, 'Caption', 'Remove caption'),
      styleToggle('large', isLarge, 'Large type', 'Remove large type'),
      styleToggle('whisper', isWhisper, 'Whisper', 'Remove whisper'),
      {
        id: 'align-left',
        label: isAlignLeft ? 'Remove align left' : 'Align left',
        disabled: !hasRange,
        onClick: () => {
          if (!range) return;
          const sectionContent = sectionsData[range.sectionId]?.content ?? '';
          const len = sectionContent.length;
          const spans = sectionsData[range.sectionId]?.presentStyleSpans ?? [];
          if (isAlignLeft) {
            const next = removePresentStyleOverlap(spans, range.start, range.end, len, 'align-left');
            onPresentStyleSpansChange?.(range.sectionId, next);
            return;
          }
          let next = removePresentStyleOverlap(spans, range.start, range.end, len, 'align-center');
          next = addPresentStyleSpan(next, range.start, range.end, 'align-left', len);
          onPresentStyleSpansChange?.(range.sectionId, next);
        },
      },
    ];
  }, [
    contextMenu,
    sectionsData,
    onHeadlineSpansChange,
    onRotateLineSpansChange,
    onBulletLineSpansChange,
    onPresentStyleSpansChange,
  ]);

  return (
    <>
    <div ref={wrapRef} className="unified-story-editor__wrap edit-step__content-wrap">
      <div ref={bodyRef} className="edit-step__content-body">
      <div className="edit-step__content-gutter" aria-hidden="true">
        {gutterLines.map((line, i) => (
          <div
            key={i}
            className="edit-step__gutter-line"
            style={{ top: gutterTops[i] ?? 0 }}
          >
            {line.headline && (
              <span className="edit-step__gutter-mark edit-step__gutter-mark--headline" title="Headline">
                H
              </span>
            )}
            {line.rotate && (
              <span className="edit-step__gutter-mark edit-step__gutter-mark--rotate" title="Rotating lines">
                ↻
              </span>
            )}
            {line.bullet && (
              <span className="edit-step__gutter-mark edit-step__gutter-mark--bullet" title="Bullet list">
                •
              </span>
            )}
            {line.hasImage && (
              <span className="edit-step__gutter-mark edit-step__gutter-mark--image" title="Sentence background">
                ▣
              </span>
            )}
            {line.alignLeft && (
              <span className="edit-step__gutter-mark edit-step__gutter-mark--layout" title="Align left">
                ◧
              </span>
            )}
            {line.emphasis && (
              <span className="edit-step__gutter-mark edit-step__gutter-mark--emphasis" title="Emphasis">
                E
              </span>
            )}
            {line.caption && (
              <span className="edit-step__gutter-mark edit-step__gutter-mark--caption" title="Caption">
                C
              </span>
            )}
            {line.large && (
              <span className="edit-step__gutter-mark edit-step__gutter-mark--large" title="Large type">
                L
              </span>
            )}
            {line.whisper && (
              <span className="edit-step__gutter-mark edit-step__gutter-mark--whisper" title="Whisper">
                W
              </span>
            )}
          </div>
        ))}
      </div>
      <div ref={measureRef} className="edit-step__line-measure" aria-hidden="true">
        {content}
      </div>
      <div className="unified-story-editor__mirror edit-step__content-mirror" aria-hidden="true">
        {mirrorParts.map((part, i) => {
          const classes = [
            part.headline && 'edit-step__content-headline',
            part.rotate && 'edit-step__content-rotate',
            part.bullet && 'edit-step__content-bullet',
            part.emphasis && 'edit-step__content-emphasis',
            part.caption && 'edit-step__content-caption',
            part.large && 'edit-step__content-large',
            part.whisper && 'edit-step__content-whisper',
            part.alignLeft && 'edit-step__content-align-left',
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
          requestAnimationFrame(() => remeasureGutter());
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
    </div>
    <TextContextMenu
      open={contextMenu.open}
      x={contextMenu.x}
      y={contextMenu.y}
      onClose={() => setContextMenu((m) => ({ ...m, open: false }))}
      items={contextMenuItems}
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
  onPresentStyleSpansChange,
  onSentenceImageChange,
  onSentenceImageLockChange,
  onBackgroundOpacityChange,
  onPresentStartChange,
  presentationAnimationRules,
  scrollToPresentSceneIndex,
  onPresentSceneScrollDone,
}) {
  const mainScrollRef = useRef(null);
  const [pickerAutoSearch, setPickerAutoSearch] = useState(false);
  const [manualPickerOpen, setManualPickerOpen] = useState(false);
  const [activeSentence, setActiveSentence] = useState(null);
  const [imageSearchOnLineClick, setImageSearchOnLineClick] = useState(
    () => getSettings().editImageSearchOnLineClick
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

  const handleOpacityChange = useCallback(
    (e) => {
      const v = parseFloat(e.target.value);
      setOpacity(v);
      onBackgroundOpacityChange?.(v);
    },
    [onBackgroundOpacityChange]
  );

  const isSentenceLocked = useCallback(
    (sectionId, sentenceIndex) => {
      const locks = sectionsData[sectionId]?.sentenceImageLocks;
      return Array.isArray(locks) && Boolean(locks[sentenceIndex]);
    },
    [sectionsData]
  );

  const activeSentenceImageUrl = activeSentence
    ? (sectionsData[activeSentence.sectionId]?.sentenceImages?.[activeSentence.sentenceIndex] || '')
    : '';
  const activeSentenceHasMedia = Boolean(String(activeSentenceImageUrl).trim());
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

  const shouldShowPicker =
    Boolean(activeSentence) &&
    !activeSentenceLocked &&
    !activeSentenceHasMedia &&
    (imageSearchOnLineClick || manualPickerOpen);

  const pickerOpen = shouldShowPicker;
  const pickerSentenceText = activeSentenceText.trim();
  const pickerInitialQuery = pickerSentenceText.slice(0, 60).trim();
  const pickerAutoSearchActive = imageSearchOnLineClick || pickerAutoSearch;

  const handlePickerSelect = useCallback(
    (url, credit) => {
      if (!activeSentence) return;
      onSentenceImageChange?.(activeSentence.sectionId, activeSentence.sentenceIndex, url, credit);
      setManualPickerOpen(false);
    },
    [activeSentence, onSentenceImageChange]
  );

  const handleOpenSentencePicker = useCallback(
    (sectionId, sentenceIndex, { autoSearch = false } = {}) => {
      if (isSentenceLocked(sectionId, sentenceIndex)) return;
      const url = String(sectionsData[sectionId]?.sentenceImages?.[sentenceIndex] ?? '').trim();
      if (url) return;
      setPickerAutoSearch(autoSearch);
      setManualPickerOpen(true);
    },
    [isSentenceLocked, sectionsData]
  );

  const handleLineClick = useCallback(
    (sectionId, sentenceIndex) => {
      if (isSentenceLocked(sectionId, sentenceIndex)) {
        setManualPickerOpen(false);
      }
    },
    [isSentenceLocked]
  );

  useEffect(() => {
    if (!imageSearchOnLineClick) {
      setManualPickerOpen(false);
    }
  }, [imageSearchOnLineClick]);

  useEffect(() => {
    if (activeSentenceHasMedia) {
      setManualPickerOpen(false);
    }
  }, [activeSentenceHasMedia]);

  const handleImageSearchOnLineClickChange = useCallback((e) => {
    const next = e.target.checked;
    setImageSearchOnLineClick(next);
    saveSettings({ ...getSettings(), editImageSearchOnLineClick: next });
  }, []);

  const handleSentenceImageSourceChange = useCallback((next) => {
    setSentenceImageSource(next);
    saveSettings({ ...getSettings(), editSentenceImageSource: next });
    setManualPickerOpen(false);
  }, []);

  const handleSketchInstructionsChange = useCallback((e) => {
    const next = e.target.value;
    setSketchInstructions(next);
    saveSettings({ ...getSettings(), editSketchGenerationInstructions: next });
  }, []);

  const handleRemoveActiveSentenceBackground = useCallback(() => {
    if (!activeSentence || activeSentenceLocked) return;
    onSentenceImageChange?.(activeSentence.sectionId, activeSentence.sentenceIndex, '');
    if (imageSearchOnLineClick) {
      setPickerAutoSearch(true);
    } else {
      setManualPickerOpen(false);
    }
  }, [activeSentence, activeSentenceLocked, onSentenceImageChange, imageSearchOnLineClick]);

  const previewRevealStep = useMemo(() => {
    if (!activeSentence) return 0;
    const scenes = buildPresentSceneList(sectionOrder, sectionsData);
    const scene = scenes.find(
      (s) =>
        s.sectionId === activeSentence.sectionId &&
        (s.sentenceIndices ?? []).includes(activeSentence.sentenceIndex)
    );
    if (!scene) return 0;
    const steps = scene.lineRevealStepCount ?? 1;
    return Math.max(0, steps - 1);
  }, [activeSentence, sectionOrder, sectionsData]);

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
      setManualPickerOpen(false);
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
    <EditViewErrorBoundary>
    <div className="edit-view">
      <div ref={mainScrollRef} className="edit-view__main">
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
          onPresentStyleSpansChange={onPresentStyleSpansChange}
          onSentencePositionChange={handleSentencePositionChange}
          onActiveSentenceChange={handleActiveSentenceChange}
          onLineClick={handleLineClick}
          scrollToPresentSceneIndex={scrollToPresentSceneIndex}
          onPresentSceneScrollDone={onPresentSceneScrollDone}
          mainScrollRef={mainScrollRef}
        />
      </div>
      <aside
        className={`edit-view__side${pickerOpen ? ' edit-view__side--picker-open' : ''}`}
        aria-label="Sentence background"
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
        <div className="edit-view__side-options">
          <fieldset className="edit-view__source-field">
            <legend className="edit-view__source-legend">Background source</legend>
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
          <label className="edit-view__side-option edit-view__side-option--auto-search">
            <input
              type="checkbox"
              checked={imageSearchOnLineClick}
              onChange={handleImageSearchOnLineClickChange}
            />
            <span>Auto search when selecting a sentence</span>
          </label>
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

        {activeSentence ? (
        <section className="edit-view__side-section edit-view__side-section--selected" aria-label="Selected background">
          <>
              <p className="edit-view__side-sentence">{activeSentenceText || 'This sentence'}</p>
              {activeSentenceHasMedia ? (
                <div className="edit-view__side-preview edit-view__side-preview--selected">
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
              ) : null}
              <label className="edit-view__side-option edit-view__side-option--lock">
                <input
                  type="checkbox"
                  checked={activeSentenceLocked}
                  onChange={handleToggleActiveSentenceLock}
                />
                <span>Lock background</span>
              </label>
              <div className="edit-view__side-actions">
                {!activeSentenceHasMedia && !imageSearchOnLineClick && !activeSentenceLocked && (
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
                {activeSentenceHasMedia && !activeSentenceLocked && (
                  <>
                    <button
                      type="button"
                      className="edit-view__side-btn edit-view__side-btn--secondary"
                      onClick={() => {
                        onSentenceImageChange?.(
                          activeSentence.sectionId,
                          activeSentence.sentenceIndex,
                          ''
                        );
                        setPickerAutoSearch(true);
                        setManualPickerOpen(true);
                      }}
                    >
                      {useImport ? 'Replace' : useAiSketch ? 'Regenerate' : 'Replace'}
                    </button>
                    <button
                      type="button"
                      className="edit-view__side-btn edit-view__side-btn--primary"
                      onClick={handleRemoveActiveSentenceBackground}
                    >
                      Remove background
                    </button>
                  </>
                )}
              </div>
            </>
        </section>
        ) : null}

        <section className="edit-view__side-section edit-view__side-section--preview" aria-label="Present preview">
          <h3 className="edit-view__side-heading">Present preview</h3>
          <EditViewErrorBoundary
            fallback={
              <p className="present-preview-panel__empty">Preview unavailable for this sentence.</p>
            }
          >
            <PresentPreviewPanel
              sectionOrder={sectionOrder}
              sectionsData={sectionsData}
              sectionId={activeSentence?.sectionId}
              sentenceIndex={activeSentence?.sentenceIndex}
              animationRules={presentationAnimationRules}
              revealStep={previewRevealStep}
            />
          </EditViewErrorBoundary>
        </section>

        <div className="edit-view__side-body">
        {pickerOpen ? (
          <div className="edit-view__side-picker">
            {useImport ? (
              <ImportImagePanel
                isOpen={true}
                compact
                sentenceText={pickerSentenceText}
                onClose={() => setManualPickerOpen(false)}
                onSelect={handlePickerSelect}
              />
            ) : useAiSketch ? (
              <SketchBackgroundPanel
                isOpen={true}
                compact
                sentenceText={pickerSentenceText}
                onClose={() => setManualPickerOpen(false)}
                onSelect={handlePickerSelect}
                autoGenerate={pickerAutoSearchActive}
                instructions={sketchInstructions}
              />
            ) : useStock ? (
              <StockMediaPicker
                key={`${activeSentence.sectionId}-${activeSentence.sentenceIndex}-${sentenceImageSource}`}
                stockSource={sentenceImageSource}
                isOpen={true}
                inline={true}
                onClose={() => setManualPickerOpen(false)}
                onSelect={handlePickerSelect}
                initialQuery={pickerInitialQuery}
                autoSearch={pickerAutoSearchActive}
                resultsCount={EDIT_STOCK_RESULTS_COUNT}
              />
            ) : null}
          </div>
        ) : null}
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
    </EditViewErrorBoundary>
  );
}
