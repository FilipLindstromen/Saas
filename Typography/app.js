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

        // Initialize UI
        this.initializeUI();
        this.attachEventListeners();

        // Start renderer
        this.renderer.start(this.animationEngine, this.cameraController);

        // Generate initial preview
        this.loadSettings();
        this.generatePreview();
    }

    // Save current settings to localStorage
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

        localStorage.setItem('typographySettings', JSON.stringify(settings));
    }

    // Load settings from localStorage
    loadSettings() {
        const saved = localStorage.getItem('typographySettings');
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
});
