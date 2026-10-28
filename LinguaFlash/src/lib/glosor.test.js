import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { validateGlosorUrl, parseGlosorDocument, formatGlosorPairs } from './glosor.js';
import { parseText } from './parse.js';
import handler from '../../server/glosor.mjs';

const source = 'https://glosor.eu/ovning/example.4624471.html';
const html = `<h1>Exercise &amp; practice</h1><ul id="listOfQuestions">
<li class="list-group-item"><input type="checkbox"><span id="q0ca"><span class="exl-c2">vivir</span> <span class="exl-c2">att leva<span class="exl-com">,</span> att bo</span></span></li>
<li class="list-group-item"><span><span class="exl-c2">adiós &amp; hola</span><span class="exl-c2">hej då &amp; hej</span></span></li>
</ul><script>throw new Error('must not execute');</script>`;

test('accepts only public HTTPS Glosor exercise URLs and canonicalizes www', () => {
  assert.equal(validateGlosorUrl(source), source);
  assert.equal(validateGlosorUrl('https://www.glosor.eu/ovning/example.4624471.html?test=1#x'), source);
  for (const invalid of ['', 'http://glosor.eu/ovning/example.1.html', 'https://glosor.eu.evil.com/ovning/example.1.html',
    'https://evil.com/ovning/example.1.html', 'https://glosor.eu/', 'https://glosor.eu:444/ovning/example.1.html',
    'https://user:password@glosor.eu/ovning/example.1.html', 'https://localhost/ovning/example.1.html']) {
    assert.throws(() => validateGlosorUrl(invalid));
  }
});

test('reads the observed Glosor list structure including nested commas, accents and entities', () => {
  const parsed = parseGlosorDocument(parseHTML(html).document);
  assert.equal(parsed.title, 'Exercise & practice');
  assert.deepEqual(parsed.pairs, [['vivir', 'att leva, att bo'], ['adiós & hola', 'hej då & hej']]);
  for (const column of ['first', 'second']) {
    const formatted = formatGlosorPairs(parsed.pairs, column);
    const roundTrip = parseText(formatted.text, formatted.separator).pairs;
    assert.equal(roundTrip.length, 2);
    assert.equal(roundTrip[0].sv, column === 'second' ? 'att leva, att bo' : 'vivir');
  }
});

test('avoids separator collisions and rejects empty or changed page structures', () => {
  const result = formatGlosorPairs([['a - b', 'c']], 'first');
  assert.equal(result.separator, '\t');
  assert.equal(parseText(result.text, result.separator).pairs[0].sv, 'a - b');
  assert.throws(() => parseGlosorDocument(parseHTML('<h1>Login</h1>').document), /No public word pairs/);
  assert.throws(() => parseGlosorDocument(parseHTML('<ul id="listOfQuestions"><li class="list-group-item"><span class="exl-c2">only one</span></li></ul>').document), /unsupported/);
});

async function request(url, method = 'GET') {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = JSON.parse(body); } };
  await handler({ url, method }, res);
  return res;
}

test('endpoint validates before fetching, returns HTML, and rejects redirects and upstream failures', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, source);
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal);
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    };
    assert.equal((await request('/api/glosor?url=https://evil.com/')).statusCode, 400);
    assert.equal((await request('/api/glosor', 'POST')).statusCode, 405);
    assert.equal(calls, 0);
    const response = await request(`/api/glosor?url=${encodeURIComponent(source)}`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.html, html);
    globalThis.fetch = async () => new Response('no', { status: 404 });
    assert.equal((await request(`/api/glosor?url=${source}`)).statusCode, 502);
    globalThis.fetch = async () => { throw new Error('redirect or timeout'); };
    assert.equal((await request(`/api/glosor?url=${source}`)).statusCode, 502);
    globalThis.fetch = async () => new Response('x'.repeat(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'text/html' } });
    assert.match((await request(`/api/glosor?url=${source}`)).body.error, /too large/);
  } finally { globalThis.fetch = original; }
});
