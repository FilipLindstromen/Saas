// Animation Engine - Handles professional motion graphics and sequential timing
class AnimationEngine {
    constructor() {
        this.words = [];
        this.currentWordIndex = 0;
        this.startTime = 0;
        this.durationPerWord = 1200; // ms
        this.overlap = -200; // ms
        this.isPaused = true;
        this.totalDuration = 0;
        this.currentTime = 0;
    }

    // Set words and calculate total duration
    setWords(words, speedMultiplier = 1.0) {
        this.durationPerWord = 1200 / speedMultiplier;
        this.overlap = -200 / speedMultiplier;

        this.words = words.map((word, index) => {
            // Syncopated timing: Randomize duration and start offset slightly
            const syncopationFactor = 0.9 + Math.random() * 0.2; // ±10%
            const timingOffset = (Math.random() - 0.5) * 150; // ms jitter

            return {
                ...word,
                visible: false,
                animationProgress: 0,
                style: this.getRandomStyle(),
                prevTransform: null,
                velocity: { x: 0, y: 0, scale: 0, rotation: 0 },
                syncDuration: this.durationPerWord * syncopationFactor,
                syncOffset: timingOffset
            };
        });

        // Total duration calculation with jitter
        this.totalDuration = this.words.length * (this.durationPerWord + this.overlap) + 1000;
        this.reset();
    }

    getRandomStyle() {
        const styles = ['fade', 'slide-up', 'mask-reveal', 'scale-bounce', 'rotate-in', 'slide-side'];
        return styles[Math.floor(Math.random() * styles.length)];
    }

    update(currentTime, force = false) {
        if (this.isPaused && !force) return;

        this.currentTime = currentTime - this.startTime;

        this.words.forEach((word, index) => {
            const wordStartTime = index * (this.durationPerWord + this.overlap) + (word.syncOffset || 0);
            const duration = word.syncDuration || this.durationPerWord;
            const elapsed = this.currentTime - wordStartTime;

            if (elapsed < 0) {
                word.visible = false;
                word.animationProgress = 0;
            } else if (elapsed > duration) {
                word.visible = true;
                word.animationProgress = 1;
                this.currentWordIndex = Math.max(this.currentWordIndex, index);
            } else {
                word.visible = true;
                word.animationProgress = elapsed / duration;
                this.currentWordIndex = index;
            }
        });
    }

    // Get transform for a word based on its animation progress
    getWordTransform(word) {
        const p = word.animationProgress;

        // Premium Easing: Quintic Out for elegant arrival
        const easeQuint = 1 - Math.pow(1 - p, 5);

        // Back Out for subtle bounce
        const backAmount = 1.70158;
        const easeBackCustom = 1 + (backAmount + 1) * Math.pow(p - 1, 3) + backAmount * Math.pow(p - 1, 2);

        let transform = {
            opacity: 1,
            scale: 1,
            rotation: 0,
            translateX: 0,
            translateY: 0,
            clipPath: null
        };

        const style = word.style;

        if (style === 'fade') {
            transform.opacity = easeQuint;
        } else if (style === 'slide-up') {
            transform.opacity = p < 0.2 ? p * 5 : 1;
            transform.translateY = (1 - easeQuint) * 100;
        } else if (style === 'mask-reveal') {
            transform.clipPath = `inset(0 0 ${(1 - easeQuint) * 100}% 0)`;
        } else if (style === 'scale-bounce') {
            transform.scale = easeBackCustom;
            transform.opacity = p < 0.2 ? p * 5 : 1;
        } else if (style === 'rotate-in') {
            transform.rotation = (1 - easeQuint) * -20;
            transform.opacity = p < 0.1 ? p * 10 : 1;
            transform.scale = 0.8 + (easeQuint * 0.2);
        } else if (style === 'slide-side') {
            transform.translateX = (1 - easeQuint) * -150;
            transform.opacity = p < 0.3 ? p * 3.3 : 1;
        }

        // Velocity for motion blur
        if (word.prevTransform) {
            word.velocity = {
                x: transform.translateX - word.prevTransform.translateX,
                y: transform.translateY - word.prevTransform.translateY,
                scale: transform.scale - word.prevTransform.scale,
                rotation: transform.rotation - word.prevTransform.rotation
            };
        }
        word.prevTransform = { ...transform };

        return transform;
    }

    play() {
        if (this.isPaused) {
            this.startTime = performance.now() - this.currentTime;
            this.isPaused = false;
        }
    }

    pause() {
        this.isPaused = true;
    }

    reset() {
        this.currentTime = 0;
        this.currentWordIndex = 0;
        this.startTime = performance.now();
        this.words.forEach(word => {
            word.visible = false;
            word.animationProgress = 0;
            word.prevTransform = null;
            word.velocity = { x: 0, y: 0, scale: 0, rotation: 0 };
        });
    }

    isComplete() {
        return this.currentTime >= this.totalDuration;
    }

    getProgress() {
        if (this.totalDuration === 0) return 0;
        return Math.min(100, (this.currentTime / this.totalDuration) * 100);
    }

    setSpeed(multiplier) {
        const wasPaused = this.isPaused;
        const progress = this.getProgress() / 100;

        this.durationPerWord = 1200 / multiplier;
        this.overlap = -200 / multiplier;
        this.totalDuration = this.words.length * (this.durationPerWord + this.overlap);

        this.currentTime = progress * this.totalDuration;
        if (!wasPaused) {
            this.startTime = performance.now() - this.currentTime;
        }
    }

    getCurrentTime() {
        return this.currentTime;
    }

    getTotalDuration() {
        return this.totalDuration;
    }

    seek(progress) {
        this.currentTime = progress * this.totalDuration;
        if (!this.isPaused) {
            this.startTime = performance.now() - this.currentTime;
        }
        this.update(performance.now(), true);
    }
}
