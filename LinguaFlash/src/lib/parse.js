// Each line is one Swedish/English pair, e.g. "hus - house" or a full
// sentence pair "jag bor i ett hus - I live in a house". Keeping the pairing
// explicit per line (rather than guessing from a flat word list) is what
// lets a multi-word sentence stay grouped as one learning unit instead of
// being torn apart word-by-word against the next pair.
const SEPARATOR_REGEX = /\t| - | – | — |\|/;

export function parseText(raw) {
  const lines = (raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  const pairs = [];
  let skipped = 0;

  for (const line of lines) {
    const match = line.match(SEPARATOR_REGEX);
    if (!match) {
      skipped++;
      continue;
    }

    const sv = line.slice(0, match.index).trim();
    const en = line.slice(match.index + match[0].length).trim();
    if (!sv || !en) {
      skipped++;
      continue;
    }

    const svWords = sv.split(/\s+/);
    const enWords = en.split(/\s+/);

    pairs.push({
      sv,
      en,
      svWords,
      enWords,
      isSentence: svWords.length > 1 || enWords.length > 1,
      // Stable identity independent of any later shuffling (timed training),
      // so a given pair always keeps the same assigned color.
      originalIndex: pairs.length,
    });
  }

  return { pairs, skipped };
}

export function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildTokenStream(pairs) {
  const tokens = [];

  pairs.forEach((pair, arrayIndex) => {
    const pairIndex = pair.originalIndex ?? arrayIndex;
    const totalWords = pair.svWords.length + pair.enWords.length;
    let position = 0;

    const pushWord = (text, lang) => {
      tokens.push({
        text,
        lang,
        svText: pair.sv,
        pairIndex,
        isSentence: pair.isSentence,
        wordIndexInPair: position,
        totalWordsInPair: totalWords,
        isPairStart: position === 0,
        isPairEnd: position === totalWords - 1,
        isLangSwitch: lang === 'en' && position === pair.svWords.length,
      });
      position++;
    };

    pair.svWords.forEach((word) => pushWord(word, 'sv'));
    pair.enWords.forEach((word) => pushWord(word, 'en'));
  });

  return tokens;
}

// For timed training: the same pairs repeating in random order for a fixed
// duration. Builds one long stream up front (reshuffled each lap) instead of
// looping live, so the existing single-pass player never has to know it's
// looping — `minTokens` just needs to comfortably outlast the time budget at
// the fastest possible reading speed.
export function buildTimedTokenStream(pairs, minTokens) {
  const tokens = [];
  if (pairs.length === 0) return tokens;

  while (tokens.length < minTokens) {
    tokens.push(...buildTokenStream(shuffleArray(pairs)));
  }

  return tokens;
}
