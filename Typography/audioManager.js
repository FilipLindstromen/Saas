// Audio Manager - Handles music upload and playback
class AudioManager {
    constructor() {
        this.audio = document.getElementById('audioPlayer');
        this.audioFile = null;
        this.isPlaying = false;
        this.volume = 0.7;
        this.audio.volume = this.volume;
    }

    // Load audio file
    loadFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            // Check if file is audio
            if (!file.type.startsWith('audio/')) {
                reject(new Error('File is not an audio file'));
                return;
            }

            this.audioFile = file;
            const url = URL.createObjectURL(file);
            this.audio.src = url;

            this.audio.onloadedmetadata = () => {
                resolve({
                    duration: this.audio.duration,
                    name: file.name
                });
            };

            this.audio.onerror = () => {
                reject(new Error('Failed to load audio file'));
            };
        });
    }

    // Play audio
    play() {
        if (this.audio.src) {
            this.audio.play();
            this.isPlaying = true;
        }
    }

    // Pause audio
    pause() {
        this.audio.pause();
        this.isPlaying = false;
    }

    // Stop audio
    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
    }

    // Reset audio
    reset() {
        this.audio.currentTime = 0;
    }

    // Set volume (0-1)
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.audio.volume = this.volume;
    }

    // Get volume
    getVolume() {
        return this.volume;
    }

    // Get current time
    getCurrentTime() {
        return this.audio.currentTime;
    }

    // Get duration
    getDuration() {
        return this.audio.duration || 0;
    }

    // Check if audio is loaded
    isLoaded() {
        return this.audio.src !== '';
    }

    // Check if playing
    getIsPlaying() {
        return this.isPlaying;
    }

    // Set loop
    setLoop(loop) {
        this.audio.loop = loop;
    }

    // Get audio element (for MediaRecorder)
    getAudioElement() {
        return this.audio;
    }

    // Get audio file
    getAudioFile() {
        return this.audioFile;
    }

    // Create audio context for recording
    createAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioContext;
    }

    // Get audio stream for recording
    getAudioStream() {
        if (!this.audio.src) return null;

        const audioContext = this.createAudioContext();
        const source = audioContext.createMediaElementSource(this.audio);
        const destination = audioContext.createMediaStreamDestination();

        source.connect(destination);
        source.connect(audioContext.destination); // Also play through speakers

        return destination.stream;
    }
}
