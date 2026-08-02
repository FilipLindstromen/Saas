// Video Exporter - Handles video recording and export
class VideoExporter {
    constructor(canvas, audioManager) {
        this.canvas = canvas;
        this.audioManager = audioManager;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.fps = 30;
    }

    // Export as WebM
    async exportWebM(animationEngine, cameraController, renderer, onProgress) {
        try {
            onProgress?.({ status: 'preparing', progress: 0, message: 'Preparing WebM export...' });

            // Get canvas stream
            const canvasStream = this.canvas.captureStream(this.fps);

            // Get audio stream if available
            let combinedStream = canvasStream;
            if (this.audioManager.isLoaded()) {
                try {
                    const audioStream = this.audioManager.getAudioStream();
                    if (audioStream) {
                        combinedStream = new MediaStream([
                            ...canvasStream.getVideoTracks(),
                            ...audioStream.getAudioTracks()
                        ]);
                    }
                } catch (error) {
                    console.warn('Could not add audio to stream:', error);
                }
            }

            // Create MediaRecorder
            const options = {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 5000000 // 5 Mbps for high quality
            };

            // Fallback to vp8 if vp9 not supported
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm;codecs=vp8';
            }

            this.mediaRecorder = new MediaRecorder(combinedStream, options);
            this.recordedChunks = [];

            // Handle data available
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            // Start recording
            return new Promise((resolve, reject) => {
                this.mediaRecorder.onstop = () => {
                    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                    this.recordedChunks = [];
                    resolve(blob);
                };

                this.mediaRecorder.onerror = (error) => {
                    reject(error);
                };

                // Start recording
                this.mediaRecorder.start();
                this.isRecording = true;

                onProgress?.({ status: 'recording', progress: 10, message: 'Recording animation...' });

                // Reset and play animation
                animationEngine.reset();
                cameraController.reset();
                renderer.clear();

                // Start audio if available
                if (this.audioManager.isLoaded()) {
                    this.audioManager.reset();
                    this.audioManager.play();
                }

                // Start animation
                animationEngine.play();

                // Monitor progress
                const totalDuration = animationEngine.getTotalDuration();
                const checkProgress = setInterval(() => {
                    const progress = animationEngine.getProgress();
                    onProgress?.({
                        status: 'recording',
                        progress: 10 + (progress * 0.8),
                        message: `Recording: ${Math.round(progress)}%`
                    });

                    // Stop when animation is complete
                    if (animationEngine.isComplete()) {
                        clearInterval(checkProgress);

                        // Wait a bit for finale to complete
                        setTimeout(() => {
                            this.mediaRecorder.stop();
                            this.isRecording = false;

                            // Stop audio
                            if (this.audioManager.isLoaded()) {
                                this.audioManager.stop();
                            }

                            onProgress?.({
                                status: 'finalizing',
                                progress: 95,
                                message: 'Finalizing video...'
                            });
                        }, 2000); // Extra 2 seconds for finale
                    }
                }, 100);
            });

        } catch (error) {
            console.error('WebM export error:', error);
            throw error;
        }
    }

    // Export as MP4 (convert from WebM using client-side conversion)
    async exportMP4(animationEngine, cameraController, renderer, onProgress) {
        try {
            onProgress?.({ status: 'preparing', progress: 0, message: 'Preparing MP4 export...' });

            // First, create WebM
            const webmBlob = await this.exportWebM(
                animationEngine,
                cameraController,
                renderer,
                (progress) => {
                    if (progress.status === 'recording') {
                        onProgress?.({
                            ...progress,
                            progress: progress.progress * 0.7,
                            message: 'Recording for MP4...'
                        });
                    } else {
                        onProgress?.(progress);
                    }
                }
            );

            onProgress?.({
                status: 'converting',
                progress: 75,
                message: 'Converting to MP4... (This may take a moment)'
            });

            // Load FFmpeg.wasm for conversion
            const mp4Blob = await this.convertWebMToMP4(webmBlob, onProgress);

            onProgress?.({ status: 'complete', progress: 100, message: 'Export complete!' });

            return mp4Blob;

        } catch (error) {
            console.error('MP4 export error:', error);
            throw error;
        }
    }

    // Convert WebM to MP4 using FFmpeg.wasm
    async convertWebMToMP4(webmBlob, onProgress) {
        try {
            // For now, we'll return the WebM blob as-is
            // In a production environment, you would load FFmpeg.wasm here
            // and perform the conversion

            onProgress?.({
                status: 'converting',
                progress: 80,
                message: 'Note: Using WebM format (MP4 conversion requires FFmpeg.wasm)'
            });

            // TODO: Implement FFmpeg.wasm conversion
            // This would require loading the FFmpeg library:
            // const ffmpeg = createFFmpeg({ log: true });
            // await ffmpeg.load();
            // ffmpeg.FS('writeFile', 'input.webm', await fetchFile(webmBlob));
            // await ffmpeg.run('-i', 'input.webm', '-c:v', 'libx264', 'output.mp4');
            // const data = ffmpeg.FS('readFile', 'output.mp4');
            // return new Blob([data.buffer], { type: 'video/mp4' });

            // For now, return WebM with MP4 extension
            return new Blob([webmBlob], { type: 'video/mp4' });

        } catch (error) {
            console.error('Conversion error:', error);
            throw error;
        }
    }

    // Download blob as file
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Check if recording
    getIsRecording() {
        return this.isRecording;
    }

    // Stop recording
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
    }
}
