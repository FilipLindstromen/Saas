document.addEventListener('DOMContentLoaded', () => {
    const PS = window.ConversationProjectStorage;
    const API_KEYS = window.ConversationApiKeys;

    // Theme Toggle - global saas-apps-theme (syncs across all apps)
    const STORAGE_KEY = 'saas-apps-theme';
    const themeToggle = document.getElementById('theme-toggle');
    const themeIconEl = themeToggle && themeToggle.querySelector('.theme-icon-svg');
    const html = document.documentElement;

    function migrateTheme() {
        if (localStorage.getItem(STORAGE_KEY)) return;
        var keys = ['theme', 'appTheme', 'typographyTheme', 'cw_theme', 'reelRecorderTheme'];
        for (var i = 0; i < keys.length; i++) {
            var v = localStorage.getItem(keys[i]);
            if (v === 'light' || v === 'dark') {
                localStorage.setItem(STORAGE_KEY, v);
                return;
            }
        }
    }
    function getTheme() {
        migrateTheme();
        var t = localStorage.getItem(STORAGE_KEY);
        if (t === 'light' || t === 'dark') return t;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    function setTheme(theme) {
        html.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
        if (themeIconEl) {
            themeIconEl.innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
        }
    }
    var SUN_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    var MOON_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    setTheme(getTheme());
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            setTheme(getTheme() === 'dark' ? 'light' : 'dark');
        });
    }
    window.addEventListener('storage', function(e) {
        if (e.key === STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
            html.setAttribute('data-theme', e.newValue);
            if (themeIconEl) themeIconEl.innerHTML = e.newValue === 'dark' ? SUN_SVG : MOON_SVG;
        }
    });

    // Settings button (direct open)
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => openSettingsOverlay());
    }

    // Left panel tabs - Profile / Conversation
    document.querySelectorAll('.left-settings-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            const tabId = this.getAttribute('data-tab');
            document.querySelectorAll('.left-settings-tab').forEach(function (t) { t.classList.remove('active'); });
            document.querySelectorAll('.left-settings-section').forEach(function (s) { s.classList.remove('active'); });
            this.classList.add('active');
            const section = document.getElementById('section-' + tabId);
            if (section) section.classList.add('active');
        });
    });

    // Panel resize - adjustable left and right panel widths
    const PANEL_STORAGE_KEY = 'conversationAnimator_panelWidths';
    const LEFT_MIN = 200;
    const LEFT_MAX = 500;
    const RIGHT_MIN = 220;
    const RIGHT_MAX = 500;
    const LEFT_DEFAULT = 280;
    const RIGHT_DEFAULT = 300;

    function loadPanelWidths() {
        try {
            const raw = localStorage.getItem(PANEL_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    left: Math.max(LEFT_MIN, Math.min(LEFT_MAX, Number(parsed.left) || LEFT_DEFAULT)),
                    right: Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, Number(parsed.right) || RIGHT_DEFAULT))
                };
            }
        } catch (e) { /* ignore */ }
        return { left: LEFT_DEFAULT, right: RIGHT_DEFAULT };
    }

    function savePanelWidths(left, right) {
        try {
            localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify({ left, right }));
        } catch (e) { /* ignore */ }
    }

    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const resizeHandleLeft = document.getElementById('resize-handle-left');
    const resizeHandleRight = document.getElementById('resize-handle-right');

    let panelWidths = loadPanelWidths();
    if (leftPanel) leftPanel.style.width = panelWidths.left + 'px';
    if (rightPanel) rightPanel.style.width = panelWidths.right + 'px';

    function setupResize(handle, isLeft) {
        if (!handle) return;
        handle.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            handle.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            const startX = e.clientX;
            const startW = isLeft ? panelWidths.left : panelWidths.right;

            function onMove(ev) {
                const dx = ev.clientX - startX;
                const delta = isLeft ? dx : -dx;
                const newW = Math.max(isLeft ? LEFT_MIN : RIGHT_MIN, Math.min(isLeft ? LEFT_MAX : RIGHT_MAX, startW + delta));
                if (isLeft) {
                    panelWidths.left = newW;
                    if (leftPanel) leftPanel.style.width = newW + 'px';
                } else {
                    panelWidths.right = newW;
                    if (rightPanel) rightPanel.style.width = newW + 'px';
                }
            }

            function onUp() {
                handle.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                savePanelWidths(panelWidths.left, panelWidths.right);
            }

            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
    }

    setupResize(resizeHandleLeft, true);
    setupResize(resizeHandleRight, false);
    
    const messagesScriptContainer = document.getElementById('messages-script');
    const addMessageBtn = document.getElementById('add-message-btn');
    const previewBtn = document.getElementById('preview-btn');
    const exportBtn = document.getElementById('export-btn');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const phoneScreen = document.getElementById('phone-screen');
    const typingIndicator = document.getElementById('typing-indicator');
    
    const senderDelayInput = document.getElementById('sender-delay');
    const receiverDelayInput = document.getElementById('receiver-delay');
    const typingDelayInput = document.getElementById('typing-delay');
    const typingPerCharInput = document.getElementById('typing-per-char');
    const typingSpeedInput = document.getElementById('typing-speed');
    
    const typingVolumeInput = document.getElementById('typing-volume');
    const sendVolumeInput = document.getElementById('send-volume');
    const receiveVolumeInput = document.getElementById('receive-volume');
    
    const profileNameInput = document.getElementById('profile-name');
    const profilePictureInput = document.getElementById('profile-picture');
    const messageCountInput = document.getElementById('message-count');
    const headerProfileName = document.getElementById('header-profile-name');
    const headerProfilePic = document.getElementById('header-profile-pic');
    const backCount = document.querySelector('.back-count');
    
    const bgTypeSelect = document.getElementById('bg-type');
    const bgColorInput = document.getElementById('bg-color');
    const bgImageInput = document.getElementById('bg-image');
    const bgVideoInput = document.getElementById('bg-video');
    const bgMusicInput = document.getElementById('bg-music');
    const chatBackground = document.getElementById('chat-background');
    const bgVideoElement = document.getElementById('bg-video-element');
    const bgMusicElement = document.getElementById('bg-music-element');
    
    const saveNameInput = document.getElementById('save-name');
    const saveBtn = document.getElementById('save-btn');
    const loadBtn = document.getElementById('load-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const savedConversationsSelect = document.getElementById('saved-conversations');
    const soundEffectsCheckbox = document.getElementById('sound-effects');

    let messageCount = 0;
    let isAnimating = false;
    let shouldStopAnimation = false;
    let profilePicUrl = null;
    let backgroundImageUrl = null;
    let backgroundVideoUrl = null;
    let backgroundMusicUrl = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let audioContext = null;

    let currentProjectId = null;
    let currentTabId = null;
    let currentTabName = 'Conversation 1';
    let projects = [];
    let saveTimeout = null;

    function collectState() {
        var panelName = document.getElementById('panel-profile-name');
        var panelCount = document.getElementById('panel-message-count');
        var panelTime = document.getElementById('panel-time-display');
        return {
            messages: getMessages(),
            settings: {
                profileName: panelName ? panelName.value : profileNameInput.value,
                messageCount: panelCount ? panelCount.value : messageCountInput.value,
                timeDisplay: panelTime ? panelTime.value : (document.querySelector('.time') ? document.querySelector('.time').textContent : '14:47'),
                profilePic: profilePicUrl,
                bgType: bgTypeSelect.value,
                bgColor: bgColorInput.value,
                bgImage: backgroundImageUrl,
                bgVideo: backgroundVideoUrl,
                bgMusic: backgroundMusicUrl,
                senderDelay: senderDelayInput.value,
                receiverDelay: receiverDelayInput.value,
                typingDelay: typingDelayInput.value,
                typingPerChar: typingPerCharInput.value,
                typingSpeed: typingSpeedInput.value,
                soundEffects: soundEffectsCheckbox.checked,
                typingVolume: typingVolumeInput.value,
                sendVolume: sendVolumeInput.value,
                receiveVolume: receiveVolumeInput.value
            }
        };
    }

    function applyState(data) {
        if (!data || !data.settings) return;
        const s = data.settings;
        var profileName = s.profileName || 'My Brain';
        var msgCount = s.messageCount || '147';
        var timeDisplay = s.timeDisplay || '14:47';
        profileNameInput.value = profileName;
        headerProfileName.textContent = profileName;
        messageCountInput.value = msgCount;
        backCount.textContent = msgCount;
        var panelName = document.getElementById('panel-profile-name');
        var panelCount = document.getElementById('panel-message-count');
        var panelTime = document.getElementById('panel-time-display');
        var timeEl = document.querySelector('.time');
        if (panelName) panelName.value = profileName;
        if (panelCount) panelCount.value = msgCount;
        if (panelTime) panelTime.value = timeDisplay;
        if (timeEl) timeEl.textContent = timeDisplay;
        profilePicUrl = s.profilePic || null;
        if (profilePicUrl) {
            headerProfilePic.src = profilePicUrl;
            headerProfilePic.style.display = 'block';
        } else headerProfilePic.style.display = '';
        bgTypeSelect.value = s.bgType || 'color';
        bgColorInput.value = s.bgColor || '#000000';
        backgroundImageUrl = s.bgImage || null;
        backgroundVideoUrl = s.bgVideo || null;
        backgroundMusicUrl = s.bgMusic || null;
        if (backgroundMusicUrl) bgMusicElement.src = backgroundMusicUrl;
        senderDelayInput.value = s.senderDelay || '1000';
        receiverDelayInput.value = s.receiverDelay || '1500';
        typingDelayInput.value = s.typingDelay || '500';
        typingPerCharInput.value = s.typingPerChar || '30';
        typingSpeedInput.value = s.typingSpeed || '50';
        soundEffectsCheckbox.checked = s.soundEffects !== false;
        typingVolumeInput.value = s.typingVolume || '50';
        sendVolumeInput.value = s.sendVolume || '50';
        receiveVolumeInput.value = s.receiveVolume || '50';
        document.getElementById('sender-delay-value').textContent = s.senderDelay || '1000';
        document.getElementById('receiver-delay-value').textContent = s.receiverDelay || '1500';
        document.getElementById('typing-delay-value').textContent = s.typingDelay || '500';
        document.getElementById('typing-per-char-value').textContent = s.typingPerChar || '30';
        document.getElementById('typing-speed-value').textContent = s.typingSpeed || '50';
        document.getElementById('typing-volume-value').textContent = s.typingVolume || '50';
        document.getElementById('send-volume-value').textContent = s.sendVolume || '50';
        document.getElementById('receive-volume-value').textContent = s.receiveVolume || '50';
        updateBackground();
        messagesScriptContainer.innerHTML = '';
        messageCount = 0;
        (data.messages || []).forEach(function (m) {
            addMessageInput(m.text, m.sender, m.delay || 0);
        });
    }

    function saveCurrentTab() {
        if (!currentProjectId || !currentTabId) return;
        PS.saveTabData(currentProjectId, currentTabId, currentTabName, collectState());
    }

    function debouncedSave() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveCurrentTab, 500);
    }

    function initProjectsAndTabs() {
        let projectList = PS.loadProjects();
        let projectId = PS.loadCurrentProjectId();
        const legacy = PS.migrateLegacyData();
        if (legacy && legacy.tabs && legacy.tabs.length > 0 && projectList.length === 0) {
            const id = PS.generateProjectId();
            projectList = [{ id: id, name: 'Migrated', updatedAt: Date.now() }];
            PS.saveProjects(projectList);
            PS.saveCurrentProjectId(id);
            legacy.tabs.forEach(function (t) {
                PS.saveTabData(id, t.id, t.name, { messages: t.data?.messages || [], settings: t.data?.settings || {} });
            });
            PS.saveCurrentTabId(id, legacy.tabs[0].id);
            PS.clearLegacyData();
            projectId = id;
        }
        if (projectList.length === 0) {
            const id = PS.generateProjectId();
            projectList = [{ id: id, name: 'Untitled', updatedAt: Date.now() }];
            PS.saveProjects(projectList);
            PS.saveCurrentProjectId(id);
            const tabId = PS.addProjectTab(id, 'Conversation 1');
            PS.saveCurrentTabId(id, tabId);
            projectId = id;
        }
        if (!projectId || !projectList.some(function (p) { return p.id === projectId; })) {
            projectId = projectList[0].id;
            PS.saveCurrentProjectId(projectId);
        }
        projects = projectList;
        currentProjectId = projectId;
        let tabId = PS.loadCurrentTabId(projectId);
        let tabs = PS.getProjectTabs(projectId);
        if (tabs.length === 0) {
            tabId = PS.addProjectTab(projectId, 'Conversation 1');
            tabs = PS.getProjectTabs(projectId);
        }
        if (!tabId || !tabs.some(function (t) { return t.id === tabId; })) {
            tabId = tabs[0].id;
        }
        PS.saveCurrentTabId(projectId, tabId);
        currentTabId = tabId;
        currentTabName = tabs.find(function (t) { return t.id === tabId; })?.name || 'Conversation 1';
        const data = PS.getDocumentDataForProject(projectId, tabId);
        applyState(data || { messages: [], settings: {} });
        renderProjectSelector();
        renderTabBar();
    }

    function renderProjectSelector() {
        const nameEl = document.getElementById('project-name');
        const listEl = document.getElementById('project-list');
        const proj = projects.find(function (p) { return p.id === currentProjectId; });
        nameEl.textContent = proj ? proj.name : 'Untitled';
        listEl.innerHTML = projects.map(function (p) {
            return '<div class="project-selector-item' + (p.id === currentProjectId ? ' active' : '') + '" data-id="' + p.id + '">' +
                '<span class="project-selector-item-name">' + (p.name || 'Untitled') + '</span>' +
                '<div class="project-selector-item-actions">' +
                '<button type="button" class="project-selector-action project-rename" data-id="' + p.id + '" title="Rename">✎</button>' +
                '<button type="button" class="project-selector-action project-delete" data-id="' + p.id + '" title="Delete" ' + (projects.length <= 1 ? 'disabled' : '') + '>🗑</button>' +
                '</div></div>';
        }).join('');
        listEl.querySelectorAll('.project-rename').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const id = btn.dataset.id;
                const p = projects.find(function (x) { return x.id === id; });
                const name = prompt('Rename project:', p ? p.name : 'Untitled');
                if (name != null && name.trim()) {
                    projects = projects.map(function (x) {
                        return x.id === id ? { ...x, name: name.trim(), updatedAt: Date.now() } : x;
                    });
                    PS.saveProjects(projects);
                    renderProjectSelector();
                }
            });
        });
        listEl.querySelectorAll('.project-delete').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (projects.length <= 1) return;
                const id = btn.dataset.id;
                if (!confirm('Delete this project?')) return;
                const idx = projects.findIndex(function (p) { return p.id === id; });
                const nextId = idx > 0 ? projects[idx - 1].id : projects[idx + 1]?.id;
                projects = projects.filter(function (p) { return p.id !== id; });
                PS.saveProjects(projects);
                PS.deleteProjectData(id);
                if (id === currentProjectId) {
                    currentProjectId = nextId;
                    PS.saveCurrentProjectId(nextId);
                    const tabs = PS.getProjectTabs(nextId);
                    currentTabId = tabs[0]?.id || null;
                    currentTabName = tabs[0]?.name || 'Conversation 1';
                    if (currentTabId) PS.saveCurrentTabId(nextId, currentTabId);
                    applyState(PS.getDocumentDataForProject(nextId, currentTabId) || { messages: [], settings: {} });
                }
                document.getElementById('project-dropdown').style.display = 'none';
                renderProjectSelector();
                renderTabBar();
            });
        });
    }

    function renderTabBar() {
        const tabs = currentProjectId ? PS.getProjectTabs(currentProjectId) : [];
        const container = document.getElementById('tab-bar-tabs');
        container.innerHTML = tabs.map(function (t) {
            return '<div class="tab-bar-tab' + (t.id === currentTabId ? ' active' : '') + '">' +
                '<button type="button" class="tab-bar-tab-btn" data-id="' + t.id + '">' + (t.name || 'Conversation') + '</button>' +
                (tabs.length > 1 ? '<button type="button" class="tab-bar-tab-close" data-id="' + t.id + '" title="Close">×</button>' : '') +
                '</div>';
        }).join('');
        container.querySelectorAll('.tab-bar-tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const id = btn.dataset.id;
                if (id === currentTabId) return;
                saveCurrentTab();
                currentTabId = id;
                currentTabName = tabs.find(function (t) { return t.id === id; })?.name || 'Conversation';
                PS.saveCurrentTabId(currentProjectId, id);
                applyState(PS.getDocumentDataForProject(currentProjectId, id) || { messages: [], settings: {} });
                renderTabBar();
            });
            btn.addEventListener('dblclick', function (e) {
                e.stopPropagation();
                const id = btn.dataset.id;
                const tab = tabs.find(function (t) { return t.id === id; });
                const name = prompt('Rename conversation:', tab ? tab.name : 'Conversation');
                if (name != null && name.trim()) {
                    PS.renameProjectTab(currentProjectId, id, name.trim());
                    if (id === currentTabId) currentTabName = name.trim();
                    renderTabBar();
                }
            });
        });
        container.querySelectorAll('.tab-bar-tab-close').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const id = btn.dataset.id;
                const nextId = PS.removeProjectTab(currentProjectId, id);
                if (!nextId) return;
                if (id === currentTabId) {
                    currentTabId = nextId;
                    currentTabName = PS.getProjectTabs(currentProjectId).find(function (t) { return t.id === nextId; })?.name || 'Conversation';
                    PS.saveCurrentTabId(currentProjectId, nextId);
                    applyState(PS.getDocumentDataForProject(currentProjectId, nextId) || { messages: [], settings: {} });
                }
                renderTabBar();
            });
        });
    }

    document.getElementById('project-trigger').addEventListener('click', function () {
        const dropdown = document.getElementById('project-dropdown');
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('project-list').addEventListener('click', function (e) {
        if (e.target.closest('.project-selector-action')) return;
        const item = e.target.closest('.project-selector-item');
        if (!item) return;
        const id = item.dataset.id;
        if (id === currentProjectId) {
            document.getElementById('project-dropdown').style.display = 'none';
            return;
        }
        saveCurrentTab();
        currentProjectId = id;
        PS.saveCurrentProjectId(id);
        const tabs = PS.getProjectTabs(id);
        currentTabId = tabs[0]?.id || null;
        currentTabName = tabs[0]?.name || 'Conversation 1';
        if (currentTabId) PS.saveCurrentTabId(id, currentTabId);
        applyState(PS.getDocumentDataForProject(id, currentTabId) || { messages: [], settings: {} });
        document.getElementById('project-dropdown').style.display = 'none';
        renderProjectSelector();
        renderTabBar();
    });

    document.getElementById('project-new').addEventListener('click', function () {
        const id = PS.generateProjectId();
        projects = [...projects, { id: id, name: 'Untitled', updatedAt: Date.now() }];
        PS.saveProjects(projects);
        PS.saveCurrentProjectId(id);
        const tabId = PS.addProjectTab(id, 'Conversation 1');
        PS.saveCurrentTabId(id, tabId);
        currentProjectId = id;
        currentTabId = tabId;
        currentTabName = 'Conversation 1';
        applyState({ messages: [], settings: {} });
        document.getElementById('project-dropdown').style.display = 'none';
        renderProjectSelector();
        renderTabBar();
    });

    document.getElementById('tab-add').addEventListener('click', function () {
        const tabId = PS.addProjectTab(currentProjectId, 'New conversation');
        PS.saveCurrentTabId(currentProjectId, tabId);
        currentTabId = tabId;
        currentTabName = 'New conversation';
        applyState({ messages: [], settings: {} });
        renderTabBar();
    });

    document.addEventListener('click', function (e) {
        if (!e.target.closest('#project-selector')) {
            document.getElementById('project-dropdown').style.display = 'none';
        }
    });

    // Slider value updates
    senderDelayInput.addEventListener('input', (e) => {
        document.getElementById('sender-delay-value').textContent = e.target.value;
    });
    
    receiverDelayInput.addEventListener('input', (e) => {
        document.getElementById('receiver-delay-value').textContent = e.target.value;
    });
    
    typingDelayInput.addEventListener('input', (e) => {
        document.getElementById('typing-delay-value').textContent = e.target.value;
    });
    
    typingPerCharInput.addEventListener('input', (e) => {
        document.getElementById('typing-per-char-value').textContent = e.target.value;
    });
    
    typingSpeedInput.addEventListener('input', (e) => {
        document.getElementById('typing-speed-value').textContent = e.target.value;
    });
    
    typingVolumeInput.addEventListener('input', (e) => {
        document.getElementById('typing-volume-value').textContent = e.target.value;
    });
    
    sendVolumeInput.addEventListener('input', (e) => {
        document.getElementById('send-volume-value').textContent = e.target.value;
    });
    
    receiveVolumeInput.addEventListener('input', (e) => {
        document.getElementById('receive-volume-value').textContent = e.target.value;
    });

    // Profile name update
    profileNameInput.addEventListener('input', () => {
        headerProfileName.textContent = profileNameInput.value || 'My Brain';
    });
    
    // Message count update
    messageCountInput.addEventListener('input', () => {
        backCount.textContent = messageCountInput.value || '147';
    });
    
    // Initialize profile name and message count on load
    headerProfileName.textContent = profileNameInput.value || 'My Brain';
    backCount.textContent = messageCountInput.value || '147';

    // Profile picture upload
    profilePictureInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                profilePicUrl = event.target.result;
                headerProfilePic.src = profilePicUrl;
                headerProfilePic.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    // Background type change
    bgTypeSelect.addEventListener('change', () => {
        const type = bgTypeSelect.value;
        document.getElementById('bg-color-group').style.display = type === 'color' ? 'flex' : 'none';
        document.getElementById('bg-image-group').style.display = type === 'image' ? 'flex' : 'none';
        document.getElementById('bg-video-group').style.display = type === 'video' ? 'flex' : 'none';
        
        updateBackground();
    });

    // Background color change
    bgColorInput.addEventListener('input', () => {
        if (bgTypeSelect.value === 'color') {
            updateBackground();
        }
    });

    // Background image upload
    bgImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                backgroundImageUrl = event.target.result;
                updateBackground();
            };
            reader.readAsDataURL(file);
        }
    });

    // Background video upload
    bgVideoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                backgroundVideoUrl = event.target.result;
                updateBackground();
            };
            reader.readAsDataURL(file);
        }
    });

    // Background music upload
    bgMusicInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                backgroundMusicUrl = event.target.result;
                bgMusicElement.src = backgroundMusicUrl;
            };
            reader.readAsDataURL(file);
        }
    });

    function updateBackground() {
        const type = bgTypeSelect.value;
        chatBackground.innerHTML = '';
        bgVideoElement.style.display = 'none';
        
        if (type === 'color') {
            chatBackground.style.backgroundColor = bgColorInput.value;
        } else if (type === 'image' && backgroundImageUrl) {
            chatBackground.style.backgroundColor = 'transparent';
            const img = document.createElement('img');
            img.src = backgroundImageUrl;
            chatBackground.appendChild(img);
        } else if (type === 'video' && backgroundVideoUrl) {
            chatBackground.style.backgroundColor = 'transparent';
            bgVideoElement.src = backgroundVideoUrl;
            bgVideoElement.style.display = 'block';
            bgVideoElement.play();
            chatBackground.appendChild(bgVideoElement);
        }
    }

    function addMessageInput(text = '', sender = 'sent', delay = 0) {
        messageCount++;
        const messageGroup = document.createElement('div');
        messageGroup.classList.add('message-input-group');
        messageGroup.draggable = true;
        messageGroup.innerHTML = `
            <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
            <select>
                <option value="sent" ${sender === 'sent' ? 'selected' : ''}>Sender</option>
                <option value="received" ${sender === 'received' ? 'selected' : ''}>Receiver</option>
                <option value="neutral" ${sender === 'neutral' ? 'selected' : ''}>Neutral</option>
            </select>
            <input type="text" class="message-text" placeholder="Type a message..." value="${text}">
            <input type="number" class="message-delay" placeholder="Delay (s)" value="${delay}" min="0" step="0.5" title="Extra delay before this message (seconds)">
            <div class="message-controls">
                <button class="move-up-btn" title="Move up">↑</button>
                <button class="move-down-btn" title="Move down">↓</button>
                <button class="delete-btn" title="Delete">×</button>
            </div>
        `;
        
        // Add event listeners for move/delete buttons
        const moveUpBtn = messageGroup.querySelector('.move-up-btn');
        const moveDownBtn = messageGroup.querySelector('.move-down-btn');
        const deleteBtn = messageGroup.querySelector('.delete-btn');
        
        moveUpBtn.addEventListener('click', () => moveMessage(messageGroup, -1));
        moveDownBtn.addEventListener('click', () => moveMessage(messageGroup, 1));
        deleteBtn.addEventListener('click', () => deleteMessage(messageGroup));
        
        // Add drag and drop event listeners
        messageGroup.addEventListener('dragstart', handleDragStart);
        messageGroup.addEventListener('dragover', handleDragOver);
        messageGroup.addEventListener('drop', handleDrop);
        messageGroup.addEventListener('dragend', handleDragEnd);
        
        messagesScriptContainer.appendChild(messageGroup);
    }
    
    function moveMessage(messageGroup, direction) {
        const sibling = direction === -1 ? messageGroup.previousElementSibling : messageGroup.nextElementSibling;
        if (sibling) {
            if (direction === -1) {
                messagesScriptContainer.insertBefore(messageGroup, sibling);
            } else {
                messagesScriptContainer.insertBefore(sibling, messageGroup);
            }
            debouncedSave();
        }
    }
    
    function deleteMessage(messageGroup) {
        if (confirm('Delete this message?')) {
            messageGroup.remove();
            debouncedSave();
        }
    }
    
    // Drag and drop functionality
    let draggedElement = null;
    
    function handleDragStart(e) {
        draggedElement = this;
        this.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
    }
    
    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        
        if (this !== draggedElement) {
            const rect = this.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            
            if (e.clientY < midpoint) {
                this.parentNode.insertBefore(draggedElement, this);
            } else {
                this.parentNode.insertBefore(draggedElement, this.nextSibling);
            }
        }
        
        return false;
    }
    
    function handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        return false;
    }
    
    function handleDragEnd(e) {
        this.style.opacity = '1';
        draggedElement = null;
    }
    
    function importConversation() {
        const text = document.getElementById('import-text').value.trim();
        if (!text) {
            alert('Please paste a conversation to import');
            return;
        }
        messagesScriptContainer.innerHTML = '';
        messageCount = 0;
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) continue;
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) continue;
            const name = line.substring(0, colonIndex).trim();
            const message = line.substring(colonIndex + 1).trim();
            if (!message) continue;
            const sender = name.toLowerCase() === 'me' ? 'sent' : 'received';
            addMessageInput(message, sender);
        }
        document.getElementById('import-text').value = '';
        debouncedSave();
        alert('Conversation imported!');
    }

    function getMessages() {
        const messages = [];
        const messageInputs = document.querySelectorAll('.message-input-group');
        messageInputs.forEach(group => {
            const sender = group.querySelector('select').value;
            const text = group.querySelector('.message-text').value.trim();
            const delay = parseFloat(group.querySelector('.message-delay').value) || 0;
            if (text) {
                messages.push({ sender, text, delay });
            }
        });
        return messages;
    }
    
    // Sound Effects - iOS-like sounds using Web Audio API
    function initAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContext;
    }
    
    function playSendSound() {
        if (!soundEffectsCheckbox.checked) return;
        
        const ctx = initAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // iOS send sound: quick "whoosh" upward sweep
        oscillator.frequency.setValueAtTime(600, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        
        const volume = parseFloat(sendVolumeInput.value) / 100;
        gainNode.gain.setValueAtTime(0.3 * volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * volume, ctx.currentTime + 0.1);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.1);
    }
    
    function playReceiveSound() {
        if (!soundEffectsCheckbox.checked) return;
        
        const ctx = initAudioContext();
        
        // iOS receive sound: two-tone notification
        const oscillator1 = ctx.createOscillator();
        const oscillator2 = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // First tone
        oscillator1.frequency.setValueAtTime(800, ctx.currentTime);
        oscillator1.type = 'sine';
        
        // Second tone (slightly lower)
        oscillator2.frequency.setValueAtTime(600, ctx.currentTime + 0.08);
        oscillator2.type = 'sine';
        
        const volume = parseFloat(receiveVolumeInput.value) / 100;
        gainNode.gain.setValueAtTime(0.2 * volume, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.2 * volume, ctx.currentTime + 0.08);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * volume, ctx.currentTime + 0.25);
        
        oscillator1.start(ctx.currentTime);
        oscillator1.stop(ctx.currentTime + 0.08);
        
        oscillator2.start(ctx.currentTime + 0.08);
        oscillator2.stop(ctx.currentTime + 0.25);
    }
    
    function playTypingSound() {
        if (!soundEffectsCheckbox.checked) return;
        
        const ctx = initAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // Subtle click sound for typing
        oscillator.frequency.setValueAtTime(200, ctx.currentTime);
        oscillator.type = 'square';
        
        const volume = parseFloat(typingVolumeInput.value) / 100;
        gainNode.gain.setValueAtTime(0.05 * volume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01 * volume, ctx.currentTime + 0.02);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.02);
    }

    async function typeCharacterByCharacter(element, text, speed) {
        element.textContent = '';
        for (let char of text) {
            element.textContent += char;
            await sleep(speed);
        }
    }

    function stopAnimation() {
        shouldStopAnimation = true;
        previewBtn.textContent = 'Preview Animation';
        previewBtn.disabled = true;
    }
    
    async function animateConversation() {
        if (isAnimating) {
            stopAnimation();
            return;
        }
        
        isAnimating = true;
        shouldStopAnimation = false;
        previewBtn.textContent = 'Stop Preview';
        previewBtn.disabled = false;
        exportBtn.disabled = true;
        
        // Clear existing messages
        chatMessagesContainer.innerHTML = '';
        const imessageInput = document.getElementById('imessage-input');
        imessageInput.textContent = '';
        imessageInput.classList.remove('active');
        
        // Start background music if available
        if (backgroundMusicUrl) {
            bgMusicElement.currentTime = 0;
            bgMusicElement.play();
        }
        
        // Start video if background is video
        if (bgTypeSelect.value === 'video' && backgroundVideoUrl) {
            bgVideoElement.currentTime = 0;
            bgVideoElement.play();
        }
        
        const messages = getMessages();
        const senderDelay = parseInt(senderDelayInput.value);
        const receiverDelay = parseInt(receiverDelayInput.value);
        const baseTypingDelay = parseInt(typingDelayInput.value);
        const typingPerChar = parseInt(typingPerCharInput.value);
        const typingSpeed = parseInt(typingSpeedInput.value);

        for (let i = 0; i < messages.length; i++) {
            if (shouldStopAnimation) break;
            
            const message = messages[i];
            
            // Add extra delay if specified
            if (message.delay > 0) {
                await sleep(message.delay * 1000);
                if (shouldStopAnimation) break;
            }
            
            const delay = message.sender === 'sent' ? senderDelay : receiverDelay;
            
            // For sent messages, type character by character in iMessage input first
            if (message.sender === 'sent') {
                imessageInput.classList.add('active');
                
                // Type with sound effects
                for (let char of message.text) {
                    imessageInput.textContent += char;
                    playTypingSound();
                    await sleep(typingSpeed);
                    if (shouldStopAnimation) {
                        imessageInput.textContent = '';
                        imessageInput.classList.remove('active');
                        break;
                    }
                }
                
                if (shouldStopAnimation) break;
                
                await sleep(300);
                playSendSound();
                imessageInput.textContent = '';
                imessageInput.classList.remove('active');
            }
            
            // Show typing indicator for received messages
            if (message.sender === 'received') {
                // Calculate typing delay based on message length
                const typingDelay = baseTypingDelay + (message.text.length * typingPerChar);
                
                // Add "..." message bubble
                const typingMessage = document.createElement('div');
                typingMessage.classList.add('message', 'received', 'visible');
                typingMessage.textContent = '...';
                chatMessagesContainer.appendChild(typingMessage);
                chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                
                await sleep(typingDelay);
                
                // Remove the "..." message
                typingMessage.remove();
                
                if (shouldStopAnimation) break;
            }
            
            // Add message
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', message.sender);
            messageElement.textContent = message.text;
            chatMessagesContainer.appendChild(messageElement);
            
            // Play receive sound for received messages
            if (message.sender === 'received') {
                playReceiveSound();
            }
            
            // Trigger animation
            await sleep(50);
            messageElement.classList.add('visible');
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
            
            // Wait before next message
            if (i < messages.length - 1) {
                await sleep(delay);
            }
        }
        
        // Stop background music
        if (backgroundMusicUrl) {
            bgMusicElement.pause();
        }
        
        isAnimating = false;
        shouldStopAnimation = false;
        previewBtn.textContent = 'Preview Animation';
        previewBtn.disabled = false;
        exportBtn.disabled = false;
    }

    async function exportVideo() {
        try {
            exportBtn.textContent = 'Preparing...';
            exportBtn.disabled = true;
            previewBtn.disabled = true;

            // Create a canvas to capture the phone screen
            const canvas = document.createElement('canvas');
            canvas.width = phoneScreen.offsetWidth;
            canvas.height = phoneScreen.offsetHeight;
            const ctx = canvas.getContext('2d');

            // Get video stream from canvas
            const videoStream = canvas.captureStream(30);
            
            // Combine video and audio streams if music is available
            let combinedStream;
            if (backgroundMusicUrl) {
                try {
                    // Create audio context to capture music
                    const audioContext = new AudioContext();
                    const source = audioContext.createMediaElementSource(bgMusicElement);
                    const destination = audioContext.createMediaStreamDestination();
                    source.connect(destination);
                    source.connect(audioContext.destination); // Also play the audio
                    
                    // Combine video and audio
                    combinedStream = new MediaStream([
                        ...videoStream.getVideoTracks(),
                        ...destination.stream.getAudioTracks()
                    ]);
                } catch (error) {
                    console.warn('Failed to capture audio, recording video only:', error);
                    combinedStream = videoStream;
                }
            } else {
                combinedStream = videoStream;
            }
            
            recordedChunks = [];
            
            mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 2500000
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'conversation.webm';
                a.click();
                URL.revokeObjectURL(url);
                
                exportBtn.textContent = 'Export as Video';
                exportBtn.disabled = false;
                previewBtn.disabled = false;
            };

            // Start recording
            mediaRecorder.start();
            exportBtn.textContent = 'Recording...';

            // Capture frames
            async function captureToCanvas() {
                const screenshot = await html2canvas(phoneScreen, {
                    logging: false,
                    useCORS: true,
                    allowTaint: true,
                    scale: 1
                });
                ctx.drawImage(screenshot, 0, 0, canvas.width, canvas.height);
            }

            // Clear existing messages
            chatMessagesContainer.innerHTML = '';
            const imessageInput = document.getElementById('imessage-input');
            imessageInput.textContent = '';
            imessageInput.classList.remove('active');

            // Start background music if available
            if (backgroundMusicUrl) {
                bgMusicElement.currentTime = 0;
                bgMusicElement.play();
            }

            // Start video if background is video
            if (bgTypeSelect.value === 'video' && backgroundVideoUrl) {
                bgVideoElement.currentTime = 0;
                bgVideoElement.play();
            }

            const messages = getMessages();
            const senderDelay = parseInt(senderDelayInput.value);
            const receiverDelay = parseInt(receiverDelayInput.value);
            const baseTypingDelay = parseInt(typingDelayInput.value);
            const typingPerChar = parseInt(typingPerCharInput.value);
            const typingSpeed = parseInt(typingSpeedInput.value);

            // Initial capture
            await captureToCanvas();
            await sleep(500);

            // Animate and capture - run animation in real-time, capture at 15fps to reduce lag
            const targetFPS = 15; // Reduced from 30 to minimize lag
            const frameInterval = 1000 / targetFPS;
            
            // Start a consistent frame capture loop
            const captureLoop = setInterval(async () => {
                await captureToCanvas();
            }, frameInterval);
            
            // Animate and capture
            for (let i = 0; i < messages.length; i++) {
                const message = messages[i];
                
                // Add extra delay if specified
                if (message.delay > 0) {
                    await sleep(message.delay * 1000);
                }
                
                const delay = message.sender === 'sent' ? senderDelay : receiverDelay;
                
                // For sent messages, type character by character in iMessage input
                if (message.sender === 'sent') {
                    imessageInput.classList.add('active');
                    
                    for (let char of message.text) {
                        imessageInput.textContent += char;
                        await sleep(typingSpeed);
                    }
                    
                    await sleep(300);
                    imessageInput.textContent = '';
                    imessageInput.classList.remove('active');
                }
                
                // Show typing indicator for received messages
                if (message.sender === 'received') {
                    // Calculate typing delay based on message length
                    const typingDelay = baseTypingDelay + (message.text.length * typingPerChar);
                    
                    // Add "..." message bubble
                    const typingMessage = document.createElement('div');
                    typingMessage.classList.add('message', 'received', 'visible');
                    typingMessage.textContent = '...';
                    chatMessagesContainer.appendChild(typingMessage);
                    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                    
                    await sleep(typingDelay);
                    
                    // Remove the "..." message
                    typingMessage.remove();
                }
                
                // Add message
                const messageElement = document.createElement('div');
                messageElement.classList.add('message', message.sender, 'visible');
                messageElement.textContent = message.text;
                chatMessagesContainer.appendChild(messageElement);
                chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
                
                // Wait before next message
                await sleep(delay);
            }

            // Final pause
            await sleep(1000);
            
            // Stop capture loop
            clearInterval(captureLoop);

            // Stop background music
            if (backgroundMusicUrl) {
                bgMusicElement.pause();
            }

            // Stop recording
            mediaRecorder.stop();

        } catch (error) {
            console.error('Error exporting video:', error);
            alert('Error exporting video: ' + error.message + '\n\nPlease check the console for more details.');
            exportBtn.textContent = 'Export as Video';
            exportBtn.disabled = false;
            previewBtn.disabled = false;
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Hamburger Menu and Overlay Functions
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const menuOverlay = document.getElementById('menu-overlay');
    const closeOverlayBtn = document.getElementById('close-overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayBody = document.getElementById('overlay-body');
    
    const saveLoadMenuBtn = document.getElementById('save-load-menu-btn');
    
    function openOverlay(title, content) {
        overlayTitle.textContent = title;
        overlayBody.innerHTML = content;
        menuOverlay.classList.add('active');
    }
    
    function closeOverlay() {
        menuOverlay.classList.remove('active');
    }
    
    hamburgerBtn.addEventListener('click', () => {
        const content = `
            <div style="text-align: center;">
                <button id="menu-settings-btn" style="width: 100%; padding: 15px; margin: 10px 0; font-size: 16px; cursor: pointer; border: none; border-radius: 8px; background: var(--accent-gradient); color: white;">⚙️ Settings</button>
                <button id="menu-save-load-btn" style="width: 100%; padding: 15px; margin: 10px 0; font-size: 16px; cursor: pointer; border: none; border-radius: 8px; background: var(--accent); color: white;">💾 Export/Import</button>
            </div>
        `;
        openOverlay('Menu', content);
        setTimeout(() => {
            document.getElementById('menu-settings-btn').addEventListener('click', () => {
                closeOverlay();
                openSettingsOverlay();
            });
            document.getElementById('menu-save-load-btn').addEventListener('click', () => {
                closeOverlay();
                saveLoadMenuBtn.click();
            });
        }, 50);
    });

    function openSettingsOverlay() {
        const keys = API_KEYS.loadApiKeys();
        const content = `
            <p class="settings-hint" style="margin-bottom: 1rem;">API keys are stored once and shared across all Saas apps (PitchDeck, InfoGraphics, ColorWriter, PowerWriter, StoryWriter, etc.).</p>
            <div class="form-group">
                <label>OpenAI API Key</label>
                <input type="password" id="overlay-openai-key" value="${(keys.openai || '').replace(/"/g, '&quot;')}" placeholder="sk-..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-default); background: var(--input-bg); color: var(--text-primary);">
            </div>
            <button id="overlay-save-settings-btn" style="width: 100%; padding: 12px; margin-top: 16px; font-size: 16px; cursor: pointer; border: none; border-radius: 8px; background: var(--accent-gradient); color: white;">Save</button>
        `;
        openOverlay('Settings', content);
        setTimeout(() => {
            document.getElementById('overlay-save-settings-btn').addEventListener('click', () => {
                const key = document.getElementById('overlay-openai-key').value.trim();
                API_KEYS.saveApiKeys({ openai: key });
                closeOverlay();
                alert('Settings saved.');
            });
        }, 50);
    }
    
    closeOverlayBtn.addEventListener('click', closeOverlay);
    menuOverlay.addEventListener('click', (e) => {
        if (e.target === menuOverlay) closeOverlay();
    });
    
    saveLoadMenuBtn.addEventListener('click', () => {
        const content = `
            <p class="settings-hint" style="margin-bottom: 1rem;">Conversations are auto-saved to the current project/tab. Export to backup or share.</p>
            <h3>Export to File</h3>
            <div style="margin-bottom: 20px;">
                <input type="text" id="overlay-export-name" placeholder="File name..." value="${(currentTabName || 'conversation').replace(/"/g, '&quot;')}" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-default); margin-bottom: 10px; background: var(--input-bg); color: var(--text-primary);">
                <button id="overlay-export-btn" style="width: 100%; padding: 10px; cursor: pointer; border: none; border-radius: 8px; background: var(--accent); color: white;">📥 Export to File</button>
            </div>
            <h3 style="margin-top: 20px;">Import from File</h3>
            <input type="file" id="overlay-import-file" accept=".json" style="width: 100%; padding: 10px; margin-bottom: 10px;">
            <button id="overlay-import-btn" style="width: 100%; padding: 10px; cursor: pointer; border: none; border-radius: 8px; background: var(--accent); color: white;">📤 Import File</button>
        `;
        openOverlay('Export / Import', content);
        setTimeout(() => {
            document.getElementById('overlay-export-btn').addEventListener('click', () => {
                const name = document.getElementById('overlay-export-name').value.trim() || 'conversation';
                exportConversationToFile(name);
            });
            document.getElementById('overlay-import-btn').addEventListener('click', () => {
                const fileInput = document.getElementById('overlay-import-file');
                const file = fileInput.files[0];
                if (file) {
                    importConversationFromFile(file);
                    debouncedSave();
                }
            });
        }, 100);
    });
    
    function exportConversationToFile(name) {
        var state = collectState();
        const data = {
            name,
            messages: state.messages,
            settings: state.settings
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('Conversation exported to file!');
    }
    
    function importConversationFromFile(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = JSON.parse(e.target.result);
                if (!data.settings) data.settings = {};
                if (!data.messages) data.messages = [];
                applyState(data);
                closeOverlay();
                alert('Conversation imported from file!');
            } catch (error) {
                alert('Error importing file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    addMessageBtn.addEventListener('click', () => {
        addMessageInput();
        debouncedSave();
    });
    previewBtn.addEventListener('click', animateConversation);
    exportBtn.addEventListener('click', exportVideo);
    document.getElementById('import-btn').addEventListener('click', importConversation);

    // Generate with AI
    document.getElementById('generate-btn').addEventListener('click', async function () {
        const input = document.getElementById('generate-input').value.trim();
        if (!input) {
            alert('Please describe the conversation you want to generate.');
            return;
        }
        const keys = API_KEYS.loadApiKeys();
        const apiKey = (keys.openai || '').trim();
        if (!apiKey) {
            alert('Please add your OpenAI API key in Settings (menu). Keys are shared across all Saas apps.');
            return;
        }
        const btn = document.getElementById('generate-btn');
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Generating...';
        try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: 'Generate a realistic text message conversation. Output ONLY the conversation in this exact format, one message per line:\n\nMe: message text\nOtherPerson: message text\n\nUse "Me" for the first/sender side. Use a short name (e.g. Support, Alex, Sarah) for the other side. No numbering, no titles, no extra text. 6-12 messages.'
                        },
                        {
                            role: 'user',
                            content: input
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 800
                })
            });
            if (!res.ok) {
                const err = await res.json().catch(function () { return {}; });
                throw new Error(err.error?.message || 'API error: ' + res.status);
            }
            const data = await res.json();
            const text = (data.choices?.[0]?.message?.content || '').trim();
            if (!text) throw new Error('No response from AI');
            messagesScriptContainer.innerHTML = '';
            messageCount = 0;
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const colonIndex = line.indexOf(':');
                if (colonIndex === -1) continue;
                const name = line.substring(0, colonIndex).trim();
                const msg = line.substring(colonIndex + 1).trim();
                if (!msg) continue;
                const sender = name.toLowerCase() === 'me' ? 'sent' : 'received';
                addMessageInput(msg, sender);
            }
            document.getElementById('generate-input').value = '';
            debouncedSave();
        } catch (err) {
            alert('Error: ' + (err.message || 'Failed to generate'));
        }
        btn.disabled = false;
        btn.innerHTML = '<span>✨</span> Generate Conversation';
    });

    // Left panel: Profile settings
    var panelProfileName = document.getElementById('panel-profile-name');
    var panelMessageCount = document.getElementById('panel-message-count');
    var panelTimeDisplay = document.getElementById('panel-time-display');
    var panelProfilePicBtn = document.getElementById('panel-profile-picture-btn');
    if (panelProfileName) {
        panelProfileName.addEventListener('input', function () {
            profileNameInput.value = panelProfileName.value;
            headerProfileName.textContent = panelProfileName.value || 'My Brain';
            debouncedSave();
        });
    }
    if (panelMessageCount) {
        panelMessageCount.addEventListener('input', function () {
            messageCountInput.value = panelMessageCount.value;
            backCount.textContent = panelMessageCount.value || '147';
            debouncedSave();
        });
    }
    if (panelTimeDisplay) {
        panelTimeDisplay.addEventListener('change', function () {
            var timeEl = document.querySelector('.time');
            if (timeEl) timeEl.textContent = panelTimeDisplay.value;
            debouncedSave();
        });
    }
    if (panelProfilePicBtn && profilePictureInput) {
        panelProfilePicBtn.addEventListener('click', function () {
            profilePictureInput.click();
        });
    }
    profilePictureInput.addEventListener('change', debouncedSave);

    // Debounced save on changes
    [profileNameInput, messageCountInput, senderDelayInput, receiverDelayInput, typingDelayInput, typingPerCharInput, typingSpeedInput, typingVolumeInput, sendVolumeInput, receiveVolumeInput, bgTypeSelect, bgColorInput].forEach(function (el) {
        if (el) el.addEventListener('change', debouncedSave);
    });
    soundEffectsCheckbox.addEventListener('change', debouncedSave);
    messagesScriptContainer.addEventListener('input', debouncedSave);
    messagesScriptContainer.addEventListener('change', debouncedSave);

    // Initialize projects and tabs (loads data, applies to UI)
    initProjectsAndTabs();
});
