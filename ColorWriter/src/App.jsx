import React, { useState, useEffect, useRef } from 'react';
import { loadApiKeys } from '@shared/apiKeys';
import {
  hasConnectedFolder,
  saveProjectToConnectedFolder,
  loadProjectFromConnectedFolder
} from '@shared/projectFolderStorage';
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
  
  // Project storage helpers
  const PROJECTS_KEY = 'cw_projects';
  const CURRENT_PROJECT_KEY = 'cw_currentProjectId';
  const getProjectDataKey = (id) => `cw_project_${id}`;

  const loadProjectData = (projectId) => {
    try {
      const saved = localStorage.getItem(getProjectDataKey(projectId));
      if (saved) {
        const data = JSON.parse(saved);
        return {
          tabs: (data.tabs || []).map(tab => ({
            ...tab,
            content: normalizeToSingleColumn(tab.content || '')
          })),
          activeTabId: data.activeTabId || (data.tabs?.[0]?.id) || '1'
        };
      }
    } catch (e) {
      console.error('Failed to load project data:', e);
    }
    return { tabs: [{ id: '1', name: 'Sales Page', content: '' }], activeTabId: '1' };
  };

  const saveProjectData = (projectId, tabs, activeTabId) => {
    try {
      localStorage.setItem(getProjectDataKey(projectId), JSON.stringify({ tabs, activeTabId }));
    } catch (e) {
      console.error('Failed to save project data:', e);
    }
  };

  // Projects state
  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem(PROJECTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load projects:', e);
    }
    return [{ id: 'default', name: 'Default' }];
  });

  const [currentProjectId, setCurrentProjectId] = useState(() => {
    return localStorage.getItem(CURRENT_PROJECT_KEY) || 'default';
  });

  const currentProjectName = projects.find(p => p.id === currentProjectId)?.name || 'Default';

  // Tab Management - per project
  const [tabs, setTabs] = useState(() => {
    // Migration: if old cw_tabs exists, migrate to project default
    const oldTabs = localStorage.getItem('cw_tabs');
    if (oldTabs) {
      try {
        const parsed = JSON.parse(oldTabs);
        const migrated = parsed.map(tab => ({
          ...tab,
          content: normalizeToSingleColumn(tab.content || '')
        }));
        const oldActive = localStorage.getItem('cw_activeTabId') || migrated[0]?.id || '1';
        saveProjectData('default', migrated, oldActive);
        localStorage.removeItem('cw_tabs');
        localStorage.removeItem('cw_activeTabId');
        return migrated;
      } catch (e) {
        console.error('Failed to migrate tabs:', e);
      }
    }
    const oldContent = localStorage.getItem('cw_content');
    if (oldContent) {
      const migratedTab = {
        id: '1',
        name: 'Sales Page',
        content: normalizeToSingleColumn(oldContent)
      };
      localStorage.removeItem('cw_content');
      saveProjectData('default', [migratedTab], '1');
      return [migratedTab];
    }
    return loadProjectData(currentProjectId).tabs;
  });

  const [activeTabId, setActiveTabId] = useState(() => {
    const oldActive = localStorage.getItem('cw_activeTabId');
    if (oldActive && localStorage.getItem('cw_tabs')) return oldActive;
    return loadProjectData(currentProjectId).activeTabId;
  });

  // Save projects list
  useEffect(() => {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }, [projects]);

  // Save current project ID
  useEffect(() => {
    if (currentProjectId) localStorage.setItem(CURRENT_PROJECT_KEY, currentProjectId);
  }, [currentProjectId]);

  // Save tabs and activeTabId for current project whenever they change
  useEffect(() => {
    if (currentProjectId) saveProjectData(currentProjectId, tabs, activeTabId);
  }, [currentProjectId, tabs, activeTabId]);

  // Save to connected folder (debounced)
  const saveToFolderTimeoutRef = useRef(null);
  useEffect(() => {
    if (!currentProjectId || !projects.length) return;
    if (saveToFolderTimeoutRef.current) clearTimeout(saveToFolderTimeoutRef.current);
    saveToFolderTimeoutRef.current = setTimeout(async () => {
      saveToFolderTimeoutRef.current = null;
      if (!(await hasConnectedFolder())) return;
      const proj = projects.find(p => p.id === currentProjectId);
      const projName = (proj?.name || 'Default').trim() || 'Default';
      const data = { tabs, activeTabId };
      try {
        await saveProjectToConnectedFolder('ColorWriter', projName, data);
        localStorage.setItem(`cw_projectLastModified_${currentProjectId}`, String(Date.now()));
      } catch (e) {
        console.warn('Save to project folder failed:', e);
      }
    }, 1500);
    return () => {
      if (saveToFolderTimeoutRef.current) clearTimeout(saveToFolderTimeoutRef.current);
    };
  }, [currentProjectId, projects, tabs, activeTabId]);

  // Load project data when switching projects
  useEffect(() => {
    const data = loadProjectData(currentProjectId);
    setTabs(data.tabs);
    setActiveTabId(data.activeTabId);
  }, [currentProjectId]);

  // If connected folder has project newer than browser, load from folder
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await hasConnectedFolder()) || !currentProjectId || !projects.length) return;
      const proj = projects.find(p => p.id === currentProjectId);
      const projName = (proj?.name || 'Default').trim() || 'Default';
      const result = await loadProjectFromConnectedFolder('ColorWriter', projName);
      if (cancelled || !result?.data) return;
      const browserLastModified = parseInt(localStorage.getItem(`cw_projectLastModified_${currentProjectId}`) || '0', 10);
      if (result.modifiedTime > browserLastModified && result.data.tabs) {
        setTabs(result.data.tabs.map(tab => ({
          ...tab,
          content: normalizeToSingleColumn(tab.content || '')
        })));
        if (result.data.activeTabId) setActiveTabId(result.data.activeTabId);
      }
    })();
    return () => { cancelled = true; };
  }, [currentProjectId, projects]);

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

  // Project handlers
  const handleCreateProject = () => {
    saveProjectData(currentProjectId, tabs, activeTabId);
    const newId = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const newProject = { id: newId, name: 'Untitled' };
    setProjects(prev => [...prev, newProject]);
    setCurrentProjectId(newId);
  };

  const handleRenameProject = (id, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed) return;
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: trimmed } : p));
  };

  const handleDeleteProject = (id) => {
    if (projects.length <= 1) return;
    const remaining = projects.filter(p => p.id !== id);
    if (currentProjectId === id && remaining.length > 0) {
      saveProjectData(currentProjectId, tabs, activeTabId);
      setCurrentProjectId(remaining[0].id);
    }
    setProjects(remaining);
    try {
      localStorage.removeItem(getProjectDataKey(id));
    } catch (e) {
      console.error('Failed to remove project data:', e);
    }
  };

  const handleSwitchProject = (id) => {
    if (id !== currentProjectId) {
      saveProjectData(currentProjectId, tabs, activeTabId);
      setCurrentProjectId(id);
    }
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

  // Resizable panel widths (persisted)
  const [leftPanelWidth, setLeftPanelWidth] = usePersistentState('cw_leftPanelWidth', '320');
  const [rightPanelWidth, setRightPanelWidth] = usePersistentState('cw_rightPanelWidth', '300');

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
            onSwitchProject: handleSwitchProject,
            onCreateProject: handleCreateProject,
            onRenameProject: handleRenameProject,
            onDeleteProject: handleDeleteProject,
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
            width={Number(leftPanelWidth) || 320}
            onResize={setLeftPanelWidth}
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
            width={Number(rightPanelWidth) || 300}
            onResize={setRightPanelWidth}
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
