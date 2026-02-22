# Video Rendering and Export System Documentation

This document explains how the rendering and video export system works in this project. Use this as a reference when implementing similar functionality in another project.

## Overview

The system uses two main approaches for video export:
1. **CanvasRecorder** - Frame-by-frame canvas rendering (primary method)
2. **VideoExporter** - DOM element capture using html2canvas (alternative method)

The primary method (`CanvasRecorder`) renders each frame programmatically to a canvas, providing deterministic, high-quality results. The alternative method (`VideoExporter`) captures DOM elements using html2canvas, which is useful when you need to export existing UI components.

---

## Architecture

### 1. CanvasRecorder (Primary Method)

**Location**: `src/utils/canvasRecorder.ts`

**How it works:**
- Creates an off-screen canvas at the target resolution
- Renders frames frame-by-frame using Canvas 2D API
- Uses `MediaRecorder` API to record the canvas stream
- Supports audio mixing (background music, SFX, voice-overs)
- Handles timing, animations, and transitions programmatically

**Key Features:**
- Frame-by-frame rendering for deterministic output
- Audio mixing with Web Audio API
- Multiple background types (color, image, video, split-screen)
- Animation timing control
- Memory-efficient streaming approach

**Usage Example:**
```typescript
import { CanvasRecorder } from './utils/canvasRecorder'

const options = {
  quiz: quizData, // Your content data
  duration: 10000, // milliseconds
  frameRate: 60,
  quality: 'high', // 'low' | 'medium' | 'high' | 'ultra'
  format: 'webm', // 'webm' | 'mp4'
  includeMusic: true,
  onProgress: (progress) => console.log(`${progress}%`),
  onStatus: (status) => console.log(status),
  onError: (error) => console.error(error)
}

const result = await CanvasRecorder.recordVideo(options)
// result contains: blob, url, size, duration, format, resolution
```

**Rendering Pipeline:**

1. **Initialization**
   - Preloads all assets (images, videos, audio)
   - Creates canvas at target resolution
   - Sets up MediaRecorder with appropriate codec
   - Initializes Web Audio API for audio mixing

2. **Frame Rendering Loop**
   - Calculates frame count: `Math.ceil((duration / 1000) * frameRate)`
   - For each frame:
     - Calculates current time: `frameIndex * frameInterval`
     - Determines what stage to render (title, question, CTA, etc.)
     - Renders background (color/image/video with zoom effects)
     - Renders content (title, questions, answers, overlays)
     - Triggers audio events (SFX, voice-overs) at correct times
     - Updates progress

3. **Audio Handling**
   - Background music: Uses `MediaElementAudioSourceNode` from HTMLAudioElement
   - SFX: Uses `AudioBufferSourceNode` with preloaded AudioBuffers
   - Voice-overs: Similar to SFX, triggered at specific times
   - All audio routed through `MediaStreamAudioDestinationNode` to combine with video

4. **Video Encoding**
   - Canvas stream captured via `canvas.captureStream(frameRate)`
   - MediaRecorder records the stream
   - Codec selection: Tries VP9, VP8, H.264 in order of preference
   - Bitrate based on quality preset

**Rendering Functions:**

- `renderBackground()` - Handles color, image, video, split-screen backgrounds with zoom animations
- `renderTitle()` - Renders title screen with fade-in animation
- `renderQuestion()` - Renders question and answers with staggered animations
- `renderCTAFrame()` - Renders call-to-action screen
- `renderMemeFrame()` - Renders meme-style content
- `renderOverlayTexts()` - Renders animated overlay text elements

**Timing System:**

The system uses a timeline calculation function (`computeQuizTimeline`) that:
- Calculates duration for each stage (title, questions, CTA)
- Determines when each element should appear
- Handles animation timings (fade in, stagger, hold, fade out)
- Supports custom timing settings per element

---

### 2. VideoExporter (Alternative Method)

**Location**: `src/utils/videoExporter.ts`

**How it works:**
- Captures DOM elements using `html2canvas`
- Can use ffmpeg.wasm for encoding (optional)
- Falls back to MediaRecorder when ffmpeg.wasm unavailable
- Supports animation timing control via callback

**Key Features:**
- DOM element capture
- Memory-efficient streaming
- Animation timing synchronization
- Multiple resolution presets
- Quality presets with bitrate control

**Usage Example:**
```typescript
import { VideoExporter } from './utils/videoExporter'

const exporter = new VideoExporter()
await exporter.initialize() // Only needed for ffmpeg.wasm

const options = {
  element: document.getElementById('target-element'),
  duration: 10000,
  frameRate: 30,
  resolution: '1080p', // '720p' | '1080p' | '1440p' | '4k'
  quality: 'high',
  setRecordingTime: (time) => {
    // Update animation state based on time
    updateAnimationState(time)
  },
  totalDuration: 10000,
  onProgress: (progress) => console.log(`${progress}%`),
  onStatus: (status) => console.log(status)
}

const result = await exporter.exportVideo(options)
```

**Process:**

1. **Frame Capture**
   - Uses `html2canvas` to capture DOM element at each frame
   - Calculates scale factor for target resolution
   - Captures at 2x scale for crisp output

2. **Streaming Approach**
   - Creates canvas for video creation
   - Captures frames and draws to canvas
   - Canvas stream captured via `canvas.captureStream()`
   - MediaRecorder records the stream

3. **Timing Control**
   - Calls `setRecordingTime()` callback at each frame
   - Allows parent component to update animation state
   - Ensures animations are synchronized with recording

---

## Key Implementation Details

### Resolution and Quality Presets

**CanvasRecorder:**
- Resolution: Calculated from aspect ratio (default 9:16 portrait)
- Width: Fixed at 1080px
- Height: Calculated from aspect ratio
- Quality presets:
  - `low`: 1Mbps bitrate, CRF 28
  - `medium`: 3Mbps bitrate, CRF 23
  - `high`: 8Mbps bitrate, CRF 20
  - `ultra`: 15Mbps bitrate, CRF 18

**VideoExporter:**
- Resolution presets (9:16 portrait):
  - `720p`: 720x1280
  - `1080p`: 1080x1920
  - `1440p`: 1440x2560
  - `4k`: 2160x3840
- Same quality presets as CanvasRecorder

### Frame Rate

- Default: 60 FPS for CanvasRecorder, 30 FPS for VideoExporter
- Frame interval: `1000 / frameRate` milliseconds
- Frame count: `Math.ceil((duration / 1000) * frameRate)`

### Memory Management

**CanvasRecorder:**
- Cleans up canvas immediately after each frame
- Releases audio sources after playback
- Properly disconnects audio nodes
- Closes AudioContext when done

**VideoExporter:**
- Streams frames instead of storing all in memory
- Cleans up captured canvas immediately: `canvas.width = 0; canvas.height = 0`
- Uses `requestAnimationFrame` for smooth processing
- Optional garbage collection if available: `window.gc()`

### Audio Mixing

**Setup:**
```typescript
// Create AudioContext
const audioContext = new AudioContext()
const audioDest = audioContext.createMediaStreamDestination()

// Combine video and audio streams
const combined = new MediaStream()
videoStream.getVideoTracks().forEach(track => combined.addTrack(track))
audioDest.stream.getAudioTracks().forEach(track => combined.addTrack(track))
```

**Background Music:**
```typescript
const musicEl = new Audio(musicUrl)
musicEl.crossOrigin = 'anonymous'
const musicSource = audioContext.createMediaElementSource(musicEl)
const musicGain = audioContext.createGain()
musicGain.gain.value = volume
musicSource.connect(musicGain)
musicGain.connect(audioDest)
```

**SFX:**
```typescript
const buffer = await loadAudioBuffer(audioContext, sfxUrl)
const source = audioContext.createBufferSource()
source.buffer = buffer
source.connect(gainNode)
source.start(audioContext.currentTime + 0.01)
```

### Background Rendering

**Image Background with Zoom:**
```typescript
const zoomProgress = Math.min(frameTime / zoomDuration, 1)
const scale = 1 + (zoomProgress * (targetZoom - 1))
// Apply scale when drawing image
ctx.save()
ctx.translate(width/2, height/2)
ctx.scale(scale, scale)
ctx.translate(-width/2, -height/2)
ctx.drawImage(image, dx, dy, dw, dh)
ctx.restore()
```

**Video Background:**
- Video element plays naturally during recording
- Draws current video frame to canvas each frame
- Handles looping if video duration < recording duration
- Supports start offset: `video.currentTime = offsetSeconds`

**Split-Screen Video:**
- Two video elements (upper and lower)
- Clips canvas context to each half
- Draws each video to its respective half

### Animation Timing

**Fade In/Out:**
```typescript
const fadeInDuration = 500 // ms
const holdDuration = 2000 // ms
const fadeOutDuration = 500 // ms

if (elapsed < fadeInDuration) {
  opacity = elapsed / fadeInDuration
} else if (elapsed < fadeInDuration + holdDuration) {
  opacity = 1
} else {
  const fadeOutElapsed = elapsed - (fadeInDuration + holdDuration)
  opacity = 1 - (fadeOutElapsed / fadeOutDuration)
}
```

**Staggered Animations:**
```typescript
const staggerDelay = 70 // ms per item
items.forEach((item, index) => {
  const itemStartTime = baseTime + (index * staggerDelay)
  const itemElapsed = Math.max(0, currentTime - itemStartTime)
  const itemProgress = Math.min(itemElapsed / animationDuration, 1)
  // Render with progress
})
```

### Text Rendering

**Text Wrapping:**
```typescript
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''
  
  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word
    const metrics = ctx.measureText(testLine)
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  
  if (currentLine) lines.push(currentLine)
  return lines.join('\n')
}
```

**Multi-line Centered Text:**
```typescript
const lines = wrappedText.split('\n')
const lineHeight = fontSize * 1.2
const totalHeight = lineHeight * (lines.length - 1)
const startY = centerY - totalHeight / 2

lines.forEach((line, i) => {
  ctx.fillText(line, centerX, startY + i * lineHeight)
})
```

### Codec Selection

**Priority Order:**
1. `video/webm;codecs=vp9` (best quality)
2. `video/webm;codecs=vp8`
3. `video/webm`
4. `video/mp4;codecs=h264`
5. `video/mp4` (fallback)

**Check Support:**
```typescript
const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', ...]
let mimeType = 'video/webm'
for (const type of mimeTypes) {
  if (MediaRecorder.isTypeSupported(type)) {
    mimeType = type
    break
  }
}
```

---

## Integration Points

### 1. Timeline Calculation

The system uses `computeQuizTimeline()` to calculate:
- Title duration
- Question timings (start time, duration per question)
- Total content duration
- CTA timing
- End delay

This function must be implemented to match your content structure.

### 2. Asset Preloading

Before recording, all assets must be preloaded:
- Background images/videos
- Meme images (if applicable)
- Background music
- SFX audio files
- Voice-over audio files

**Example:**
```typescript
async function preloadAssets(quiz) {
  const assets = {}
  
  // Load image
  if (quiz.background?.type === 'image') {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = quiz.background.imageUrl
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })
    assets.imageEl = img
  }
  
  // Load video
  if (quiz.background?.type === 'video') {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.src = quiz.background.videoUrl
    video.muted = true
    await video.play()
    video.pause()
    assets.videoEl = video
  }
  
  // Load audio
  if (quiz.settings?.music?.url) {
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.src = quiz.settings.music.url
    await audio.load
    assets.musicEl = audio
  }
  
  return assets
}
```

### 3. Animation State Management

When using `VideoExporter` with timing control, you need to update your animation state:

```typescript
const [recordingTime, setRecordingTime] = useState(0)

// In your component, update animations based on recordingTime
useEffect(() => {
  if (isRecording) {
    // Update animation progress based on recordingTime
    const progress = recordingTime / totalDuration
    updateAnimationProgress(progress)
  }
}, [recordingTime, isRecording])
```

---

## Best Practices

1. **Always preload assets** before starting recording
2. **Use appropriate frame rates**: 60 FPS for smooth animations, 30 FPS for static content
3. **Clean up resources** after recording (audio sources, canvas, streams)
4. **Handle errors gracefully** with try-catch and user feedback
5. **Show progress** to users during long exports
6. **Test codec support** before recording
7. **Use memory-efficient approaches** for long videos (streaming, cleanup)
8. **Calculate timing accurately** to ensure animations sync correctly
9. **Handle CORS** for cross-origin assets (images, videos, audio)
10. **Test on target devices** as performance varies

---

## Common Issues and Solutions

### Issue: Video is black/blank
**Solution**: Ensure canvas is being drawn to before MediaRecorder starts. Add a small delay before stopping recorder.

### Issue: Audio not included
**Solution**: Check that AudioContext is resumed (`audioContext.resume()`), and audio sources are connected to the destination node.

### Issue: Out of memory errors
**Solution**: Use streaming approach, clean up canvases immediately, reduce frame rate or resolution.

### Issue: Animations not syncing
**Solution**: Ensure timing calculations are accurate, use `requestAnimationFrame` for smooth updates.

### Issue: Codec not supported
**Solution**: Check browser support, fall back to supported codec, or use server-side encoding.

### Issue: CORS errors
**Solution**: Set `crossOrigin = 'anonymous'` on media elements, ensure server sends proper CORS headers.

---

## Dependencies

**Required:**
- `html2canvas` - For DOM element capture (VideoExporter)
- `@ffmpeg/ffmpeg` and `@ffmpeg/util` - Optional, for ffmpeg.wasm encoding

**Browser APIs:**
- `HTMLCanvasElement` and `CanvasRenderingContext2D`
- `MediaRecorder` API
- `Web Audio API` (AudioContext, MediaElementAudioSourceNode, etc.)
- `requestAnimationFrame`

---

## Example: Complete Recording Flow

```typescript
async function recordVideo(quizData) {
  // 1. Preload assets
  const assets = await preloadAssets(quizData)
  
  // 2. Calculate duration
  const timeline = computeQuizTimeline(quizData)
  const duration = timeline.totalContentDuration + timeline.endDelay
  
  // 3. Set up recording
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const ctx = canvas.getContext('2d')
  
  // 4. Create media stream
  const videoStream = canvas.captureStream(60)
  const audioContext = new AudioContext()
  const audioDest = audioContext.createMediaStreamDestination()
  
  // 5. Set up audio (if needed)
  if (assets.musicEl) {
    const musicSource = audioContext.createMediaElementSource(assets.musicEl)
    musicSource.connect(audioDest)
    assets.musicEl.play()
  }
  
  // 6. Combine streams
  const combined = new MediaStream()
  videoStream.getVideoTracks().forEach(t => combined.addTrack(t))
  audioDest.stream.getAudioTracks().forEach(t => combined.addTrack(t))
  
  // 7. Start MediaRecorder
  const recorder = new MediaRecorder(combined, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 8000000
  })
  
  const chunks = []
  recorder.ondataavailable = (e) => chunks.push(e.data)
  
  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      resolve({ blob, url: URL.createObjectURL(blob) })
    }
    
    recorder.start()
    
    // 8. Render frames
    renderFrames(ctx, canvas, quizData, duration, 60, () => {
      setTimeout(() => recorder.stop(), 1000)
    })
  })
}

function renderFrames(ctx, canvas, quiz, duration, frameRate, onComplete) {
  const frameCount = Math.ceil((duration / 1000) * frameRate)
  const frameInterval = 1000 / frameRate
  let frameIndex = 0
  
  const renderNext = () => {
    if (frameIndex >= frameCount) {
      onComplete()
      return
    }
    
    const frameTime = frameIndex * frameInterval
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Render background
    renderBackground(ctx, quiz.background, canvas.width, canvas.height, frameTime)
    
    // Render content based on frameTime
    // ... (determine stage and render accordingly)
    
    frameIndex++
    setTimeout(renderNext, frameInterval)
  }
  
  renderNext()
}
```

---

## Summary

The video rendering and export system uses a frame-by-frame canvas rendering approach for deterministic, high-quality output. Key components:

1. **CanvasRecorder**: Primary method using programmatic canvas rendering
2. **VideoExporter**: Alternative method using DOM capture
3. **Timing System**: Calculates when each element should appear
4. **Audio Mixing**: Combines multiple audio sources using Web Audio API
5. **Memory Management**: Streaming approach with immediate cleanup
6. **Codec Selection**: Automatic fallback to supported codecs

The system is designed to be flexible and handle various content types (quizzes, memes, overlays) with smooth animations and proper audio synchronization.

