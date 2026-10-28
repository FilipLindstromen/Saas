import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import express from 'express'
import multer from 'multer'
import dotenv from 'dotenv'
import { renderProject, RENDER_DIR } from './render.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const REPO_ROOT = path.join(ROOT, '..')
const UPLOAD_DIR = path.join(__dirname, 'uploads')
const DIST_DIR = path.join(ROOT, 'dist')

// Same root .env every other Saas app reads its API keys from (see ../ENV-ROOT.md).
dotenv.config({ path: path.join(REPO_ROOT, '.env') })
dotenv.config({ path: path.join(REPO_ROOT, '.env.local') })

fs.mkdirSync(UPLOAD_DIR, { recursive: true })
fs.mkdirSync(RENDER_DIR, { recursive: true })

const PORT = Number(process.env.BROLL_API_PORT) || 3230

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use('/uploads', express.static(UPLOAD_DIR))
app.use('/renders', express.static(RENDER_DIR))

const upload = multer({ storage: multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm'
    cb(null, `${randomUUID()}${ext}`)
  },
}) })

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Exposes the root .env's API keys to the client on localhost, the same keys every other Saas
// app reads (see ../ENV-ROOT.md) — delivered this way instead of Vite's import.meta.env define
// mechanism, which shared/apiKeys.js's `const e = import.meta.env; e.VITE_X` access pattern
// doesn't actually pick up (Vite only statically replaces literal import.meta.env.X call sites).
app.get('/api/keys', (_req, res) => {
  const keys = {
    openai: process.env.OPENAI_API_KEY || '',
    pexels: process.env.PEXELS_API_KEY || '',
    pixabay: process.env.PIXABAY_API_KEY || '',
    unsplash: process.env.UNSPLASH_ACCESS_KEY || '',
  }
  res.json(keys)
})

app.post('/api/upload', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'missing audio file' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

const uploadBroll = multer({
  storage: upload.storage,
  limits: { fileSize: 300 * 1024 * 1024 }, // 300MB — b-roll can be a real video file, not just a short recording
})

app.post('/api/upload-broll', uploadBroll.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'missing file' })
  res.json({ url: `/uploads/${req.file.filename}` })
})

/** @type {Map<string, {status: string, progress: number, url?: string, error?: string}>} */
const jobs = new Map()

app.post('/api/render', async (req, res) => {
  const { project } = req.body || {}
  if (!project) return res.status(400).json({ error: 'missing project' })

  const jobId = randomUUID()
  jobs.set(jobId, { status: 'queued', progress: 0 })
  res.json({ jobId })

  const selfOrigin = `http://localhost:${PORT}`
  jobs.set(jobId, { status: 'rendering', progress: 0 })
  renderProject(jobId, project, {
    selfOrigin,
    onProgress: (progress) => jobs.set(jobId, { status: 'rendering', progress }),
  })
    .then((url) => jobs.set(jobId, { status: 'done', progress: 1, url }))
    .catch((err) => jobs.set(jobId, { status: 'error', progress: 0, error: err?.message || String(err) }))
})

app.get('/api/render', (req, res) => {
  const jobId = String(req.query.jobId || '')
  const job = jobs.get(jobId)
  if (!job) return res.status(404).json({ error: 'job not found' })
  res.json(job)
})

// Serve the built Vite app in production (and when launched from Electron) — dev mode uses
// Vite's own dev server for everything else, proxying only /api, /uploads, /renders here.
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')))
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`BRollEditor server listening on http://127.0.0.1:${PORT}`)
})
