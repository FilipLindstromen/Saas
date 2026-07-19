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
 * @param {Object} [options.response_format] - e.g. { type: 'json_object' } for structured JSON
 */
export async function chatCompletion({ messages, model = 'gpt-4o-mini', temperature = 0.6, max_tokens = 1000, apiKey, response_format }) {
  const key = getKey(apiKey);
  if (!key) throw new Error('OpenAI API key is not set. Open Settings to add your key.');

  const body = { model, messages, temperature, max_tokens };
  if (response_format) body.response_format = response_format;

  const res = await fetch(`${OPENAI_API}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
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

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function imageItemToDataUrl(item) {
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  return null;
}

async function resolveImageResponse(data) {
  const item = data?.data?.[0];
  const fromBase64 = imageItemToDataUrl(item);
  if (fromBase64) return fromBase64;
  if (item?.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error('Failed to download generated image.');
    return blobToDataUrl(await imgRes.blob());
  }
  throw new Error('Image API returned no image data.');
}

/**
 * Generate an image from a text prompt.
 * @param {Object} options
 * @param {string} options.prompt
 * @param {string} [options.size] - e.g. 1536x1024, 1024x1024, 1024x1536
 * @param {string} [options.model] - default gpt-image-1
 * @param {string} [options.quality] - low | medium | high
 * @param {string} [options.apiKey]
 * @returns {Promise<string>} data URL
 */
export async function generateImage({
  prompt,
  size = '1536x1024',
  model = 'gpt-image-1',
  quality = 'high',
  apiKey,
}) {
  const key = getKey(apiKey);
  if (!key) throw new Error('OpenAI API key is not set. Open Settings to add your key.');
  if (!prompt?.trim()) throw new Error('Prompt is required.');

  const res = await fetch(`${OPENAI_API}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      prompt: prompt.trim(),
      size,
      quality,
      n: 1,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Image generation failed: ${res.status}`);
  }

  return resolveImageResponse(await res.json());
}

/**
 * Generate an image using a reference image and prompt.
 * @param {Object} options
 * @param {string} options.prompt
 * @param {string} options.imageDataUrl - reference image as data URL
 * @param {string} [options.size]
 * @param {string} [options.model]
 * @param {string} [options.quality]
 * @param {string} [options.apiKey]
 * @returns {Promise<string>} data URL
 */
export async function editImage({
  prompt,
  imageDataUrl,
  size = '1536x1024',
  model = 'gpt-image-1',
  quality = 'high',
  apiKey,
}) {
  const key = getKey(apiKey);
  if (!key) throw new Error('OpenAI API key is not set. Open Settings to add your key.');
  if (!prompt?.trim()) throw new Error('Prompt is required.');
  if (!imageDataUrl) throw new Error('Reference image is required.');

  const blob = await dataUrlToBlob(imageDataUrl);
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt.trim());
  form.append('size', size);
  form.append('quality', quality);
  form.append('input_fidelity', 'high');
  form.append('image', blob, 'reference.png');

  const res = await fetch(`${OPENAI_API}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Image edit failed: ${res.status}`);
  }

  return resolveImageResponse(await res.json());
}
