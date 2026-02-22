import React, { useState, useEffect } from 'react';
import { loadApiKeys } from '@shared/apiKeys';
import { getTheme, setTheme as applyTheme, initThemeSync } from '@shared/theme';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import AppTopBar from '@shared/AppTopBar/AppTopBar';
import FeedbackModal from './components/FeedbackModal';
import BalanceModal from './components/BalanceModal';
import ThreeKeyIngredientsModal from './components/ThreeKeyIngredientsModal';
import ThreeRulesModal from './components/ThreeRulesModal';
import HeaderSuggestionsModal from './components/HeaderSuggestionsModal';
import RightPanel from './components/RightPanel';
import MasterPromptModal from './components/MasterPromptModal';
import { analyzeAudienceFeedback, improveCopy, improveBalance, analyzeConversionMetrics, improveConversionMetrics, generateHeaderSuggestions, analyzeThreeKeyIngredients, analyzeThreeRules, improveCopyThreeRules, normalizeToSingleColumn } from './services';
import { FileText } from 'lucide-react';
import ThemeToggle from '@shared/ThemeToggle';

function App() {
  // Use shared API key from @shared/apiKeys (configured in SaaS Apps or other apps)
  const [apiKey, setApiKey] = useState(() => loadApiKeys().openai || '');

  // Sync apiKey from shared storage when window gains focus (e.g. user set it in another app)
  useEffect(() => {
    const handler = () => setApiKey(loadApiKeys().openai || '');
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

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

  const [docType, setDocType] = usePersistentState('cw_docType', '📄 Sales Page');
  const [instructions, setInstructions] = usePersistentState('cw_instructions', '');
  const [targetAudience, setTargetAudience] = usePersistentState('cw_targetAudience', '');
  
  // Tab Management
  const [tabs, setTabs] = useState(() => {
    const saved = localStorage.getItem('cw_tabs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map(tab => ({
          ...tab,
          content: normalizeToSingleColumn(tab.content || '')
        }));
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
        content: normalizeToSingleColumn(oldContent)
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

  // Project state - single "Default" project for now (tabs live under it)
  const [projects] = useState([{ id: 'default', name: 'Default' }]);
  const currentProjectId = 'default';
  const currentProjectName = 'Default';

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

  // Theme - use shared theme for consistency across apps
  const [theme, setThemeState] = useState(() => getTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const unsub = initThemeSync();
    const handler = () => setThemeState(getTheme());
    window.addEventListener('saas-theme-change', handler);
    return () => {
      unsub?.();
      window.removeEventListener('saas-theme-change', handler);
    };
  }, []);

  const [feedbackData, setFeedbackData] = useState(null);
  const [balanceData, setBalanceData] = useState(null);
  const [threeKeyIngredientsData, setThreeKeyIngredientsData] = useState(null);
  const [threeRulesData, setThreeRulesData] = useState(null);
  const [isImproving, setIsImproving] = useState(false);

  // Conversion Metrics State
  const [conversionMetrics, setConversionMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [threeKeyIngredientsLoading, setThreeKeyIngredientsLoading] = useState(false);
  const [threeRulesLoading, setThreeRulesLoading] = useState(false);
  const [isImprovingThreeRules, setIsImprovingThreeRules] = useState(false);
  const [headerSuggestions, setHeaderSuggestions] = useState(null);

  // Legend Highlighting
  const [activeLegendItem, setActiveLegendItem] = useState(null);
  
  // Block Type Selection (for filtering/fading)
  const [selectedBlockType, setSelectedBlockType] = useState(null);

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

  // Persuasion framework inputs
  const [offerType, setOfferType] = usePersistentState('cw_offerType', 'Mid-ticket');
  const [situationsList, setSituationsList] = usePersistentState('cw_situationsList', '');
  const [painPoints, setPainPoints] = usePersistentState('cw_painPoints', '');
  const [hiddenFrustrations, setHiddenFrustrations] = usePersistentState('cw_hiddenFrustrations', '');
  const [desiredOutcomes, setDesiredOutcomes] = usePersistentState('cw_desiredOutcomes', '');
  const [objections, setObjections] = usePersistentState('cw_objections', '');
  const [oldBelief, setOldBelief] = usePersistentState('cw_oldBelief', '');
  const [newBelief, setNewBelief] = usePersistentState('cw_newBelief', '');
  const [desiredEmotion, setDesiredEmotion] = usePersistentState('cw_desiredEmotion', '');
  const [primaryCta, setPrimaryCta] = usePersistentState('cw_primaryCta', '');

  // Show/Hide Background Colors Toggle
  const [showColors, setShowColors] = usePersistentState('cw_showColors', 'true');

  // Master prompt (custom override; empty = use default)
  const [customMasterPrompt, setCustomMasterPrompt] = usePersistentState('cw_customMasterPrompt', '');
  const [isMasterPromptOpen, setIsMasterPromptOpen] = useState(false);


  const handleAudienceFeedback = async (targetAudience, currentDocType) => {
    if (!apiKey) return;
    setFeedbackLoading(true);
    try {
      const result = await analyzeAudienceFeedback(apiKey, content, targetAudience, currentDocType);
      setFeedbackData(result);
    } catch (e) {
      console.error(e);
      alert('Failed to get audience feedback.');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleBalanceAnalysis = async (targetAudience) => {
    if (!apiKey) return;
    setBalanceLoading(true);
    try {
      const { analyzeColorBalance } = await import('./services');
      const result = await analyzeColorBalance(apiKey, content, targetAudience, docType);
      setBalanceData(result);
    } catch (e) {
      console.error(e);
      alert('Failed to analyze balance.');
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleThreeKeyIngredientsAnalysis = async (targetAudience) => {
    if (!apiKey) return;
    setThreeKeyIngredientsLoading(true);
    try {
      const result = await analyzeThreeKeyIngredients(apiKey, content, targetAudience);
      setThreeKeyIngredientsData(result);
    } catch (e) {
      console.error(e);
      alert('Failed to analyze three key ingredients.');
    } finally {
      setThreeKeyIngredientsLoading(false);
    }
  };

  const handleThreeRulesAnalysis = async (targetAudience) => {
    if (!apiKey) return;
    setThreeRulesLoading(true);
    try {
      const result = await analyzeThreeRules(apiKey, content, targetAudience);
      setThreeRulesData(result);
    } catch (e) {
      console.error(e);
      alert('Failed to analyze three rules.');
    } finally {
      setThreeRulesLoading(false);
    }
  };

  const handleThreeRulesImprove = async () => {
    if (!apiKey || !threeRulesData) return;
    setIsImprovingThreeRules(true);
    try {
      const newContent = await improveCopyThreeRules(apiKey, content, threeRulesData, docType, 'Direct', targetAudience, 'None');
      setContent(newContent);
      setThreeRulesData(null); // Close modal after improvement
    } catch (e) {
      console.error(e);
      alert('Failed to improve copy based on three rules.');
    } finally {
      setIsImprovingThreeRules(false);
    }
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
    setMetricsLoading(true);
    setIsImproving(true);
    try {
      const newContent = await improveConversionMetrics(apiKey, content, conversionMetrics, docType, 'Direct', targetAudience, 'None');
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
      setMetricsLoading(false);
      setIsImproving(false);
    }
  };

  const handleHeaderSuggestions = async () => {
    if (!apiKey) return;
    setMetricsLoading(true);
    try {
      const suggestions = await generateHeaderSuggestions(apiKey, content, targetAudience, docType, 'Direct');
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
    const { analyzeCopy } = await import('./services');
    setAnalyzeLoading(true);
    try {
      const newContent = await analyzeCopy(apiKey, content);
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
      const newContent = await improveCopy(apiKey, content, feedbackData, docType, 'Direct', targetAudience);
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
      const { improveBalance } = await import('./services');
      const newContent = await improveBalance(apiKey, content, balanceData, docType, 'Direct', targetAudience);
      setContent(newContent);
      setBalanceData(null);
    } catch (e) {
      alert("Failed to improve balance. Check console.");
    } finally {
      setIsImproving(false);
    }
  };

  const handleThreeKeyIngredientsImprove = async () => {
    if (!apiKey || !threeKeyIngredientsData) return;
    setIsImproving(true);
    try {
      // Format the analysis as feedback data for improveCopy
      const feedbackData = {
        thoughts: `Four Key Ingredients Analysis Results:
- Overall Score: ${threeKeyIngredientsData.overall_score}/100
- Overall Feedback: ${threeKeyIngredientsData.overall_feedback}`,
        improvements: [
          `1. Deep, Precise Understanding (${threeKeyIngredientsData.understanding.score}/100): ${threeKeyIngredientsData.understanding.feedback}`,
          `2. Clear, Believable Mechanism (${threeKeyIngredientsData.mechanism.score}/100): ${threeKeyIngredientsData.mechanism.feedback}`,
          `3. Emotional Movement → Relief (${threeKeyIngredientsData.emotional_movement.score}/100): ${threeKeyIngredientsData.emotional_movement.feedback}`,
          `4. The Big Idea (${threeKeyIngredientsData.big_idea.score}/100): ${threeKeyIngredientsData.big_idea.feedback}`
        ]
      };
      const improved = await improveCopy(apiKey, content, feedbackData, docType, 'Direct', targetAudience);
      setContent(improved);
      setThreeKeyIngredientsData(null);
    } catch (e) {
      alert("Failed to improve copy. Check console.");
    } finally {
      setIsImproving(false);
    }
  };

  const handleInfuseBlockType = async (blockType) => {
    if (!apiKey || !content) return;
    setAnalyzeLoading(true);
    try {
      const { infuseBlockType } = await import('./services');
      const newContent = await infuseBlockType(apiKey, {
        originalText: content,
        blockType,
        docType,
        style: 'Direct',
        instructions,
        targetAudience,
        copywriter: 'None'
      });
      setContent(newContent);
    } catch (e) {
      console.error(e);
      alert(`Failed to infuse ${blockType} blocks: ${e.message || 'Unknown error'}`);
    } finally {
      setAnalyzeLoading(false);
    }
  };

  return (
    <>
      <div className="app-container">
        <AppTopBar
          logo={<span className="app-toolbar-logo">COLOR WRITER</span>}
          showProject={true}
          projectProps={{
            projects,
            currentProjectId,
            currentProjectName,
          }}
          showTabs={true}
          tabProps={{
            tabs,
            currentTabId: activeTabId,
            onSwitchTab: handleTabSelect,
            onAddTab: handleTabAdd,
            onRenameTab: handleTabRename,
            onDeleteTab: handleTabDelete,
            defaultTabName: 'Sales Page',
            addTitle: 'Add tab',
          }}
          actions={
            <>
              <button
                type="button"
                className="app-toolbar-btn"
                onClick={() => setIsMasterPromptOpen(true)}
                title="View & Edit Master Prompt"
                aria-label="Master prompt"
              >
                <FileText size={18} />
              </button>
              <ThemeToggle theme={theme} onToggle={setThemeState} className="app-toolbar-btn" />
            </>
          }
        />

        <Layout>
          <Sidebar
            docType={docType}
            setDocType={setDocType}
            instructions={instructions}
            setInstructions={setInstructions}
            targetAudience={targetAudience}
            setTargetAudience={setTargetAudience}
            onGenerated={setContent}
            apiKey={apiKey}
            offerType={offerType}
            setOfferType={setOfferType}
            situationsList={situationsList}
            setSituationsList={setSituationsList}
            painPoints={painPoints}
            setPainPoints={setPainPoints}
            hiddenFrustrations={hiddenFrustrations}
            setHiddenFrustrations={setHiddenFrustrations}
            desiredOutcomes={desiredOutcomes}
            setDesiredOutcomes={setDesiredOutcomes}
            objections={objections}
            setObjections={setObjections}
            oldBelief={oldBelief}
            setOldBelief={setOldBelief}
            newBelief={newBelief}
            setNewBelief={setNewBelief}
            desiredEmotion={desiredEmotion}
            setDesiredEmotion={setDesiredEmotion}
            primaryCta={primaryCta}
            setPrimaryCta={setPrimaryCta}
            customMasterPrompt={customMasterPrompt}
          />

          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '100%', overflow: 'hidden' }}>
            <div style={{ flexGrow: 1, overflow: 'hidden' }}>
              <Editor
                content={content}
                setContent={setContent}
                onSelectionChange={setActiveLegendItem}
                showColors={showColors === 'true'}
                selectedBlockType={selectedBlockType}
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
            onThreeKeyIngredients={() => handleThreeKeyIngredientsAnalysis(targetAudience)}
            onThreeRulesAnalysis={() => handleThreeRulesAnalysis(targetAudience)}
            onInfuseBlockType={handleInfuseBlockType}
            loading={analyzeLoading}
            feedbackLoading={feedbackLoading}
            balanceLoading={balanceLoading}
            threeKeyIngredientsLoading={threeKeyIngredientsLoading}
            threeRulesLoading={threeRulesLoading}
            metricsLoading={metricsLoading}
            isImproving={isImproving}
            conversionMetrics={conversionMetrics}
            onUpdateMetrics={handleMetricsUpdate}
            onImproveMetrics={handleImproveMetrics}
            onHeaderSuggestions={handleHeaderSuggestions}
            activeLegendItem={activeLegendItem}
            selectedBlockType={selectedBlockType}
            onBlockTypeSelect={setSelectedBlockType}
            showColors={showColors === 'true'}
            setShowColors={(value) => setShowColors(value ? 'true' : 'false')}
          />

        </Layout>
      </div>

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

      {threeKeyIngredientsData && (
        <ThreeKeyIngredientsModal
          data={threeKeyIngredientsData}
          onClose={() => setThreeKeyIngredientsData(null)}
          onImprove={handleThreeKeyIngredientsImprove}
          isImproving={isImproving}
        />
      )}

      {threeRulesData && (
        <ThreeRulesModal
          data={threeRulesData}
          onClose={() => setThreeRulesData(null)}
          onImprove={handleThreeRulesImprove}
          isImproving={isImprovingThreeRules}
        />
      )}

      {headerSuggestions && (
        <HeaderSuggestionsModal
          suggestions={headerSuggestions}
          onClose={() => setHeaderSuggestions(null)}
        />
      )}

      <MasterPromptModal
        isOpen={isMasterPromptOpen}
        onClose={() => setIsMasterPromptOpen(false)}
        promptValue={customMasterPrompt}
        onSave={setCustomMasterPrompt}
      />

    </>
  );
}

export default App;
