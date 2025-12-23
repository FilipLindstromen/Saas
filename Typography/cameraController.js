// Camera Controller - Handles camera movement and focus
class CameraController {
    constructor(canvasWidth, canvasHeight) {
        this.width = canvasWidth;
        this.height = canvasHeight;
        this.x = canvasWidth / 2;
        this.y = canvasHeight / 2;
        this.targetX = this.x;
        this.targetY = this.y;
        this.zoom = 1;
        this.targetZoom = 1;
        this.distance = 1.8; // Camera distance (zoom level)
        this.zoomOutFinale = true;
        this.finaleStarted = false;
        this.lerpFactor = 0.05; // Base smoothing factor for camera movement (reduced for smoothness)
        this.zoomLerpFactor = 0.03; // Even slower for zoom to avoid jumpiness
    }

    // Set camera distance
    setDistance(distance) {
        this.distance = distance;
    }

    // Enable/disable zoom out finale
    setZoomOutFinale(enabled) {
        this.zoomOutFinale = enabled;
    }

    // Update camera to focus on current word
    update(words, currentWordIndex, animationComplete) {
        if (!words || words.length === 0) return;

        // Handle zoom out finale
        if (animationComplete && this.zoomOutFinale) {
            if (!this.finaleStarted) {
                this.finaleStarted = true;
                this.startFinale(words);
            }
            this.updateFinale();
            return;
        }

        // Focus on current word
        if (currentWordIndex < words.length) {
            const word = words[currentWordIndex];
            this.targetX = word.x;
            this.targetY = word.y;

            // Dynamic zoom with a slight "punch" for smaller words
            const distanceScale = 1.0 / this.distance;
            this.targetZoom = (550 / word.size) * distanceScale;
            this.targetZoom = Math.max(0.4, Math.min(1.4, this.targetZoom));
        }

        // Swish-pan dynamics: Faster tracking (0.08) for a cinematic feel
        const trackFactor = 0.08;
        this.x += (this.targetX - this.x) * trackFactor;
        this.y += (this.targetY - this.y) * trackFactor;
        this.zoom += (this.targetZoom - this.zoom) * this.zoomLerpFactor;
    }

    // Start zoom out finale
    startFinale(words) {
        if (this.finaleStarted || words.length === 0) return;
        this.finaleStarted = true;
        this.targetZoom = this.calculateFinaleZoom(words);
        this.targetX = this.finaleCenterX;
        this.targetY = this.finaleCenterY;
        // Slower lerp for finale
        this.lerpFactor = 0.02;
    }

    // Calculate zoom needed to show all words centered
    calculateFinaleZoom(words) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        words.forEach(word => {
            const hw = word.width / 2;
            const hh = word.height / 2;
            minX = Math.min(minX, word.x - hw);
            maxX = Math.max(maxX, word.x + hw);
            minY = Math.min(minY, word.y - hh);
            maxY = Math.max(maxY, word.y + hh);
        });

        const padding = 150;
        const compWidth = (maxX - minX) + padding;
        const compHeight = (maxY - minY) + padding;

        this.finaleCenterX = (minX + maxX) / 2;
        this.finaleCenterY = (minY + maxY) / 2;

        const zoomX = this.width / compWidth;
        const zoomY = this.height / compHeight;

        return Math.min(zoomX, zoomY, 1.0);
    }

    // Update finale animation
    updateFinale() {
        this.x += (this.targetX - this.x) * this.lerpFactor;
        this.y += (this.targetY - this.y) * this.lerpFactor;
        this.zoom += (this.targetZoom - this.zoom) * this.lerpFactor;
    }

    // Reset camera
    reset() {
        this.x = this.width / 2;
        this.y = this.height / 2;
        this.targetX = this.x;
        this.targetY = this.y;
        this.zoom = 1;
        this.targetZoom = 1;
        this.finaleStarted = false;
        this.lerpFactor = 0.1;
    }

    // Apply camera transform to canvas context
    applyTransform(ctx) {
        // Clear any previous transforms
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Translate to center
        ctx.translate(this.width / 2, this.height / 2);

        // Apply zoom
        ctx.scale(this.zoom, this.zoom);

        // Translate to camera position (inverted)
        ctx.translate(-this.x, -this.y);
    }

    // Get camera state
    getState() {
        return {
            x: this.x,
            y: this.y,
            zoom: this.zoom,
            targetX: this.targetX,
            targetY: this.targetY,
            targetZoom: this.targetZoom
        };
    }

    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        const worldX = (screenX - centerX) / this.zoom + this.x;
        const worldY = (screenY - centerY) / this.zoom + this.y;

        return { x: worldX, y: worldY };
    }

    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        const screenX = (worldX - this.x) * this.zoom + centerX;
        const screenY = (worldY - this.y) * this.zoom + centerY;

        return { x: screenX, y: screenY };
    }
}
