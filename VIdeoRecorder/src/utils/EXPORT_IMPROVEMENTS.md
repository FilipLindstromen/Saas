# Canvas Export Improvements

## Issues Fixed

### 1. Flickering/Black Frames
**Problem:** Exported video showed flickering between frames and black backgrounds.

**Solution:**
- Draw background first before any video frames
- Improved video synchronization with double `requestAnimationFrame` for frame readiness
- Better handling of video `seeked` and `loadeddata` events
- Reduced seek threshold from 0.1s to 0.05s for more accurate timing

### 2. Low Frame Rate
**Problem:** Exported video had lower frame rate than expected.

**Solution:**
- Switched from `setTimeout` to `requestAnimationFrame` for consistent timing
- Continuous render loop instead of discrete frame rendering
- Proper frame throttling to match desired FPS
- Increased default bitrate from 5Mbps to 8Mbps for better quality

## Improved Export Utility

The new `improvedCanvasExport.ts` provides:
- **Continuous rendering loop** using `requestAnimationFrame`
- **Better video synchronization** with proper event handling
- **Frame-ready detection** using double RAF
- **Optimized canvas settings** (alpha disabled for performance)
- **Better progress tracking** with more frequent updates

## Browser Extension Option

If you still experience issues, you can use a browser extension:

### Canvas Capture (Chrome Extension)
- **Link:** [Chrome Web Store - Canvas Capture](https://chromewebstore.google.com/detail/canvas-capture/pnhaaddlgbpchligciolcdjgndcpelee)
- **How to use:**
  1. Install the extension
  2. Open your preview in the browser
  3. Click the extension icon
  4. Select the canvas element
  5. Click "Record" to capture
  6. The extension will export a WebM file

**Pros:**
- Captures exactly what's on screen
- No code changes needed
- Works with any canvas element

**Cons:**
- Manual process (not automated)
- Frame rate depends on browser/system performance
- May still have flickering if video elements aren't ready

## Usage

The improved export is automatically used if supported. The code checks for:
- `canvas.captureStream` API
- `MediaRecorder` API
- `requestAnimationFrame` API

If all are available, it uses the improved version automatically.

## Technical Details

### Video Synchronization Improvements

**Before:**
```typescript
videoElement.currentTime = sourceTime
await new Promise(resolve => {
  videoElement.addEventListener('seeked', resolve, { once: true })
  setTimeout(resolve, 200)
})
```

**After:**
```typescript
videoElement.currentTime = sourceTime
await new Promise<void>(resolve => {
  let resolved = false
  const onSeeked = () => {
    if (!resolved) {
      resolved = true
      videoElement.removeEventListener('seeked', onSeeked)
      videoElement.removeEventListener('loadeddata', onLoaded)
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve) // Double RAF for frame readiness
      })
    }
  }
  const onLoaded = () => {
    if (!resolved && Math.abs(videoElement.currentTime - sourceTime) < 0.1) {
      resolved = true
      // ... same cleanup and double RAF
    }
  }
  videoElement.addEventListener('seeked', onSeeked, { once: true })
  videoElement.addEventListener('loadeddata', onLoaded, { once: true })
  setTimeout(() => {
    if (!resolved) {
      resolved = true
      // ... cleanup and resolve
    }
  }, 300)
})
```

### Frame Rendering Improvements

**Before:**
- Used `setTimeout` with fixed intervals
- Could miss frames or render at wrong times
- No proper frame throttling

**After:**
- Uses `requestAnimationFrame` for browser-optimized timing
- Proper frame throttling to match desired FPS
- Continuous loop ensures no frames are missed

## Performance Tips

1. **Keep the browser tab active** - Inactive tabs are throttled
2. **Close other tabs** - Reduces system load
3. **Use lower resolution** for testing - Faster exports
4. **Reduce FPS** if needed - 24fps is often sufficient
5. **Ensure videos are preloaded** - Faster seeking

## Troubleshooting

### Still seeing flickering?
1. Check that videos are fully loaded before export
2. Try reducing the export FPS (e.g., 24 instead of 30)
3. Ensure the browser tab stays active during export
4. Try the Canvas Capture browser extension

### Still low frame rate?
1. Check system performance (CPU usage)
2. Reduce export resolution
3. Close other applications
4. Try exporting shorter clips first

### Export fails?
1. Check browser console for errors
2. Ensure you're using Chrome, Edge, or Firefox
3. Check that videos are accessible
4. Try refreshing the page
