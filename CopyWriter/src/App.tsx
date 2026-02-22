import { useState, useEffect, useCallback } from 'react';
import ThemeToggle from '@shared/ThemeToggle';
import {
  FileText,
  Settings,
  FileEdit,
  Plus,
  Sparkles,
  ClipboardList,
  Lightbulb,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Target,
  Edit3,
  Eye,
  RotateCcw,
  Zap,
  FileCheck,
} from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';
import ProjectSelector from '@shared/ProjectSelector/ProjectSelector';
import { DEFAULT_INSTRUCTIONS } from './constants';
import {
  getApiKey,
  setApiKey,
  getInstructions,
  setInstructions,
  getProjects,
  setProjects,
  getActiveProjectId,
  setActiveProjectId,
  getActiveDocId,
  setActiveDocId,
  type ProjectData,
  type DocumentData,
} from './storage';
import { getTheme, setTheme, initThemeSync } from '@shared/theme';
import { generateWithOpenAI } from './api';
import './App.css';

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

function createDoc(name?: string): DocumentData {
  return {
    id: generateId(),
    name: name ?? `Document ${Date.now()}`,
    copyPurpose: '',
    targetAudience: '',
    originalText: '',
    generatedText: '',
    improvedCopy: '',
    questions: '',
    answers: '',
    conversationHistory: [],
    suggestions: '',
    audienceAnalysis: '',
  };
}

function createProject(name?: string): ProjectData {
  const doc = createDoc('Untitled');
  return {
    id: generateId(),
    name: name ?? 'New Project',
    documents: [doc],
  };
}

export default function App() {
  const [projects, setProjectsState] = useState<ProjectData[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [activeDocId, setActiveDocIdState] = useState<string | null>(null);
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => getTheme());
  const [showSettings, setShowSettings] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [instructionsInput, setInstructionsInput] = useState('');

  // Load from storage
  useEffect(() => {
    const stored = getProjects();
    if (stored.length === 0) {
      const proj = createProject('My First Project');
      setProjectsState([proj]);
      setActiveProjectIdState(proj.id);
      setActiveDocIdState(proj.documents[0].id);
      setProjects([proj]);
      setActiveProjectId(proj.id);
      setActiveDocId(proj.documents[0].id);
    } else {
      const migrated = stored.map((p) => ({
        ...p,
        documents: p.documents.map((d) => ({
          ...d,
          copyPurpose: (d as DocumentData).copyPurpose ?? '',
          targetAudience: (d as DocumentData).targetAudience ?? '',
          improvedCopy: (d as DocumentData).improvedCopy ?? '',
          audienceAnalysis: (d as DocumentData).audienceAnalysis ?? '',
        })),
      }));
      setProjectsState(migrated);
      setProjects(migrated);
      const activeProj = getActiveProjectId();
      const activeDoc = getActiveDocId();
      setActiveProjectIdState(activeProj ?? migrated[0]?.id ?? null);
      setActiveDocIdState(activeDoc ?? migrated[0]?.documents[0]?.id ?? null);
    }
    setThemeState(getTheme());
    setApiKeyInput(getApiKey());
    setInstructionsInput(getInstructions() || DEFAULT_INSTRUCTIONS);
  }, []);

  useEffect(() => {
    const unsub = initThemeSync();
    const handler = () => setThemeState(getTheme());
    window.addEventListener('saas-theme-change', handler);
    return () => {
      unsub?.();
      window.removeEventListener('saas-theme-change', handler);
    };
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeDoc = activeProject?.documents.find((d) => d.id === activeDocId);

  const updateDoc = useCallback(
    (updates: Partial<DocumentData>) => {
      if (!activeProject || !activeDoc) return;
      setProjectsState((prev) =>
        prev.map((p) =>
          p.id === activeProject.id
            ? {
                ...p,
                documents: p.documents.map((d) =>
                  d.id === activeDoc.id ? { ...d, ...updates } : d
                ),
              }
            : p
        )
      );
    },
    [activeProject, activeDoc]
  );

  const persistProjects = useCallback(() => {
    setProjects(projects);
    if (activeProjectId) setActiveProjectId(activeProjectId);
    if (activeDocId) setActiveDocId(activeDocId);
  }, [projects, activeProjectId, activeDocId]);

  useEffect(() => {
    if (projects.length > 0) persistProjects();
  }, [projects, persistProjects]);

  const addTab = () => {
    if (!activeProject) return;
    const doc = createDoc(`Document ${activeProject.documents.length + 1}`);
    setProjectsState((prev) =>
      prev.map((p) =>
        p.id === activeProject.id
          ? { ...p, documents: [...p.documents, doc] }
          : p
      )
    );
    setActiveDocIdState(doc.id);
    setActiveDocId(doc.id);
  };

  const switchTab = (docId: string) => {
    setActiveDocIdState(docId);
    setActiveDocId(docId);
  };

  const closeTab = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (!activeProject) return;
    const docs = activeProject.documents.filter((d) => d.id !== docId);
    if (docs.length === 0) return;
    const newActive = activeDocId === docId
      ? docs[0].id
      : activeDocId;
    setProjectsState((prev) =>
      prev.map((p) =>
        p.id === activeProject.id ? { ...p, documents: docs } : p
      )
    );
    setActiveDocIdState(newActive);
    setActiveDocId(newActive);
  };

  const saveSettings = () => {
    setApiKey(apiKeyInput);
    setShowSettings(false);
  };

  const saveInstructions = () => {
    setInstructions(instructionsInput);
    setShowInstructions(false);
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="headerLeft">
          <div className="logo">
            <FileText size={24} strokeWidth={2} />
            CopyWriter
          </div>
          <ProjectSelector
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            currentProjectId={activeProjectId ?? ''}
            currentProjectName={activeProject?.name ?? 'Untitled'}
            onSwitchProject={(id) => {
              setActiveProjectIdState(id);
              setActiveProjectId(id);
              const proj = projects.find((p) => p.id === id);
              if (proj?.documents[0]) {
                setActiveDocIdState(proj.documents[0].id);
                setActiveDocId(proj.documents[0].id);
              }
            }}
            onCreateProject={() => {
              const proj = createProject('New Project');
              setProjectsState((prev) => [...prev, proj]);
              setActiveProjectIdState(proj.id);
              setActiveDocIdState(proj.documents[0].id);
              setActiveProjectId(proj.id);
              setActiveDocId(proj.documents[0].id);
            }}
            onRenameProject={(id, name) => {
              setProjectsState((prev) =>
                prev.map((p) => (p.id === id ? { ...p, name } : p))
              );
            }}
            onDeleteProject={(id) => {
              if (projects.length <= 1) return;
              const idx = projects.findIndex((p) => p.id === id);
              const nextId = idx > 0 ? projects[idx - 1].id : projects[idx + 1]?.id;
              setProjectsState((prev) => prev.filter((p) => p.id !== id));
              if (id === activeProjectId && nextId) {
                setActiveProjectIdState(nextId);
                setActiveProjectId(nextId);
                const proj = projects.find((p) => p.id === nextId);
                if (proj?.documents[0]) {
                  setActiveDocIdState(proj.documents[0].id);
                  setActiveDocId(proj.documents[0].id);
                }
              }
            }}
          />
        </div>
        <div className="headerRight">
          <button
            className="iconBtn"
            onClick={() => setShowInstructions(true)}
            title="Instructions"
          >
            <FileEdit size={20} />
          </button>
          <button
            className="iconBtn"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings size={20} />
          </button>
          <ThemeToggle theme={theme} onToggle={(t) => { setTheme(t); setThemeState(t); }} className="iconBtn themeBtn" />
        </div>
      </header>

      <div className="tabs">
        {activeProject?.documents.map((doc) => (
          <button
            key={doc.id}
            className={`tab ${doc.id === activeDocId ? 'tabActive' : ''}`}
            onClick={() => switchTab(doc.id)}
          >
            <FileText size={16} />
            {doc.name}
            <button
              className="iconBtn"
              style={{ width: 24, height: 24, padding: 0 }}
              onClick={(e) => closeTab(e, doc.id)}
              title="Close"
            >
              <X size={14} />
            </button>
          </button>
        ))}
        <button className="addTab" onClick={addTab} title="New document">
          <Plus size={20} />
        </button>
      </div>

      <div className="workArea">
        <div className="panel">
          <div className="panelHeader">
            <Sparkles size={18} />
            Generate Copy
          </div>
          <div className="panelContent">
            {activeDoc && (
              <GeneratePanel
                doc={activeDoc}
                onUpdate={updateDoc}
                onCopyToOriginal={(text) => updateDoc({ originalText: text })}
                apiKey={getApiKey()}
                instructions={getInstructions() || DEFAULT_INSTRUCTIONS}
              />
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panelHeader">
            <ClipboardList size={18} />
            Original Text
          </div>
          <div className="panelContent">
            {activeDoc && (
              <OriginalPanel
                value={activeDoc.originalText}
                onChange={(v) => updateDoc({ originalText: v })}
              />
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panelHeader">
            <FileCheck size={18} />
            Improved Copy
          </div>
          <div className="panelContent">
            {activeDoc && (
              <ImprovedCopyPanel
                value={activeDoc.improvedCopy ?? ''}
                onChange={(v) => updateDoc({ improvedCopy: v })}
              />
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panelHeader">
            <Lightbulb size={18} />
            Suggestions & Feedback
          </div>
          <div className="panelContent">
            {activeDoc && (
              <SuggestionsPanel
                originalText={activeDoc.originalText}
                copyPurpose={activeDoc.copyPurpose ?? ''}
                targetAudience={activeDoc.targetAudience ?? ''}
                audienceAnalysis={activeDoc.audienceAnalysis ?? ''}
                onAnalysisChange={(v) => updateDoc({ audienceAnalysis: v })}
                onImprovedChange={(v) => updateDoc({ improvedCopy: v })}
                apiKey={getApiKey()}
              />
            )}
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="modalOverlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <span className="modalTitle">Settings</span>
              <button className="iconBtn" onClick={() => setShowSettings(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modalBody">
              <div className="formGroup">
                <label className="label">OpenAI API Key</label>
                <input
                  type="password"
                  className="input"
                  placeholder="sk-..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
              </div>
            </div>
            <div className="modalFooter">
              <button className="btn btnSecondary" onClick={() => setShowSettings(false)}>
                Cancel
              </button>
              <button className="btn btnPrimary" onClick={saveSettings}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="modalOverlay" onClick={() => setShowInstructions(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modalHeader">
              <span className="modalTitle">Project Instructions</span>
              <button className="iconBtn" onClick={() => setShowInstructions(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modalBody">
              <div className="formGroup">
                <label className="label">Custom instructions for AI copy generation</label>
                <textarea
                  className="textarea"
                  style={{ minHeight: 400 }}
                  value={instructionsInput}
                  onChange={(e) => setInstructionsInput(e.target.value)}
                  placeholder="Enter your instructions..."
                />
              </div>
            </div>
            <div className="modalFooter">
              <button className="btn btnSecondary" onClick={() => setInstructionsInput(DEFAULT_INSTRUCTIONS)}>
                Reset to Default
              </button>
              <button className="btn btnPrimary" onClick={saveInstructions}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GeneratePanel({
  doc,
  onUpdate,
  onCopyToOriginal,
  apiKey,
  instructions,
}: {
  doc: DocumentData;
  onUpdate: (u: Partial<DocumentData>) => void;
  onCopyToOriginal: (text: string) => void;
  apiKey: string;
  instructions: string;
}) {
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const pages = doc.conversationHistory
    .filter((m) => m.role === 'assistant')
    .map((m) => m.content);
  const currentContent = pages[currentPage] ?? null;
  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < pages.length - 1;

  const messages = [
    { role: 'system' as const, content: instructions },
    ...doc.conversationHistory,
  ];

  const handleStart = async () => {
    if (!apiKey) {
      setError('Please add your OpenAI API key in Settings.');
      return;
    }
    setError(null);
    setLoading(true);
    const copyPurposeContext = doc.copyPurpose?.trim()
      ? `\n\nThe copy will be used for: ${doc.copyPurpose.trim()}. Tailor your questions and output accordingly.`
      : '';
    const targetAudienceContext = doc.targetAudience?.trim()
      ? `\n\nThe initial target audience is: ${doc.targetAudience.trim()}.`
      : '';
    const audienceNarrowingInstruction = `\n\nDuring the questions, when relevant, give suggestions on how to narrow or refine the target audience for this specific offer. Help them define a more specific, qualified audience if it would improve the copy.`;
    const startMessage = `Begin by asking the Step 1 questions.${copyPurposeContext}${targetAudienceContext}${audienceNarrowingInstruction}`;
    try {
      let fullResponse = '';
      await generateWithOpenAI(
        apiKey,
        messages.length > 1 ? messages : [...messages, { role: 'user' as const, content: startMessage }],
        (chunk) => {
          fullResponse += chunk;
          onUpdate({
            conversationHistory: [{ role: 'assistant' as const, content: fullResponse }],
            generatedText: fullResponse,
          });
        }
      );
      onUpdate({
        conversationHistory: [{ role: 'assistant' as const, content: fullResponse }],
        generatedText: fullResponse,
      });
      setCurrentPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const text = userInput.trim();
    if (!text || !apiKey) {
      if (!apiKey) setError('Please add your OpenAI API key in Settings.');
      return;
    }
    setError(null);
    setUserInput('');
    const newHistory = [
      ...doc.conversationHistory,
      { role: 'user' as const, content: text },
    ];
    onUpdate({ conversationHistory: newHistory });
    setLoading(true);

    try {
      let fullResponse = '';
      await generateWithOpenAI(
        apiKey,
        [...messages, { role: 'user' as const, content: text }],
        (chunk) => {
          fullResponse += chunk;
          onUpdate({
            conversationHistory: [
              ...newHistory,
              { role: 'assistant' as const, content: fullResponse },
            ],
            generatedText: fullResponse,
          });
          setCurrentPage(pages.length);
        }
      );
      onUpdate({
        conversationHistory: [
          ...newHistory,
          { role: 'assistant' as const, content: fullResponse },
        ],
        generatedText: fullResponse,
      });
      setCurrentPage(pages.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const showGenerateCopy = pages.length >= 2;
  const handleGenerateCopy = async () => {
    if (!apiKey) {
      setError('Please add your OpenAI API key in Settings.');
      return;
    }
    setError(null);
    setLoading(true);
    const copyPurposeContext = doc.copyPurpose?.trim()
      ? ` Remember this copy is for: ${doc.copyPurpose.trim()}.`
      : '';
    const targetAudienceContext = doc.targetAudience?.trim()
      ? ` Target audience: ${doc.targetAudience.trim()}.`
      : '';
    const generateMessage = `Please generate the full copy now based on everything we've discussed.${copyPurposeContext}${targetAudienceContext}`;
    const newHistory = [
      ...doc.conversationHistory,
      { role: 'user' as const, content: generateMessage },
    ];
    onUpdate({ conversationHistory: newHistory });

    try {
      let fullResponse = '';
      await generateWithOpenAI(
        apiKey,
        [...messages, { role: 'user' as const, content: generateMessage }],
        (chunk) => {
          fullResponse += chunk;
          onUpdate({
            conversationHistory: [
              ...newHistory,
              { role: 'assistant' as const, content: fullResponse },
            ],
            generatedText: fullResponse,
          });
          onCopyToOriginal(fullResponse);
        }
      );
      onUpdate({
        conversationHistory: [
          ...newHistory,
          { role: 'assistant' as const, content: fullResponse },
        ],
        generatedText: fullResponse,
      });
      onCopyToOriginal(fullResponse);
      setCurrentPage(pages.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="generatePanel">
      {error && <div className="errorMsg">{error}</div>}
      {pages.length === 0 && !loading ? (
        <div className="generateInputArea">
          <div className="questionDisplay" style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Click Start to begin. The AI will ask clarification questions one at a time.
          </div>
          <div className="copyPurposeField">
            <label className="label">What is this copy for?</label>
            <input
              className="input"
              placeholder="e.g. Sales page, VSL, FB ad, Email, Ad hooks..."
              value={doc.copyPurpose ?? ''}
              onChange={(e) => onUpdate({ copyPurpose: e.target.value })}
              list="copyPurposeOptions"
            />
            <datalist id="copyPurposeOptions">
              <option value="Sales page" />
              <option value="VSL" />
              <option value="FB ad" />
              <option value="Google ad" />
              <option value="Email" />
              <option value="Ad hooks" />
              <option value="Landing page" />
              <option value="Product page" />
            </datalist>
          </div>
          <div className="copyPurposeField">
            <label className="label">Target audience</label>
            <input
              className="input"
              placeholder="e.g. Busy entrepreneurs, stressed parents, fitness beginners..."
              value={doc.targetAudience ?? ''}
              onChange={(e) => onUpdate({ targetAudience: e.target.value })}
            />
          </div>
          <button
            className="generateBtn"
            onClick={handleStart}
            disabled={loading}
          >
            <Play size={18} />
            Start
          </button>
        </div>
      ) : (
        <>
          <div className="generateTopBar">
            <button
              className="startFromBeginningBtn"
              onClick={() => {
                onUpdate({ conversationHistory: [], generatedText: '' });
                setCurrentPage(0);
              }}
              disabled={loading}
            >
              <RotateCcw size={14} />
              Start from beginning
            </button>
          </div>
          {pages.length > 1 && (
            <div className="pageNav">
              <button
                className="pageNavBtn"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={!canGoPrev}
              >
                <ChevronLeft size={16} />
              </button>
              <span>Question {currentPage + 1} of {pages.length}</span>
              <button
                className="pageNavBtn"
                onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
                disabled={!canGoNext}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <div className={`questionDisplay pageFlip`}>
            {loading && !currentContent ? (
              <div className="loading">
                <div className="spinner" />
                Generating...
              </div>
            ) : currentContent ? (
              <MarkdownContent content={currentContent} />
            ) : null}
          </div>
          {!loading && (
            <div className="generateInputArea">
              {showGenerateCopy && (
                <button
                  className="generateBtn"
                  onClick={handleGenerateCopy}
                  style={{ marginBottom: 12 }}
                >
                  <Sparkles size={18} />
                  Generate Copy
                </button>
              )}
              {!showGenerateCopy && (
                <>
                  <textarea
                    placeholder="Type your answer..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={2}
                  />
                  <button
                    className="generateBtn"
                    onClick={handleSend}
                    disabled={!userInput.trim()}
                  >
                    <Sparkles size={18} />
                    Send
                  </button>
                </>
              )}
              {showGenerateCopy && (
                <>
                  <textarea
                    placeholder="Or type an answer (e.g. yes, I approve)..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={2}
                  />
                  <button
                    className="btn btnSecondary"
                    onClick={handleSend}
                    disabled={!userInput.trim()}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    Send
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ImprovedCopyPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="panelContentScroll">
      <div className="panelModeToggle">
        <button
          className={`modeBtn ${mode === 'edit' ? 'modeBtnActive' : ''}`}
          onClick={() => setMode('edit')}
        >
          <Edit3 size={14} />
          Edit
        </button>
        <button
          className={`modeBtn ${mode === 'preview' ? 'modeBtnActive' : ''}`}
          onClick={() => setMode('preview')}
        >
          <Eye size={14} />
          Preview
        </button>
      </div>
      {mode === 'edit' ? (
        <textarea
          className="panelTextarea"
          placeholder="Improved version will appear here..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="panelTextarea panelMarkdownPreview">
          {value ? (
            <MarkdownContent content={value} />
          ) : (
            <span className="previewPlaceholder">No improved copy yet.</span>
          )}
        </div>
      )}
    </div>
  );
}

function OriginalPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  return (
    <div className="panelContentScroll">
      <div className="panelModeToggle">
        <button
          className={`modeBtn ${mode === 'edit' ? 'modeBtnActive' : ''}`}
          onClick={() => setMode('edit')}
        >
          <Edit3 size={14} />
          Edit
        </button>
        <button
          className={`modeBtn ${mode === 'preview' ? 'modeBtnActive' : ''}`}
          onClick={() => setMode('preview')}
        >
          <Eye size={14} />
          Preview
        </button>
      </div>
      {mode === 'edit' ? (
        <textarea
          className="panelTextarea"
          placeholder="Paste or type your original text here..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="panelTextarea panelMarkdownPreview">
          {value ? (
            <MarkdownContent content={value} />
          ) : (
            <span className="previewPlaceholder">Nothing to preview yet.</span>
          )}
        </div>
      )}
    </div>
  );
}

const AUDIENCE_ANALYSIS_PROMPT = `You are analyzing sales copy from the perspective of the TARGET AUDIENCE (a cold prospect).

IMPORTANT: Consider what format the copy is intended for (e.g. sales page, VSL, FB ad, email). Evaluate whether the copy is optimized for that specific format.

Analyze the copy below and rate it on a 0-10 scale for each metric. Be honest and critical.

Format your response EXACTLY like this (one metric per line):

**Hook** (0-10): [score] - [1 sentence why]
**Belief** (0-10): [score] - [1 sentence why]
**Wanting to Buy** (0-10): [score] - [1 sentence why]
**Clarity** (0-10): [score] - [1 sentence why]
**Trust** (0-10): [score] - [1 sentence why]
**Urgency** (0-10): [score] - [1 sentence why]
**Objection Handling** (0-10): [score] - [1 sentence why]
**Value Perception** (0-10): [score] - [1 sentence why]

**Overall** (0-10): [average or weighted score] - [1 sentence summary]

Then add 2-3 specific suggestions for improvement.`;

const IMPROVE_PROMPT = `You are an expert copywriter. Rewrite the copy below to address all the feedback and suggestions in the analysis. Keep the same format (headings, structure) but improve the copy based on the scores and recommendations. Output only the improved copy, no commentary.`;

function SuggestionsPanel({
  originalText,
  copyPurpose,
  targetAudience,
  audienceAnalysis,
  onAnalysisChange,
  onImprovedChange,
  apiKey,
}: {
  originalText: string;
  copyPurpose: string;
  targetAudience: string;
  audienceAnalysis: string;
  onAnalysisChange: (v: string) => void;
  onImprovedChange: (v: string) => void;
  apiKey: string;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [improving, setImproving] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [improveError, setImproveError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!originalText.trim()) {
      setAnalysisError('Add copy to the Original Text panel first.');
      return;
    }
    if (!apiKey) {
      setAnalysisError('Add your OpenAI API key in Settings.');
      return;
    }
    setAnalysisError(null);
    setAnalyzing(true);
    try {
      const copyPurposeContext = copyPurpose.trim()
        ? `\n\nThis copy is intended for: ${copyPurpose.trim()}. Evaluate it specifically for that format.`
        : '';
      const targetAudienceContext = targetAudience.trim()
        ? `\n\nTarget audience: ${targetAudience.trim()}.`
        : '';
      const result = await generateWithOpenAI(apiKey, [
        { role: 'system', content: AUDIENCE_ANALYSIS_PROMPT },
        { role: 'user', content: `Analyze this copy:${copyPurposeContext}${targetAudienceContext}\n\n${originalText}` },
      ]);
      onAnalysisChange(result);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImprove = async () => {
    if (!originalText.trim() || !audienceAnalysis.trim()) {
      setImproveError('Run the analysis first, then click improve.');
      return;
    }
    if (!apiKey) {
      setImproveError('Add your OpenAI API key in Settings.');
      return;
    }
    setImproveError(null);
    setImproving(true);
    try {
      const copyPurposeContext = copyPurpose.trim()
        ? `\n\nThis copy is for: ${copyPurpose.trim()}. Keep the format appropriate for that use case.`
        : '';
      const targetAudienceContext = targetAudience.trim()
        ? `\n\nTarget audience: ${targetAudience.trim()}.`
        : '';
      const result = await generateWithOpenAI(apiKey, [
        { role: 'system', content: IMPROVE_PROMPT + copyPurposeContext + targetAudienceContext },
        { role: 'user', content: `ORIGINAL COPY:\n\n${originalText}\n\n---\n\nFEEDBACK/ANALYSIS TO ADDRESS:\n\n${audienceAnalysis}` },
      ]);
      onImprovedChange(result);
    } catch (err) {
      setImproveError(err instanceof Error ? err.message : 'Improvement failed');
    } finally {
      setImproving(false);
    }
  };

  return (
    <div className="panelContentScroll">
      <button
        className="analyzeBtn"
        onClick={handleAnalyze}
        disabled={analyzing}
      >
        <Target size={18} />
        {analyzing ? 'Analyzing...' : 'Analyze as the target audience'}
      </button>
      {analysisError && <div className="errorMsg">{analysisError}</div>}
      {audienceAnalysis && (
        <>
          <div className="audienceAnalysis">
            <MarkdownContent content={audienceAnalysis} />
          </div>
          <button
            className="improveBtn"
            onClick={handleImprove}
            disabled={improving}
          >
            <Zap size={18} />
            {improving ? 'Generating...' : 'Generate improved version based on the feedback'}
          </button>
        </>
      )}
      {improveError && <div className="errorMsg">{improveError}</div>}
    </div>
  );
}
