# Video Export Techniques

This document describes the 5 different export techniques implemented in the video recorder application.

## Overview

The multi-export system provides 5 different techniques to export videos, each with different advantages and trade-offs. The system can automatically try all techniques until one succeeds, or you can specify a particular technique.

## Export Techniques

### 1. WebCodecs Canvas (`webcodecs-canvas`)

**Best for:** Highest quality, modern browsers (Chrome/Edge)

- Uses WebCodecs VideoEncoder API
- Renders frames to canvas, encodes directly with hardware acceleration
- Best quality output
- Requires Chrome 94+, Edge 94+, or Opera 80+
- Supports H.264, VP8, VP9 codecs
- Fast encoding with good quality/size ratio

**Availability:** Chrome 94+, Edge 94+, Opera 80+

### 2. FFmpeg Frames (`ffmpeg-frames`)

**Best for:** Maximum compatibility, reliable exports

- Renders frames to canvas, captures as PNG images
- Encodes using FFmpeg (WASM)
- Works in all browsers
- Slower but very reliable
- Good quality with wide codec support
- Can handle large videos

**Availability:** All browsers (requires FFmpeg WASM)

### 3. MediaRecorder Canvas (`mediarecorder-canvas`)

**Best for:** Fast exports, native browser encoding

- Records canvas directly using MediaRecorder API
- Browser-native encoding
- Fast performance
- Limited codec options (mostly WebM)
- Good for quick previews

**Availability:** Modern browsers (Chrome, Firefox, Edge, Safari)

### 4. Canvas CaptureStream + FFmpeg (`canvas-capture-ffmpeg`)

**Best for:** Balanced performance and quality

- Uses canvas.captureStream() to create video stream
- Captures frames from stream
- Encodes with FFmpeg
- Good balance between speed and quality
- Requires canvas.captureStream() support

**Availability:** Chrome, Edge, Firefox

### 5. Canvas CaptureStream + MediaRecorder (`canvas-capture-mediarecorder`)

**Best for:** Fast native encoding

- Uses canvas.captureStream() + MediaRecorder
- Fastest encoding (native browser)
- Limited to WebM format typically
- Best for quick exports

**Availability:** Chrome, Edge, Firefox

## Usage

### Automatic Selection

The system can automatically try all techniques until one succeeds:

```typescript
import { exportWithMultiTechnique } from './utils/multiExportIntegration'

const result = await exportWithMultiTechnique(
  scenes,
  timelineClips,
  layoutClips,
  canvasSettings,
  layout,
  captionSettings,
  titleSettings,
  backgroundImageData,
  transcripts,
  {
    technique: 'auto', // Try all techniques
    fps: 30,
    format: 'mp4',
    onProgress: (message, percent, technique, error) => {
      console.log(`[${technique}] ${percent.toFixed(1)}%: ${message}`)
      if (error) console.error(error)
    }
  }
)
```

### Specific Technique

You can also specify a particular technique:

```typescript
const result = await exportWithMultiTechnique(
  // ... parameters ...
  {
    technique: 'webcodecs-canvas', // Use specific technique
    fps: 30,
    format: 'mp4',
    onProgress: (message, percent) => {
      console.log(`${percent.toFixed(1)}%: ${message}`)
    }
  }
)
```

## Technique Comparison

| Technique | Speed | Quality | Compatibility | Format Support |
|-----------|-------|---------|---------------|----------------|
| webcodecs-canvas | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Chrome/Edge only | MP4, WebM |
| ffmpeg-frames | ⭐⭐ | ⭐⭐⭐⭐ | All browsers | MP4, WebM |
| mediarecorder-canvas | ⭐⭐⭐⭐ | ⭐⭐⭐ | Modern browsers | WebM |
| canvas-capture-ffmpeg | ⭐⭐⭐ | ⭐⭐⭐⭐ | Chrome/Edge/Firefox | MP4, WebM |
| canvas-capture-mediarecorder | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Chrome/Edge/Firefox | WebM |

## Logging and Error Handling

All techniques include comprehensive logging:

- Start/end timestamps
- Progress updates
- Error messages with stack traces
- Warnings for non-fatal issues
- Technique-specific logs

Logs are returned in the result:

```typescript
const result = await exportWithMultiTechnique(...)

if (result.success) {
  // Export succeeded
  console.log('Export logs:', result.log)
  console.log('Used technique:', result.technique)
} else {
  // Export failed
  console.error('Export failed:', result.error)
  console.error('Logs:', result.log)
}
```

## Recommendations

1. **Default:** Use `'auto'` - let the system choose the best available technique
2. **High Quality:** Use `'webcodecs-canvas'` if available (Chrome/Edge)
3. **Maximum Compatibility:** Use `'ffmpeg-frames'` (works everywhere)
4. **Quick Previews:** Use `'canvas-capture-mediarecorder'` (fastest)

## Future Enhancements

- Audio encoding and synchronization
- Hardware acceleration detection
- Performance metrics and recommendations
- Quality presets (fast, balanced, best)
- Batch export support




