/**
 * Project and tab storage for Conversation Animator - InfoGraphics-style
 */
(function (global) {
  const PROJECTS_KEY = 'conversationProjects';
  const CURRENT_PROJECT_KEY = 'conversationCurrentProject';
  const CURRENT_TAB_KEY = 'conversationCurrentTab_';
  const PROJECT_DATA_PREFIX = 'conversationProject_';
  const LEGACY_KEY = 'savedConversations';

  function getProjectStorageKey(id) {
    return PROJECT_DATA_PREFIX + id;
  }

  function generateId() {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  function generateTabId() {
    return 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  function loadProjects() {
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list : [];
      }
    } catch (e) {
      console.error('Error loading projects:', e);
    }
    return [];
  }

  function saveProjects(projects) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }

  function loadCurrentProjectId() {
    return localStorage.getItem(CURRENT_PROJECT_KEY) || null;
  }

  function saveCurrentProjectId(id) {
    if (id) localStorage.setItem(CURRENT_PROJECT_KEY, id);
    else localStorage.removeItem(CURRENT_PROJECT_KEY);
  }

  function loadCurrentTabId(projectId) {
    return projectId ? localStorage.getItem(CURRENT_TAB_KEY + projectId) || null : null;
  }

  function saveCurrentTabId(projectId, tabId) {
    if (projectId && tabId) {
      localStorage.setItem(CURRENT_TAB_KEY + projectId, tabId);
    }
  }

  function loadProjectData(id) {
    try {
      const raw = localStorage.getItem(getProjectStorageKey(id));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Error loading project:', e);
    }
    return null;
  }

  function normalizeProjectData(raw) {
    if (!raw) return { tabs: [] };
    if (Array.isArray(raw.tabs) && raw.tabs.length > 0) return raw;
    if (raw.messages && Array.isArray(raw.messages)) {
      const tabId = generateTabId();
      return { tabs: [{ id: tabId, name: 'Conversation 1', data: raw }] };
    }
    return { tabs: [] };
  }

  function getProjectTabs(projectId) {
    const raw = loadProjectData(projectId);
    const normalized = normalizeProjectData(raw);
    return normalized.tabs.map(function (t) {
      return { id: t.id, name: t.name };
    });
  }

  function getDocumentDataForProject(projectId, tabId) {
    const raw = loadProjectData(projectId);
    const normalized = normalizeProjectData(raw);
    if (normalized.tabs.length === 0) return null;
    const tab = tabId
      ? normalized.tabs.find(function (t) { return t.id === tabId; })
      : normalized.tabs[0];
    return tab ? tab.data : null;
  }

  function saveTabData(projectId, tabId, tabName, data) {
    const raw = loadProjectData(projectId);
    const normalized = raw ? normalizeProjectData(raw) : { tabs: [] };
    const idx = normalized.tabs.findIndex(function (t) { return t.id === tabId; });
    const tabEntry = { id: tabId, name: tabName || 'Conversation', data: data };
    if (idx >= 0) {
      normalized.tabs[idx] = Object.assign({}, normalized.tabs[idx], tabEntry);
    } else {
      normalized.tabs.push(tabEntry);
    }
    localStorage.setItem(getProjectStorageKey(projectId), JSON.stringify(normalized));
  }

  function addProjectTab(projectId, name) {
    const raw = loadProjectData(projectId);
    const normalized = raw ? normalizeProjectData(raw) : { tabs: [] };
    const tabId = generateTabId();
    const defaultData = {
      messages: [],
      settings: {
        profileName: 'My Brain',
        messageCount: '147',
        timeDisplay: '14:47',
        profilePic: null,
        bgType: 'color',
        bgColor: '#000000',
        bgImage: null,
        bgVideo: null,
        bgMusic: null,
        senderDelay: '1000',
        receiverDelay: '1500',
        typingDelay: '500',
        typingPerChar: '30',
        typingSpeed: '50',
        soundEffects: true,
        typingVolume: '50',
        sendVolume: '50',
        receiveVolume: '50'
      }
    };
    normalized.tabs.push({ id: tabId, name: name || 'New conversation', data: defaultData });
    localStorage.setItem(getProjectStorageKey(projectId), JSON.stringify(normalized));
    return tabId;
  }

  function removeProjectTab(projectId, tabId) {
    const raw = loadProjectData(projectId);
    const normalized = normalizeProjectData(raw);
    const idx = normalized.tabs.findIndex(function (t) { return t.id === tabId; });
    if (idx < 0) return null;
    normalized.tabs.splice(idx, 1);
    if (normalized.tabs.length === 0) return null;
    const nextTab = normalized.tabs[Math.min(idx, normalized.tabs.length - 1)];
    localStorage.setItem(getProjectStorageKey(projectId), JSON.stringify(normalized));
    return nextTab.id;
  }

  function renameProjectTab(projectId, tabId, name) {
    const raw = loadProjectData(projectId);
    const normalized = normalizeProjectData(raw);
    const tab = normalized.tabs.find(function (t) { return t.id === tabId; });
    if (tab) {
      tab.name = (name || 'Conversation').trim();
      localStorage.setItem(getProjectStorageKey(projectId), JSON.stringify(normalized));
    }
  }

  function deleteProjectData(id) {
    localStorage.removeItem(getProjectStorageKey(id));
  }

  function migrateLegacyData() {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        const tabs = [];
        Object.keys(parsed).forEach(function (name) {
          const d = parsed[name];
          if (d && (d.messages || d.settings)) {
            tabs.push({
              id: generateTabId(),
              name: name,
              data: {
                messages: Array.isArray(d.messages) ? d.messages : [],
                settings: d.settings || {}
              }
            });
          }
        });
        if (tabs.length > 0) return { tabs: tabs };
      }
    } catch (e) {}
    return null;
  }

  function clearLegacyData() {
    localStorage.removeItem(LEGACY_KEY);
  }

  function generateProjectId() {
    return generateId();
  }

  global.ConversationProjectStorage = {
    loadProjects: loadProjects,
    saveProjects: saveProjects,
    loadCurrentProjectId: loadCurrentProjectId,
    saveCurrentProjectId: saveCurrentProjectId,
    loadCurrentTabId: loadCurrentTabId,
    saveCurrentTabId: saveCurrentTabId,
    loadProjectData: loadProjectData,
    getProjectTabs: getProjectTabs,
    getDocumentDataForProject: getDocumentDataForProject,
    saveTabData: saveTabData,
    addProjectTab: addProjectTab,
    removeProjectTab: removeProjectTab,
    renameProjectTab: renameProjectTab,
    deleteProjectData: deleteProjectData,
    migrateLegacyData: migrateLegacyData,
    clearLegacyData: clearLegacyData,
    generateProjectId: generateProjectId
  };
})(typeof window !== 'undefined' ? window : this);
