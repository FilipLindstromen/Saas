import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import OpenAI from 'openai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = join(__dirname, 'uploads')
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true })

const app = express()
app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(UPLOADS_DIR))

function getGiphyKey(req) {
  return req.headers['x-giphy-api-key'] || process.env.GIPHY_API_KEY || ''
}

function getPixabayKey(req) {
  return req.headers['x-pixabay-api-key'] || process.env.PIXABAY_API_KEY || ''
}

function getPexelsKey(req) {
  return req.headers['x-pexels-api-key'] || process.env.PEXELS_API_KEY || ''
}

function getOpenAIKey(req) {
  return req.headers['x-openai-api-key'] || process.env.OPENAI_API_KEY || ''
}

// Search Giphy
async function searchGiphy(q, type = 'stickers', limit = 20, offset = 0, apiKey) {
  try {
    const key = (apiKey || process.env.GIPHY_API_KEY || '').trim()
    if (!key) {
      console.error('Giphy search: no API key provided')
      return []
    }
    const endpoint = type === 'stickers' ? 'stickers/search' : 'gifs/search'
    const res = await fetch(
      `https://api.giphy.com/v1/${endpoint}?api_key=${key}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&rating=g`
    )
    const data = await res.json().catch(() => ({}))
    if (data?.meta?.status >= 400) {
      console.error('Giphy API error:', data.meta?.msg || data.meta?.status)
      return []
    }
    if (!data?.data || !Array.isArray(data.data)) return []
    return data.data.map((item) => {
      const imgs = item?.images
      if (!imgs) return null
      const img = type === 'gifs'
        ? (imgs?.fixed_height || imgs?.fixed_height_small || imgs?.downsized || imgs?.original)
        : (imgs?.fixed_height_small || imgs?.downsized_small || imgs?.original)
      const url = img?.url || imgs.original?.url
      return url ? { url } : null
    }).filter(Boolean)
  } catch (e) {
    console.error('Giphy search error:', e.message)
    return []
  }
}

// Search Pixabay
async function searchPixabay(q, limit = 24, page = 1, apiKey) {
  try {
    const key = (apiKey || process.env.PIXABAY_API_KEY || '').trim()
    if (!key) {
      console.error('Pixabay search: no API key provided')
      return []
    }
    const res = await fetch(
      `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&per_page=${limit}&page=${page}&safesearch=true`
    )
    const data = await res.json().catch(() => ({}))
    if (!data?.hits || !Array.isArray(data.hits)) return []
    return data.hits.map((item) => {
      const url = item.webformatURL || item.largeImageURL || item.previewURL
      return url ? { url } : null
    }).filter(Boolean)
  } catch (e) {
    console.error('Pixabay search error:', e.message)
    return []
  }
}

// Search Pexels
async function searchPexels(q, limit = 24, page = 1, apiKey) {
  try {
    const key = (apiKey || process.env.PEXELS_API_KEY || '').trim()
    if (!key) {
      console.error('Pexels search: no API key provided')
      return []
    }
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${limit}&page=${page}`,
      { headers: { Authorization: key } }
    )
    const data = await res.json().catch(() => ({}))
    if (!data?.photos || !Array.isArray(data.photos)) return []
    return data.photos.map((photo) => {
      const url = photo.src?.medium || photo.src?.large || photo.src?.original
      return url ? { url } : null
    }).filter(Boolean)
  } catch (e) {
    console.error('Pexels search error:', e.message)
    return []
  }
}

// Search Iconify
async function searchIconify(q, limit = 20, start = 0) {
  try {
    const res = await fetch(
      `https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=${limit}&start=${start}`
    )
    const data = await res.json()
    if (!data?.icons || !Array.isArray(data.icons)) return []
    return data.icons.map((icon) => {
      const parts = String(icon).split(':')
      if (parts.length < 2) return null
      return {
        url: `https://api.iconify.design/${parts[0]}/${parts[1]}.svg`
      }
    }).filter(Boolean)
  } catch (e) {
    console.error('Iconify search error:', e.message)
    return []
  }
}

// Save image from URL to server
async function saveImage(url, baseUrl) {
  try {
    const fullUrl = url.startsWith('http') ? url : new URL(url, baseUrl || 'https://api.giphy.com').href
    const res = await fetch(fullUrl, { redirect: 'follow' })
    if (!res.ok) return url
    const buf = await res.arrayBuffer()
    const ext = url.includes('.svg') ? 'svg' : url.includes('.gif') ? 'gif' : 'png'
    const filename = `${uuidv4()}.${ext}`
    const filepath = join(UPLOADS_DIR, filename)
    writeFileSync(filepath, Buffer.from(buf))
    return `/uploads/${filename}`
  } catch (e) {
    console.error('Save image error:', e)
    return url
  }
}

// GET /api/search?service=giphy|iconify|pixabay|pexels&type=...&q=...&offset=...
app.get('/api/search', async (req, res) => {
  try {
    const { service, type, q, offset } = req.query
    if (!q) return res.json({ results: [] })
    const off = Math.max(0, parseInt(offset, 10) || 0)
    let results = []
    if (service === 'giphy') {
      const apiKey = getGiphyKey(req)
      if (!apiKey?.trim()) {
        return res.status(400).json({ error: 'Giphy API key required. Add it in Settings (gear icon).' })
      }
      results = await searchGiphy(q, type || 'stickers', 24, off, apiKey)
    } else if (service === 'iconify') {
      results = await searchIconify(q, 32, off)
    } else if (service === 'pixabay') {
      const apiKey = getPixabayKey(req)
      if (!apiKey?.trim()) {
        return res.status(400).json({ error: 'Pixabay API key required. Add it in Settings (gear icon).' })
      }
      const page = Math.floor(off / 24) + 1
      results = await searchPixabay(q, 24, page, apiKey)
    } else if (service === 'pexels') {
      const apiKey = getPexelsKey(req)
      if (!apiKey?.trim()) {
        return res.status(400).json({ error: 'Pexels API key required. Add it in Settings (gear icon).' })
      }
      const page = Math.floor(off / 24) + 1
      results = await searchPexels(q, 24, page, apiKey)
    }
    res.json({ results })
  } catch (e) {
    const msg = e?.message || String(e) || 'Search failed'
    console.error('Search error:', msg, e?.stack)
    res.status(500).json({ error: msg })
  }
})

// POST /api/save-image - save image from URL and return local path
app.post('/api/save-image', async (req, res) => {
  try {
    const { url } = req.body
    if (!url) return res.status(400).json({ error: 'url required' })
    const localUrl = await saveImage(url)
    res.json({ url: localUrl })
  } catch (e) {
    console.error('Save error:', e)
    res.status(500).json({ error: e.message })
  }
})

// POST /api/generate - AI generate steps and fetch images
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, stepCount } = req.body
    if (!prompt) return res.status(400).json({ error: 'prompt required' })

    const openaiKey = getOpenAIKey(req)
    const giphyKey = getGiphyKey(req)

    let steps = []
    if (openaiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey })
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an infographic designer. Given a user prompt, output a JSON array of steps. Each step has: "text" (short label 3-8 words, optionally followed by a brief description on a new line) and "searchTerm" (search query for finding an icon/sticker, e.g. "stress brain", "cortisol"). Use simple, visual search terms. Output ONLY valid JSON, no markdown.${stepCount ? ` Generate exactly ${stepCount} steps.` : ''}`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7
        })
        const text = completion.choices[0]?.message?.content?.trim() || '[]'
        const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
        let parsed = []
        try {
          parsed = JSON.parse(cleaned)
        } catch (_) {
          console.error('OpenAI returned invalid JSON, using fallback')
        }
        steps = Array.isArray(parsed) ? parsed : []
      } catch (openaiErr) {
        console.error('OpenAI error, using fallback:', openaiErr.message)
      }
    }
    if (steps.length === 0) {
      // Fallback: simple heuristic - extract number and topic
      const match = prompt.match(/(\d+)[- ]?step\s+(?:process\s+of\s+)?(.+?)(?:\s+in\s+(.+))?$/i)
      const n = stepCount || (match ? parseInt(match[1], 10) : 5)
      const topic = match ? match[2].trim() : prompt
      const style = match ? match[3] || '' : ''
      for (let i = 0; i < Math.min(n, 10); i++) {
        steps.push({
          text: `Step ${i + 1}`,
          searchTerm: `${topic} ${style}`.trim()
        })
      }
    }

    // Fetch image for each step and save to server
    const results = []
    const searchType = prompt.toLowerCase().includes('hand drawn') || prompt.toLowerCase().includes('sticker') ? 'stickers' : 'stickers'
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const term = step.searchTerm || step.text
      let imageUrl = ''
      let imageSource = null
      if (giphyKey) {
        const giphyResults = await searchGiphy(term, searchType, 1, 0, giphyKey)
        if (giphyResults[0]) {
          imageUrl = giphyResults[0].url
          imageSource = 'giphy'
        }
      }
      if (!imageUrl) {
        const iconResults = await searchIconify(term, 1)
        if (iconResults[0]) {
          imageUrl = iconResults[0].url
          imageSource = 'iconify'
        }
      }
      if (imageUrl) {
        try {
          imageUrl = await saveImage(imageUrl)
        } catch (saveErr) {
          console.error('Save image failed for step', i, saveErr.message)
          // keep original URL if save fails
        }
      }
      results.push({
        text: step.text,
        imageUrl,
        imageSource
      })
    }

    res.json({ steps: results })
  } catch (e) {
    console.error('Generate error:', e)
    res.status(500).json({ error: e.message })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`InfoGraphics server on http://localhost:${PORT}`)
})
