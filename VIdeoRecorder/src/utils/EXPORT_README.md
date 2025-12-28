# Offline Video Export Pipeline

This directory contains a deterministic offline video export pipeline using WebCodecs API. The export produces videos that match exactly what the user sees in the editor (WYSIWYG).

## Architecture

### Core Components

1. **renderer.ts** - Shared rendering function used by both preview and export
   - `renderFrame()` - Renders a single frame at time `t` to a canvas
   - Uses the same rendering code as the editor preview
   - Handles video layers, captions, titles, background images

2. **webcodecsEncoder.ts** - WebCodecs VideoEncoder wrapper
   - Deterministic frame encoding with fixed timestep
   - Configurable bitrate, keyframe interval, codec (H.264, VP8, VP9)
   - Handles encoder backpressure

3. **audioEncoder.ts** - WebCodecs AudioEncoder wrapper
   - Audio encoding with Opus or AAC
   - Synchronized with video using timestamps

4. **muxer.ts** - MP4/WebM muxer
   - Combines encoded video/audio chunks into final file
   - Supports MP4 (via mp4box.js if available) and WebM

5. **assetPreflight.ts** - Asset preloading and validation
   - Ensures fonts are loaded (`document.fonts.ready`)
   - Preloads all video and image assets
   - Validates assets before export begins

6. **exportWorker.ts** - Main export orchestration
   - Coordinates rendering, encoding, and muxing
   - Handles progress reporting
   - Can run in Web Worker with OffscreenCanvas (future)

7. **offlineExport.ts** - High-level export API
   - `exportOfflineVideo()` - Main export function
   - `prepareRenderState()` - Converts EditStep data to render state

## Usage

### Basic Example

```typescript
import { exportOfflineVideo, prepareRenderState } from './utils/offlineExport'

// Prepare render state from editor data
const renderState = prepareRenderState(
  scenes,
  timelineClips,
  layoutClips,
  canvasSettings,
  layout,
  captionSettings,
  titleSettings,
  backgroundImageData,
  transcripts
)

// Export video
const blob = await exportOfflineVideo(renderState, {
  width: 1920,
  height: 1080,
  fps: 30,
  bitrate: 5_000_000, // 5 Mbps
  format: 'mp4',
  codec: 'avc1',
  onProgress: (progress) => {
    console.log(`Export: ${(progress.progress * 100).toFixed(1)}% - ${progress.message}`)
  }
})

// Download or save blob
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'export.mp4'
a.click()
```

### Integration with EditStep

Replace the existing `handleExport` function in EditStep.tsx:

```typescript
import { exportOfflineVideo, prepareRenderState } from '../utils/offlineExport'

const handleExport = async () => {
  setIsExporting(true)
  setExportProgress('Preparing export...')
  
  try {
    // Prepare render state
    const renderState = prepareRenderState(
      scenes,
      timelineClips,
      layoutClips,
      canvasSettings,
      layout,
      captionSettings,
      titleSettings,
      backgroundImageData,
      transcripts
    )
    
    // Export
    const blob = await exportOfflineVideo(renderState, {
      width: canvasSettings.resolution.width,
      height: canvasSettings.resolution.height,
      fps: 30,
      bitrate: 5_000_000,
      format: 'mp4',
      codec: 'avc1',
      onProgress: (progress) => {
        setExportProgress(progress.message)
        setExportProgressPercent(progress.progress * 100)
      }
    })
    
    // Save file
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'export.mp4'
    a.click()
    URL.revokeObjectURL(url)
    
    setIsExporting(false)
    setExportProgress('Export complete!')
  } catch (error) {
    console.error('Export failed:', error)
    alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`)
    setIsExporting(false)
  }
}
```

## Key Features

### WYSIWYG (What You See Is What You Export)

- Uses the same `renderFrame()` function for preview and export
- Fixed device pixel ratio (DPR = 1.0) for export
- Exact typography matching (fonts preloaded)
- Same color space and blending modes
- Identical layout, timing, and effects

### Deterministic Timing

- Fixed timestep: frame `i` renders at `t = i / fps`
- No dependency on `requestAnimationFrame` or real-time recording
- Exact frame timestamps: `timestamp = frameIndex * (1_000_000 / fps)` microseconds

### Offline Rendering

- Not limited by real-time frame rate
- Can render at any speed (faster or slower than real-time)
- Handles encoder backpressure gracefully
- Yields to prevent UI blocking

### Asset Preflight

- Fonts: `await document.fonts.ready`
- Videos: Preloaded and validated before export
- Images: Preloaded with error handling
- Ensures all assets are ready before rendering begins

## Browser Support

- **Required**: Chromium-based browsers (Chrome, Edge, Opera)
- **WebCodecs API**: Available in Chrome 94+, Edge 94+
- **OffscreenCanvas**: Available in Chrome 69+, Edge 79+ (for future Worker support)

## Optional Dependencies

- **mp4box.js**: For better MP4 muxing (optional, falls back to basic muxing)
  ```bash
  npm install mp4box
  ```

- **webm-muxer**: For better WebM muxing (optional)
  ```bash
  npm install webm-muxer
  ```

## Performance Considerations

1. **Memory**: Large videos may consume significant memory during encoding
2. **CPU**: Encoding is CPU-intensive; consider showing progress UI
3. **Backpressure**: Encoder queue size is monitored; export yields when queue > 20
4. **Frame Rate**: Higher FPS = more frames to encode = longer export time

## Future Enhancements

1. **Web Worker + OffscreenCanvas**: Move rendering to worker thread
2. **Audio Encoding**: Full audio track encoding and A/V sync
3. **Progressive Export**: Stream chunks as they're encoded
4. **Hardware Acceleration**: Better utilization of GPU encoding
5. **Multi-pass Encoding**: Two-pass encoding for better quality

## Troubleshooting

### "WebCodecs API is not supported"
- Use a Chromium-based browser (Chrome, Edge, Opera)
- Ensure you're using a recent version (Chrome 94+)

### "Asset preflight failed"
- Check that all video files are accessible
- Ensure fonts are loaded (check `document.fonts.ready`)
- Verify image URLs are valid

### "Encoder queue size too large"
- Reduce export resolution or FPS
- Increase keyframe interval
- Check CPU usage

### "Export timeout"
- Large videos may take a long time
- Consider showing progress UI
- Check browser console for errors




