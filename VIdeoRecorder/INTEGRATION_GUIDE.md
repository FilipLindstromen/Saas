# Integration Guide: Offline Export Pipeline

## Quick Start Checklist

### ✅ Already Done
- [x] Core export pipeline modules created
- [x] Shared renderer implemented
- [x] WebCodecs encoder wrapper
- [x] Asset preflight system
- [x] Integration helper created

### 🔧 What You Need to Do

#### 1. **Check Browser Support** (Required)
The export pipeline requires WebCodecs API, which is only available in:
- Chrome 94+ ✅
- Edge 94+ ✅
- Opera 80+ ✅
- **NOT available in Firefox or Safari** ❌

**Test if WebCodecs is available:**
```javascript
if (typeof VideoEncoder === 'undefined') {
  console.error('WebCodecs not supported - use Chrome/Edge')
}
```

#### 2. **Integrate into EditStep** (Required)

You have two options:

##### Option A: Add as Alternative Export Method (Recommended)
Add a toggle or button to use the new export method:

```typescript
// In EditStep.tsx, add near the export dialog:
const [useOfflineExport, setUseOfflineExport] = useState(false)

// Add a checkbox in the export dialog:
<input
  type="checkbox"
  checked={useOfflineExport}
  onChange={(e) => setUseOfflineExport(e.target.checked)}
/>
<label>Use offline export (WebCodecs - faster, more accurate)</label>

// Modify handleExport to use offline export when enabled:
if (useOfflineExport && isWebCodecsAvailable()) {
  // Use new export pipeline
  await exportWithOfflinePipeline(...)
} else {
  // Use existing FFmpeg export
  // ... existing code ...
}
```

##### Option B: Replace Existing Export (More Work)
Replace the entire `handleExport` function with the new pipeline.

#### 3. **Install Optional Dependencies** (Optional but Recommended)

For better MP4 muxing quality, install mp4box.js:

```bash
npm install mp4box
```

For better WebM muxing:

```bash
npm install webm-muxer
```

**Note:** The export will work without these, but muxing quality may be lower.

#### 4. **Test the Integration**

1. Open your app in Chrome/Edge
2. Create a simple project with one scene
3. Try exporting with the new pipeline
4. Verify the exported video matches the preview

## Integration Example

Here's a minimal integration example:

```typescript
// In EditStep.tsx

import { exportWithOfflinePipeline, isWebCodecsAvailable, downloadExportedVideo } from '../utils/exportIntegration'

// Add this function alongside handleExport:
const handleOfflineExport = async () => {
  if (!isWebCodecsAvailable()) {
    alert('WebCodecs not available. Please use Chrome or Edge browser.')
    return
  }

  setIsExporting(true)
  setExportProgress('Starting offline export...')
  setExportProgressPercent(0)

  try {
    const blob = await exportWithOfflinePipeline(
      scenes,
      timelineClips,
      layoutClips,
      canvasSettings,
      layout,
      captionSettings ? {
        style: selectedCaptionStyle !== 'none' 
          ? captionStyles.find(s => s.id === selectedCaptionStyle) 
          : undefined,
        font: captionFont,
        size: captionSize,
        lineHeight: captionLineHeight,
        maxWords: captionMaxWords,
        enabled: selectedCaptionStyle !== 'none',
      } : undefined,
      titleSettings,
      backgroundImageData,
      transcripts,
      {
        fps: 30,
        bitrate: 5_000_000,
        format: exportFormat,
        codec: exportFormat === 'webm' ? 'vp9' : 'avc1',
        onProgress: (message, percent) => {
          setExportProgress(message)
          setExportProgressPercent(percent)
        }
      }
    )

    downloadExportedVideo(blob, `export_${Date.now()}.${exportFormat}`)
    
    setIsExporting(false)
    setExportProgress('Export complete!')
    setExportProgressPercent(100)
  } catch (error) {
    console.error('Export failed:', error)
    alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`)
    setIsExporting(false)
    setExportProgress('Export failed')
    setExportProgressPercent(0)
  }
}

// Then add a button in your export dialog:
<button onClick={handleOfflineExport}>
  Export with Offline Pipeline
</button>
```

## Troubleshooting

### "WebCodecs API is not available"
- **Solution:** Use Chrome 94+, Edge 94+, or Opera 80+
- **Check:** Open browser console and type `typeof VideoEncoder` - should return `"function"`

### "Asset preflight failed"
- **Check:** All video files are accessible
- **Check:** Fonts are loaded (check `document.fonts.ready`)
- **Check:** Browser console for specific error messages

### "Export is very slow"
- **Normal:** First export may be slower (asset preloading)
- **Optimize:** Reduce resolution or FPS for testing
- **Check:** CPU usage - encoding is CPU-intensive

### "Exported video doesn't match preview"
- **Check:** Canvas settings match between preview and export
- **Check:** DPR is set to 1.0 for export (should be automatic)
- **Check:** Fonts are the same in preview and export

## Next Steps

1. ✅ Test in Chrome/Edge browser
2. ✅ Add integration code to EditStep
3. ✅ Test with a simple project
4. ✅ Compare exported video with preview
5. ✅ Install optional dependencies if needed

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify WebCodecs is available: `typeof VideoEncoder !== 'undefined'`
3. Check that all assets (videos, fonts) are accessible
4. Review the export progress messages









