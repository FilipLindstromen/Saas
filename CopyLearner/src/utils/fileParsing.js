import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json']

async function extractPdfText(arrayBuffer) {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pageTexts = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((it) => it.str).join(' ')
    pageTexts.push(text)
  }
  return pageTexts.join('\n\n')
}

async function extractZipText(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const parts = []
  const entries = Object.values(zip.files).filter((f) => !f.dir)
  for (const entry of entries) {
    const lower = entry.name.toLowerCase()
    if (lower.endsWith('.pdf')) {
      const buf = await entry.async('arraybuffer')
      try {
        const text = await extractPdfText(buf)
        if (text.trim()) parts.push(`# ${entry.name}\n${text}`)
      } catch {
        /* skip unreadable pdf inside zip */
      }
    } else if (TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      const text = await entry.async('text')
      if (text.trim()) parts.push(`# ${entry.name}\n${text}`)
    }
  }
  return parts.join('\n\n---\n\n')
}

/**
 * Extract plain text from a File (pdf, zip, txt/md, or anything readable as text).
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) {
    const buf = await file.arrayBuffer()
    return extractPdfText(buf)
  }
  if (name.endsWith('.zip')) {
    const buf = await file.arrayBuffer()
    return extractZipText(buf)
  }
  return file.text()
}

export function guessFileType(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.zip')) return 'zip'
  return 'text'
}
