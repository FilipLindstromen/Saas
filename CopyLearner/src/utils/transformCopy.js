import { chatCompletion } from '@shared/openai'

const SYSTEM_PROMPT = `You are an expert direct-response copywriter with decades of experience, working one-on-one with a client to rewrite their copy. You'll be given the client's copy, instructions for how to transform it, and a list of standing instructions they've given you in past sessions — apply those standing instructions too, alongside the current ones, unless they conflict with the current instructions (current instructions win).

Rewrite the copy accordingly. Return ONLY the transformed copy itself — no preamble, no explanation, no markdown fences, no commentary. If the copy has multiple lines (e.g. a headline plus body), preserve that structure using plain line breaks.`

/**
 * Rewrite pasted copy per instructions, factoring in previously given
 * standing instructions so the tool's output improves the more it's used.
 * @param {Object} opts
 * @param {string} opts.copy
 * @param {string} opts.instructions
 * @param {string[]} [opts.standingInstructions]
 * @param {string} [opts.apiKey]
 * @returns {Promise<string>}
 */
export async function transformCopy({ copy, instructions, standingInstructions = [], apiKey }) {
  const standing = standingInstructions.length
    ? standingInstructions.map((s) => `- ${s}`).join('\n')
    : '(none yet)'

  const userMessage = `STANDING INSTRUCTIONS FROM PAST SESSIONS:\n${standing}\n\nCURRENT INSTRUCTIONS:\n${instructions || '(none given — use your best copywriting judgment to improve it)'}\n\nCOPY TO TRANSFORM:\n${copy}`

  const output = await chatCompletion({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 1600,
    apiKey,
  })

  return output.trim()
}
