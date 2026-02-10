# Canvas Export Guide

This guide explains how to export the preview canvas exactly as it appears in the preview.

## Overview

The canvas export utilities provide two methods to capture the preview:

1. **`canvasCaptureExport.ts`** - Direct canvas capture using `canvas.captureStream()`
2. **`previewCanvasExport.ts`** - Frame-by-frame rendering with full control

## Quick Start

### Method 1: Direct Canvas Capture (Simplest)

If you have a canvas element that already displays the preview, you can capture it directly:

```typescript
import { captureCanvasAsVideo } from '../utils/canvasCaptureExport'

const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement
const duration = 10 // seconds

const result = await captureCanvasAsVideo(canvas, duration, {
  fps: 30,
  bitrate: 5_000_000,
  format: 'webm',
  onProgress: (message, percent) => {
    console.log(`${percent}%: ${message}`)
  }
})

if (result.success && result.blob) {
  // Download the video
  const url = URL.createObjectURL(result.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'export.webm'
  a.click()
  URL.revokeObjectURL(url)
} else {
  console.error('Export failed:', result.error)
}
```

### Method 2: Frame-by-Frame Rendering (Most Control)

For more control over what gets rendered, use the frame renderer approach:

```typescript
import { exportPreviewCanvas } from '../utils/previewCanvasExport'

const duration = 10 // seconds

const result = await exportPreviewCanvas(
  async (canvas, ctx, time) => {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Draw video frames at current time
    // ... your rendering logic here ...
    
    // Draw captions, titles, overlays, etc.
    // ... your overlay rendering logic ...
  },
  duration,
  {
    fps: 30,
    width: 1920,
    height: 1080,
    format: 'webm',
    onProgress: (message, percent) => {
      console.log(`${percent}%: ${message}`)
    }
  }
)

if (result.success && result.blob) {
  // Download the video
  const url = URL.createObjectURL(result.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'export.webm'
  a.click()
  URL.revokeObjectURL(url)
}
```

## Integration with EditStep

To integrate with your `EditStep` component, you'll need to:

1. Create a composite canvas that renders all preview elements
2. Use the frame renderer to draw each frame
3. Capture the canvas

### Example Integration

```typescript
// In EditStep.tsx

import { exportPreviewCanvas } from '../utils/previewCanvasExport'

const handleExportCanvas = async () => {
  if (sceneTakes.length === 0) {
    alert('No scenes to export')
    return
  }

  const duration = totalDuration
  const { width, height } = canvasDimensions

  setIsExporting(true)
  setExportProgress('Preparing export...')
  setExportProgressPercent(0)

  try {
    const result = await exportPreviewCanvas(
      async (canvas, ctx, time) => {
        // Set current time (this will trigger re-renders)
        setCurrentTime(time)
        
        // Wait for frame to render
        await new Promise(resolve => requestAnimationFrame(resolve))
        await new Promise(resolve => setTimeout(resolve, 16)) // Wait for video frames
        
        // Get the preview container
        const container = document.querySelector('[data-canvas-container]') as HTMLElement
        if (!container) return
        
        // Create a temporary canvas to capture the container
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = width
        tempCanvas.height = height
        const tempCtx = tempCanvas.getContext('2d')
        if (!tempCtx) return
        
        // Use html2canvas or similar to capture the container
        // Or manually render all elements to the canvas
        
        // For now, we'll use a simpler approach:
        // Render the LUT canvas (which has overlays)
        const lutCanvas = lutCanvasRef.current
        if (lutCanvas) {
          ctx.drawImage(lutCanvas, 0, 0, width, height)
        }
        
        // Draw video holders
        // ... render video elements at their positions ...
      },
      duration,
      {
        fps: 30,
        width,
        height,
        format: 'webm',
        onProgress: (message, percent) => {
          setExportProgress(message)
          setExportProgressPercent(percent)
        }
      }
    )

    if (result.success && result.blob) {
      // Download
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
      
      setExportProgress('Export complete!')
    } else {
      throw new Error(result.error || 'Export failed')
    }
  } catch (error) {
    console.error('Export error:', error)
    alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`)
    setExportProgress('Export failed')
  } finally {
    setIsExporting(false)
  }
}
```

## Browser Support

### Canvas Capture Stream
- ✅ Chrome 51+
- ✅ Edge 79+
- ✅ Firefox 15+
- ❌ Safari (not supported)

### MediaRecorder
- ✅ Chrome 47+
- ✅ Edge 79+
- ✅ Firefox 25+
- ✅ Safari 14.1+

### WebCodecs (for advanced encoding)
- ✅ Chrome 94+
- ✅ Edge 94+
- ❌ Firefox (not yet supported)
- ❌ Safari (not yet supported)

## Tips

1. **For best quality**: Use higher bitrate (8-10 Mbps) and higher resolution
2. **For faster export**: Use lower FPS (24-25) and lower bitrate
3. **For compatibility**: Use WebM format (MP4 requires conversion)
4. **For exact preview match**: Ensure canvas dimensions match preview dimensions

## Troubleshooting

### "Canvas captureStream API is not supported"
- Use Chrome, Edge, or Firefox
- Safari doesn't support this API yet

### "Failed to get video track"
- Ensure the canvas has valid dimensions (width > 0, height > 0)
- Check that the canvas is visible (not display: none)

### Export is slow
- Reduce FPS (e.g., 24 instead of 30)
- Reduce resolution
- Reduce bitrate

### Export quality is poor
- Increase bitrate
- Use higher resolution
- Ensure source videos are high quality

## Advanced: Using html2canvas for Container Capture

If you want to capture the entire preview container (including CSS styling), you can use `html2canvas`:

```typescript
import html2canvas from 'html2canvas'

const result = await exportPreviewCanvas(
  async (canvas, ctx, time) => {
    // Set current time
    setCurrentTime(time)
    await new Promise(resolve => requestAnimationFrame(resolve))
    
    // Capture the container
    const container = document.querySelector('[data-canvas-container]') as HTMLElement
    if (container) {
      const tempCanvas = await html2canvas(container, {
        width: canvas.width,
        height: canvas.height,
        scale: 1,
        useCORS: true,
        allowTaint: false,
      })
      
      ctx.drawImage(tempCanvas, 0, 0)
    }
  },
  duration,
  options
)
```

Note: You'll need to install `html2canvas`: `npm install html2canvas`
