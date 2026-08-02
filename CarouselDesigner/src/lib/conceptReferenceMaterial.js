import JSZip from 'jszip'

export const MAX_REFERENCE_UPLOAD_BYTES = 50 * 1024 * 1024
export const MAX_REFERENCE_FILES_PER_REQUEST = 50
export const MAX_REFERENCE_PROMPT_CHARS = 80_000
export const MAX_REFERENCE_URL_BYTES = 2 * 1024 * 1024
export const REFERENCE_URL_FETCH_TIMEOUT_MS = 20_000
export const MAX_REFERENCE_URLS_PER_REQUEST = 5

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.rst', '.csv', '.json', '.html', '.htm',
  '.xml', '.yaml', '.yml', '.tex', '.adoc', '.log', '.ini', '.cfg',
])

const SKIP_DIR_NAMES = new Set(['__macosx', '.git', 'node_modules', '.ds_store'])

function getExtension(name) {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

export function sanitizeUploadFileName(name) {
  const base = (name.split(/[/\\]/).pop() || 'upload')
    .replace(/[^\w.\- ()[\]]+/g, '_')
    .trim()
  return base || 'upload.txt'
}

function isLikelyText(bytes) {
  if (!bytes.length) return false
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096))
  let suspicious = 0
  for (let i = 0; i < sample.length; i += 1) {
    const byte = sample[i]
    if (byte === 0) return false
    if (byte < 9 || (byte > 13 && byte < 32)) suspicious += 1
  }
  return suspicious / sample.length < 0.05
}

export async function extractPdfText(bytes) {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  }
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
  const parts = []
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (line) parts.push(line)
  }
  return parts.join('\n\n').replace(/\u0000/g, '').trim()
}

export function sanitizeZipEntryPath(entryName) {
  const normalized = entryName.replace(/\\/g, '/').replace(/^\/+/, '')
  const segments = normalized.split('/').filter(Boolean)
  const safe = []
  for (const segment of segments) {
    if (segment === '..' || segment === '.') throw new Error('Invalid path in zip archive')
    if (SKIP_DIR_NAMES.has(segment.toLowerCase())) return null
    safe.push(segment)
  }
  if (safe.length === 0) return null
  return safe.join('/')
}

function shouldExtract(entryPath, bytes) {
  const ext = getExtension(entryPath)
  if (ext === '.pdf') return true
  if (TEXT_EXTENSIONS.has(ext)) return true
  if (!ext && isLikelyText(bytes)) return true
  return false
}

async function extractTextFromBytes(bytes, entryPath) {
  const ext = getExtension(entryPath)
  if (ext === '.pdf') return extractPdfText(bytes)
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\u0000/g, '').trim()
}

export async function extractReferenceFromZipFile(file) {
  if (file.size > MAX_REFERENCE_UPLOAD_BYTES) {
    throw new Error('Reference file is too large (max 50 MB).')
  }
  const buffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)
  const files = []
  let skippedBinary = 0
  const zipLabel = sanitizeUploadFileName(file.name || 'reference.zip')

  for (const [entryName, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const safePath = sanitizeZipEntryPath(entryName)
    if (!safePath) continue
    const bytes = await entry.async('uint8array')
    if (!shouldExtract(safePath, bytes)) {
      skippedBinary += 1
      continue
    }
    let text
    try {
      text = await extractTextFromBytes(bytes, safePath)
    } catch {
      skippedBinary += 1
      continue
    }
    const trimmed = text.trim()
    if (!trimmed) continue
    files.push({ path: `${zipLabel}/${safePath}`, text: trimmed })
  }

  return { files, skippedBinary, sourceNames: [zipLabel] }
}

export async function extractReferenceFromUploadFile(file) {
  if (file.size > MAX_REFERENCE_UPLOAD_BYTES) {
    throw new Error(`File too large (max 50 MB): ${file.name}`)
  }
  const safeName = sanitizeUploadFileName(file.name)
  const ext = getExtension(safeName)

  if (ext === '.zip') return extractReferenceFromZipFile(file)

  const bytes = new Uint8Array(await file.arrayBuffer())

  if (ext === '.pdf' || (ext === '' && bytes[0] === 0x25 && bytes[1] === 0x50)) {
    const text = await extractPdfText(bytes)
    if (!text) throw new Error(`Could not extract text from PDF: ${safeName}`)
    return { files: [{ path: safeName, text }], skippedBinary: 0, sourceNames: [safeName] }
  }

  if (TEXT_EXTENSIONS.has(ext) || isLikelyText(bytes)) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/\u0000/g, '').trim()
    if (!text) throw new Error(`File is empty or unreadable: ${safeName}`)
    return { files: [{ path: safeName, text }], skippedBinary: 0, sourceNames: [safeName] }
  }

  throw new Error(`Unsupported file type: ${safeName}`)
}

export async function extractReferenceFromUploadFiles(uploads) {
  if (!uploads?.length) throw new Error('Select at least one file to upload.')
  if (uploads.length > MAX_REFERENCE_FILES_PER_REQUEST) {
    throw new Error(`Too many files (max ${MAX_REFERENCE_FILES_PER_REQUEST} per upload).`)
  }
  const files = []
  const sourceNames = []
  let skippedBinary = 0
  for (const file of uploads) {
    const part = await extractReferenceFromUploadFile(file)
    files.push(...part.files)
    sourceNames.push(...part.sourceNames)
    skippedBinary += part.skippedBinary
  }
  if (files.length === 0) {
    throw new Error('No usable reference text found. Upload .txt, .md, .pdf, or .zip archives.')
  }
  return { files, sourceNames, skippedBinary }
}

export function mergeReferenceFiles(existingFiles, incomingFiles) {
  const byPath = new Map()
  for (const file of existingFiles || []) {
    if (file?.path && file?.text) byPath.set(file.path, file)
  }
  for (const file of incomingFiles || []) {
    if (file?.path && file?.text) byPath.set(file.path, file)
  }
  return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path))
}

export function buildReferenceManifest({ sourceNames, files, skippedBinary = 0, previousManifest = null }) {
  const mergedSourceNames = [
    ...new Set([
      ...(Array.isArray(previousManifest?.sourceNames)
        ? previousManifest.sourceNames
        : previousManifest?.sourceFileName
        ? [previousManifest.sourceFileName]
        : []),
      ...sourceNames,
    ]),
  ]
  const label =
    mergedSourceNames.length <= 2
      ? mergedSourceNames.join(', ')
      : `${mergedSourceNames.length} uploads · ${files.length} files`

  return {
    uploadedAt: new Date().toISOString(),
    sourceFileName: label || 'reference files',
    sourceNames: mergedSourceNames,
    files: files.map((file) => ({ path: file.path, charCount: file.text.length })),
    totalChars: files.reduce((sum, file) => sum + file.text.length, 0),
    skippedBinary: (previousManifest?.skippedBinary || 0) + (skippedBinary || 0),
  }
}

export function rebuildReferenceManifestFromFiles(files, previousManifest) {
  if (!files?.length) return null
  const label =
    files.length === 1
      ? files[0].path.split('/').pop() || files[0].path
      : `${files.length} files`
  return {
    uploadedAt: new Date().toISOString(),
    sourceFileName: label,
    sourceNames: previousManifest?.sourceNames,
    files: files.map((file) => ({ path: file.path, charCount: file.text.length })),
    totalChars: files.reduce((sum, file) => sum + file.text.length, 0),
    skippedBinary: previousManifest?.skippedBinary,
  }
}

export function parseReferenceUrlInputs(input) {
  if (Array.isArray(input)) {
    return [...new Set(input.map((value) => String(value).trim()).filter(Boolean))]
  }
  if (typeof input === 'string') {
    return [...new Set(input.split(/[\n,]+/).map((part) => part.trim()).filter(Boolean))]
  }
  return []
}

export function normalizeReferenceUrl(input) {
  const trimmed = String(input || '').trim()
  if (!trimmed) throw new Error('URL is required')
  let url
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
  } catch {
    throw new Error('Invalid URL')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http and https URLs are supported')
  }
  return url.href
}

export function referencePathFromUrl(urlString) {
  const url = new URL(urlString)
  const host = url.hostname.replace(/[^\w.-]+/g, '_')
  let pathname = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!pathname) pathname = 'index'
  pathname = pathname.replace(/[^\w./-]+/g, '_').replace(/\.\./g, '_')
  const querySuffix = url.search
    ? `_${url.search.slice(1).replace(/[^\w=&-]+/g, '_').slice(0, 48)}`
    : ''
  return `web/${host}/${pathname}${querySuffix}.txt`
}

export function htmlToPlainText(html) {
  let source = String(html || '')
  source = source
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')

  const titleMatch = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : ''

  source = source.replace(
    /<\/?(p|div|br|hr|h[1-6]|li|tr|td|th|section|article|header|footer|blockquote|main|aside|figure|figcaption)[^>]*>/gi,
    '\n',
  )
  source = source.replace(/<[^>]+>/g, ' ')
  source = source
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

  if (title && !source.startsWith(title)) {
    source = `Title: ${title}\n\n${source}`
  }
  return source
}

export async function fetchReferenceFromUrl(urlInput) {
  const href = normalizeReferenceUrl(urlInput)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REFERENCE_URL_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(href, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain,text/markdown;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      throw new Error(`Could not fetch URL (HTTP ${response.status})`)
    }

    const contentType = response.headers.get('content-type') || ''
    const buffer = new Uint8Array(await response.arrayBuffer())
    if (buffer.length > MAX_REFERENCE_URL_BYTES) {
      throw new Error(`Page too large (max ${MAX_REFERENCE_URL_BYTES / (1024 * 1024)} MB)`)
    }

    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    let text
    if (contentType.includes('text/plain') || contentType.includes('text/markdown')) {
      text = decoded.replace(/\u0000/g, '').trim()
    } else {
      text = htmlToPlainText(decoded)
    }

    if (!text || text.length < 80) {
      throw new Error('Could not extract enough text from this page.')
    }

    return {
      files: [{ path: referencePathFromUrl(href), text }],
      sourceNames: [href],
      skippedBinary: 0,
    }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Timed out fetching URL')
    if (error instanceof TypeError) {
      throw new Error(
        'Could not fetch this URL (browser blocked by CORS). Save the page as .txt/.pdf and upload instead.',
      )
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function extractReferenceFromUrls(urls) {
  const list = parseReferenceUrlInputs(urls)
  if (list.length === 0) throw new Error('Enter at least one URL')
  if (list.length > MAX_REFERENCE_URLS_PER_REQUEST) {
    throw new Error(`At most ${MAX_REFERENCE_URLS_PER_REQUEST} URLs per request`)
  }

  const files = []
  const sourceNames = []
  let skippedBinary = 0
  for (const url of list) {
    const part = await fetchReferenceFromUrl(url)
    files.push(...part.files)
    sourceNames.push(...part.sourceNames)
    skippedBinary += part.skippedBinary
  }
  return { files, sourceNames, skippedBinary }
}

export function buildReferencePromptContext(files, maxChars = MAX_REFERENCE_PROMPT_CHARS) {
  if (!files?.length) return ''

  const header = [
    'Use the following as research, facts, and style context. Write original carousel slide copy; do not copy verbatim.',
    '',
  ].join('\n')

  let budget = Math.max(0, maxChars - header.length - 64)
  const sections = []

  for (const file of files) {
    const label = `\n--- ${file.path} ---\n`
    const remaining = budget - label.length
    if (remaining <= 200) break

    let body = file.text
    if (body.length > remaining) {
      body = `${body.slice(0, remaining)}\n… [truncated]`
    }
    sections.push(`${label}${body}`)
    budget -= label.length + body.length
    if (budget <= 200) break
  }

  if (!sections.length) return ''
  return `${header}${sections.join('\n')}`
}
