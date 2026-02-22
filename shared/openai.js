/**
 * Shared OpenAI service for all Saas apps.
 * Centralizes API usage and error handling.
 */
import { getApiKey } from '@shared/apiKeys';

const OPENAI_API = 'https://api.openai.com/v1';

function getKey(apiKey) {
  return (apiKey && apiKey.trim()) || getApiKey('openai') || '';
}

/**
 * Chat completion.
 * @param {Object} options
 * @param {Array<{role: string, content: string}>} options.messages
 * @param {string} [options.model] - default gpt-4o-mini
 * @param {number} [options.temperature]
 * @param {number} [options.max_tokens]
 * @param {string} [options.apiKey]
 */
export async function chatCompletion({ messages, model = 'gpt-4o-mini', temperature = 0.6, max_tokens = 1000, apiKey }) {
  const key = getKey(apiKey);
  if (!key) throw new Error('OpenAI API key is not set. Open Settings to add your key.');

  const res = await fetch(`${OPENAI_API}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? '';
  return text;
}

/**
 * Simple completion from system + user content.
 */
export async function generateFromPrompt(systemPrompt, userContent, { model, temperature, max_tokens, apiKey } = {}) {
  return chatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    model: model || 'gpt-4o-mini',
    temperature: temperature ?? 0.6,
    max_tokens: max_tokens ?? 1000,
    apiKey,
  });
}

/**
 * Transcribe audio blob using Whisper.
 * @param {Blob} audioBlob
 * @param {string} [apiKey]
 * @returns {Promise<string>}
 */
export async function transcribeAudio(audioBlob, apiKey) {
  const key = getKey(apiKey);
  if (!key) throw new Error('OpenAI API key is not set. Open Settings to add your key.');

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-1');

  const res = await fetch(`${OPENAI_API}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Transcription failed: ${res.status}`);
  }

  const data = await res.json();
  return (data.text || '').trim();
}
