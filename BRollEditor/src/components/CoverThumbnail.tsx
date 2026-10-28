import { useCallback, useRef, useState } from 'react'
import { ASPECT_RATIO_SIZES } from '../types'
import type { AspectRatio } from '../types'
import './CoverThumbnail.css'

type Props = {
  videoUrl: string
  aspectRatio: AspectRatio
  defaultTitle: string
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, bottomY: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  const shown = lines.slice(0, maxLines)
  const startY = bottomY - (shown.length - 1) * lineHeight
  shown.forEach((line, i) => ctx.fillText(line, x, startY + i * lineHeight))
}

// Composes a cover frame client-side, straight from the exported MP4 — no separate render job
// needed. Just a frame grab + a bold bottom-scrim title, which covers the common "thumbnail with
// text overlay" case without pulling in a whole design tool.
export default function CoverThumbnail({ videoUrl, aspectRatio, defaultTitle }: Props) {
  const [title, setTitle] = useState(defaultTitle)
  const [framePct, setFramePct] = useState(35)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)

  const generate = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    setError('')
    setGenerating(true)
    try {
      if (video.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => { video.removeEventListener('loadedmetadata', onLoaded); resolve() }
          video.addEventListener('loadedmetadata', onLoaded)
          video.addEventListener('error', () => reject(new Error('Could not load the exported video.')), { once: true })
        })
      }
      await new Promise<void>((resolve) => {
        const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
        video.addEventListener('seeked', onSeeked)
        video.currentTime = Math.max(0, (video.duration || 1) * (framePct / 100))
      })

      const { width, height } = ASPECT_RATIO_SIZES[aspectRatio]
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas unsupported')
      ctx.drawImage(video, 0, 0, width, height)

      if (title.trim()) {
        const grad = ctx.createLinearGradient(0, height * 0.5, 0, height)
        grad.addColorStop(0, 'rgba(0,0,0,0)')
        grad.addColorStop(1, 'rgba(0,0,0,0.78)')
        ctx.fillStyle = grad
        ctx.fillRect(0, height * 0.5, width, height * 0.5)

        ctx.fillStyle = '#fff'
        ctx.textBaseline = 'alphabetic'
        const fontSize = Math.round(width * 0.065)
        ctx.font = `800 ${fontSize}px Arial, Helvetica, sans-serif`
        wrapText(ctx, title.trim().toUpperCase(), width * 0.06, height - height * 0.08, width * 0.88, fontSize * 1.15, 3)
      }

      setDataUrl(canvas.toDataURL('image/png'))
    } catch (err: any) {
      setError(err?.message || 'Could not generate a thumbnail.')
    } finally {
      setGenerating(false)
    }
  }, [aspectRatio, framePct, title])

  return (
    <div className="cover-thumbnail">
      <video ref={videoRef} src={videoUrl} muted playsInline preload="metadata" style={{ display: 'none' }} />
      <div className="cover-thumbnail__controls">
        <label className="cover-thumbnail__field">
          Title on thumbnail
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional bold title text" />
        </label>
        <label className="cover-thumbnail__field">
          Frame ({framePct}% into the video)
          <input type="range" min={0} max={100} value={framePct} onChange={(e) => setFramePct(Number(e.target.value))} />
        </label>
        <button type="button" className="cover-thumbnail__generate-btn" onClick={generate} disabled={generating}>
          {generating ? 'Generating…' : dataUrl ? 'Regenerate thumbnail' : 'Generate thumbnail'}
        </button>
        {error && <p className="cover-thumbnail__error">{error}</p>}
      </div>

      {dataUrl && (
        <div className="cover-thumbnail__preview">
          <img src={dataUrl} alt="Cover thumbnail preview" />
          <a className="cover-thumbnail__download" href={dataUrl} download="thumbnail.png">Download PNG</a>
        </div>
      )}
    </div>
  )
}
