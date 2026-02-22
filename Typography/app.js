// Main Application Controller
class TypographyAnimationApp {
    constructor() {
        this.canvas = document.getElementById('previewCanvas');
        this.overlay = document.getElementById('canvasOverlay');

        // Initialize modules
        this.wordCloud = new WordCloud(1080, 1920);
        this.animationEngine = new AnimationEngine();
        this.cameraController = new CameraController(1080, 1920);
        this.renderer = new Renderer(this.canvas);
        this.audioManager = new AudioManager();
        this.videoExporter = new VideoExporter(this.canvas, this.audioManager);

        // State
        this.words = [];
        this.isPlaying = false;

        // Project & tab state
        this.projects = this.loadProjects();
        this.currentProjectId = this.loadCurrentProjectId();
        this.tabs = this.loadTabs();
        this.activeTabId = this.loadActiveTabId();

        // Initialize UI
        this.initializeUI();
        this.initProjectTabBar();
        this.attachEventListeners();

        // Start renderer
        this.renderer.start(this.animationEngine, this.cameraController);

        // Generate initial preview
        this.loadSettings();
        this.generatePreview();
    }

    loadProjects() {
        try {
            const raw = localStorage.getItem('typographyProjects');
            if (raw) {
                const list = JSON.parse(raw);
                return Array.isArray(list) && list.length > 0 ? list : [{ id: 'default', name: 'Untitled' }];
            }
        } catch (e) { }
        return [{ id: 'default', name: 'Untitled' }];
    }

    saveProjects() {
        localStorage.setItem('typographyProjects', JSON.stringify(this.projects));
    }

    loadCurrentProjectId() {
        return localStorage.getItem('typographyCurrentProject') || 'default';
    }

    saveCurrentProjectId(id) {
        localStorage.setItem('typographyCurrentProject', id);
    }

    loadTabs() {
        try {
            const raw = localStorage.getItem('typographyTabs_' + this.currentProjectId);
            if (raw) {
                const list = JSON.parse(raw);
                return Array.isArray(list) && list.length > 0 ? list : [{ id: '1', name: 'Animation 1' }];
            }
        } catch (e) { }
        return [{ id: '1', name: 'Animation 1' }];
    }

    saveTabs() {
        localStorage.setItem('typographyTabs_' + this.currentProjectId, JSON.stringify(this.tabs));
    }

    loadActiveTabId() {
        return localStorage.getItem('typographyActiveTab_' + this.currentProjectId) || (this.tabs[0]?.id || '1');
    }

    saveActiveTabId(id) {
        localStorage.setItem('typographyActiveTab_' + this.currentProjectId, id);
    }

    initProjectTabBar() {
        this.renderProjectSelector();
        this.renderTabBar();

        const projectTrigger = document.getElementById('project-trigger');
        const projectDropdown = document.getElementById('project-dropdown');
        if (projectTrigger && projectDropdown) {
            projectTrigger.addEventListener('click', () => {
                projectDropdown.style.display = projectDropdown.style.display === 'none' ? 'block' : 'none';
            });
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#project-selector')) {
                const d = document.getElementById('project-dropdown');
                if (d) d.style.display = 'none';
            }
        });

        const projectNew = document.getElementById('project-new');
        if (projectNew) {
            projectNew.addEventListener('click', () => {
                const id = 'p_' + Date.now();
                this.projects = [...this.projects, { id, name: 'Untitled' }];
                this.saveProjects();
                this.currentProjectId = id;
                this.saveCurrentProjectId(id);
                this.tabs = [{ id: '1', name: 'Animation 1' }];
                this.saveTabs();
                this.activeTabId = '1';
                this.saveActiveTabId('1');
                document.getElementById('project-dropdown').style.display = 'none';
                this.renderProjectSelector();
                this.renderTabBar();
                this.loadSettings();
            });
        }

        const projectList = document.getElementById('project-list');
        if (projectList) {
            projectList.addEventListener('click', (e) => {
                if (e.target.closest('.project-selector-action')) return;
                const item = e.target.closest('.project-selector-item');
                if (!item || item.dataset.id === this.currentProjectId) {
                    if (item) document.getElementById('project-dropdown').style.display = 'none';
                    return;
                }
                this.saveSettings();
                this.currentProjectId = item.dataset.id;
                this.saveCurrentProjectId(this.currentProjectId);
                this.tabs = this.loadTabs();
                this.activeTabId = this.loadActiveTabId();
                document.getElementById('project-dropdown').style.display = 'none';
                this.renderProjectSelector();
                this.renderTabBar();
                this.loadSettings();
                this.generatePreview();
            });
        }

        const tabAdd = document.getElementById('tab-add');
        if (tabAdd) {
            tabAdd.addEventListener('click', () => {
                const id = 't_' + Date.now();
                this.tabs = [...this.tabs, { id, name: 'Animation ' + (this.tabs.length + 1) }];
                this.saveTabs();
                this.activeTabId = id;
                this.saveActiveTabId(id);
                this.renderTabBar();
                this.loadSettings();
            });
        }
    }

    renderProjectSelector() {
        const nameEl = document.getElementById('project-name');
        const listEl = document.getElementById('project-list');
        if (!nameEl || !listEl) return;
        const proj = this.projects.find(p => p.id === this.currentProjectId);
        nameEl.textContent = proj ? proj.name : 'Untitled';
        listEl.innerHTML = this.projects.map(p =>
            '<div class="project-selector-item' + (p.id === this.currentProjectId ? ' active' : '') + '" data-id="' + p.id + '">' +
            '<span class="project-selector-item-name">' + (p.name || 'Untitled') + '</span></div>'
        ).join('');
    }

    renderTabBar() {
        const container = document.getElementById('tab-bar-tabs');
        if (!container) return;
        container.innerHTML = this.tabs.map(t => {
            const isActive = t.id === this.activeTabId;
            return '<div class="tab-bar-tab' + (isActive ? ' active' : '') + '">' +
                '<button type="button" class="tab-bar-tab-btn" data-id="' + t.id + '">' + (t.name || 'Animation') + '</button>' +
                (this.tabs.length > 1 ? '<button type="button" class="tab-bar-tab-close" data-id="' + t.id + '" title="Close">×</button>' : '') +
                '</div>';
        }).join('');

        container.querySelectorAll('.tab-bar-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                if (id === this.activeTabId) return;
                this.saveSettings();
                this.activeTabId = id;
                this.saveActiveTabId(id);
                this.renderTabBar();
                this.loadSettings();
                this.generatePreview();
            });
            btn.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const tab = this.tabs.find(t => t.id === id);
                const name = prompt('Rename animation:', tab ? tab.name : 'Animation');
                if (name != null && name.trim()) {
                    this.tabs = this.tabs.map(t => t.id === id ? { ...t, name: name.trim() } : t);
                    this.saveTabs();
                    this.renderTabBar();
                }
            });
        });

        container.querySelectorAll('.tab-bar-tab-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (this.tabs.length <= 1) return;
                const idx = this.tabs.findIndex(t => t.id === id);
                const nextTab = idx > 0 ? this.tabs[idx - 1] : this.tabs[idx + 1];
                this.tabs = this.tabs.filter(t => t.id !== id);
                this.saveTabs();
                if (id === this.activeTabId) {
                    this.activeTabId = nextTab.id;
                    this.saveActiveTabId(nextTab.id);
                    this.loadSettings();
                    this.generatePreview();
                }
                this.renderTabBar();
            });
        });
    }

    // Save current settings to localStorage (per tab)
    saveSettings() {
        const selectedFonts = Array.from(document.querySelectorAll('input[name="font"]:checked'))
            .map(cb => cb.value);

        const settings = {
            text: this.elements.textInput.value,
            minSize: this.elements.minSize.value,
            maxSize: this.elements.maxSize.value,
            animSpeed: this.elements.animSpeed.value,
            cameraDistance: this.elements.cameraDistance.value,
            zoomOutFinale: this.elements.zoomOutFinale.checked,
            bgColor: this.elements.bgColor.value,
            textColor: this.elements.textColor.value,
            fonts: selectedFonts
        };

        const key = 'typographySettings_' + this.activeTabId;
        localStorage.setItem(key, JSON.stringify(settings));
    }

    // Load settings from localStorage (per tab, with legacy migration)
    loadSettings() {
        let key = 'typographySettings_' + this.activeTabId;
        let saved = localStorage.getItem(key);
        if (!saved && this.activeTabId === '1') {
            const legacy = localStorage.getItem('typographySettings');
            if (legacy) {
                localStorage.setItem(key, legacy);
                saved = legacy;
            }
        }
        if (!saved) return;

        try {
            const settings = JSON.parse(saved);

            if (settings.text !== undefined) this.elements.textInput.value = settings.text;
            if (settings.minSize !== undefined) this.elements.minSize.value = settings.minSize;
            if (settings.maxSize !== undefined) this.elements.maxSize.value = settings.maxSize;
            if (settings.animSpeed !== undefined) {
                this.elements.animSpeed.value = settings.animSpeed;
                this.updateSpeedDisplay();
            }
            if (settings.cameraDistance !== undefined) {
                this.elements.cameraDistance.value = settings.cameraDistance;
                this.updateDistanceDisplay();
            }
            if (settings.zoomOutFinale !== undefined) this.elements.zoomOutFinale.checked = settings.zoomOutFinale;

            if (settings.bgColor !== undefined) {
                this.elements.bgColor.value = settings.bgColor;
                this.elements.bgColorText.value = settings.bgColor;
                this.renderer.setBackgroundColor(settings.bgColor);
            }

            if (settings.textColor !== undefined) {
                this.elements.textColor.value = settings.textColor;
                this.elements.textColorText.value = settings.textColor;
                this.renderer.setTextColor(settings.textColor);
            }

            if (settings.fonts && Array.isArray(settings.fonts)) {
                document.querySelectorAll('input[name="font"]').forEach(cb => {
                    cb.checked = settings.fonts.includes(cb.value);
                });
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }

    initializeUI() {
        // Get UI elements
        this.elements = {
            textInput: document.getElementById('textInput'),
            minSize: document.getElementById('minSize'),
            maxSize: document.getElementById('maxSize'),
            animSpeed: document.getElementById('animSpeed'),
            speedValue: document.getElementById('speedValue'),
            cameraDistance: document.getElementById('cameraDistance'),
            distanceValue: document.getElementById('distanceValue'),
            zoomOutFinale: document.getElementById('zoomOutFinale'),
            bgColor: document.getElementById('bgColor'),
            bgColorText: document.getElementById('bgColorText'),
            textColor: document.getElementById('textColor'),
            textColorText: document.getElementById('textColorText'),
            musicUpload: document.getElementById('musicUpload'),
            uploadBtn: document.getElementById('uploadBtn'),
            fileName: document.getElementById('fileName'),
            audioControls: document.getElementById('audioControls'),
            audioPlayBtn: document.getElementById('audioPlayBtn'),
            audioPauseBtn: document.getElementById('audioPauseBtn'),
            volumeSlider: document.getElementById('volumeSlider'),
            volumeLabel: document.getElementById('volumeLabel'),
            playBtn: document.getElementById('playBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            resetBtn: document.getElementById('resetBtn'),
            progressFill: document.getElementById('progressFill'),
            timeDisplay: document.getElementById('timeDisplay'),
            exportWebM: document.getElementById('exportWebM'),
            exportMP4: document.getElementById('exportMP4'),
            exportProgress: document.getElementById('exportProgress'),
            exportProgressFill: document.getElementById('exportProgressFill'),
            exportProgressText: document.getElementById('exportProgressText'),
            // Layout Tools
            showLayoutBtn: document.getElementById('showLayoutBtn'),
            newLayoutBtn: document.getElementById('newLayoutBtn')
        };

        // Set initial values
        this.updateSpeedDisplay();
        this.updateDistanceDisplay();
    }

    attachEventListeners() {
        // Playback
        this.elements.playBtn.addEventListener('click', () => this.play());
        this.elements.pauseBtn.addEventListener('click', () => this.pause());
        this.elements.resetBtn.addEventListener('click', () => this.reset());

        // Layout Tools
        if (this.elements.showLayoutBtn) {
            this.elements.showLayoutBtn.addEventListener('click', () => this.showFullLayout());
        }
        if (this.elements.newLayoutBtn) {
            this.elements.newLayoutBtn.addEventListener('click', () => this.generatePreview());
        }

        // Text input
        this.elements.textInput.addEventListener('input', () => {
            this.saveSettings();
            this.generatePreview();
        });

        // Font selection
        document.querySelectorAll('input[name="font"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.saveSettings();
                this.generatePreview();
            });
        });

        // Size range
        this.elements.minSize.addEventListener('input', () => {
            this.saveSettings();
            this.generatePreview();
        });
        this.elements.maxSize.addEventListener('input', () => {
            this.saveSettings();
            this.generatePreview();
        });

        // Animation speed
        this.elements.animSpeed.addEventListener('input', () => {
            this.updateSpeedDisplay();
            this.saveSettings();
            this.animationEngine.setSpeed(parseFloat(this.elements.animSpeed.value));
        });

        // Camera distance
        this.elements.cameraDistance.addEventListener('input', () => {
            this.updateDistanceDisplay();
            this.saveSettings();
            this.cameraController.setDistance(parseFloat(this.elements.cameraDistance.value));
        });

        // Zoom out finale
        this.elements.zoomOutFinale.addEventListener('change', () => {
            this.saveSettings();
            this.cameraController.setZoomOutFinale(this.elements.zoomOutFinale.checked);
        });

        // Background color
        this.elements.bgColor.addEventListener('input', () => {
            this.elements.bgColorText.value = this.elements.bgColor.value;
            this.saveSettings();
            this.renderer.setBackgroundColor(this.elements.bgColor.value);
            this.renderer.draw(); // Live update even when paused
        });
        this.elements.bgColorText.addEventListener('input', () => {
            this.elements.bgColor.value = this.elements.bgColorText.value;
            this.saveSettings();
            this.renderer.setBackgroundColor(this.elements.bgColorText.value);
            this.renderer.draw(); // Live update
        });

        // Text color
        this.elements.textColor.addEventListener('input', () => {
            this.elements.textColorText.value = this.elements.textColor.value;
            this.saveSettings();
            this.renderer.setTextColor(this.elements.textColor.value);
            this.renderer.draw(); // Live update
        });
        this.elements.textColorText.addEventListener('input', () => {
            this.elements.textColor.value = this.elements.textColorText.value;
            this.saveSettings();
            this.renderer.setTextColor(this.elements.textColorText.value);
            this.renderer.draw(); // Live update
        });

        // Music upload
        this.elements.uploadBtn.addEventListener('click', () => {
            this.elements.musicUpload.click();
        });
        this.elements.musicUpload.addEventListener('change', (e) => {
            this.handleMusicUpload(e.target.files[0]);
        });

        // Audio controls
        this.elements.audioPlayBtn.addEventListener('click', () => {
            this.audioManager.play();
        });
        this.elements.audioPauseBtn.addEventListener('click', () => {
            this.audioManager.pause();
        });
        this.elements.volumeSlider.addEventListener('input', () => {
            const volume = parseInt(this.elements.volumeSlider.value) / 100;
            this.audioManager.setVolume(volume);
            this.elements.volumeLabel.textContent = `${this.elements.volumeSlider.value}%`;
        });

        // Export buttons
        this.elements.exportWebM.addEventListener('click', () => this.exportVideo('webm'));
        this.elements.exportMP4.addEventListener('click', () => this.exportVideo('mp4'));
    }

    // Generate preview
    generatePreview() {
        const text = this.elements.textInput.value.trim();

        if (!text) {
            this.overlay.classList.remove('hidden');
            return;
        }

        this.overlay.classList.add('hidden');

        // Get selected fonts
        const selectedFonts = Array.from(document.querySelectorAll('input[name="font"]:checked'))
            .map(cb => cb.value);

        if (selectedFonts.length === 0) {
            alert('Please select at least one font');
            return;
        }

        if (selectedFonts.length > 3) {
            alert('Please select maximum 3 fonts');
            return;
        }

        // Get size range
        const minSize = parseInt(this.elements.minSize.value);
        const maxSize = parseInt(this.elements.maxSize.value);

        if (minSize >= maxSize) {
            alert('Minimum size must be less than maximum size');
            return;
        }

        // Generate word cloud
        this.words = this.wordCloud.generate(text, minSize, maxSize, selectedFonts);

        // Initialize animation
        const speed = parseFloat(this.elements.animSpeed.value);
        this.animationEngine.setWords(this.words, speed);

        // Reset camera
        this.cameraController.reset();
        this.cameraController.setDistance(parseFloat(this.elements.cameraDistance.value));
        this.cameraController.setZoomOutFinale(this.elements.zoomOutFinale.checked);

        // Reset playback
        this.isPlaying = false;
        this.elements.playBtn.disabled = false;
        this.elements.pauseBtn.disabled = true;
        this.updateTimeDisplay();
    }

    // Show the full layout instantly (at the end of animation)
    showFullLayout() {
        if (!this.words || this.words.length === 0) return;

        this.pause();
        this.animationEngine.seek(1.0); // Jump to 100%

        // Ensure camera moves to finale if option is enabled
        if (this.elements.zoomOutFinale.checked) {
            this.cameraController.startFinale(this.words);
        }

        this.updateTimeDisplay();
        this.elements.progressFill.style.width = '100%';
    }

    // Play animation
    play() {
        if (!this.words || this.words.length === 0) {
            alert('Please enter text first');
            return;
        }

        this.animationEngine.play();
        this.isPlaying = true;
        this.elements.playBtn.disabled = true;
        this.elements.pauseBtn.disabled = false;

        // Start audio if loaded
        if (this.audioManager.isLoaded()) {
            this.audioManager.play();
        }

        // Update progress
        this.updateProgress();
    }

    // Pause animation
    pause() {
        this.animationEngine.pause();
        this.isPlaying = false;
        this.elements.playBtn.disabled = false;
        this.elements.pauseBtn.disabled = true;

        // Pause audio
        if (this.audioManager.isLoaded()) {
            this.audioManager.pause();
        }
    }

    // Reset animation
    reset() {
        this.animationEngine.reset();
        this.cameraController.reset();
        this.isPlaying = false;
        this.elements.playBtn.disabled = false;
        this.elements.pauseBtn.disabled = true;
        this.elements.progressFill.style.width = '0%';
        this.updateTimeDisplay();

        // Reset audio
        if (this.audioManager.isLoaded()) {
            this.audioManager.stop();
        }
    }

    // Update progress bar
    updateProgress() {
        if (!this.isPlaying) return;

        const progress = this.animationEngine.getProgress();
        this.elements.progressFill.style.width = `${progress}%`;
        this.updateTimeDisplay();

        if (progress < 100) {
            requestAnimationFrame(() => this.updateProgress());
        } else {
            this.elements.playBtn.disabled = false;
            this.elements.pauseBtn.disabled = true;
            this.isPlaying = false;
        }
    }

    // Update time display
    updateTimeDisplay() {
        const current = this.animationEngine.getCurrentTime() / 1000;
        const total = this.animationEngine.getTotalDuration() / 1000;

        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        this.elements.timeDisplay.textContent = `${formatTime(current)} / ${formatTime(total)}`;
    }

    // Update speed display
    updateSpeedDisplay() {
        const speed = parseFloat(this.elements.animSpeed.value);
        this.elements.speedValue.textContent = `${speed.toFixed(1)}x`;
    }

    // Update distance display
    updateDistanceDisplay() {
        const distance = parseFloat(this.elements.cameraDistance.value);
        let label = 'Close';
        if (distance > 2.5) label = 'Far';
        else if (distance > 1.5) label = 'Medium';
        this.elements.distanceValue.textContent = label;
    }

    // Handle music upload
    async handleMusicUpload(file) {
        if (!file) return;

        try {
            const metadata = await this.audioManager.loadFile(file);
            this.elements.fileName.textContent = metadata.name;
            this.elements.audioControls.style.display = 'flex';
        } catch (error) {
            alert('Failed to load audio file: ' + error.message);
        }
    }

    // Export video
    async exportVideo(format) {
        if (!this.words || this.words.length === 0) {
            alert('Please enter text first');
            return;
        }

        // Disable export buttons
        this.elements.exportWebM.disabled = true;
        this.elements.exportMP4.disabled = true;
        this.elements.exportProgress.style.display = 'block';

        try {
            const onProgress = (progress) => {
                this.elements.exportProgressFill.style.width = `${progress.progress}%`;
                this.elements.exportProgressText.textContent = progress.message;
            };

            let blob;
            if (format === 'webm') {
                blob = await this.videoExporter.exportWebM(
                    this.animationEngine,
                    this.cameraController,
                    this.renderer,
                    onProgress
                );
            } else {
                blob = await this.videoExporter.exportMP4(
                    this.animationEngine,
                    this.cameraController,
                    this.renderer,
                    onProgress
                );
            }

            // Download
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `typography-animation-${timestamp}.${format}`;
            this.videoExporter.downloadBlob(blob, filename);

            // Reset UI
            setTimeout(() => {
                this.elements.exportProgress.style.display = 'none';
                this.elements.exportProgressFill.style.width = '0%';
                this.elements.exportWebM.disabled = false;
                this.elements.exportMP4.disabled = false;

                // Reset animation
                this.reset();
            }, 1000);

        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export video: ' + error.message);

            this.elements.exportProgress.style.display = 'none';
            this.elements.exportWebM.disabled = false;
            this.elements.exportMP4.disabled = false;
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TypographyAnimationApp();

    // Settings modal - shared API keys
    const settingsModal = document.getElementById('settingsModal');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModalClose = document.getElementById('settingsModalClose');
    const settingsCancel = document.getElementById('settingsCancel');
    const settingsSave = document.getElementById('settingsSave');
    const settingsOpenaiKey = document.getElementById('settingsOpenaiKey');

    function openSettings() {
        const keys = window.loadApiKeys ? window.loadApiKeys() : { openai: '' };
        if (settingsOpenaiKey) settingsOpenaiKey.value = keys.openai || '';
        if (settingsModal) settingsModal.style.display = 'flex';
    }

    function closeSettings() {
        if (settingsModal) settingsModal.style.display = 'none';
    }

    function saveSettingsKeys() {
        if (!window.saveApiKeys) return;
        const openai = settingsOpenaiKey ? settingsOpenaiKey.value.trim() : '';
        window.saveApiKeys({ openai });
        closeSettings();
    }

    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    if (settingsModalClose) settingsModalClose.addEventListener('click', closeSettings);
    if (settingsCancel) settingsCancel.addEventListener('click', closeSettings);
    if (settingsSave) settingsSave.addEventListener('click', saveSettingsKeys);
    if (settingsModal) {
        settingsModal.querySelector('.settings-modal-backdrop')?.addEventListener('click', closeSettings);
    }

    // Theme toggle - global saas-apps-theme (syncs across all apps)
    const STORAGE_KEY = 'saas-apps-theme';
    const themeToggle = document.getElementById('themeToggle');
    const iconSun = themeToggle?.querySelector('.theme-icon-sun');
    const iconMoon = themeToggle?.querySelector('.theme-icon-moon');
    const updateThemeIcon = (theme) => {
        if (iconSun) iconSun.style.display = theme === 'dark' ? 'block' : 'none';
        if (iconMoon) iconMoon.style.display = theme === 'light' ? 'block' : 'none';
    };
    function migrateTheme() {
        if (localStorage.getItem(STORAGE_KEY)) return;
        ['typographyTheme', 'appTheme', 'theme', 'cw_theme', 'reelRecorderTheme'].forEach(k => {
            const v = localStorage.getItem(k);
            if (v === 'light' || v === 'dark') { localStorage.setItem(STORAGE_KEY, v); return; }
        });
    }
    function getTheme() {
        migrateTheme();
        const t = localStorage.getItem(STORAGE_KEY);
        if (t === 'light' || t === 'dark') return t;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
        updateThemeIcon(theme);
    }
    if (themeToggle) {
        setTheme(getTheme());
        themeToggle.addEventListener('click', () => setTheme(getTheme() === 'dark' ? 'light' : 'dark'));
        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
                document.documentElement.setAttribute('data-theme', e.newValue);
                updateThemeIcon(e.newValue);
            }
        });
    }
});
