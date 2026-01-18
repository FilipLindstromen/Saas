import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import SettingsModal from './components/SettingsModal';
import FeedbackModal from './components/FeedbackModal';
import BalanceModal from './components/BalanceModal';
import HeaderSuggestionsModal from './components/HeaderSuggestionsModal';
import RightPanel from './components/RightPanel';
import { analyzeAudienceFeedback, improveCopy, improveBalance, analyzeConversionMetrics, improveConversionMetrics, generateHeaderSuggestions } from './services/openai';
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

  // Conversion Metrics State
  const [conversionMetrics, setConversionMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [headerSuggestions, setHeaderSuggestions] = useState(null);

  // Legend Highlighting
  const [activeLegendItem, setActiveLegendItem] = useState(null);

  // Load conversion metrics from localStorage on mount
  useEffect(() => {
    const savedMetrics = localStorage.getItem('conversionMetrics');
    if (savedMetrics) {
      try {
        setConversionMetrics(JSON.parse(savedMetrics));
      } catch (e) {
        console.error('Failed to parse saved metrics:', e);
      }
    }
  }, []);

  // Save conversion metrics to localStorage whenever they change
  useEffect(() => {
    if (conversionMetrics) {
      localStorage.setItem('conversionMetrics', JSON.stringify(conversionMetrics));
    }
  }, [conversionMetrics]);

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

  const handleMetricsUpdate = async () => {
    if (!apiKey) return;
    setMetricsLoading(true);
    try {
      const metrics = await analyzeConversionMetrics(apiKey, content, targetAudience);
      setConversionMetrics(metrics);
    } catch (e) {
      console.error(e);
      alert('Failed to update metrics.');
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleImproveMetrics = async () => {
    if (!apiKey || !conversionMetrics) return;
    setIsImproving(true);
    try {
      const newContent = await improveConversionMetrics(apiKey, content, conversionMetrics, docType, style, targetAudience, copywriter);
      setContent(newContent);
      // Auto-refresh metrics after improvement
      setTimeout(async () => {
        try {
          const updatedMetrics = await analyzeConversionMetrics(apiKey, newContent, targetAudience);
          setConversionMetrics(updatedMetrics);
        } catch (e) {
          console.error('Failed to refresh metrics:', e);
        }
      }, 500);
    } catch (e) {
      console.error(e);
      alert('Failed to improve copy based on metrics.');
    } finally {
      setIsImproving(false);
    }
  };

  const handleHeaderSuggestions = async () => {
    if (!apiKey) return;
    setMetricsLoading(true);
    try {
      const suggestions = await generateHeaderSuggestions(apiKey, content, targetAudience, docType, style);
      setHeaderSuggestions(suggestions);
    } catch (e) {
      console.error(e);
      alert('Failed to generate header suggestions.');
    } finally {
      setMetricsLoading(false);
    }
  };


  const handleAnalyzeAndColor = async () => {
    if (!apiKey || analyzeLoading) return;
    const { analyzeCopy } = await import('./services/openai');
    // We need to parse text from HTML content for analysis if possible, but the service handles it.
    // Although wait, Editor usually handles this logic. 
    // We should pass a handler to Editor? Or can we do it here?
    // The Editor has the ref. But `content` state is synced. 

    setAnalyzeLoading(true);
    try {
      const newContent = await analyzeCopy(apiKey, content); // analyzing the HTML content directly is fine if service strips tags
      setContent(newContent);
    } catch (e) {
      alert("Error analyzing text.");
    } finally {
      setAnalyzeLoading(false);
    }
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
      const { improveBalance } = await import('./services/openai');
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
        {/* Theme Toggle - Fixed Top Right - Adjusted position for 3-col layout */}
        <button
          onClick={toggleTheme}
          style={{
            position: 'fixed',
            bottom: '1rem', // Moved to bottom right to not conflict with header
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
            onSelectionChange={setActiveLegendItem}
          // Removed internal action buttons
          />

          <RightPanel
            apiKey={apiKey}
            docType={docType}
            targetAudience={targetAudience}
            onAnalyze={handleAnalyzeAndColor}
            onFeedback={() => handleAudienceFeedback(targetAudience, docType)}
            onBalance={() => handleBalanceAnalysis(targetAudience)}
            loading={analyzeLoading}
            metricsLoading={metricsLoading}
            conversionMetrics={conversionMetrics}
            onUpdateMetrics={handleMetricsUpdate}
            onImproveMetrics={handleImproveMetrics}
            onHeaderSuggestions={handleHeaderSuggestions}
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

      {headerSuggestions && (
        <HeaderSuggestionsModal
          suggestions={headerSuggestions}
          onClose={() => setHeaderSuggestions(null)}
        />
      )}
    </>
  );
}

export default App;
