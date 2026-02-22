# DOM Element Video Recorder

A complete implementation for recording specific DOM elements as MP4 videos using the MediaRecorder API and ffmpeg.wasm.

## Features

- ✅ **Cross-browser support** (Chrome, Edge, Firefox)
- ✅ **High-quality MP4 output** using ffmpeg.wasm
- ✅ **Real-time progress tracking**
- ✅ **Customizable recording settings** (frame rate, bitrate, duration)
- ✅ **Production-ready** with proper error handling and cleanup
- ✅ **WebM fallback** for browsers without MP4 support
- ✅ **Memory efficient** with proper resource cleanup

## Installation

### 1. Install Dependencies

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util html2canvas
```

### 2. Configure Vite (for ffmpeg.wasm)

Update your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
```

### 3. Restart Development Server

```bash
npm run dev
```

**Important**: Open the exact URL shown in the terminal (usually `http://localhost:5173`) to ensure COOP/COEP headers are applied.

## Usage

### Basic Example

```typescript
import { DOMRecorder, downloadBlob, formatFileSize } from './utils/domRecorder'

// Create recorder instance
const recorder = new DOMRecorder()

// Start recording
await recorder.startRecording({
  elementId: 'my-element',        // ID of element to record
  duration: 10000,               // Duration in milliseconds
  frameRate: 30,                 // Frames per second
  bitrate: 2500000,              // Video bitrate
  format: 'mp4',                 // Output format
  onProgress: (progress) => {    // Progress callback (0-100)
    console.log(`Recording: ${progress}%`)
  },
  onStatus: (status) => {        // Status updates
    console.log(status)
  },
  onError: (error) => {          // Error handling
    console.error('Recording failed:', error)
  }
})

// Stop recording and get result
const result = await recorder.stopRecording()

// Download the video
downloadBlob(result.blob, 'my-recording.mp4')
console.log(`File size: ${formatFileSize(result.size)}`)
```

### Advanced Example with React

```tsx
import React, { useState, useRef } from 'react'
import { DOMRecorder, downloadBlob, formatFileSize } from './utils/domRecorder'

function VideoRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const recorderRef = useRef<DOMRecorder | null>(null)

  const startRecording = async () => {
    try {
      setIsRecording(true)
      setProgress(0)
      setStatus('Initializing...')
      
      const recorder = new DOMRecorder()
      recorderRef.current = recorder
      
      await recorder.startRecording({
        elementId: 'preview-window',
        duration: 15000,
        frameRate: 30,
        bitrate: 2500000,
        format: 'mp4',
        onProgress: setProgress,
        onStatus: setStatus,
        onError: (error) => {
          setStatus(`Error: ${error.message}`)
          setIsRecording(false)
        }
      })
      
    } catch (error) {
      setStatus(`Failed: ${error}`)
      setIsRecording(false)
    }
  }

  const stopRecording = async () => {
    if (!recorderRef.current) return
    
    try {
      const result = await recorderRef.current.stopRecording()
      downloadBlob(result.blob, `recording-${Date.now()}.mp4`)
      setStatus(`Complete! Size: ${formatFileSize(result.size)}`)
    } catch (error) {
      setStatus(`Error: ${error}`)
    } finally {
      setIsRecording(false)
      recorderRef.current = null
    }
  }

  return (
    <div>
      <div id="preview-window" style={{ width: 400, height: 300, background: '#000' }}>
        {/* Your content here */}
      </div>
      
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
      
      {isRecording && (
        <div>
          <div>{status}</div>
          <div style={{ width: '100%', background: '#333', height: 8 }}>
            <div 
              style={{ 
                width: `${progress}%`, 
                background: '#007bff', 
                height: '100%',
                transition: 'width 0.3s'
              }} 
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

## API Reference

### DOMRecorder Class

#### Methods

##### `initialize(): Promise<void>`
Initialize ffmpeg.wasm. Called automatically on first recording.

##### `startRecording(options: RecordingOptions): Promise<void>`
Start recording a DOM element.

**Parameters:**
- `elementId: string` - ID of the element to record
- `duration: number` - Recording duration in milliseconds
- `frameRate?: number` - Frame rate (default: 30)
- `bitrate?: number` - Video bitrate (default: 2500000)
- `format?: 'mp4' | 'webm'` - Output format (default: 'mp4')
- `onProgress?: (progress: number) => void` - Progress callback (0-100)
- `onStatus?: (status: string) => void` - Status updates
- `onError?: (error: Error) => void` - Error handling

##### `stopRecording(): Promise<RecordingResult>`
Stop recording and return the result.

**Returns:**
```typescript
{
  blob: Blob,           // Video blob
  url: string,          // Object URL
  size: number,         // File size in bytes
  duration: number,     // Duration in milliseconds
  format: string        // Output format
}
```

#### Static Methods

##### `isSupported(): boolean`
Check if recording is supported in the current browser.

##### `getSupportedMimeTypes(): string[]`
Get list of supported MIME types for recording.

### Utility Functions

##### `downloadBlob(blob: Blob, filename: string): void`
Download a blob as a file.

##### `formatFileSize(bytes: number): string`
Format file size in human-readable format.

## Browser Support

| Browser | Recording | MP4 Output | Notes |
|---------|-----------|------------|-------|
| Chrome  | ✅ | ✅ | Full support |
| Edge    | ✅ | ✅ | Full support |
| Firefox | ✅ | ✅ | Full support |
| Safari  | ⚠️ | ❌ | Limited MediaRecorder support |

## Troubleshooting

### 1. "Recording not supported" Error

**Cause**: Browser doesn't support MediaRecorder API or canvas capture.

**Solution**: Use a modern browser (Chrome, Edge, Firefox).

### 2. "Not crossOriginIsolated" Error

**Cause**: ffmpeg.wasm requires COOP/COEP headers.

**Solution**: 
1. Ensure your `vite.config.ts` has the correct headers
2. Restart the dev server
3. Open the exact URL from the terminal

### 3. "Failed to convert to MP4" Error

**Cause**: ffmpeg.wasm failed to process the video.

**Solution**: The recorder will automatically fallback to WebM format.

### 4. Poor Video Quality

**Solution**: Increase bitrate and frame rate:

```typescript
await recorder.startRecording({
  elementId: 'my-element',
  duration: 10000,
  frameRate: 60,        // Higher frame rate
  bitrate: 5000000,     // Higher bitrate
  format: 'mp4'
})
```

### 5. Memory Issues with Long Recordings

**Solution**: 
- Reduce frame rate
- Use lower bitrate
- Ensure proper cleanup by calling `stopRecording()`

## Performance Tips

1. **Optimize frame rate**: Use 30fps for most cases, 60fps only when needed
2. **Adjust bitrate**: Higher bitrate = better quality but larger files
3. **Element size**: Smaller elements record faster
4. **Cleanup**: Always call `stopRecording()` to free resources

## Example Files

- `dom-recorder-example.html` - Standalone HTML example
- `src/utils/domRecorder.ts` - Complete TypeScript implementation
- `src/ui/App.tsx` - React integration example

## License

MIT License - feel free to use in your projects!

