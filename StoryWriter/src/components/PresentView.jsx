import { useState, useEffect, useMemo, useCallback } from 'react';
import './PresentView.css';

/** Split text into sentences (by . ! ? followed by space or end). */
function getSentences(text) {
  if (!text || !String(text).trim()) return [];
  const trimmed = String(text).trim();
  return trimmed
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function PresentView({ sectionOrder, sectionsData, onExit }) {
  const sentences = useMemo(() => {
    const parts = [];
    for (const sectionId of sectionOrder) {
      const content = sectionsData[sectionId]?.content ?? '';
      parts.push(content);
    }
    const fullText = parts.join('\n\n').replace(/\n+/g, ' ');
    return getSentences(fullText);
  }, [sectionOrder, sectionsData]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayBgUrl, setDisplayBgUrl] = useState('');
  const [bgLayerOpacity, setBgLayerOpacity] = useState(0);
  const fadeRef = useRef(null);

  const currentSectionId = sentencesWithSection[currentIndex]?.sectionId;
  const currentSectionBgUrl = currentSectionId
    ? (sectionsData[currentSectionId]?.backgroundImageUrl || '')
    : '';

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

  useEffect(() => {
    setCurrentIndex(0);
  }, [sentences.length]);

  if (sentences.length === 0) {
    return (
      <div className="present-view present-view--fullscreen" style={{ fontFamily }}>
        <div className="present-view__inner">
          <p className="present-view__empty">No content yet. Generate or refine your story first.</p>
          <p className="present-view__hint">Press Esc to go back.</p>
        </div>
      </div>
    );
  }

  const sentence = sentences[currentIndex];

  return (
    <div className="present-view present-view--fullscreen" style={{ fontFamily }}>
      {displayBgUrl && (
        <div
          className="present-view__bg"
          style={{
            backgroundImage: `url(${displayBgUrl})`,
            opacity: bgLayerOpacity,
          }}
          aria-hidden="true"
        />
      )}
      <div className="present-view__inner">
        <div
          key={currentIndex}
          className="present-view__sentence"
          style={{ fontSize }}
        >
          {sentence}
        </div>
      </div>
    </div>
  );
}
