# Quick Start: What You Need to Do

## ✅ What's Already Done

All the core export pipeline code is ready:
- ✅ Shared renderer (`src/utils/renderer.ts`)
- ✅ WebCodecs encoder (`src/utils/webcodecsEncoder.ts`)
- ✅ Audio encoder (`src/utils/audioEncoder.ts`)
- ✅ Muxer (`src/utils/muxer.ts`)
- ✅ Asset preflight (`src/utils/assetPreflight.ts`)
- ✅ Export worker (`src/utils/exportWorker.ts`)
- ✅ High-level API (`src/utils/offlineExport.ts`)
- ✅ Integration helper (`src/utils/exportIntegration.ts`)

## 🔧 What You Need to Do (3 Steps)

### Step 1: Check Browser Support ⚠️ REQUIRED

The export **only works in Chromium browsers**:
- ✅ Chrome 94+ 
- ✅ Edge 94+
- ✅ Opera 80+
- ❌ Firefox (not supported)
- ❌ Safari (not supported)

**Quick test:** Open browser console and type:
```javascript
typeof VideoEncoder
```
Should return `"function"` if supported.

### Step 2: Integrate into EditStep (Choose One)

#### Option A: Add as New Export Button (Easiest)

Add this to your export dialog in `EditStep.tsx`:

```typescript
import { exportWithOfflinePipeline, isWebCodecsAvailable, downloadExportedVideo } from '../utils/exportIntegration'

// Add new export handler
const handleOfflineExport = async () => {
  if (!isWebCodecsAvailable()) {
    alert('Please use Chrome or Edge browser for this export method.')
    return
  }

  setIsExporting(true)
  setExportProgress('Starting export...')
  setExportProgressPercent(0)

  try {
    const blob = await exportWithOfflinePipeline(
      scenes,
      timelineClips,
      layoutClips,
      canvasSettings,
      layout,
      {
        style: selectedCaptionStyle !== 'none' 
          ? captionStyles.find(s => s.id === selectedCaptionStyle) 
          : undefined,
        font: captionFont,
        size: captionSize,
        lineHeight: captionLineHeight,
        maxWords: captionMaxWords,
        enabled: selectedCaptionStyle !== 'none',
      },
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
  } catch (error) {
    alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`)
    setIsExporting(false)
  }
}

// Add button in export dialog:
<button onClick={handleOfflineExport} disabled={!isWebCodecsAvailable()}>
  Export (Offline Pipeline)
</button>
```

#### Option B: Replace Existing Export

Replace the `handleExport` function with the offline pipeline (see `INTEGRATION_GUIDE.md` for details).

### Step 3: Install Optional Dependencies (Optional)

For better quality, install muxing libraries:

```bash
npm install mp4box
# or for WebM:
npm install webm-muxer
```

**Note:** Export works without these, but muxing quality may be lower.

## 🧪 Testing

1. Open app in **Chrome or Edge**
2. Create a simple project
3. Click the new export button
4. Verify exported video matches preview

## ❓ Common Issues

**"WebCodecs not available"**
→ Use Chrome/Edge browser

**"Export failed: Asset preflight failed"**
→ Check browser console for specific errors
→ Ensure all video files are accessible

**"Export is slow"**
→ Normal for first export (asset preloading)
→ Reduce resolution/FPS for testing

## 📚 More Details

See `INTEGRATION_GUIDE.md` for detailed integration examples and troubleshooting.

See `src/utils/EXPORT_README.md` for technical documentation.

