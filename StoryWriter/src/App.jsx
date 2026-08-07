import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ThemeToggle from '@shared/ThemeToggle';
import { getTheme, setTheme, initThemeSync } from '@shared/theme';
import { getSettings, saveSettings, PRESENTATION_FONTS } from './utils/settings';
import { normalizeStoryData } from './utils/persistence';
import * as projectStorage from './utils/projectStorage';
import {
  getDefaultSectionOrder,
  createEmptySections,
  getSectionDefs,
  FRAMEWORKS,
} from './constants/frameworks';
import { TARGET_OUTCOMES, DEFAULT_TARGET_OUTCOME_ID, getTargetOutcome } from './constants/targetOutcomes';
import { getSceneStartForSentenceIndex, getPresentScenes } from './utils/sentences';
import {
  normalizePresentSceneImages,
  normalizePresentSceneImageLocks,
} from './utils/presentSceneImages';
import { generateFullStory } from './services/openai';
import { resolveSentenceBackgroundImage } from './services/sentenceBackgroundAi';
import SettingsModal from '@shared/SettingsModal/SettingsModal';
import FontSettingsPopover from './components/FontSettingsPopover';
import RecordingOptionsPopover from './components/RecordingOptionsPopover';
import BackgroundAnimationPopover from './components/BackgroundAnimationPopover';
import UnifiedStoryEditor from './components/UnifiedStoryEditor';
import EditView from './components/EditView';
import PresentView from './components/PresentView';
import RambleRecorder from './components/RambleRecorder';
import ProjectSelector from './components/ProjectSelector';
import TabBar from '@shared/TabBar/TabBar';
import PresentationAnimationPopover from './components/PresentationAnimationPopover';
import { DEFAULT_PRESENTATION_ANIMATION_RULES } from './utils/textAnimations';
import { copyTextToClipboard } from './utils/clipboard';
import { formatStoryForClipboard } from './utils/storyPlainText';
import { applyUnifiedStoryEdit } from './utils/storyDocument';
import './App.css';

const INPUT_PANEL_MIN = 280;
const INPUT_PANEL_MAX = 560;
const INPUT_PANEL_DEFAULT = 320;

const DEFAULT_STORY = {
  storyAbout: '',
  frameworkId: 'heros_arc',
  sectionOrder: [],
  sectionsData: {},
  storyLength: 'medium',
  targetOutcome: DEFAULT_TARGET_OUTCOME_ID,
  presentationAnimationRules: DEFAULT_PRESENTATION_ANIMATION_RULES,
};

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [persisted, setPersisted] = useState(DEFAULT_STORY);
  const { storyAbout, frameworkId, sectionOrder, sectionsData, storyLength, targetOutcome, presentationAnimationRules } = persisted;
  const sectionDefs = getSectionDefs(frameworkId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('write');
  const [presentStartIndex, setPresentStartIndex] = useState(0);
  const [editScrollPresentIndex, setEditScrollPresentIndex] = useState(null);

  const leavePresentForEdit = useCallback((sceneIndex) => {
    if (typeof sceneIndex === 'number') {
      setPresentStartIndex(sceneIndex);
      setEditScrollPresentIndex(sceneIndex);
    }
    setView('edit');
  }, []);

  useEffect(() => {
    if (view === 'present') return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [view]);

  const [inputPanelWidth, setInputPanelWidth] = useState(INPUT_PANEL_DEFAULT);
  const [writePanelVisible, setWritePanelVisible] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [magicImageLoading, setMagicImageLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentTabId, setCurrentTabId] = useState(null);
  const [currentTabName, setCurrentTabName] = useState('Story 1');
  const [hasHydrated, setHasHydrated] = useState(false);
  const [theme, setThemeState] = useState(() => getTheme());
  const [settingsPresentationFont, setSettingsPresentationFont] = useState('Poppins');
  const [settingsPresentationSize, setSettingsPresentationSize] = useState('medium');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const resizeStartRef = useRef({ x: 0, width: 0 });
  const copyFeedbackTimerRef = useRef(null);
  const persistedRef = useRef(persisted);
  persistedRef.current = persisted;

  const getDefaultStoryData = useCallback(() => {
    const fid = 'heros_arc';
    return {
      storyAbout: '',
      frameworkId: fid,
      sectionOrder: getDefaultSectionOrder(fid),
      sectionsData: createEmptySections(fid),
      storyLength: 'medium',
      targetOutcome: DEFAULT_TARGET_OUTCOME_ID,
      presentationAnimationRules: DEFAULT_PRESENTATION_ANIMATION_RULES,
    };
  }, []);

  useEffect(() => {
    let projectList = projectStorage.loadProjects();
    let projectId = projectStorage.loadCurrentProjectId();

    const legacy = projectStorage.migrateLegacyData();
    if (legacy && projectList.length === 0) {
      const id = projectStorage.generateProjectId();
      projectList = [{ id, name: 'Untitled', updatedAt: Date.now() }];
      projectStorage.saveProjectData(id, legacy);
      projectStorage.saveProjects(projectList);
      projectStorage.saveCurrentProjectId(id);
      projectStorage.clearLegacyData();
      projectId = id;
    }

    if (projectList.length === 0) {
      const id = projectStorage.generateProjectId();
      projectList = [{ id, name: 'Untitled', updatedAt: Date.now() }];
      projectStorage.saveProjects(projectList);
      projectStorage.saveCurrentProjectId(id);
      projectId = id;
    }

    if (!projectId || !projectList.some((p) => p.id === projectId)) {
      projectId = projectList[0].id;
      projectStorage.saveCurrentProjectId(projectId);
    }

    setProjects(projectList);
    setCurrentProjectId(projectId);

    let tabId = projectStorage.loadCurrentTabId(projectId);
    let tabs = projectStorage.getProjectTabs(projectId);
    if (tabs.length === 0) {
      projectStorage.saveProjectData(projectId, getDefaultStoryData());
      tabs = projectStorage.getProjectTabs(projectId);
      tabId = tabs[0]?.id || null;
    }
    if (!tabId || !tabs.some((t) => t.id === tabId)) {
      tabId = tabs[0]?.id || null;
    }
    if (tabId) {
      projectStorage.saveCurrentTabId(projectId, tabId);
      setCurrentTabId(tabId);
      const tab = tabs.find((t) => t.id === tabId);
      setCurrentTabName(tab?.name || 'Story 1');
    }

    const data = projectStorage.getDocumentDataForProject(projectId, tabId);
    if (data) {
      setPersisted(normalizeStoryData(data, getDefaultSectionOrder, createEmptySections));
    } else {
      setPersisted(getDefaultStoryData());
    }

    setHasHydrated(true);
  }, [getDefaultStoryData]);

  const saveCurrentProjectToStorage = useCallback(() => {
    if (!hasHydrated || !currentProjectId || !currentTabId) return;
    projectStorage.saveTabData(currentProjectId, currentTabId, currentTabName, persistedRef.current);
  }, [hasHydrated, currentProjectId, currentTabId, currentTabName]);

  useEffect(() => {
    if (!hasHydrated || !currentProjectId || !currentTabId) return;
    projectStorage.saveTabData(currentProjectId, currentTabId, currentTabName, persisted);
  }, [hasHydrated, currentProjectId, currentTabId, currentTabName, persisted]);

  useEffect(() => {
    const flush = () => saveCurrentProjectToStorage();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [saveCurrentProjectToStorage]);

  useEffect(() => {
    if (settingsOpen) {
      const s = getSettings();
      setSettingsPresentationFont(s.presentationFont || 'Poppins');
      setSettingsPresentationSize(s.presentationFontSize || 'medium');
    }
  }, [settingsOpen]);

  useEffect(() => {
    const unsub = initThemeSync();
    const handler = () => setThemeState(getTheme());
    window.addEventListener('saas-theme-change', handler);
    return () => {
      unsub?.();
      window.removeEventListener('saas-theme-change', handler);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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

  const handleUnifiedStoryChange = useCallback(
    (unified) => {
      setPersisted((prev) => ({
        ...prev,
        sectionsData: applyUnifiedStoryEdit(prev.sectionOrder, prev.sectionsData, unified),
      }));
    },
    []
  );

  const handleReorder = useCallback((newOrder) => {
    setPersisted((prev) => ({ ...prev, sectionOrder: newOrder }));
  }, []);

  const handleSentenceImageChange = useCallback((sectionId, sentenceIndex, url) => {
    setPersisted((prev) => {
      const section = prev.sectionsData[sectionId] ?? {};
      const content = section.content ?? '';
      const arr = Array.isArray(section.sentenceImages) ? [...section.sentenceImages] : [];
      const presentSceneImages = { ...normalizePresentSceneImages(section.presentSceneImages) };

      const scenes = getPresentScenes(content, {
        presentSceneImages,
        sentenceImages: arr,
      });
      const scene = scenes.find((s) => s.sentenceIndices.includes(sentenceIndex));
      const sceneStart = scene?.start ?? null;
      const indices = scene?.sentenceIndices?.length ? scene.sentenceIndices : [sentenceIndex];

      if (sceneStart != null) {
        const key = String(sceneStart);
        if (url) presentSceneImages[key] = url;
        else delete presentSceneImages[key];
      } else if (url) {
        while (arr.length <= sentenceIndex) arr.push('');
        arr[sentenceIndex] = url;
      }

      for (const i of indices) {
        while (arr.length <= i) arr.push('');
        if (sceneStart != null || !url) arr[i] = '';
      }

      return {
        ...prev,
        sectionsData: {
          ...prev.sectionsData,
          [sectionId]: { ...section, presentSceneImages, sentenceImages: arr },
        },
      };
    });
  }, []);

  const handleSentenceImageLockChange = useCallback((sectionId, sentenceIndex, locked) => {
    setPersisted((prev) => {
      const section = prev.sectionsData[sectionId] ?? {};
      const content = section.content ?? '';
      const sceneStart = getSceneStartForSentenceIndex(content, sentenceIndex);
      if (sceneStart == null) return prev;
      const presentSceneImageLocks = {
        ...normalizePresentSceneImageLocks(section.presentSceneImageLocks),
      };
      const key = String(sceneStart);
      if (locked) presentSceneImageLocks[key] = true;
      else delete presentSceneImageLocks[key];
      return {
        ...prev,
        sectionsData: {
          ...prev.sectionsData,
          [sectionId]: { ...section, presentSceneImageLocks },
        },
      };
    });
  }, []);

  const handleHeadlineSpansChange = useCallback((sectionId, headlineSpans) => {
    setPersisted((prev) => ({
      ...prev,
      sectionsData: {
        ...prev.sectionsData,
        [sectionId]: { ...prev.sectionsData[sectionId], headlineSpans },
      },
    }));
  }, []);

  const handleRotateLineSpansChange = useCallback((sectionId, rotateLineSpans) => {
    setPersisted((prev) => ({
      ...prev,
      sectionsData: {
        ...prev.sectionsData,
        [sectionId]: { ...prev.sectionsData[sectionId], rotateLineSpans },
      },
    }));
  }, []);

  const handleBulletLineSpansChange = useCallback((sectionId, bulletLineSpans) => {
    setPersisted((prev) => ({
      ...prev,
      sectionsData: {
        ...prev.sectionsData,
        [sectionId]: { ...prev.sectionsData[sectionId], bulletLineSpans },
      },
    }));
  }, []);

  const handlePresentStyleSpansChange = useCallback((sectionId, presentStyleSpans) => {
    setPersisted((prev) => ({
      ...prev,
      sectionsData: {
        ...prev.sectionsData,
        [sectionId]: { ...prev.sectionsData[sectionId], presentStyleSpans },
      },
    }));
  }, []);

  const handleBackgroundOpacityChange = useCallback((value) => {
    saveSettings({ ...getSettings(), presentationBackgroundOpacity: value });
  }, []);

  const handleMagicImages = useCallback(async () => {
    setMagicImageLoading(true);
    try {
      const source = getSettings().editSentenceImageSource;
      const openaiApiKey = getSettings().openaiApiKey;
      const sketchInstructions = getSettings().editSketchGenerationInstructions ?? '';
      for (const sectionId of sectionOrder) {
        const section = sectionsData[sectionId];
        const content = section?.content ?? '';
        const scenes = getPresentScenes(content, {
          presentSceneImages: section?.presentSceneImages ?? {},
          sentenceImages: section?.sentenceImages ?? [],
        });
        for (const sc of scenes) {
          if (sc.imageUrl) continue;
          const query = sc.text.slice(0, 80).trim();
          if (!query) continue;
          try {
            const result = await resolveSentenceBackgroundImage({
              sentenceText: query,
              source,
              openaiApiKey,
              sketchInstructions,
            });
            if (result?.url) {
              handleSentenceImageChange(sectionId, sc.primarySentenceIndex, result.url, result.credit);
            }
          } catch (err) {
            setError(err.message || 'Failed to set background image.');
          }
        }
      }
    } finally {
      setMagicImageLoading(false);
    }
  }, [sectionOrder, sectionsData, handleSentenceImageChange]);

  const hasAnyBgImages = useMemo(() => {
    for (const sectionId of sectionOrder) {
      const section = sectionsData[sectionId];
      if (!section) continue;
      if (String(section.backgroundImageUrl ?? '').trim()) return true;
      const sceneImgs = Object.values(normalizePresentSceneImages(section.presentSceneImages ?? {}));
      if (sceneImgs.some((u) => String(u).trim())) return true;
      const imgs = section.sentenceImages ?? [];
      if (imgs.some((u) => String(u ?? '').trim())) return true;
    }
    return false;
  }, [sectionOrder, sectionsData]);

  const handleRemoveAllBgImages = useCallback(() => {
    if (
      !window.confirm(
        'Remove all present-screen backgrounds and section fallback images from this story? Locked images will be cleared too.'
      )
    ) {
      return;
    }
    setPersisted((prev) => {
      const nextSections = { ...prev.sectionsData };
      for (const sectionId of prev.sectionOrder) {
        const section = nextSections[sectionId];
        if (!section) continue;
        const images = section.sentenceImages;
        const clearedImages = Array.isArray(images) ? images.map(() => '') : [];
        const locks = section.sentenceImageLocks;
        const clearedLocks = Array.isArray(locks) ? locks.map(() => false) : [];
        nextSections[sectionId] = {
          ...section,
          sentenceImages: clearedImages,
          sentenceImageLocks: clearedLocks,
          presentSceneImages: {},
          presentSceneImageLocks: {},
          backgroundImageUrl: undefined,
          backgroundImageCredit: undefined,
        };
      }
      return { ...prev, sectionsData: nextSections };
    });
  }, []);

  const createProject = useCallback(() => {
    const id = projectStorage.generateProjectId();
    const newProject = { id, name: 'Untitled', updatedAt: Date.now() };
    const updated = [...projects, newProject];
    projectStorage.saveProjects(updated);
    projectStorage.saveCurrentProjectId(id);
    const defaultData = getDefaultStoryData();
    projectStorage.saveProjectData(id, defaultData);
    setProjects(updated);
    setCurrentProjectId(id);
    const newTabs = projectStorage.getProjectTabs(id);
    const firstTabId = newTabs[0]?.id || null;
    setCurrentTabId(firstTabId);
    setCurrentTabName(newTabs[0]?.name || 'Story 1');
    projectStorage.saveCurrentTabId(id, firstTabId);
    setPersisted(defaultData);
  }, [projects, getDefaultStoryData]);

  const switchProject = useCallback((id) => {
    if (id === currentProjectId) return;
    saveCurrentProjectToStorage();
    const tabs = projectStorage.getProjectTabs(id);
    let tabId = projectStorage.loadCurrentTabId(id);
    if (!tabId || !tabs.some((t) => t.id === tabId)) tabId = tabs[0]?.id || null;
    if (tabId) {
      projectStorage.saveCurrentTabId(id, tabId);
      setCurrentTabId(tabId);
      const tab = tabs.find((t) => t.id === tabId);
      setCurrentTabName(tab?.name || 'Story 1');
    }
    const data = projectStorage.getDocumentDataForProject(id, tabId);
    setPersisted(
      data
        ? normalizeStoryData(data, getDefaultSectionOrder, createEmptySections)
        : getDefaultStoryData()
    );
    projectStorage.saveCurrentProjectId(id);
    setCurrentProjectId(id);
  }, [currentProjectId, saveCurrentProjectToStorage, getDefaultStoryData]);

  const switchTab = useCallback((tabId) => {
    if (tabId === currentTabId || !currentProjectId) return;
    saveCurrentProjectToStorage();
    const tabs = projectStorage.getProjectTabs(currentProjectId);
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    projectStorage.saveCurrentTabId(currentProjectId, tabId);
    setCurrentTabId(tabId);
    setCurrentTabName(tab.name || 'Story');
    const data = projectStorage.getDocumentDataForProject(currentProjectId, tabId);
    setPersisted(
      data
        ? normalizeStoryData(data, getDefaultSectionOrder, createEmptySections)
        : getDefaultStoryData()
    );
  }, [currentProjectId, currentTabId, saveCurrentProjectToStorage, getDefaultStoryData]);

  const addTab = useCallback(() => {
    if (!currentProjectId) return;
    const defaultData = getDefaultStoryData();
    const tabId = projectStorage.addProjectTab(currentProjectId, 'New story', defaultData);
    projectStorage.saveCurrentTabId(currentProjectId, tabId);
    setCurrentTabId(tabId);
    setCurrentTabName('New story');
    setPersisted(defaultData);
  }, [currentProjectId, getDefaultStoryData]);

  const deleteTab = useCallback((tabId) => {
    if (!currentProjectId) return;
    saveCurrentProjectToStorage();
    const nextTabId = projectStorage.removeProjectTab(currentProjectId, tabId);
    if (nextTabId === null) return;
    if (tabId === currentTabId) {
      const tabs = projectStorage.getProjectTabs(currentProjectId);
      const nextTab = tabs.find((t) => t.id === nextTabId);
      if (nextTab) {
        setCurrentTabId(nextTabId);
        setCurrentTabName(nextTab.name);
        projectStorage.saveCurrentTabId(currentProjectId, nextTabId);
        const data = projectStorage.getDocumentDataForProject(currentProjectId, nextTabId);
        setPersisted(
          data
            ? normalizeStoryData(data, getDefaultSectionOrder, createEmptySections)
            : getDefaultStoryData()
        );
      }
    }
  }, [currentProjectId, currentTabId, saveCurrentProjectToStorage, getDefaultStoryData]);

  const renameTab = useCallback((tabId, name) => {
    if (!currentProjectId) return;
    projectStorage.renameProjectTab(currentProjectId, tabId, name);
    if (tabId === currentTabId) {
      setCurrentTabName((name || 'Story').trim());
    }
  }, [currentProjectId, currentTabId]);

  const renameProject = useCallback((id, name) => {
    if (!name.trim()) return;
    const updated = projects.map((p) =>
      p.id === id ? { ...p, name: name.trim(), updatedAt: Date.now() } : p
    );
    projectStorage.saveProjects(updated);
    setProjects(updated);
  }, [projects]);

  const deleteProject = useCallback((id) => {
    if (projects.length <= 1) return;
    const idx = projects.findIndex((p) => p.id === id);
    const nextIdToSwitch = idx > 0 ? projects[idx - 1].id : projects[idx + 1]?.id;
    const updated = projects.filter((p) => p.id !== id);
    projectStorage.saveProjects(updated);
    projectStorage.deleteProjectData(id);
    if (id === currentProjectId && nextIdToSwitch) {
      switchProject(nextIdToSwitch);
    } else if (id === currentProjectId) {
      setCurrentProjectId(updated[0]?.id || null);
      projectStorage.saveCurrentProjectId(updated[0]?.id || null);
    }
    setProjects(updated);
  }, [projects, currentProjectId, switchProject]);

  const handleCopyStory = useCallback(async () => {
    const output = formatStoryForClipboard(sectionOrder, sectionDefs, sectionsData);
    if (!output.trim()) {
      alert('No story copy to copy.');
      return;
    }
    try {
      await copyTextToClipboard(output);
      setCopyFeedback(true);
      if (copyFeedbackTimerRef.current) clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Could not copy to clipboard. Check browser permissions and try again.');
    }
  }, [sectionOrder, sectionDefs, sectionsData]);

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current) clearTimeout(copyFeedbackTimerRef.current);
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
        storyLength,
        sectionsData,
        sectionOrder,
        sectionDefs,
        targetOutcomeInstruction: getTargetOutcome(targetOutcome).promptInstruction,
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

        <ProjectSelector
          projects={projects}
          currentProjectId={currentProjectId}
          currentProjectName={projects.find((p) => p.id === currentProjectId)?.name}
          onSwitchProject={switchProject}
          onCreateProject={createProject}
          onRenameProject={renameProject}
          onDeleteProject={deleteProject}
        />

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
            onClick={() => {
              if (view === 'present') leavePresentForEdit(presentStartIndex);
              else setView('edit');
            }}
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
          <button
            type="button"
            className={`app-settings-btn${copyFeedback ? ' app-settings-btn--copied' : ''}`}
            onClick={handleCopyStory}
            title={copyFeedback ? 'Copied!' : 'Copy all story copy to clipboard'}
            aria-label="Copy all story copy to clipboard"
          >
            {copyFeedback ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
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
          <button
            type="button"
            className="app-header-text-btn"
            onClick={handleRemoveAllBgImages}
            disabled={!hasAnyBgImages}
            title="Clear every sentence background and section fallback image in this story"
          >
            Remove all bg images
          </button>
          <PresentationAnimationPopover
            rules={presentationAnimationRules}
            onApply={(rules) => setPersisted((prev) => ({ ...prev, presentationAnimationRules: rules }))}
          />
          <FontSettingsPopover onApply={() => setSettingsVersion((v) => v + 1)} />
          <BackgroundAnimationPopover onApply={() => setSettingsVersion((v) => v + 1)} />
          <RecordingOptionsPopover onApply={() => setSettingsVersion((v) => v + 1)} />
          <ThemeToggle theme={theme} onToggle={(t) => { setTheme(t); setThemeState(t); }} className="app-settings-btn" />
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

      <TabBar
        tabs={currentProjectId ? projectStorage.getProjectTabs(currentProjectId) : []}
        currentTabId={currentTabId}
        onSwitchTab={switchTab}
        onAddTab={addTab}
        onDeleteTab={deleteTab}
        onRenameTab={renameTab}
        disabled={!hasHydrated}
        defaultTabName="Story"
        addTitle="Add story"
      />

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
              Choose a framework and length, then generate. Your story appears as one continuous script — section structure is used behind the scenes for generation.
            </p>
            <label className="story-framework-label" htmlFor="story-target-outcome">
              Target outcome
            </label>
            <select
              id="story-target-outcome"
              className="story-outcome-select"
              value={targetOutcome}
              onChange={(e) => setPersisted((prev) => ({ ...prev, targetOutcome: e.target.value }))}
              disabled={isGenerating}
            >
              {TARGET_OUTCOMES.map((outcome) => (
                <option key={outcome.id} value={outcome.id} title={outcome.description}>
                  {outcome.name}
                </option>
              ))}
            </select>
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
          <UnifiedStoryEditor
            sectionOrder={sectionOrder}
            sectionsData={sectionsData}
            onUnifiedChange={handleUnifiedStoryChange}
            disabled={isGenerating}
          />
        </div>
      </main>
      )}

      {view === 'edit' && (
        <main className="app-main app-main--single">
          <EditView
            sectionOrder={sectionOrder}
            sectionsData={sectionsData}
            onUnifiedContentChange={handleUnifiedStoryChange}
            onHeadlineSpansChange={handleHeadlineSpansChange}
            onRotateLineSpansChange={handleRotateLineSpansChange}
            onBulletLineSpansChange={handleBulletLineSpansChange}
            onPresentStyleSpansChange={handlePresentStyleSpansChange}
            onSentenceImageChange={handleSentenceImageChange}
            onSentenceImageLockChange={handleSentenceImageLockChange}
            onBackgroundOpacityChange={handleBackgroundOpacityChange}
            onPresentStartChange={setPresentStartIndex}
            scrollToPresentSceneIndex={editScrollPresentIndex}
            onPresentSceneScrollDone={() => setEditScrollPresentIndex(null)}
            presentationAnimationRules={presentationAnimationRules}
          />
        </main>
      )}

      {view === 'present' && (
        <PresentView
          sectionOrder={sectionOrder}
          sectionsData={sectionsData}
          onExit={leavePresentForEdit}
          onPresentIndexChange={setPresentStartIndex}
          initialIndex={presentStartIndex}
          animationRules={presentationAnimationRules}
          settingsVersion={settingsVersion}
        />
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={() => {
          saveSettings({
            ...getSettings(),
            presentationFont: settingsPresentationFont,
            presentationFontSize: settingsPresentationSize,
          });
        }}
      >
        <div className="shared-settings-field">
          <label htmlFor="sw-presentation-font">Presentation font</label>
          <select
            id="sw-presentation-font"
            value={settingsPresentationFont}
            onChange={(e) => setSettingsPresentationFont(e.target.value)}
          >
            {PRESENTATION_FONTS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="shared-settings-field">
          <label htmlFor="sw-presentation-size">Presentation size</label>
          <select
            id="sw-presentation-size"
            value={settingsPresentationSize}
            onChange={(e) => setSettingsPresentationSize(e.target.value)}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      </SettingsModal>
    </div>
  );
}

export default App;
