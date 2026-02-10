# Multi-Export System Usage Guide

This guide shows how to use the new multi-technique export system in your video recorder application.

## Quick Start

The multi-export system is ready to use! You can integrate it into your existing export handler or use it as a standalone function.

## Basic Integration

### Option 1: Replace Existing Export Handler

In `EditStep.tsx`, you can replace the existing `handleExport` function with the new multi-export system:

```typescript
import { exportWithMultiTechnique, downloadExportedVideo, getAvailableTechniques } from '../utils/multiExportIntegration'

const handleExport = async () => {
  if (sceneTakes.length === 0) {
    alert('No scenes with selected takes')
    return
  }

  setIsExporting(true)
  setExportProgress('Starting export...')
  setExportProgressPercent(0)

  try {
    // Convert EditStep data to export format
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
        technique: 'auto', // Try all techniques until one succeeds
        fps: 30,
        format: 'mp4',
        bitrate: 5_000_000,
        onProgress: (message, percent, technique, error) => {
          setExportProgress(message)
          setExportProgressPercent(percent)
          if (error) {
            console.error(`[${technique}] Error:`, error)
          }
        }
      }
    )

    // Download the exported video
    downloadExportedVideo(result.blob, 'export.mp4')
    
    setIsExporting(false)
    setExportProgress(`Export complete! (Used: ${result.technique})`)
    
    // Log export details
    console.log('Export logs:', result.log)
  } catch (error) {
    console.error('Export failed:', error)
    alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`)
    setIsExporting(false)
    setExportProgress('Export failed')
  }
}
```

### Option 2: Add as New Export Option

You can add the multi-export as an additional export option alongside the existing FFmpeg export:

```typescript
const handleMultiExport = async () => {
  // ... same as Option 1 ...
}

// In your export dialog UI:
<button onClick={handleExport}>Export (FFmpeg)</button>
<button onClick={handleMultiExport}>Export (Multi-Technique)</button>
```

## Selecting a Specific Technique

If you want to use a specific technique instead of automatic selection:

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

Available techniques:
- `'webcodecs-canvas'` - Best quality (Chrome/Edge only)
- `'ffmpeg-frames'` - Most compatible (all browsers)
- `'mediarecorder-canvas'` - Fast (modern browsers)
- `'canvas-capture-ffmpeg'` - Balanced performance
- `'canvas-capture-mediarecorder'` - Fastest (native encoding)
- `'auto'` - Try all until one succeeds (recommended)

## Checking Available Techniques

You can check which techniques are available in the current browser:

```typescript
import { getAvailableTechniques } from '../utils/multiExportIntegration'

const availableTechniques = getAvailableTechniques()
console.log('Available techniques:', availableTechniques)

// Example output: ['webcodecs-canvas', 'ffmpeg-frames', 'mediarecorder-canvas', ...]
```

## Error Handling and Logging

The export system provides comprehensive logging:

```typescript
const result = await exportWithMultiTechnique(...)

if (result.success) {
  // Success - logs are in result.log
  console.log('Export successful!')
  console.log('Used technique:', result.technique)
  console.log('Full logs:', result.log)
} else {
  // Failure - error message and logs available
  console.error('Export failed:', result.error)
  console.error('Logs:', result.log)
}
```

## Progress Tracking

The progress callback provides detailed information:

```typescript
onProgress: (message, percent, technique, error) => {
  // message: Current status message
  // percent: Progress percentage (0-100)
  // technique: Currently used technique
  // error: Optional error message
  
  console.log(`[${technique}] ${percent.toFixed(1)}%: ${message}`)
  
  // Update UI
  setExportProgress(message)
  setExportProgressPercent(percent)
  
  // Handle errors
  if (error) {
    console.error('Export error:', error)
    // Optionally show error to user
  }
}
```

## Export Options

All export options:

```typescript
{
  fps?: number                    // Frame rate (default: 30)
  bitrate?: number                // Video bitrate in bps (default: 5_000_000)
  format?: 'mp4' | 'webm'         // Output format (default: 'mp4')
  codec?: 'avc1' | 'vp8' | 'vp9'  // Video codec (default: 'avc1')
  technique?: ExportTechnique | 'auto'  // Export technique (default: 'auto')
  onProgress?: (message, percent, technique?, error?) => void  // Progress callback
}
```

## Performance Tips

1. **For best quality**: Use `'webcodecs-canvas'` (Chrome/Edge only)
2. **For maximum compatibility**: Use `'ffmpeg-frames'` (works everywhere)
3. **For speed**: Use `'canvas-capture-mediarecorder'` (fastest)
4. **For automatic selection**: Use `'auto'` (recommended default)

## Troubleshooting

### Export fails with "WebCodecs API not available"
- Use a Chromium-based browser (Chrome/Edge)
- Or use `'ffmpeg-frames'` technique instead

### Export is slow
- Try a faster technique like `'canvas-capture-mediarecorder'`
- Reduce resolution or frame rate
- Use lower bitrate

### Export quality is poor
- Use `'webcodecs-canvas'` technique (best quality)
- Increase bitrate
- Use higher resolution

### Audio is missing
- Audio support is planned for future updates
- Current implementation focuses on video export

## Next Steps

1. Integrate the multi-export system into your export handler
2. Test different techniques to find what works best
3. Adjust export settings (fps, bitrate) based on your needs
4. Monitor export logs for debugging

For more details, see `EXPORT_TECHNIQUES.md`.









