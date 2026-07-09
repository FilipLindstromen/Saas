import { chatCompletion } from '@shared/openai'

const OGILVY_SYSTEM = `You are David Ogilvy, the legendary advertising executive known for clear, benefit-driven, fact-based copy. Analyze native ad headline and body copy with your direct, expert voice. Be specific and constructive — never vague or flattering without reason.

Return valid JSON only with this shape:
{
  "score": <number 1-10>,
  "summary": "<2-3 sentence overview>",
  "strengths": ["<strength>", ...],
  "weaknesses": ["<weakness>", ...],
  "suggestions": ["<actionable fix>", ...],
  "ogilvyVerdict": "<one paragraph in Ogilvy's distinctive voice>"
}`

const VERSIONS_SYSTEM = `You are David Ogilvy writing native ad copy. Create fresh headline and body copy variations that sell with clarity, specificity, and reader benefit. Each version should use a distinct creative angle (e.g. benefit-led, curiosity, social proof, urgency, problem-solution).

Return valid JSON only:
{
  "versions": [
    { "headline": "<string>", "copy": "<string, 1-3 short sentences>", "angle": "<angle label>" }
  ]
}

Rules:
- Headlines: punchy, under 12 words when possible
- Copy: concise, scannable, native-ad friendly
- No hashtags or emoji
- Match the product/context implied by the original copy`

function parseJsonResponse(raw) {
  const trimmed = raw.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('Invalid AI response')
  return JSON.parse(trimmed.slice(start, end + 1))
}

export async function analyzeAsOgilvy(headline, copy) {
  const userContent = [
    'Analyze this native ad:',
    '',
    `Headline: ${headline?.trim() || '(empty)'}`,
    '',
    `Copy: ${copy?.trim() || '(empty)'}`,
  ].join('\n')

  const raw = await chatCompletion({
    messages: [
      { role: 'system', content: OGILVY_SYSTEM },
      { role: 'user', content: userContent },
    ],
    temperature: 0.5,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  })

  return parseJsonResponse(raw)
}

export async function generateCopyVersions(headline, copy, count = 5) {
  const userContent = [
    `Create ${count} different versions of this native ad headline and copy.`,
    '',
    `Current headline: ${headline?.trim() || '(empty)'}`,
    `Current copy: ${copy?.trim() || '(empty)'}`,
  ].join('\n')

  const raw = await chatCompletion({
    messages: [
      { role: 'system', content: VERSIONS_SYSTEM },
      { role: 'user', content: userContent },
    ],
    temperature: 0.85,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  })

  const data = parseJsonResponse(raw)
  const versions = Array.isArray(data.versions) ? data.versions : []
  return versions
    .filter((v) => v?.headline || v?.copy)
    .map((v) => ({
      headline: String(v.headline || '').trim(),
      copy: String(v.copy || '').trim(),
      angle: String(v.angle || 'Variation').trim(),
    }))
}
