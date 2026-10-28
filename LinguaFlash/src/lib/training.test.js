import test from 'node:test';
import assert from 'node:assert/strict';
import { parseText, buildTokenStream, buildTimedTokenStream, buildMixedTokenStream, chunkWords } from './parse.js';
import { getDurationMs } from '../hooks/useRSVPPlayer.js';
import { generateWordBasedColors, mutedBackground } from './colors.js';

const { pairs } = parseText('jag går i skolan - I go to school\nhus - house\nbil - car\nhund - dog');

test('custom separators match literally, including spaces, across the full input', () => {
  for (const separator of [' - ', '-', ', ', '|', '.*', '\t']) {
    const result = parseText(`hus${separator}house\nbil${separator}car\ninvalid`, separator);
    assert.deepEqual(result.pairs.map(pair => [pair.sv, pair.en]), [['hus', 'house'], ['bil', 'car']]);
    assert.equal(result.skipped, 1);
  }
  assert.equal(parseText('hus-house').pairs.length, 0);
  assert.equal(parseText('hus,house', ', ').pairs.length, 0);
  assert.equal(parseText('hus - house', '').pairs.length, 0);
  assert.equal(parseText('hus - house - home').pairs[0].en, 'house - home');
  assert.equal(parseText('hus - ').pairs.length, 0);
});

test('all exercise combinations preserve languages, repetitions, and quiz placement', () => {
  for (let mask = 0; mask < 32; mask++) {
    const options = Object.fromEntries(['recallGap', 'phraseChunks', 'repeatPairs', 'accelerate', 'swedishFirst'].map((key, i) => [key, Boolean(mask & (1 << i))]));
    const stream = buildTokenStream(pairs, options);
    for (const pair of pairs) {
      const own = stream.filter(token => token.pairIndex === pair.originalIndex);
      assert.equal(own.filter(token => token.type === 'gap').length, options.recallGap ? options.repeatPairs ? 10 : 1 : 0);
      assert.equal(own.filter(token => token.isPairEnd).length, options.repeatPairs ? 10 : 1);
      if (options.repeatPairs) {
        const ordered = options.swedishFirst ? [pair.sv, pair.en] : [pair.en, pair.sv];
        assert.deepEqual(own.filter(token => token.lang).map(token => token.text), Array.from({ length: 10 }, () => ordered).flat());
      }
    }
    const mixed = buildMixedTokenStream(pairs, null, options);
    assert.equal(mixed.filter(token => token.type === 'quiz').length, 2);
    assert.equal(mixed.findIndex(token => token.type === 'quiz'), buildTokenStream(pairs.slice(0, 3), options).length);
    const timed = buildTimedTokenStream(pairs, 300, options);
    assert.ok(timed.length >= 300);
    assert.ok(timed.every(token => token.pairIndex >= 0 && token.pairIndex < pairs.length));
  }
});

test('Swedish-last puts the recall gap after English and resets ordering for every pair', () => {
  const stream = buildTokenStream(pairs, { swedishFirst: false, recallGap: true, repeatPairs: true });
  for (let i = 0; i < stream.length; i += 3) {
    assert.equal(stream[i].lang, 'en');
    assert.equal(stream[i + 1].type, 'gap');
    assert.equal(stream[i + 2].lang, 'sv');
    assert.equal(stream[i + 2].isLangSwitch, true);
    assert.equal(stream[i + 2].isPairEnd, true);
  }
});

test('recall blanks follow Swedish and precede English without changing their order', () => {
  const stream = buildTokenStream(pairs, { recallGap: true });
  stream.forEach((token, i) => {
    if (token.type !== 'gap') return;
    assert.equal(stream[i - 1].lang, 'sv');
    assert.equal(stream[i + 1].lang, 'en');
    assert.equal(getDurationMs(token, 600), 600);
  });
});

test('acceleration reduces each repeat duration and resets at the next pair', () => {
  const stream = buildTokenStream(pairs, { repeatPairs: true, accelerate: true });
  for (const pair of pairs) {
    const own = stream.filter(token => token.pairIndex === pair.originalIndex && token.lang === 'sv');
    assert.equal(own[0].speedFactor, 1);
    for (let i = 1; i < own.length; i++) assert.ok(getDurationMs(own[i], 300) < getDurationMs(own[i - 1], 300));
  }
  assert.ok(buildTokenStream(pairs, { accelerate: true }).every(token => token.speedFactor === 1));
});

test('phrase chunks retain every word and respect punctuation and size', () => {
  const words = 'I walk in the morning, then I go to school'.split(' ');
  const chunks = chunkWords(words);
  assert.equal(chunks.join(' '), words.join(' '));
  assert.ok(chunks.includes('in the morning,'));
  assert.ok(chunks.every(chunk => chunk.split(' ').length <= 3));
});

test('muted backgrounds stay dark and maintain readable focus-letter contrast', () => {
  const luminance = hex => hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  for (const color of generateWordBasedColors(24)) {
    const bg = mutedBackground(color);
    assert.ok(luminance(bg) < 0.1);
    assert.ok((luminance(color) + 0.05) / (luminance(bg) + 0.05) >= 4.5);
  }
});
