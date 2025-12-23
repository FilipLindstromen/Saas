// Word Cloud Layout Engine
class WordCloud {
    constructor(canvasWidth, canvasHeight) {
        this.width = canvasWidth;
        this.height = canvasHeight;
        this.words = [];
    }

    // Generate word cloud from text input
    generate(text, minSize, maxSize, fonts) {
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

            // Power-based sizing for more visual drama
            const normalizedFreq = maxFreq === minFreq ? 0.5 : (freq - minFreq) / (maxFreq - minFreq);
            const sizePower = 2.2; // Even stronger visual hierarchy
            const scale = Math.pow(normalizedFreq, sizePower);

            let size = minSize + (scale * (maxSize - minSize));
            size *= (0.7 + Math.random() * 0.6); // Increased jitter for organic feel

            const font = fonts[Math.floor(Math.random() * fonts.length)];

            // Artistic rotation: Long words prefer 0 degrees, 
            // short words provide vertical variety.
            let rotation = 0;
            if (word.length <= 4) {
                rotation = Math.random() > 0.5 ? 90 : 0;
            } else {
                rotation = Math.random() > 0.85 ? 90 : 0;
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
                height: 0
            };
        });

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
            ctx.font = `${word.size}px ${word.font}`;
            const metrics = ctx.measureText(word.text);
            const w = metrics.width;
            const h = word.size;

            this.setWordDimensions(word, w, h);
        });

        const placed = [];
        const margin = 120;

        // KINETIC DYNAMICS: Jump between clusters across 9:16 frame
        let focusX = margin + 200;
        let focusY = margin + 300;
        const wordsPerCluster = 5;
        const ctxMeasure = ctx; // Reuse context

        this.words.forEach((word, index) => {
            if (index > 0 && index % wordsPerCluster === 0) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 300 + Math.random() * 400;
                focusX += Math.cos(angle) * dist;
                focusY += Math.sin(angle) * dist;

                focusX = Math.max(margin, Math.min(this.width - margin, focusX));
                focusY = Math.max(margin, Math.min(this.height - margin, focusY));
            }

            let startPos = { x: focusX, y: focusY };
            if (index % wordsPerCluster !== 0) {
                const prev = this.words[index - 1];
                startPos = { x: prev.x, y: prev.y };
            }

            // EXPERT FIT: Try current rotation, then alternative rotation for best density
            let bestPos = this.findContextualPosition(word, placed, startPos);

            if (!bestPos) {
                // Try rotating to find a better fit
                word.rotation = word.rotation === 0 ? 90 : 0;
                this.setWordDimensions(word, word.rotation === 0 ? word.width : word.height, word.rotation === 90 ? word.width : word.height);
                bestPos = this.findContextualPosition(word, placed, startPos);
            }

            if (bestPos) {
                word.x = bestPos.x;
                word.y = bestPos.y;
            } else {
                // Hard fallback if still no fit
                word.x = margin + Math.random() * (this.width - margin * 2);
                word.y = margin + Math.random() * (this.height - margin * 2);
            }
            placed.push(word);
        });
    }

    setWordDimensions(word, w, h) {
        if (word.rotation === 90) {
            word.width = h;
            word.height = w;
        } else {
            word.width = w;
            word.height = h;
        }
    }

    findContextualPosition(word, placedWords, startPos) {
        const width = this.width;
        const height = this.height;
        const margin = 60;

        let angle = Math.random() * Math.PI * 2;
        let radius = 0;
        const maxRadius = Math.max(width, height);

        // Puzzle-fit dense search resolution
        while (radius < maxRadius) {
            const x = startPos.x + radius * Math.cos(angle);
            const y = startPos.y + radius * Math.sin(angle);

            if (x >= margin && x <= width - margin && y >= margin && y <= height - margin) {
                const overlaps = placedWords.some(placed => this.checkOverlap(word, x, y, placed));
                if (!overlaps) {
                    return { x, y };
                }
            }

            angle += 0.25; // High resolution
            radius += 1.0;
        }

        return null;
    }

    checkOverlap(word1, x1, y1, word2) {
        const padding = 4; // PUZZLE-FIT: TIGHTER SPACING
        const l1 = x1 - word1.width / 2 - padding;
        const r1 = x1 + word1.width / 2 + padding;
        const t1 = y1 - word1.height / 2 - padding;
        const b1 = y1 + word1.height / 2 + padding;

        const l2 = word2.x - word2.width / 2 - padding;
        const r2 = word2.x + word2.width / 2 + padding;
        const t2 = word2.y - word2.height / 2 - padding;
        const b2 = word2.y + word2.height / 2 + padding;

        return !(r1 < l2 || l1 > r2 || b1 < t2 || t1 > b2);
    }



    // Check if word is within canvas bounds
    isInBounds(word, x, y) {
        const margin = 50;
        const left = x - word.width / 2;
        const right = x + word.width / 2;
        const top = y - word.height / 2;
        const bottom = y + word.height / 2;

        return left >= margin &&
            right <= this.width - margin &&
            top >= margin &&
            bottom <= this.height - margin;
    }

    // Get all words
    getWords() {
        return this.words;
    }

    // Get word by index
    getWord(index) {
        return this.words[index];
    }

    // Get total word count
    getWordCount() {
        return this.words.length;
    }
}
