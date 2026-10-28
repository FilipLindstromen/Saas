import type { Line, Word } from '../types'

function normalize(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9']/g, '')
}

/**
 * Aligns freely-edited transcript text back onto the original Whisper word timestamps via a
 * longest-common-subsequence match on normalized tokens. Matched tokens keep their original
 * timing; inserted/changed tokens interpolate from their nearest matched neighbors. This is what
 * keeps audio sync correct while still letting the user retype a misheard word or move line
 * breaks around, instead of only allowing line-break edits.
 */
export function alignTextToWords(text: string, originalWords: Word[]): Line[] {
  const rawLines = text.split('\n')
  const tokens: { raw: string; norm: string; lineIndex: number }[] = []
  rawLines.forEach((lineText, lineIndex) => {
    const words = lineText.split(/\s+/).filter(Boolean)
    for (const w of words) tokens.push({ raw: w, norm: normalize(w), lineIndex })
  })

  const origNorm = originalWords.map((w) => normalize(w.text))
  const curNorm = tokens.map((t) => t.norm)

  const matches = lcsMatch(origNorm, curNorm)
  const matchByCur = new Map<number, number>() // curIndex -> origIndex
  for (const [oi, ci] of matches) matchByCur.set(ci, oi)

  const tokenTimes: { startMs: number; endMs: number }[] = new Array(tokens.length)
  for (let ci = 0; ci < tokens.length; ci++) {
    const oi = matchByCur.get(ci)
    if (oi !== undefined) {
      tokenTimes[ci] = { startMs: originalWords[oi].startMs, endMs: originalWords[oi].endMs }
    }
  }
  // Interpolate unmatched tokens from nearest matched neighbors.
  for (let ci = 0; ci < tokens.length; ci++) {
    if (tokenTimes[ci]) continue
    let before = -1
    for (let j = ci - 1; j >= 0; j--) if (tokenTimes[j]) { before = j; break }
    let after = -1
    for (let j = ci + 1; j < tokens.length; j++) if (tokenTimes[j]) { after = j; break }
    if (before === -1 && after === -1) {
      tokenTimes[ci] = { startMs: 0, endMs: 0 }
    } else if (before === -1) {
      tokenTimes[ci] = { startMs: tokenTimes[after].startMs, endMs: tokenTimes[after].startMs }
    } else if (after === -1) {
      tokenTimes[ci] = { startMs: tokenTimes[before].endMs, endMs: tokenTimes[before].endMs }
    } else {
      const span = after - before
      const frac = (ci - before) / span
      const startMs = tokenTimes[before].endMs + frac * (tokenTimes[after].startMs - tokenTimes[before].endMs)
      tokenTimes[ci] = { startMs, endMs: startMs }
    }
  }

  const lines: Line[] = rawLines.map((lineText, i) => ({
    id: `line-${i}`,
    text: lineText,
    startMs: 0,
    endMs: 0,
    broll: null,
  }))

  for (let li = 0; li < lines.length; li++) {
    const lineTokenIdx = tokens.reduce<number[]>((acc, t, idx) => {
      if (t.lineIndex === li) acc.push(idx)
      return acc
    }, [])
    if (lineTokenIdx.length === 0) continue
    const first = lineTokenIdx[0]
    const last = lineTokenIdx[lineTokenIdx.length - 1]
    lines[li].startMs = tokenTimes[first].startMs
    lines[li].endMs = Math.max(tokenTimes[last].endMs, tokenTimes[first].startMs)
  }

  return lines
}

/** Standard DP longest-common-subsequence, returns matched index pairs [origIndex, curIndex]. */
function lcsMatch(a: string[], b: string[]): [number, number][] {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0) return []
  const dp: Uint32Array[] = new Array(n + 1)
  for (let i = 0; i <= n; i++) dp[i] = new Uint32Array(m + 1)
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] && a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  const pairs: [number, number][] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (a[i - 1] && a[i - 1] === b[j - 1]) {
      pairs.push([i - 1, j - 1])
      i--
      j--
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  pairs.reverse()
  return pairs
}

/**
 * Re-attaches punctuation from the punctuated `fullText` onto the bare per-word timestamps —
 * Whisper's word-level output never includes it (`words[i].text` is "editor", never "editor."),
 * only the full transcript does. Run once, right after transcription, so every downstream
 * consumer (seeded line breaks, the Cut tab's word list, sentence-boundary detection generally)
 * just sees real punctuation on `project.words` instead of each having to re-derive it. Mirrors
 * seedTranscriptText's greedy-consume matching (a fullText token can span multiple word entries,
 * e.g. "b-roll" vs "b" + "roll").
 */
export function punctuateWords(words: Word[], fullText: string): Word[] {
  const textTokens = fullText.split(/\s+/).filter(Boolean)
  const result = words.map((w) => ({ ...w }))
  let wi = 0

  for (const token of textTokens) {
    const targetCore = normalize(token)
    const startIdx = wi
    let acc = ''
    while (wi < words.length && acc.length < targetCore.length) {
      acc += normalize(words[wi].text)
      wi++
    }
    const trailingPunct = token.match(/[.,!?;:]+$/)?.[0]
    if (trailingPunct && wi > startIdx) {
      const lastIdx = wi - 1
      result[lastIdx] = { ...result[lastIdx], text: result[lastIdx].text + trailingPunct }
    }
  }
  return result
}

/**
 * Seeds initial line-broken text from the word list, breaking after sentence punctuation.
 * Whisper's word-level timestamps strip punctuation from each word (`words[i].text` is
 * "editor", never "editor."), so the sentence boundary has to come from the punctuated
 * `fullText` instead. The two don't line up 1:1 by index — Whisper sometimes splits a
 * hyphenated word like "b-roll" into two word entries ("b", "roll") while `fullText` keeps it
 * as one token — so each `fullText` token is matched by greedily consuming words until their
 * concatenated normalized text covers it, rather than assuming matching positions.
 */
export function seedTranscriptText(words: Word[], fullText: string): string {
  const textTokens = fullText.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current: string[] = []
  let wi = 0

  for (const token of textTokens) {
    const targetCore = normalize(token)
    let acc = ''
    while (wi < words.length && acc.length < targetCore.length) {
      acc += normalize(words[wi].text)
      current.push(words[wi].text)
      wi++
    }
    if (/[.!?]$/.test(token)) {
      lines.push(current.join(' '))
      current = []
    }
  }
  while (wi < words.length) {
    current.push(words[wi].text)
    wi++
  }
  if (current.length) lines.push(current.join(' '))
  return lines.join('\n')
}
