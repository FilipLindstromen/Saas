import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import TabBar from './components/TabBar';
import SettingsModal from './components/SettingsModal';
import FeedbackModal from './components/FeedbackModal';
import BalanceModal from './components/BalanceModal';
import HeaderSuggestionsModal from './components/HeaderSuggestionsModal';
import BigIdeaModal from './components/BigIdeaModal';
import RightPanel from './components/RightPanel';
import { analyzeAudienceFeedback, improveCopy, improveBalance, analyzeConversionMetrics, improveConversionMetrics, generateHeaderSuggestions, generateBigIdeas } from './services/openai';
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
  
  // Tab Management
  const [tabs, setTabs] = useState(() => {
    const saved = localStorage.getItem('cw_tabs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved tabs:', e);
      }
    }
    
    // Migration: Check if old content exists and migrate it
    const oldContent = localStorage.getItem('cw_content');
    if (oldContent) {
      const migratedTab = {
        id: '1',
        name: 'Sales Page',
        content: oldContent
      };
      // Clear old content key after migration
      localStorage.removeItem('cw_content');
      return [migratedTab];
    }
    
    // Default: one tab named "Sales Page"
    return [{ id: '1', name: 'Sales Page', content: '' }];
  });

  const [activeTabId, setActiveTabId] = useState(() => {
    const saved = localStorage.getItem('cw_activeTabId');
    return saved || '1';
  });

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('cw_tabs', JSON.stringify(tabs));
  }, [tabs]);

  // Save active tab ID
  useEffect(() => {
    localStorage.setItem('cw_activeTabId', activeTabId);
  }, [activeTabId]);

  // Get current tab content
  const currentTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];
  const content = currentTab?.content || '';
  
  // Set content for current tab
  const setContent = (newContent) => {
    setTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.id === activeTabId 
          ? { ...tab, content: newContent }
          : tab
      )
    );
  };

  // Tab management functions
  const handleTabSelect = (tabId) => {
    setActiveTabId(tabId);
  };

  const handleTabAdd = () => {
    const newTabId = Date.now().toString();
    const newTab = {
      id: newTabId,
      name: `Tab ${tabs.length + 1}`,
      content: ''
    };
    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newTabId);
  };

  const handleTabDelete = (tabId) => {
    if (tabs.length === 1) {
      alert('Cannot delete the last tab. Add another tab first.');
      return;
    }
    
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    
    // If deleted tab was active, switch to first remaining tab
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const handleTabRename = (tabId, newName) => {
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === tabId ? { ...tab, name: newName } : tab
      )
    );
  };

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
  const [bigIdea, setBigIdea] = usePersistentState('cw_bigIdea', '');
  const [bigIdeaSuggestions, setBigIdeaSuggestions] = useState(null);

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

  // Persuasion Framework Overlay
  const [persuasionFramework, setPersuasionFramework] = usePersistentState('cw_persuasionFramework', 'None');

  // Show/Hide Background Colors Toggle
  const [showColors, setShowColors] = usePersistentState('cw_showColors', 'true');

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
    const result = await analyzeColorBalance(apiKey, content, targetAudience, docType);
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


  const handleGenerateBigIdeas = async () => {
    if (!apiKey || !instructions) return;
    setMetricsLoading(true);
    try {
      const suggestions = await generateBigIdeas(apiKey, instructions, targetAudience, docType, style);
      setBigIdeaSuggestions(suggestions);
    } catch (e) {
      console.error(e);
      alert('Failed to generate big ideas.');
    } finally {
      setMetricsLoading(false);
    }
  };

  const handleSelectBigIdea = (idea) => {
    setBigIdea(idea);
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
            copywriter={copywriter}
            setCopywriter={setCopywriter}
            bigIdea={bigIdea}
            setBigIdea={setBigIdea}
            onGenerateBigIdeas={handleGenerateBigIdeas}
            persuasionFramework={persuasionFramework}
            setPersuasionFramework={setPersuasionFramework}
          />

          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '100%', overflow: 'hidden' }}>
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onTabSelect={handleTabSelect}
              onTabAdd={handleTabAdd}
              onTabDelete={handleTabDelete}
              onTabRename={handleTabRename}
            />
            <div style={{ flexGrow: 1, overflow: 'hidden' }}>
              <Editor
                content={content}
                setContent={setContent}
                onSelectionChange={setActiveLegendItem}
                showColors={showColors === 'true'}
              />
            </div>
          </div>

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
            activeLegendItem={activeLegendItem}
            showColors={showColors === 'true'}
            setShowColors={(value) => setShowColors(value ? 'true' : 'false')}
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

      {bigIdeaSuggestions && (
        <BigIdeaModal
          suggestions={bigIdeaSuggestions}
          onClose={() => setBigIdeaSuggestions(null)}
          onSelect={handleSelectBigIdea}
        />
      )}
    </>
  );
}

export default App;
