import { useCallback, useEffect, useRef, useState } from 'react'
import CoverThumbnail from '../components/CoverThumbnail'
import type { AspectRatio, Project, Quality, RenderJob } from '../types'
import './ExportTab.css'

type Props = {
  project: Project
  onProjectChange: (updater: (p: Project) => Project) => void
}

const ASPECT_OPTIONS: { value: AspectRatio; label: string }[] = [
  { value: '16:9', label: '1920×1080 (landscape)' },
  { value: '1:1', label: '1080×1080 (square)' },
  { value: '9:16', label: '1080×1920 (vertical)' },
]

const QUALITY_OPTIONS: { value: Quality; label: string }[] = [
  { value: 'high', label: 'High (best quality, slowest)' },
  { value: 'standard', label: 'Standard' },
  { value: 'draft', label: 'Draft (fast preview render)' },
]

export default function ExportTab({ project, onProjectChange }: Props) {
  const [job, setJob] = useState<RenderJob | null>(null)
  const pollRef = useRef<number | null>(null)

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current) }, [])

  const poll = useCallback((jobId: string) => {
    pollRef.current = window.setInterval(async () => {
      const res = await fetch(`/api/render?jobId=${jobId}`)
      if (!res.ok) return
      const data = (await res.json()) as RenderJob
      setJob(data)
      if (data.status === 'done' || data.status === 'error') {
        if (pollRef.current) window.clearInterval(pollRef.current)
      }
    }, 1500)
  }, [])

  const startRender = useCallback(async () => {
    setJob({ status: 'queued', progress: 0 })
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    })
    if (!res.ok) {
      setJob({ status: 'error', progress: 0, error: `Render request failed: ${res.status}` })
      return
    }
    const { jobId } = (await res.json()) as { jobId: string }
    poll(jobId)
  }, [project, poll])

  const linesWithBroll = project.lines.filter((l) => l.broll || l.text.trim()).length
  const canRender = !!project.audioUrl && project.lines.some((l) => l.broll)
  const isRendering = job?.status === 'queued' || job?.status === 'rendering'

  if (!project.audioUrl) {
    return (
      <div className="export-tab export-tab--empty">
        <p>Record or import a narration clip, then add b-roll before exporting.</p>
      </div>
    )
  }

  return (
    <div className="export-tab">
      <div className="export-tab__card">
        <h2>Aspect ratio</h2>
        <div className="export-tab__options">
          {ASPECT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`export-tab__option ${project.aspectRatio === opt.value ? 'active' : ''}`}
              onClick={() => onProjectChange((p) => ({ ...p, aspectRatio: opt.value }))}
              disabled={isRendering}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="export-tab__card">
        <h2>Quality</h2>
        <div className="export-tab__options">
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`export-tab__option ${project.quality === opt.value ? 'active' : ''}`}
              onClick={() => onProjectChange((p) => ({ ...p, quality: opt.value }))}
              disabled={isRendering}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="export-tab__card">
        <h2>Export</h2>
        {!canRender && <p className="export-tab__hint">Add at least one b-roll clip on the Edit tab before exporting. ({linesWithBroll} line(s) with text)</p>}
        <button type="button" className="export-tab__render-btn" onClick={startRender} disabled={!canRender || isRendering}>
          {isRendering ? `Rendering… ${Math.round((job?.progress || 0) * 100)}%` : 'Export MP4'}
        </button>

        {job?.status === 'error' && <p className="export-tab__error">{job.error || 'Render failed.'}</p>}

        {job?.status === 'done' && job.url && (
          <a className="export-tab__download" href={job.url} download>
            Download MP4
          </a>
        )}
      </div>

      {job?.status === 'done' && job.url && (
        <div className="export-tab__card">
          <h2>Cover thumbnail</h2>
          <CoverThumbnail
            videoUrl={job.url}
            aspectRatio={project.aspectRatio}
            defaultTitle={project.lines.find((l) => l.text.trim())?.text.slice(0, 40) || ''}
          />
        </div>
      )}
    </div>
  )
}
