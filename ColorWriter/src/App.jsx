import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import SettingsModal from './components/SettingsModal';
import FeedbackModal from './components/FeedbackModal';
import BalanceModal from './components/BalanceModal';
import { analyzeAudienceFeedback, improveCopy, improveBalance } from './services/openai';
import { Settings, Moon, Sun } from 'lucide-react';

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Persistent State Helpers
  const usePersistentState = (key, initialValue) => {
    const [state, setState] = useState(() => {
      const stored = localStorage.getItem(key);
      return stored !== null ? stored : initialValue;
    });
    useEffect(() => {
      localStorage.setItem(key, state);
    }, [key, state]);
    return [state, setState];
  };

  const [docType, setDocType] = usePersistentState('cw_docType', 'Sales Page');
  const [style, setStyle] = usePersistentState('cw_style', 'Aggressive');
  const [instructions, setInstructions] = usePersistentState('cw_instructions', '');
  const [targetAudience, setTargetAudience] = usePersistentState('cw_targetAudience', '');
  const [content, setContent] = usePersistentState('cw_content', '');

  // Theme State
  const [theme, setTheme] = usePersistentState('cw_theme', 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const [feedbackData, setFeedbackData] = useState(null);
  const [balanceData, setBalanceData] = useState(null);
  const [isImproving, setIsImproving] = useState(false);

  // Legend Highlighting
  const [activeLegendItem, setActiveLegendItem] = useState(null);

  // Legendary Copywriter Selection
  const [copywriter, setCopywriter] = usePersistentState('cw_copywriter', 'None');

  // Handler for saving API key
  const handleSaveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('openai_api_key', key);
    setIsSettingsOpen(false);
  };

  const handleAudienceFeedback = async (targetAudience, currentDocType) => {
    const result = await analyzeAudienceFeedback(apiKey, content, targetAudience, currentDocType);
    setFeedbackData(result);
  };

  const handleBalanceAnalysis = async (targetAudience) => {
    const { analyzeColorBalance } = await import('./services/openai');
    const result = await analyzeColorBalance(apiKey, content, targetAudience);
    setBalanceData(result);
  };

  const handleImprove = async () => {
    if (!apiKey || !feedbackData) return;
    setIsImproving(true);
    try {
      const newContent = await improveCopy(apiKey, content, feedbackData, docType, style, targetAudience);
      setContent(newContent);
      setFeedbackData(null); // Close modal on success
    } catch (e) {
      alert("Failed to improve copy. Check console.");
    } finally {
      setIsImproving(false);
    }
  };

  const handleBalanceImprove = async () => {
    if (!apiKey || !balanceData) return;
    setIsImproving(true);
    try {
      const newContent = await improveBalance(apiKey, content, balanceData, docType, style, targetAudience);
      setContent(newContent);
      setBalanceData(null);
    } catch (e) {
      alert("Failed to improve balance. Check console.");
    } finally {
      setIsImproving(false);
    }
  };

  return (
    <>
      <div className="app-container">
        {/* Theme Toggle - Fixed Top Right */}
        <button
          onClick={toggleTheme}
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 100,
            padding: '0.5rem',
            borderRadius: '50%',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
            color: 'var(--text-primary)'
          }}
          title="Toggle Theme"
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <Layout>
          <Sidebar
            docType={docType}
            setDocType={setDocType}
            style={style}
            setStyle={setStyle}
            instructions={instructions}
            setInstructions={setInstructions}
            targetAudience={targetAudience}
            setTargetAudience={setTargetAudience}
            onGenerated={setContent}
            onOpenSettings={() => setIsSettingsOpen(true)}
            apiKey={apiKey}
            activeLegendItem={activeLegendItem}
            copywriter={copywriter}
            setCopywriter={setCopywriter}
          />
          <Editor
            content={content}
            setContent={setContent}
            apiKey={apiKey}
            onSelectionChange={setActiveLegendItem}
            onFeedback={handleAudienceFeedback}
            onBalance={handleBalanceAnalysis}
            targetAudience={targetAudience}
            docType={docType}
            style={style}
          />
        </Layout>
      </div>

      {isSettingsOpen && (
        <SettingsModal
          apiKey={apiKey}
          onSave={handleSaveApiKey}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {feedbackData && (
        <FeedbackModal
          data={feedbackData}
          onClose={() => setFeedbackData(null)}
          onImprove={handleImprove}
          isImproving={isImproving}
        />
      )}

      {balanceData && (
        <BalanceModal
          data={balanceData}
          onClose={() => setBalanceData(null)}
          onImprove={handleBalanceImprove}
          isImproving={isImproving}
        />
      )}
    </>
  );
}

export default App;
