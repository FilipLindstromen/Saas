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
  const items = await resolveAllImageResponses(data)
  if (!items.length) throw new Error('Image API returned no image data.')
  return items[0]
}

async function resolveAllImageResponses(data) {
  const list = data?.data
  if (!Array.isArray(list) || !list.length) return []
  const urls = []
  for (const item of list) {
    const fromBase64 = imageItemToDataUrl(item)
    if (fromBase64) {
      urls.push(fromBase64)
      continue
    }
    if (item?.url) {
      const imgRes = await fetch(item.url)
      if (!imgRes.ok) throw new Error('Failed to download generated image.')
      urls.push(await blobToDataUrl(await imgRes.blob()))
    }
  }
  return urls
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
  n = 1,
  apiKey,
  signal,
}) {
  const key = getKey(apiKey);
  if (!key) throw new Error('OpenAI API key is not set. Open Settings to add your key.');
  if (!prompt?.trim()) throw new Error('Prompt is required.');

  const count = Math.min(10, Math.max(1, Math.floor(n) || 1));

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
      n: count,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Image generation failed: ${res.status}`);
  }

  const payload = await res.json();
  if (count === 1) return resolveImageResponse(payload);
  const all = await resolveAllImageResponses(payload);
  if (!all.length) throw new Error('Image API returned no image data.');
  return all;
}

/**
 * Generate an image using a reference image and prompt.
 * @param {Object} options
 * @param {string} options.prompt
 * @param {string} options.imageDataUrl - reference image as data URL
 * @param {string[]} [options.additionalImages] - extra reference images (e.g. a style
 *   reference) sent alongside the primary image via gpt-image-1's multi-image edit
 *   support. Omitted by default so every existing caller is unaffected.
 * @param {string} [options.size]
 * @param {string} [options.model]
 * @param {string} [options.quality]
 * @param {number} [options.n] - number of images (1–10), gpt-image models
 * @param {string} [options.apiKey]
 * @returns {Promise<string|string[]>} data URL, or array when n > 1
 */
export async function editImage({
  prompt,
  imageDataUrl,
  additionalImages = [],
  size = '1536x1024',
  model = 'gpt-image-1',
  quality = 'high',
  n = 1,
  apiKey,
  signal,
}) {
  const key = getKey(apiKey);
  if (!key) throw new Error('OpenAI API key is not set. Open Settings to add your key.');
  if (!prompt?.trim()) throw new Error('Prompt is required.');
  if (!imageDataUrl) throw new Error('Reference image is required.');

  const count = Math.min(10, Math.max(1, Math.floor(n) || 1));

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt.trim());
  form.append('size', size);
  form.append('quality', quality);
  form.append('input_fidelity', 'high');
  if (count > 1) form.append('n', String(count));

  if (additionalImages.length > 0) {
    const primaryBlob = await dataUrlToBlob(imageDataUrl);
    form.append('image[]', primaryBlob, 'reference-0.png');
    for (let i = 0; i < additionalImages.length; i++) {
      const blob = await dataUrlToBlob(additionalImages[i]);
      form.append('image[]', blob, `reference-${i + 1}.png`);
    }
  } else {
    const blob = await dataUrlToBlob(imageDataUrl);
    form.append('image', blob, 'reference.png');
  }

  const res = await fetch(`${OPENAI_API}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Image edit failed: ${res.status}`);
  }

  const payload = await res.json();
  if (count === 1) return resolveImageResponse(payload);
  const all = await resolveAllImageResponses(payload);
  if (!all.length) throw new Error('Image API returned no image data.');
  return all;
}
