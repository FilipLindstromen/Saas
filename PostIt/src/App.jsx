import { useState, useCallback, useEffect, useRef } from 'react';
import { Board } from './components/Board';
import { loadState, saveState } from './utils/persistence';
import { createHistory } from './utils/undoRedo';
import { GOOGLE_FONTS, POSTIT_COLORS, POSTIT_WIDTH, POSTIT_MIN_HEIGHT, OPENAI_API_KEY_STORAGE } from './constants';
import { TEMPLATES } from './templates';
import { suggestIconForNote } from './services/openai';
import ProjectSelector from '@shared/ProjectSelector/ProjectSelector';
import ThemeToggle from '@shared/ThemeToggle';
import { getTheme, setTheme, initThemeSync } from '@shared/theme';
import './App.css';

const defaultPage = () => ({
  id: `page-${Date.now()}`,
  name: 'Page 1',
  notes: [],
  comments: [],
  arrows: [],
});

const defaultState = {
  theme: 'light',
  fontFamily: GOOGLE_FONTS[0].family,
  snapMode: false,
  connectMode: false,
  pages: [defaultPage()],
  currentPageId: null,
};

function getInitialState() {
  const saved = loadState();
  const theme = getTheme();
  if (saved?.pages?.length) {
    saved.currentPageId = saved.currentPageId ?? saved.pages[0].id;
    saved.theme = theme;
    return saved;
  }
  const state = { ...defaultState, theme, pages: [defaultPage()] };
  state.currentPageId = state.pages[0].id;
  return state;
}

function applyTemplate(templateId) {
  const t = TEMPLATES.find((x) => x.id === templateId);
  if (!t) return defaultPage();
  const data = t.getData();
  return {
    id: `page-${Date.now()}`,
    name: t.name,
    notes: data.notes,
    comments: data.comments,
    arrows: data.arrows,
  };
}

export default function App() {
  const [state, setState] = useState(getInitialState);
  const [selected, setSelected] = useState({ id: null, type: null });
  const [connectSource, setConnectSource] = useState(null);
  const historyRef = useRef(createHistory(getInitialState()));
  const [, setHistoryVersion] = useState(0);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [pagesMenuOpen, setPagesMenuOpen] = useState(false);
  const [autoIconsLoading, setAutoIconsLoading] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem(OPENAI_API_KEY_STORAGE) || '');

  const currentPage = state.pages.find((p) => p.id === state.currentPageId) || state.pages[0];
  const openaiApiKey = apiKeyInput || (typeof localStorage !== 'undefined' ? localStorage.getItem(OPENAI_API_KEY_STORAGE) : null);

  const setStateAndSave = useCallback((next, opts) => {
    setState((prev) => {
      const nextState = typeof next === 'function' ? next(prev) : next;
      if (opts?.pushHistory) historyRef.current.push(nextState);
      if (opts?.pushHistory) setHistoryVersion((v) => v + 1);
      setTimeout(() => saveState(nextState), 0);
      return nextState;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  useEffect(() => {
    const unsub = initThemeSync();
    const handler = () => setStateAndSave((prev) => ({ ...prev, theme: getTheme() }));
    window.addEventListener('saas-theme-change', handler);
    return () => {
      unsub?.();
      window.removeEventListener('saas-theme-change', handler);
    };
  }, [setStateAndSave]);

  const updatePage = useCallback(
    (updater, opts) => {
      setStateAndSave((prev) => {
        const draft = JSON.parse(JSON.stringify(prev));
        const page = draft.pages.find((p) => p.id === draft.currentPageId);
        if (!page) return prev;
        updater(page);
        return draft;
      }, opts);
    },
    [setStateAndSave]
  );

  const undo = useCallback(() => {
    const prev = historyRef.current.undo();
    if (prev) {
      setState(prev);
      setTimeout(() => saveState(prev), 0);
      setHistoryVersion((v) => v + 1);
    }
  }, []);

  const redo = useCallback(() => {
    const next = historyRef.current.redo();
    if (next) {
      setState(next);
      setTimeout(() => saveState(next), 0);
      setHistoryVersion((v) => v + 1);
    }
  }, []);

  const genId = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const handleSelect = useCallback((idOrSource, type) => {
    if (type === 'connect' && idOrSource && typeof idOrSource === 'object') {
      const side = idOrSource.side ?? 'bottom';
      if (connectSource && (connectSource.id !== idOrSource.id || connectSource.type !== idOrSource.type)) {
        updatePage((draft) => {
          draft.arrows.push({
            id: genId(),
            fromId: connectSource.id,
            toId: idOrSource.id,
            fromType: connectSource.type,
            toType: idOrSource.type,
            fromSide: connectSource.side ?? 'bottom',
            toSide: side,
          });
        }, { pushHistory: true });
        setConnectSource(null);
      } else {
        setConnectSource({ ...idOrSource, side });
      }
      setSelected({ id: null, type: null });
      return;
    }
    setConnectSource(null);
    setSelected({ id: idOrSource ?? null, type: type ?? null });
  }, [connectSource, updatePage]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selected.id || !selected.type) return;
        e.preventDefault();
        updatePage((draft) => {
          if (selected.type === 'note') draft.notes = draft.notes.filter((n) => n.id !== selected.id);
          else if (selected.type === 'comment') draft.comments = draft.comments.filter((c) => c.id !== selected.id);
          draft.arrows = draft.arrows.filter((a) => a.fromId !== selected.id && a.toId !== selected.id);
        }, { pushHistory: true });
        setSelected({ id: null, type: null });
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        }
        if (e.key === 'y') {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, updatePage, undo, redo]);

  const addPage = () => {
    const page = defaultPage();
    page.name = `Page ${state.pages.length + 1}`;
    setStateAndSave((prev) => ({
      ...prev,
      pages: [...prev.pages, page],
      currentPageId: page.id,
    }));
    setPagesMenuOpen(false);
  };

  const applyTemplateToNewPage = (templateId) => {
    const page = applyTemplate(templateId);
    setStateAndSave((prev) => ({
      ...prev,
      pages: [...prev.pages, page],
      currentPageId: page.id,
    }));
    setTemplateMenuOpen(false);
    setPagesMenuOpen(false);
  };

  const switchPage = (pageId) => {
    setStateAndSave((prev) => ({ ...prev, currentPageId: pageId }));
    setPagesMenuOpen(false);
  };

  const addNoteFromHeader = () => {
    updatePage((draft) => {
      draft.notes.push({
        id: genId(),
        x: 120,
        y: 120,
        width: POSTIT_WIDTH,
        height: POSTIT_MIN_HEIGHT,
        text: 'New note',
        colorIndex: Math.floor(Math.random() * POSTIT_COLORS.length),
      });
    }, { pushHistory: true });
  };

  const addComment = () => {
    updatePage((draft) => {
      draft.comments.push({
        id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        x: 100,
        y: 100,
        text: 'New comment',
      });
    }, { pushHistory: true });
  };

  const toggleConnect = () => {
    setStateAndSave((prev) => ({ ...prev, connectMode: !prev.connectMode }));
    if (state.connectMode) setConnectSource(null);
  };

  const runAutoIcons = useCallback(async () => {
    const key = (typeof localStorage !== 'undefined' ? localStorage.getItem(OPENAI_API_KEY_STORAGE) : null) || apiKeyInput;
    if (!key?.trim()) {
      setApiKeyModalOpen(true);
      return;
    }
    if (typeof localStorage !== 'undefined') localStorage.setItem(OPENAI_API_KEY_STORAGE, key.trim());
    setAutoIconsLoading(true);
    try {
      const notes = currentPage.notes;
      const updates = await Promise.all(
        notes.map(async (note) => {
          const iconId = await suggestIconForNote(note.text, key);
          return { id: note.id, icon: iconId };
        })
      );
      updatePage((draft) => {
        updates.forEach(({ id, icon }) => {
          const n = draft.notes.find((x) => x.id === id);
          if (n) n.icon = icon;
        });
      }, { pushHistory: true });
    } finally {
      setAutoIconsLoading(false);
    }
  }, [currentPage.notes, apiKeyInput, updatePage]);

  const saveApiKeyAndRun = () => {
    if (apiKeyInput?.trim()) {
      localStorage.setItem(OPENAI_API_KEY_STORAGE, apiKeyInput.trim());
      setApiKeyModalOpen(false);
      runAutoIcons();
    }
  };

  return (
    <div className={`app app--${state.theme}`} style={{ fontFamily: state.fontFamily }}>
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-logo">PostIt</span>
          <ProjectSelector
            projects={[{ id: 'default', name: 'Untitled' }]}
            currentProjectId="default"
            currentProjectName="Untitled"
          />
          <button
            type="button"
            className="app-btn app-btn-pages"
            onClick={() => setPagesMenuOpen((o) => !o)}
            title="Pages"
          >
            {currentPage?.name ?? 'Pages'} ▾
          </button>
          {pagesMenuOpen && (
            <div className="app-dropdown app-dropdown-pages">
              {state.pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`app-dropdown-item ${p.id === state.currentPageId ? 'active' : ''}`}
                  onClick={() => switchPage(p.id)}
                >
                  {p.name}
                </button>
              ))}
              <button type="button" className="app-dropdown-item" onClick={addPage}>
                + New page
              </button>
            </div>
          )}
          <button
            type="button"
            className="app-btn"
            onClick={() => setTemplateMenuOpen((o) => !o)}
            title="Templates"
          >
            Templates ▾
          </button>
          {templateMenuOpen && (
            <div className="app-dropdown app-dropdown-templates">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="app-dropdown-item"
                  onClick={() => applyTemplateToNewPage(t.id)}
                >
                  <strong>{t.name}</strong>
                  <span className="app-dropdown-desc">{t.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="app-header-right">
          <button
            type="button"
            className={`app-btn ${state.snapMode ? 'active' : ''}`}
            onClick={() => setStateAndSave((prev) => ({ ...prev, snapMode: !prev.snapMode }))}
            title="Snap to grid"
          >
            Snap
          </button>
          <button
            type="button"
            className={`app-btn ${state.connectMode ? 'active' : ''}`}
            onClick={toggleConnect}
            title="Draw arrows between items"
          >
            Connect
          </button>
          <button type="button" className="app-btn" onClick={addComment} title="Add comment">
            Comment
          </button>
          <button
            type="button"
            className="app-btn"
            onClick={runAutoIcons}
            disabled={autoIconsLoading || !currentPage.notes.length}
            title="Use OpenAI to pick icons for all notes on this page"
          >
            {autoIconsLoading ? '…' : 'Auto icons'}
          </button>
          <button
            type="button"
            className="app-btn"
            onClick={undo}
            disabled={!historyRef.current.canUndo()}
            title="Undo"
          >
            Undo
          </button>
          <button
            type="button"
            className="app-btn"
            onClick={redo}
            disabled={!historyRef.current.canRedo()}
            title="Redo"
          >
            Redo
          </button>
          <button
            type="button"
            className="app-btn app-btn-cta"
            onClick={addNoteFromHeader}
            title="Add a new note"
          >
            New note
          </button>
          <button
            type="button"
            className="app-btn"
            onClick={() => setFontMenuOpen((o) => !o)}
            title="Font"
          >
            Font ▾
          </button>
          {fontMenuOpen && (
            <div className="app-dropdown app-dropdown-fonts">
              {GOOGLE_FONTS.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  className="app-dropdown-item"
                  style={{ fontFamily: f.family }}
                  onClick={() => {
                    setStateAndSave((prev) => ({ ...prev, fontFamily: f.family }));
                    setFontMenuOpen(false);
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
          <ThemeToggle
            theme={state.theme}
            onToggle={(next) => { setTheme(next); setStateAndSave((prev) => ({ ...prev, theme: next })); }}
            className="app-btn app-btn-theme"
          />
        </div>
      </header>
      <Board
        notes={currentPage.notes}
        comments={currentPage.comments}
        arrows={currentPage.arrows}
        theme={state.theme}
        fontFamily={state.fontFamily}
        snapMode={state.snapMode}
        selectedId={selected.type === 'connect' ? null : selected.id}
        selectedType={selected.type === 'connect' ? null : selected.type}
        connectMode={state.connectMode}
        connectSource={connectSource}
        onUpdatePage={updatePage}
        onSelect={handleSelect}
      />
      {state.connectMode && connectSource && (
        <div className="app-connect-hint">Click another note or comment to connect</div>
      )}
      {apiKeyModalOpen && (
        <div className="app-modal-overlay" onClick={() => setApiKeyModalOpen(false)}>
          <div className="app-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="app-modal-title">OpenAI API key</h3>
            <p className="app-modal-desc">Auto icons uses OpenAI to suggest an icon for each note. Enter your API key (stored only in this browser).</p>
            <input
              type="password"
              className="app-modal-input"
              placeholder="sk-..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveApiKeyAndRun()}
            />
            <div className="app-modal-actions">
              <button type="button" className="app-btn" onClick={() => setApiKeyModalOpen(false)}>Cancel</button>
              <button type="button" className="app-btn app-btn-cta" onClick={saveApiKeyAndRun} disabled={!apiKeyInput?.trim()}>
                Save & run Auto icons
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
