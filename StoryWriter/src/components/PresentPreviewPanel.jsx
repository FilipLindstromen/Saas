import { useMemo } from 'react';
import { getSettings } from '../utils/settings';
import { buildPresentSceneList } from '../utils/sentences';
import { buildLineRevealRowsSimple } from '../utils/lineReveal';
import {
  stripPresentImagePlaceholderLines,
  processPresentRevealRows,
  isPresentImageOnlyScene,
} from '../utils/presentImagePlaceholder';
import { normalizePresentationAnimationRules, resolveAnimationForSentence } from '../utils/textAnimations';
import PresentSentence from './PresentSentence';
import PresentRotateLines from './PresentRotateLines';
import './PresentPreviewPanel.css';

const FONT_SIZE_MAP = {
  small: '0.72rem',
  medium: '0.82rem',
  large: '0.95rem',
};

export default function PresentPreviewPanel({
  sectionOrder,
  sectionsData,
  sectionId,
  sentenceIndex,
  animationRules,
  revealStep = 0,
}) {
  const settings = getSettings();
  const fontFamily = `'${settings.presentationFont || 'Poppins'}', sans-serif`;
  const fontSize = FONT_SIZE_MAP[settings.presentationFontSize] ?? FONT_SIZE_MAP.medium;
  const lineHeight = settings.presentationLineHeight || '1.4';
  const rules = useMemo(
    () => normalizePresentationAnimationRules(animationRules),
    [animationRules]
  );

  const scene = useMemo(() => {
    if (!sectionId || sentenceIndex == null) return null;
    const scenes = buildPresentSceneList(sectionOrder, sectionsData);
    const global = scenes.findIndex(
      (s) => s.sectionId === sectionId && (s.sentenceIndices ?? []).includes(sentenceIndex)
    );
    if (global >= 0) return { ...scenes[global], globalIndex: global };
    const fallback = scenes.find((s) => s.sectionId === sectionId);
    return fallback ? { ...fallback, globalIndex: scenes.indexOf(fallback) } : null;
  }, [sectionOrder, sectionsData, sectionId, sentenceIndex]);

  if (!scene) {
    return (
      <div className="present-preview-panel">
        <p className="present-preview-panel__empty">Click a sentence to preview Present styling.</p>
      </div>
    );
  }

  const animation = resolveAnimationForSentence(scene.text, rules);
  const displayText = stripPresentImagePlaceholderLines(scene.text);
  const useLineReveal = (scene.rotateSpans?.length ?? 0) > 0 || (scene.bulletSpans?.length ?? 0) > 0;
  const rowsRaw = useLineReveal
    ? buildLineRevealRowsSimple(scene.text, scene.rotateSpans ?? [], scene.bulletSpans ?? [], revealStep)
    : null;
  const { rows, stepImageOnly } = processPresentRevealRows(rowsRaw);
  const showLineReveal = useLineReveal && (rows?.length ?? 0) > 0;
  const sceneImageOnly = isPresentImageOnlyScene(scene.text, { rows });
  const imageOnlyPreview = Boolean(String(scene.imageUrl ?? '').trim()) && (sceneImageOnly || stepImageOnly);
  const hasBullets = (scene.bulletSpans?.length ?? 0) > 0;
  const hasRotate = (scene.rotateSpans?.length ?? 0) > 0;
  const layout = scene.layout ?? 'center';
  const hasDarkText = Boolean(scene.darkText);

  return (
    <div className="present-preview-panel" aria-label="Present preview">
      <div
        className={[
          'present-preview-panel__stage',
          layout === 'left' && 'present-preview-panel__stage--left',
          hasBullets && 'present-preview-panel__stage--bullets',
          hasRotate && 'present-preview-panel__stage--text-rotate',
          hasDarkText && 'present-preview-panel__stage--dark-text',
          imageOnlyPreview && 'present-preview-panel__stage--image-only',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ fontFamily, fontSize, lineHeight }}
      >
        {showLineReveal ? (
          <PresentRotateLines
            rows={rows}
            styledParts={scene.styledParts}
            fontSize={fontSize}
            lineHeight={lineHeight}
            animKey={0}
            phase="idle"
            animation={animation}
            rules={rules}
          />
        ) : displayText.trim() ? (
          <PresentSentence
            text={displayText}
            styledParts={scene.styledParts}
            animation={animation}
            phase="idle"
            rules={rules}
            style={{ fontSize, lineHeight }}
          />
        ) : imageOnlyPreview ? (
          <p className="present-preview-panel__image-only-hint" aria-hidden="true">
            Background image
          </p>
        ) : null}      </div>
    </div>
  );
}
