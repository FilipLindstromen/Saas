// Mosaic Layout Engine
class WordCloud {
    constructor(canvasWidth, canvasHeight) {
        this.width = canvasWidth;
        this.height = canvasHeight;
        this.words = [];
        this.allowRotation = true;
    }

    // Generate a mosaic layout from text input
    generate(text, minSize, maxSize, fonts, allowRotation = true) {
        const allWords = text
            .toUpperCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 0);

        const frequency = this.calculateFrequency(text);
        const frequencies = Object.values(frequency);
        const maxFreq = Math.max(...frequencies);
        const minFreq = Math.min(...frequencies);

        this.words = allWords.map((word, index) => {
            const freq = frequency[word];

            // Power-based sizing for visual hierarchy
            const normalizedFreq = maxFreq === minFreq ? 0.5 : (freq - minFreq) / (maxFreq - minFreq);
            const sizePower = 2.2;
            const scale = Math.pow(normalizedFreq, sizePower);

            let size = minSize + (scale * (maxSize - minSize));
            // Gentle jitter for an organic feel -- large swings break the
            // tessellation between neighboring mosaic pieces.
            size *= (0.92 + Math.random() * 0.16);

            const font = fonts[Math.floor(Math.random() * fonts.length)];

            // Artistic rotation: long words stay horizontal for readability,
            // short words provide vertical variety to help tile the gaps.
            let rotation = 0;
            if (allowRotation) {
                if (word.length <= 4) {
                    rotation = Math.random() > 0.5 ? 90 : 0;
                } else {
                    rotation = Math.random() > 0.85 ? 90 : 0;
                }
            }

            return {
                text: word,
                size: Math.max(minSize, Math.min(maxSize, Math.round(size))),
                font: font,
                rotation: rotation,
                frequency: freq,
                index: index,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                rawWidth: 0,
                rawHeight: 0
            };
        });

        this.allowRotation = allowRotation;
        this.calculatePositions();
        return this.words;
    }

    calculateFrequency(text) {
        const words = text.toUpperCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);
        const freq = {};
        words.forEach(w => freq[w] = (freq[w] || 0) + 1);
        return freq;
    }

    calculatePositions() {
        if (this.words.length === 0) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        this.words.forEach(word => {
            ctx.font = `${word.size}px "${word.font}"`;
            const metrics = ctx.measureText(word.text);
            word.rawWidth = metrics.width;
            word.rawHeight = word.size;
            const dims = this.dimsForRotation(word, word.rotation);
            word.width = dims.width;
            word.height = dims.height;
        });

        // Mosaic composition: the biggest / most frequent words anchor the
        // center and smaller ones tile outward, interlocking around them.
        // Placing them in size order (rather than original text order)
        // also gives the animation and camera a coherent center-out path
        // to follow instead of jumping between disconnected clusters.
        const placementOrder = [...this.words].sort((a, b) => b.size - a.size);

        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const margin = 40;
        const padding = 6; // tight gap so neighboring pieces read as one mosaic

        const placed = [];
        placementOrder.forEach(word => {
            const pos = this.findSpiralPosition(word, placed, centerX, centerY, margin, padding);
            word.x = pos.x;
            word.y = pos.y;
            placed.push(word);
        });

        // Packing order (biggest-first) is great for tessellating tightly,
        // but the spiral search can land a word anywhere along its ring,
        // so consecutive packed words aren't always neighbors in space.
        // Re-walk the finished mosaic as a nearest-neighbor tour starting
        // from the anchor word so playback/camera always advances to the
        // physically closest remaining piece -- a smooth glide through the
        // mosaic instead of hopping around it.
        this.words = this.buildNearestNeighborTour(placementOrder);
    }

    buildNearestNeighborTour(words) {
        if (words.length <= 2) return words;
        const remaining = [...words];
        const tour = [remaining.shift()];
        while (remaining.length) {
            const last = tour[tour.length - 1];
            let bestIndex = 0;
            let bestDist = Infinity;
            for (let i = 0; i < remaining.length; i++) {
                const d = Math.hypot(remaining[i].x - last.x, remaining[i].y - last.y);
                if (d < bestDist) {
                    bestDist = d;
                    bestIndex = i;
                }
            }
            tour.push(remaining.splice(bestIndex, 1)[0]);
        }
        return tour;
    }

    // Width/height a word would occupy at a given rotation, derived from
    // its unrotated measured text metrics (never mutated in place, so
    // repeatedly testing rotations can't drift from the true glyph size).
    dimsForRotation(word, rotation) {
        return rotation === 90
            ? { width: word.rawHeight, height: word.rawWidth }
            : { width: word.rawWidth, height: word.rawHeight };
    }

    checkOverlap(x, y, width, height, other, padding) {
        const l1 = x - width / 2 - padding, r1 = x + width / 2 + padding;
        const t1 = y - height / 2 - padding, b1 = y + height / 2 + padding;

        const l2 = other.x - other.width / 2, r2 = other.x + other.width / 2;
        const t2 = other.y - other.height / 2, b2 = other.y + other.height / 2;

        return !(r1 < l2 || l1 > r2 || b1 < t2 || t1 > b2);
    }

    // Walk an aspect-ratio-scaled Archimedean spiral out from the canvas
    // center, testing both rotations at each stop, until a spot is found
    // that doesn't overlap anything already placed. If the word can't fit
    // anywhere within bounds, shrink it slightly and retry -- this keeps
    // dense text tessellating cleanly instead of spilling outside the
    // frame or falling back to a random, gap-breaking position.
    findSpiralPosition(word, placed, centerX, centerY, margin, padding) {
        const aspect = this.width / this.height;
        const maxReachSq = Math.pow(Math.max(this.width, this.height), 2);
        const rotations = this.allowRotation
            ? [word.rotation, word.rotation === 0 ? 90 : 0]
            : [word.rotation];

        for (let shrink = 0; shrink < 8; shrink++) {
            const dt = 0.15;
            const spread = 2.4; // spiral density -- smaller = tighter packing
            let t = 0;

            while (true) {
                const dx = aspect * t * Math.cos(t) * spread;
                const dy = t * Math.sin(t) * spread;
                const x = centerX + dx;
                const y = centerY + dy;

                for (const rotation of rotations) {
                    const { width, height } = this.dimsForRotation(word, rotation);
                    const fitsInFrame = x - width / 2 >= margin && x + width / 2 <= this.width - margin &&
                        y - height / 2 >= margin && y + height / 2 <= this.height - margin;
                    if (!fitsInFrame) continue;

                    const blocked = placed.some(p => this.checkOverlap(x, y, width, height, p, padding));
                    if (!blocked) {
                        word.rotation = rotation;
                        word.width = width;
                        word.height = height;
                        return { x, y };
                    }
                }

                t += dt;
                if (dx * dx + dy * dy > maxReachSq) break;
            }

            // Nothing fit at this size anywhere in the frame -- shrink and
            // retry so the mosaic still tessellates fully.
            word.size = Math.max(10, Math.round(word.size * 0.85));
            word.rawWidth *= 0.85;
            word.rawHeight *= 0.85;
        }

        // Practically unreachable, but keep the word visible rather than lost.
        const dims = this.dimsForRotation(word, word.rotation);
        word.width = dims.width;
        word.height = dims.height;
        return { x: centerX, y: centerY };
    }
}
