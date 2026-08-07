/** Rough USD estimates for gpt-image-1 edits (indicative, not billing-accurate). */
const ESTIMATE_PER_IMAGE_USD = {
  low: 0.02,
  high: 0.08,
}

export function normalizeGenerationQuality(q) {
  return q === 'low' ? 'low' : 'high'
}

export function estimateGenerationCost(quality, count = 1) {
  const q = normalizeGenerationQuality(quality)
  const per = ESTIMATE_PER_IMAGE_USD[q]
  const n = Math.max(1, Math.min(3, Math.floor(count) || 1))
  const total = per * n
  const multi = n > 1
  return {
    quality: q,
    perImageUsd: per,
    totalUsd: total,
    label: multi ? `~$${total.toFixed(2)} est. · 1 request` : `~$${total.toFixed(2)} est.`,
    perLabel: q === 'low' ? 'Draft' : 'Standard',
    singleRequest: multi,
  }
}

export function classifyGenerationError(err) {
  const message = err?.message || 'Generation failed.'
  if (/api key is not set/i.test(message)) {
    return { type: 'auth', message, canRetryDraft: false }
  }
  if (/429|rate limit|too many requests/i.test(message)) {
    return { type: 'rate_limit', message, canRetryDraft: true }
  }
  if (/timeout|network|failed to fetch/i.test(message)) {
    return { type: 'network', message, canRetryDraft: true }
  }
  return { type: 'unknown', message, canRetryDraft: true }
}
