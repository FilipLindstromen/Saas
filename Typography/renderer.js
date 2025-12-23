// Renderer - Handles canvas rendering at 30fps
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', {
            alpha: false
        });
        this.width = canvas.width;
        this.height = canvas.height;
        this.backgroundColor = '#1a1a2e';
        this.textColor = '#ffffff';
        this.fps = 30;
        this.frameInterval = 1000 / this.fps;
        this.lastFrameTime = 0;
        this.animationFrameId = null;
    }

    // Set background color
    setBackgroundColor(color) {
        this.backgroundColor = color;
    }

    // Set text color
    setTextColor(color) {
        this.textColor = color;
    }

    // Start rendering loop
    start(animationEngine, cameraController) {
        this.animationEngine = animationEngine;
        this.cameraController = cameraController;
        this.lastFrameTime = performance.now();
        this.render();
    }

    // Stop rendering loop
    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // Main render loop
    render(currentTime = performance.now()) {
        // Maintain 30fps
        const elapsed = currentTime - this.lastFrameTime;

        if (elapsed >= this.frameInterval) {
            this.lastFrameTime = currentTime - (elapsed % this.frameInterval);

            // Update animation
            if (this.animationEngine) {
                this.animationEngine.update(currentTime);
            }

            // Update camera
            if (this.cameraController && this.animationEngine) {
                this.cameraController.update(
                    this.animationEngine.words,
                    this.animationEngine.currentWordIndex,
                    this.animationEngine.isComplete()
                );
            }

            // Draw frame
            this.draw();
        }

        this.animationFrameId = requestAnimationFrame((time) => this.render(time));
    }

    // Draw single frame
    draw() {
        const ctx = this.ctx;

        // CRITICAL: Reset transform before clearing to avoid ghosting
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Clear canvas
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, this.width, this.height);

        // Apply camera transform
        if (this.cameraController) {
            this.cameraController.applyTransform(ctx);
        }

        // Draw words
        if (this.animationEngine && this.animationEngine.words) {
            this.drawWords(this.animationEngine.words);
        }
    }

    // Draw all words with their animations
    drawWords(words) {
        const ctx = this.ctx;

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        words.forEach(word => {
            if (!word.visible) return;

            const transform = this.animationEngine.getWordTransform(word);

            // Motion Blur Simulation: Draw multiple times if velocity exists
            const velocity = word.velocity || { x: 0, y: 0, scale: 0, rotation: 0 };
            const blurSamples = 5;
            const blurStrength = 0.8; // Professional level

            for (let i = blurSamples - 1; i >= 0; i--) {
                const subProgress = i / blurSamples;
                const alpha = i === 0 ? transform.opacity : (transform.opacity * 0.2 * (1 - subProgress));

                if (alpha < 0.01) continue;

                ctx.save();

                // Offset by velocity for blur
                const ox = word.x - (velocity.x * subProgress * blurStrength);
                const oy = word.y - (velocity.y * subProgress * blurStrength);
                const os = transform.scale - (velocity.scale * subProgress * blurStrength);
                const or = transform.rotation - (velocity.rotation * subProgress * blurStrength);

                ctx.translate(ox, oy);
                ctx.rotate((or * Math.PI) / 180);
                ctx.scale(os, os);
                ctx.translate(transform.translateX, transform.translateY);
                ctx.globalAlpha = alpha;

                if (transform.clipPath && i === 0) { // Only clip the main instance
                    this.applyClipPath(ctx, word, transform.clipPath);
                }

                ctx.font = `${word.size}px ${word.font}`;

                // Added Polish: Subtle drop shadow for depth (only for the main instance)
                if (i === 0) {
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                    ctx.shadowBlur = 10;
                    ctx.shadowOffsetX = 5;
                    ctx.shadowOffsetY = 5;
                }

                ctx.fillStyle = this.textColor;
                ctx.fillText(word.text, 0, 0);

                ctx.restore();
            }
        });
    }


    // Apply clip path for mask animations
    applyClipPath(ctx, word, clipPath) {
        // Parse inset clip path: "inset(top right bottom left)"
        const match = clipPath.match(/inset\(([^)]+)\)/);
        if (!match) return;

        const values = match[1].split(' ').map(v => parseFloat(v));
        const top = values[0] || 0;
        const right = values[1] || 0;
        const bottom = values[2] || 0;
        const left = values[3] || 0;

        // For clipping, we need the actual text dimensions (before rotation swap)
        // Note: wordCloud.js swaps width/height for placement, but here we
        // are inside the rotated context if word.rotation === 90.
        // The transform.rotation is applied ABOVE this call.

        // If the word is at 90 degrees, its 'width' and 'height' in word object
        // are ALREADY swapped by wordCloud for bounding box.
        // But the text itself, when drawn with ctx.rotate(90), expects its
        // horizontal width to be the clip width.

        const isRotated = word.rotation === 90;
        const drawWidth = isRotated ? word.height : word.width;
        const drawHeight = isRotated ? word.width : word.height;

        ctx.beginPath();
        ctx.rect(
            -drawWidth / 2 + (left * drawWidth / 100),
            -drawHeight / 2 + (top * drawHeight / 100),
            drawWidth - ((left + right) * drawWidth / 100),
            drawHeight - ((top + bottom) * drawHeight / 100)
        );
        ctx.clip();
    }

    // Render single frame (for export)
    renderFrame(words, animationEngine, cameraController) {
        const ctx = this.ctx;

        // Clear canvas
        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(0, 0, this.width, this.height);

        // Apply camera transform
        if (cameraController) {
            cameraController.applyTransform(ctx);
        }

        // Draw words
        if (words && words.length > 0) {
            // Temporarily set animation engine
            const prevEngine = this.animationEngine;
            this.animationEngine = animationEngine;

            this.drawWords(words);

            this.animationEngine = prevEngine;
        }
    }

    // Get canvas as blob (for export)
    getBlob() {
        return new Promise((resolve) => {
            this.canvas.toBlob(resolve, 'image/png');
        });
    }

    // Clear canvas
    clear() {
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Resize canvas
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
    }
}
