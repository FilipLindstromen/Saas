import { formatSlideTextBody } from './slidePlainText'

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'it', 'that', 'this',
  'with', 'as', 'by', 'from', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
  'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'if', 'when', 'where', 'what', 'which', 'who', 'whom', 'how', 'why', 'not', 'no', 'yes', 'so', 'than',
  'too', 'very', 'just', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up',
  'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'all', 'each',
  'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'also', 'back', 'even', 'well',
  'way', 'many', 'much', 'any', 'both', 'your', 'you', 'we', 'they', 'them', 'their', 'our', 'my', 'me',
  'i', 'he', 'she', 'his', 'her', 'its', 'get', 'got', 'go', 'goes', 'going', 'went', 'come', 'comes',
  'keep', 'keeps', 'still', 'never', 'always', 'every', 'without', 'within', 'between', 'because', 'while',
  'until', 'since', 'though', 'although', 'however', 'really', 'actually', 'maybe', 'perhaps', 'already',
  'yet', 'now', 'new', 'old', 'one', 'two', 'three', 'first', 'last', 'next', 'like', 'make', 'made',
  'take', 'takes', 'took', 'see', 'seen', 'know', 'think', 'want', 'use', 'used', 'using', 'find', 'found',
  'give', 'gives', 'tell', 'tells', 'say', 'says', 'said', 'look', 'looks', 'looking', 'feel', 'feels',
  'help', 'helps', 'start', 'starts', 'stop', 'stops', 'try', 'tries', 'let', 'lets', 'put', 'puts',
  'set', 'sets', 'show', 'shows', 'work', 'works', 'call', 'calls', 'ask', 'asks', 'turn', 'turns',
  'move', 'moves', 'live', 'lives', 'believe', 'seem', 'seems', 'leave', 'leaves', 'left', 'bring',
  'become', 'becomes', 'hold', 'holds', 'write', 'writes', 'read', 'reads', 'run', 'runs', 'open',
  'opens', 'close', 'closes', 'win', 'wins', 'offer', 'offers', 'remember', 'love', 'loves', 'hate',
  'hates', 'pay', 'pays', 'meet', 'meets', 'include', 'includes', 'continue', 'continues', 'learn',
  'learns', 'change', 'changes', 'lead', 'leads', 'understand', 'watch', 'watches', 'follow', 'follows',
  'create', 'creates', 'speak', 'speaks', 'spend', 'spends', 'grow', 'grows', 'build', 'builds',
  'stay', 'stays', 'fall', 'falls', 'cut', 'cuts', 'reach', 'reaches', 'kill', 'kills', 'raise',
  'raises', 'pass', 'passes', 'sell', 'sells', 'decide', 'decides', 'return', 'returns', 'explain',
  'explains', 'hope', 'hopes', 'develop', 'develops', 'carry', 'carries', 'break', 'breaks', 'receive',
  'receives', 'agree', 'agrees', 'support', 'supports', 'hit', 'hits', 'produce', 'produces', 'eat',
  'eats', 'cover', 'covers', 'catch', 'catches', 'draw', 'draws', 'choose', 'chooses', 'cause', 'causes',
  'point', 'points', 'listen', 'listens', 'plan', 'plans', 'pick', 'picks', 'save', 'saves', 'add',
  'adds', 'end', 'ends', 'wait', 'waits', 'stand', 'stands', 'happen', 'happens', 'provide', 'provides',
  'allow', 'allows', 'consider', 'considers', 'expect', 'expects', 'report', 'reports', 'suggest',
  'suggests', 'require', 'requires', 'involve', 'involves', 'complete', 'completes', 'deal', 'deals',
  'face', 'faces', 'fail', 'fails', 'serve', 'serves', 'end', 'ends', 'refuse', 'refuses', 'refused',
  'back', 'won', 'wont', "won't", "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't",
  "can't", "couldn't", "shouldn't", "wouldn't", "haven't", "hasn't", "hadn't",
])

/** Pick the most distinctive words from slide text (not stop words, prefer longer terms). */
export function extractImportantKeywords(text, maxWords = 3) {
  if (!text || typeof text !== 'string') return ''

  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))

  if (!tokens.length) return ''

  const freq = new Map()
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1)
  }

  const ranked = [...freq.entries()]
    .map(([word, count]) => ({
      word,
      score: word.length + (count === 1 ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.word.length - a.word.length)

  return ranked.slice(0, maxWords).map((r) => r.word).join(' ')
}

export function getSlideSearchKeywords(slide, maxWords = 3) {
  const plainText = formatSlideTextBody(slide)
  return extractImportantKeywords(plainText, maxWords)
}

function sanitizeSearchQuery(raw) {
  return String(raw || '')
    .trim()
    .replace(/['"]/g, '')
    .split(/\s+/)
    .slice(0, 4)
    .join(' ')
}

/**
 * Build a concise stock-media search query from slide content.
 * Uses only extracted keywords (not the full slide text) for the AI prompt.
 */
export async function generateMediaSearchQuery({ slide, mediaType = 'image', openaiKey, maxKeywords = 3 }) {
  const keywords = getSlideSearchKeywords(slide, maxKeywords)
  if (!keywords) return null

  if (!openaiKey?.trim()) {
    return keywords
  }

  const isVideo = mediaType === 'video'
  const platform = isVideo ? 'Pexels or Pixabay' : 'Unsplash'
  const mediaLabel = isVideo ? 'stock video' : 'stock photo'

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey.trim()}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            `You generate concise search queries for ${platform}. Return ONLY 2-3 important keywords as a search query for a ${mediaLabel}. Do not use filler words. Do not repeat all input words — pick the most visually descriptive terms.`,
        },
        {
          role: 'user',
          content: `Most important keywords from a slide: "${keywords}". Return a ${mediaLabel} search query.`,
        },
      ],
      max_tokens: 15,
    }),
  })

  const data = await response.json()
  if (!response.ok || !data.choices?.[0]?.message?.content) {
    return keywords
  }

  const refined = sanitizeSearchQuery(data.choices[0].message.content)
  return refined || keywords
}
