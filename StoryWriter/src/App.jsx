import { useState, useCallback, useEffect, useRef } from 'react';
import { getSettings } from './utils/settings';
import { loadContent, saveContent } from './utils/persistence';
import { saveSettings } from './utils/settings';
import {
  getDefaultSectionOrder,
  createEmptySections,
  getSectionDefs,
  FRAMEWORKS,
} from './constants/frameworks';
import { getSentenceStarts } from './utils/sentences';
import { generateFullStory } from './services/openai';
import { searchUnsplashFirst } from './services/unsplash';
import SettingsModal from './components/SettingsModal';
import FontSettingsPopover from './components/FontSettingsPopover';
import RecordingOptionsPopover from './components/RecordingOptionsPopover';
import BackgroundAnimationPopover from './components/BackgroundAnimationPopover';
import SortableSectionList from './components/SortableSectionList';
import EditView from './components/EditView';
import PresentView from './components/PresentView';
import RambleRecorder from './components/RambleRecorder';
import './App.css';

const INPUT_PANEL_MIN = 280;
const INPUT_PANEL_MAX = 560;
const INPUT_PANEL_DEFAULT = 320;

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [persisted, setPersisted] = useState(() =>
    loadContent(getDefaultSectionOrder, createEmptySections)
  );
  const { storyAbout, frameworkId, sectionOrder, sectionsData, storyLength } = persisted;
  const sectionDefs = getSectionDefs(frameworkId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('write');
  const [presentStartIndex, setPresentStartIndex] = useState(0);
  const [inputPanelWidth, setInputPanelWidth] = useState(INPUT_PANEL_DEFAULT);
  const [writePanelVisible, setWritePanelVisible] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [magicImageLoading, setMagicImageLoading] = useState(false);
  const resizeStartRef = useRef({ x: 0, width: 0 });
  const persistedRef = useRef(persisted);
  persistedRef.current = persisted;

  useEffect(() => {
    saveContent(persisted);
  }, [persisted]);

  useEffect(() => {
    const flush = () => saveContent(persistedRef.current);
    const onBeforeUnload = flush;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e) => {
      const delta = e.clientX - resizeStartRef.current.x;
      setInputPanelWidth((w) => {
        const next = resizeStartRef.current.width + delta;
        return Math.min(INPUT_PANEL_MAX, Math.max(INPUT_PANEL_MIN, next));
      });
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

  const handleContentChange = useCallback((sectionId, value) => {
    setPersisted((prev) => ({
      ...prev,
      sectionsData: {
        ...prev.sectionsData,
        [sectionId]: { ...prev.sectionsData[sectionId], content: value },
      },
    }));
  }, []);

  const handleReorder = useCallback((newOrder) => {
    setPersisted((prev) => ({ ...prev, sectionOrder: newOrder }));
  }, []);

  const handleSentenceImageChange = useCallback((sectionId, sentenceIndex, url) => {
    setPersisted((prev) => {
      const section = prev.sectionsData[sectionId] ?? {};
      const arr = Array.isArray(section.sentenceImages) ? [...section.sentenceImages] : [];
      while (arr.length <= sentenceIndex) arr.push('');
      arr[sentenceIndex] = url || '';
      return {
        ...prev,
        sectionsData: {
          ...prev.sectionsData,
          [sectionId]: { ...section, sentenceImages: arr },
        },
      };
    });
  }, []);

  const handleBackgroundOpacityChange = useCallback((value) => {
    saveSettings({ ...getSettings(), presentationBackgroundOpacity: value });
  }, []);

  const handleMagicImages = useCallback(async () => {
    setMagicImageLoading(true);
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
          if (result?.url) {
            handleSentenceImageChange(sectionId, i, result.url);
          }
        }
      }
    } finally {
      setMagicImageLoading(false);
    }
  }, [sectionOrder, sectionsData, handleSentenceImageChange]);

  const handleGenerate = async () => {
    setError('');
    const apiKey = getSettings().openaiApiKey?.trim();
    if (!apiKey) {
      setError('Please set your OpenAI API key in Settings (top right).');
      setSettingsOpen(true);
      return;
    }
    if (!storyAbout.trim()) {
      setError('Please describe what the story is about.');
      return;
    }
    setIsGenerating(true);
    try {
      const generated = await generateFullStory(apiKey, {
        storyAbout: storyAbout.trim(),
        storyLength,
        sectionsData,
        sectionOrder,
        sectionDefs,
      });
      setPersisted((prev) => {
        const next = { ...prev.sectionsData };
        for (const [id, content] of Object.entries(generated)) {
          next[id] = { ...next[id], content };
        }
        return { ...prev, sectionsData: next };
      });
    } catch (err) {
      setError(err.message || 'Failed to generate story.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Story Writer</h1>

        <div className="view-switcher">
          <button
            type="button"
            className={`view-btn ${view === 'write' ? 'view-btn--active' : ''}`}
            onClick={() => setView('write')}
          >
            <svg className="view-btn__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Write</span>
          </button>
          <button
            type="button"
            className={`view-btn ${view === 'edit' ? 'view-btn--active' : ''}`}
            onClick={() => setView('edit')}
          >
            <svg className="view-btn__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>Edit</span>
          </button>
          <button
            type="button"
            className={`view-btn ${view === 'present' ? 'view-btn--active' : ''}`}
            onClick={() => setView('present')}
          >
            <svg className="view-btn__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Present</span>
          </button>
        </div>

        <div className="app-header-actions">
          {view === 'edit' && (
            <button
              type="button"
              className="app-settings-btn"
              onClick={handleMagicImages}
              disabled={magicImageLoading}
              title="Set images for all sentences that don't have one"
              aria-label="Set images for all sentences that don't have one"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 4V2" />
                <path d="M15 16v-2" />
                <path d="M12 3h-2" />
                <path d="M12 21h-2" />
                <path d="M3 12v-2" />
                <path d="M21 12v-2" />
                <path d="M4 5l2 2" />
                <path d="M18 19l2 2" />
                <path d="M4 19l2-2" />
                <path d="M18 5l2-2" />
                <path d="m12 8-4 4 4 4 4-4-4-4Z" />
              </svg>
            </button>
          )}
          <FontSettingsPopover onApply={() => setSettingsVersion((v) => v + 1)} />
          <BackgroundAnimationPopover onApply={() => setSettingsVersion((v) => v + 1)} />
          <RecordingOptionsPopover onApply={() => setSettingsVersion((v) => v + 1)} />
          <button
            type="button"
            className="app-settings-btn"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            aria-label="Open settings"
          >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          </button>
        </div>
      </header>

      {view === 'write' && (
      <main className="app-main">
        {!writePanelVisible && (
          <button
            type="button"
            className="write-panel-toggle write-panel-toggle--expand"
            onClick={() => setWritePanelVisible(true)}
            title="Show write panel"
            aria-label="Show write panel"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
        {writePanelVisible && (
          <>
        <aside
          className="input-panel"
          style={{ width: inputPanelWidth }}
        >
          <button
            type="button"
            className="write-panel-toggle"
            onClick={() => setWritePanelVisible(false)}
            title="Hide write panel"
            aria-label="Hide write panel"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <section className="story-about">
            <RambleRecorder
              onTranscription={(text) => setPersisted((prev) => ({ ...prev, storyAbout: prev.storyAbout ? prev.storyAbout + '\n\n' + text : text }))}
              onError={setError}
              disabled={isGenerating}
            />
            <label className="story-about__label" htmlFor="story-about">
              What is the story about?
            </label>
            <textarea
              id="story-about"
              className="story-about__input"
              placeholder="e.g. A creative director who overcomes anxiety and regains control of their career and wellbeing…"
              value={storyAbout}
              onChange={(e) => setPersisted((prev) => ({ ...prev, storyAbout: e.target.value }))}
              rows={16}
              disabled={isGenerating}
            />
          </section>

          <section className="sections-header">
            <p className="sections-header__desc">
              Below are the sections your story will contain. Write the story, then drag sections to reorder and edit the text as needed.
            </p>
            <label className="story-framework-label" htmlFor="story-framework">
              Story framework
            </label>
            <select
              id="story-framework"
              className="story-framework-select"
              value={frameworkId}
              onChange={(e) => {
                const newId = e.target.value;
                setPersisted((prev) => ({
                  ...prev,
                  frameworkId: newId,
                  sectionOrder: getDefaultSectionOrder(newId),
                  sectionsData: createEmptySections(newId),
                }));
              }}
              disabled={isGenerating}
            >
              {FRAMEWORKS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <label className="story-length-label" htmlFor="story-length">
              Story length
            </label>
            <select
              id="story-length"
              className="story-length-select"
              value={storyLength}
              onChange={(e) => setPersisted((prev) => ({ ...prev, storyLength: e.target.value }))}
              disabled={isGenerating}
            >
              <option value="micro">Micro</option>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
            <button
              type="button"
              className="btn-write"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'Writing…' : 'Write story'}
            </button>
          </section>

          {error && (
            <div className="app-error" role="alert">
              {error}
            </div>
          )}
        </aside>

        <div
          className="input-panel-resize"
          onMouseDown={(e) => {
            e.preventDefault();
            resizeStartRef.current = { x: e.clientX, width: inputPanelWidth };
            setIsResizing(true);
          }}
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={inputPanelWidth}
          aria-valuemin={INPUT_PANEL_MIN}
          aria-valuemax={INPUT_PANEL_MAX}
          title="Drag to resize panel"
        />
          </>
        )}

        <div className="sections-panel">
          <SortableSectionList
          sectionOrder={sectionOrder}
          sectionDefs={sectionDefs}
          sectionsData={sectionsData}
          onReorder={handleReorder}
          onContentChange={handleContentChange}
          isGenerating={isGenerating}
        />
        </div>
      </main>
      )}

      {view === 'edit' && (
        <main className="app-main app-main--single">
          <EditView
            sectionOrder={sectionOrder}
            sectionDefs={sectionDefs}
            sectionsData={sectionsData}
            onContentChange={handleContentChange}
            onSentenceImageChange={handleSentenceImageChange}
            onBackgroundOpacityChange={handleBackgroundOpacityChange}
            onPresentStartChange={setPresentStartIndex}
          />
        </main>
      )}

      {view === 'present' && (
        <PresentView
          sectionOrder={sectionOrder}
          sectionsData={sectionsData}
          onExit={() => setView('edit')}
          initialIndex={presentStartIndex}
        />
      )}

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
