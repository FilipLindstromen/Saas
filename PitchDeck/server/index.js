/**
 * Server-side FFmpeg API for faster audio extraction and video export.
 * Requires FFmpeg installed on the system (e.g. apt install ffmpeg / brew install ffmpeg).
 *
 * Usage: npm start (or npm run dev)
 * Set VITE_FFMPEG_API_URL=http://localhost:3030 in the frontend .env to use this server.
 */

import express from 'express'
import multer from 'multer'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3030

const uploadDir = path.join(__dirname, 'tmp')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}${path.extname(file.originalname) || ''}`)
})
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }) // 500 MB max

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

function toAssTime(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(Math.floor(s)).padStart(2, '0')}.${String(Math.round((s % 1) * 100)).padStart(2, '0')}`
}

function getAssStyleAndHeader(style) {
  const alignmentNum = style === 'top-black' ? 8 : 2
  let primaryColour = '&H00FFFFFF'
  let backColour = '&H80000000'
  let outlineColour = '&H00000000'
  if (style === 'bottom-white') {
    primaryColour = '&H00000000'
    backColour = '&H80FFFFFF'
  } else if (style === 'white-outline') {
    backColour = '&H00000000'
  }
  const marginV = 30
  const styleLine = `Style: Default,Arial,28,${primaryColour},&H000000FF,${outlineColour},${backColour},-1,0,0,0,100,100,0,0,1,2,1,${alignmentNum},10,10,${marginV},1`
  return `[Script Info]
Title: Burned captions
ScriptType: v4.00+
PlayResX: 384
PlayResY: 288
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styleLine}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
}

function buildAssFromSegments(segments, style) {
  if (!Array.isArray(segments) || segments.length === 0) return ''
  const header = getAssStyleAndHeader(style || 'bottom-black')
  let outTime = 0
  const lines = segments.map((seg) => {
    const duration = Math.max(0.01, (seg.end || 0) - (seg.start || 0))
    const start = outTime
    const end = outTime + duration
    outTime = end
    const text = (seg.text || '').replace(/\r/g, '').replace(/\n/g, '\\N').trim()
    if (!text) return null
    return `Dialogue: 0,${toAssTime(start)},${toAssTime(end)},Default,,0,0,0,,${text}`
  }).filter(Boolean)
  return lines.length ? header + lines.join('\n') : ''
}

function runFfmpeg(args, cwd = uploadDir) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('error', (err) => reject(err))
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`))
    })
  })
}

function inputExt(type) {
  if (!type) return 'webm'
  const t = type.toLowerCase()
  if (t.includes('mp4')) return 'mp4'
  if (t.includes('ogg')) return 'ogg'
  return 'webm'
}

const WHISPER_MAX = 25 * 1024 * 1024

/** POST /api/extract-audio — extract/compress audio for Whisper (under 25 MB) */
app.post('/api/extract-audio', upload.single('video'), async (req, res) => {
  const file = req.file
  if (!file) {
    res.status(400).json({ error: 'Missing video file' })
    return
  }
  const ext = inputExt(file.mimetype)
  const inputPath = file.path
  const baseName = path.basename(inputPath, path.extname(inputPath))
  const fastOut = path.join(uploadDir, `${baseName}_audio.${ext === 'mp4' ? 'm4a' : 'webm'}`)
  const mp3Out = path.join(uploadDir, `${baseName}_audio.mp3`)

  try {
    try {
      await runFfmpeg(['-i', inputPath, '-vn', '-c:a', 'copy', '-y', fastOut])
      const stat = fs.statSync(fastOut)
      if (stat.size > 0 && stat.size <= WHISPER_MAX) {
        res.setHeader('Content-Type', ext === 'mp4' ? 'audio/mp4' : 'audio/webm')
        res.sendFile(fastOut, () => fs.unlink(fastOut, () => {}))
        return
      }
      fs.unlinkSync(fastOut)
    } catch (_) {}

    await runFfmpeg(['-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', '-y', mp3Out])
    res.setHeader('Content-Type', 'audio/mpeg')
    res.sendFile(mp3Out, () => fs.unlink(mp3Out, () => {}))
  } catch (e) {
    res.status(500).json({ error: e.message || 'FFmpeg failed' })
  } finally {
    try { fs.unlinkSync(inputPath) } catch (_) {}
  }
})

/** POST /api/export-video — trim by segments, optional burn captions. Form: video (file), segments (JSON string), captions (JSON string, optional) */
app.post('/api/export-video', upload.single('video'), async (req, res) => {
  const file = req.file
  if (!file) {
    res.status(400).json({ error: 'Missing video file' })
    return
  }
  let segments = []
  let captions = null
  const format = (req.body?.format === 'webm' ? 'webm' : 'mp4').toLowerCase()
  const quality = (req.body?.quality || 'high').toLowerCase() // high | medium | low
  const resolution = (req.body?.resolution || 'original').toLowerCase() // 1080 | 720 | 480 | original
  try {
    if (req.body?.segments) segments = JSON.parse(req.body.segments)
    if (req.body?.captions) captions = JSON.parse(req.body.captions)
  } catch (_) {}
  if (!Array.isArray(segments)) segments = []

  if (segments.length === 0) {
    try { fs.unlinkSync(file.path) } catch (_) {}
    res.status(400).json({ error: 'Missing or empty segments' })
    return
  }

  const ext = file.path.toLowerCase().endsWith('.mp4') ? 'mp4' : 'webm'
  const inputPath = file.path
  const baseName = path.basename(inputPath, path.extname(inputPath))
  const workDir = path.join(uploadDir, baseName)
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true })
  const inputInWork = path.join(workDir, `input.${ext}`)
  fs.renameSync(inputPath, inputInWork)
  const inputName = `input.${ext}`
  const segFiles = []
  try {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const start = Math.max(0, seg.start)
      const duration = Math.max(0.01, seg.end - seg.start)
      const segName = `seg${i}.${ext}`
      segFiles.push(path.join(workDir, segName))
      await runFfmpeg(['-ss', String(start), '-i', inputName, '-t', String(duration), '-c', 'copy', '-avoid_negative_ts', '1', '-y', segName], workDir)
    }

    const listPath = path.join(workDir, 'list.txt')
    fs.writeFileSync(listPath, segFiles.map((f) => `file '${path.basename(f)}'`).join('\n'))
    const concatName = `concat.${ext}`
    await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-y', concatName], workDir)

    const captionSegments = Array.isArray(captions?.segments) && captions.segments.length > 0
    let assPath = null
    if (captionSegments) {
      const assContent = buildAssFromSegments(captions.segments, captions.style || 'bottom-black')
      if (assContent) {
        fs.writeFileSync(path.join(workDir, 'captions.ass'), assContent, 'utf8')
        assPath = path.join(workDir, 'captions.ass')
      }
    }

    const outExt = format
    const outName = `output.${outExt}`
    const crfH264 = { high: 18, medium: 23, low: 28 }[quality] || 18
    const crfVp9 = { high: 30, medium: 35, low: 40 }[quality] || 30
    const scaleFilter = resolution === 'original' ? null : (resolution === '1080' ? '-2:1080' : resolution === '720' ? '-2:720' : '-2:480')
    const vfParts = []
    if (scaleFilter) vfParts.push(`scale=${scaleFilter}`)
    if (assPath) vfParts.push(`subtitles=captions.ass`)
    const vfStr = vfParts.length > 0 ? vfParts.join(',') : null

    if (format === 'mp4') {
      const args = ['-i', concatName, ...(vfStr ? ['-vf', vfStr] : []), '-c:v', 'libx264', '-crf', String(crfH264), '-preset', 'medium', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-y', outName]
      await runFfmpeg(args, workDir)
    } else {
      const args = ['-i', concatName, ...(vfStr ? ['-vf', vfStr] : []), '-c:v', 'libvpx-vp9', '-crf', String(crfVp9), '-b:v', '0', '-c:a', 'libopus', '-b:a', '128k', '-y', outName]
      await runFfmpeg(args, workDir)
    }

    const finalPath = path.join(workDir, outName)
    res.setHeader('Content-Type', format === 'mp4' ? 'video/mp4' : 'video/webm')
    res.sendFile(finalPath, () => {
      try {
        fs.readdirSync(workDir).forEach((f) => fs.unlinkSync(path.join(workDir, f)))
        fs.rmdirSync(workDir)
      } catch (_) {}
    })
  } catch (e) {
    try {
      if (fs.existsSync(workDir)) {
        fs.readdirSync(workDir).forEach((f) => fs.unlinkSync(path.join(workDir, f)))
        fs.rmdirSync(workDir)
      }
    } catch (_) {}
    res.status(500).json({ error: e.message || 'FFmpeg failed' })
  }
})

app.use((req, res) => res.status(404).json({ error: 'Not found' }))

app.listen(PORT, () => {
  console.log(`FFmpeg API server running at http://localhost:${PORT}`)
  console.log('  POST /api/extract-audio  — video file → audio for Whisper')
  console.log('  POST /api/export-video   — video + segments (+ captions) → trimmed video')
})
