import { useState, useCallback, useEffect, useRef } from 'react';
import { getSettings } from './utils/settings';
import { getDefaultSectionOrder, createEmptySections, SECTION_DEFINITIONS } from './constants/sections';
import { generateFullStory } from './services/openai';
import SettingsModal from './components/SettingsModal';
import SortableSectionList from './components/SortableSectionList';
import './App.css';

const INPUT_PANEL_MIN = 280;
const INPUT_PANEL_MAX = 560;
const INPUT_PANEL_DEFAULT = 320;

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storyAbout, setStoryAbout] = useState('');
  const [sectionOrder, setSectionOrder] = useState(getDefaultSectionOrder);
  const [sectionsData, setSectionsData] = useState(createEmptySections);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [inputPanelWidth, setInputPanelWidth] = useState(INPUT_PANEL_DEFAULT);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef({ x: 0, width: 0 });

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
    setSectionsData((prev) => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], content: value },
    }));
  }, []);

  const handleReorder = useCallback((newOrder) => {
    setSectionOrder(newOrder);
  }, []);

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
        sectionsData,
        sectionOrder,
        sectionDefs: SECTION_DEFINITIONS,
      });
      setSectionsData((prev) => {
        const next = { ...prev };
        for (const [id, content] of Object.entries(generated)) {
          next[id] = { ...next[id], content };
        }
        return next;
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
      </header>

      <main className="app-main">
        <aside
          className="input-panel"
          style={{ width: inputPanelWidth }}
        >
          <section className="story-about">
            <label className="story-about__label" htmlFor="story-about">
              What is the story about?
            </label>
            <textarea
              id="story-about"
              className="story-about__input"
              placeholder="e.g. A creative director who overcomes anxiety and regains control of their career and wellbeing…"
              value={storyAbout}
              onChange={(e) => setStoryAbout(e.target.value)}
              rows={8}
              disabled={isGenerating}
            />
          </section>

          <section className="sections-header">
            <p className="sections-header__desc">
              Below are the sections your story will contain. Generate the story, then drag sections to reorder and edit the text as needed.
            </p>
            <button
              type="button"
              className="btn-generate"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating…' : 'Generate story'}
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

        <div className="sections-panel">
          <SortableSectionList
          sectionOrder={sectionOrder}
          sectionsData={sectionsData}
          onReorder={handleReorder}
          onContentChange={handleContentChange}
          isGenerating={isGenerating}
        />
        </div>
      </main>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;
