import { getApiBaseUrl, getApiHeaders } from '../utils/settings';

function apiUrl(path) {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function headers(extra = {}) {
  return { ...getApiHeaders(), ...extra };
}

function wrapNetworkError(err, context) {
  if (err?.name === 'TypeError' && (err.message === 'Failed to fetch' || err.message?.includes('fetch'))) {
    return new Error(
      `Cannot reach the API (${context}). Make sure the backend is running: run "npm run server" in the project folder. If you use a custom API URL, check Settings.`
    );
  }
  return err;
}

export async function transcribe(audioFile) {
  const form = new FormData();
  form.append('audio', audioFile);
  let res;
  try {
    res = await fetch(apiUrl('/transcribe'), {
      method: 'POST',
      headers: headers(),
      body: form,
    });
  } catch (err) {
    throw wrapNetworkError(err, 'transcribe');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Transcription failed');
  }
  return res.json();
}

export async function analyzeImportant(segments, text, overallFeel, userImportantFocus, selectedSegments) {
  let res;
  try {
    res = await fetch(apiUrl('/analyze-important'), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        segments,
        text,
        overallFeel: overallFeel || undefined,
        userImportantFocus: userImportantFocus || undefined,
        selectedSegments: selectedSegments?.length ? selectedSegments : undefined,
      }),
    });
  } catch (err) {
    throw wrapNetworkError(err, 'analyze');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Analysis failed');
  }
  return res.json();
}

/** Generate one sound effect via ElevenLabs. Returns blob (audio). */
export async function generateEffect(text, overallFeel, durationSeconds = 3) {
  let res;
  try {
    res = await fetch(apiUrl('/generate-effect'), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        text,
        overallFeel: overallFeel || undefined,
        duration_seconds: durationSeconds,
      }),
    });
  } catch (err) {
    throw wrapNetworkError(err, 'generate effect');
  }
  if (!res.ok) {
    let message = res.statusText || 'Effect generation failed';
    try {
      const err = await res.json();
      if (err && typeof err.error === 'string') message = err.error;
    } catch (_) {
      const text = await res.text().catch(() => '');
      if (text) message = text.slice(0, 200);
    }
    throw new Error(message);
  }
  return res.blob();
}
