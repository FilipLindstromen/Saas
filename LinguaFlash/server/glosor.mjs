import { validateGlosorUrl } from '../src/lib/glosor.js';

const MAX_BYTES = 2 * 1024 * 1024;

export default async function glosorHandler(req, res) {
  const send = (status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(405, { error: 'Only GET requests are supported.' });
  }
  let url;
  try {
    url = validateGlosorUrl(new URL(req.url, 'http://localhost').searchParams.get('url') || '');
  } catch (error) { return send(400, { error: error.message }); }
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Accept: 'text/html' } });
    if (!response.ok) return send(502, { error: 'Glosor.eu could not open this exercise. Check that it is public and the URL is correct.' });
    if (!response.headers.get('content-type')?.includes('text/html')) return send(502, { error: 'Glosor.eu did not return an exercise page.' });
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return send(502, { error: 'This exercise page is too large to import.' });
      }
      chunks.push(value);
    }
    return send(200, { html: Buffer.concat(chunks).toString('utf8'), url });
  } catch {
    return send(502, { error: 'Could not reach Glosor.eu. Try again shortly or paste the words manually.' });
  }
}
