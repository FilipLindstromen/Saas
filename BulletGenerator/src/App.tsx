import { useState, useEffect, type KeyboardEvent } from 'react';
import AppTopBar from '@shared/AppTopBar/AppTopBar';
import ThemeToggle from '@shared/ThemeToggle';
import SettingsModal from '@shared/SettingsModal/SettingsModal';
import { List, Settings, Sparkles } from 'lucide-react';
import { getApiKey } from '@shared/apiKeys';
import { getTheme, setTheme, initThemeSync } from '@shared/theme';
import { generateBulletsWithOpenAI } from './api';
import './App.css';

export default function App() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => getTheme() as 'light' | 'dark');
  const [showSettings, setShowSettings] = useState(false);
  const [topic, setTopic] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = initThemeSync();
    const handler = () => setThemeState(getTheme() as 'light' | 'dark');
    window.addEventListener('saas-theme-change', handler);
    return () => {
      unsub?.();
      window.removeEventListener('saas-theme-change', handler);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleGenerate = async () => {
    const apiKey = getApiKey('openai');
    if (!apiKey?.trim()) {
      setError('Please add your OpenAI API key in the SaaS Apps Settings.');
      return;
    }
    if (!topic.trim()) {
      setError('Describe your offer, product, or audience first.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const bullets = await generateBulletsWithOpenAI(apiKey, topic);
      setEditorContent(bullets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const onTopicKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="app">
      <AppTopBar
        logo={
          <span className="bullet-gen-logo">
            <List size={20} strokeWidth={2} />
            Bullet Generator
          </span>
        }
        showProject={false}
        showTabs={false}
        actions={
          <>
            <button
              type="button"
              className="shared-toolbar-btn"
              onClick={() => setShowSettings(true)}
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
            <ThemeToggle
              theme={theme}
              onToggle={(t: 'light' | 'dark') => {
                setTheme(t);
                setThemeState(t);
              }}
              className="shared-toolbar-btn"
            />
          </>
        }
      />

      <div className="workArea">
        <div className="leftPanel leftPanel--simple">
          <div className="panelHeader">
            <Sparkles size={18} />
            Your topic
          </div>
          <div className="panelContent panelContent--simple">
            {error && <div className="errorMsg">{error}</div>}
            <p className="leftPanelHint">
              Describe your offer, audience, and main promise in a few sentences. We&apos;ll spin
              curiosity-driven bullets using 19 pro copy templates.
            </p>
            <textarea
              className="topicInput"
              rows={8}
              placeholder="e.g. Online course for coaches who want more clients without cold DMs — mid-ticket program, tired of posting with no sales…"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={onTopicKeyDown}
            />
            <button
              type="button"
              className="generateBtn"
              onClick={handleGenerate}
              disabled={loading}
            >
              <Sparkles size={18} />
              {loading ? 'Generating…' : 'Generate bullets'}
            </button>
            <p className="leftPanelShortcut">Ctrl+Enter to generate</p>
          </div>
        </div>

        <div className="editorPanel">
          <div className="panelHeader">
            <List size={18} />
            Bullets & Content
          </div>
          <div className="editorContent">
            <textarea
              className="editorTextarea"
              placeholder="Generated bullets will appear here. Edit freely or paste your own."
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
            />
          </div>
        </div>
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
