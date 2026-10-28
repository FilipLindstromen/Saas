// Each line is one Swedish/English pair, e.g. "hus - house" or a full
// sentence pair "jag bor i ett hus - I live in a house". Keeping the pairing
// explicit per line (rather than guessing from a flat word list) is what
// lets a multi-word sentence stay grouped as one learning unit instead of
// being torn apart word-by-word against the next pair.
export function parseText(raw, separator = ' - ') {
  const lines = (raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  const pairs = [];
  let skipped = 0;

  for (const line of lines) {
    const separatorIndex = separator.length ? line.indexOf(separator) : -1;
    if (separatorIndex < 0) {
      skipped++;
      continue;
    }

    const sv = line.slice(0, separatorIndex).trim();
    const en = line.slice(separatorIndex + separator.length).trim();
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

// Lightweight phrase boundaries for Swedish/English, with a three-word cap.
export function chunkWords(words) {
  const chunks = [];
  let current = [];
  const boundary = /^(?:in|on|at|with|from|to|for|under|after|before|i|på|med|från|till|för|efter|före)$/i;
  for (const word of words) {
    if (current.length >= 3 || (current.length >= 2 && boundary.test(word))) {
      chunks.push(current.join(' '));
      current = [];
    }
    current.push(word);
    if (/[,;:.!?]$/.test(word)) {
      chunks.push(current.join(' '));
      current = [];
    }
  }
  if (current.length) chunks.push(current.join(' '));
  return chunks;
}

export function buildTokenStream(pairs, options = {}) {
  const tokens = [];

  pairs.forEach((pair, arrayIndex) => {
    const pairIndex = pair.originalIndex ?? arrayIndex;
    const svUnits = options.repeatPairs ? [pair.sv] : options.phraseChunks ? chunkWords(pair.svWords) : pair.svWords;
    const enUnits = options.repeatPairs ? [pair.en] : options.phraseChunks ? chunkWords(pair.enWords) : pair.enWords;
    const firstLang = options.swedishFirst === false ? 'en' : 'sv';
    const secondLang = firstLang === 'sv' ? 'en' : 'sv';
    const firstUnits = firstLang === 'sv' ? svUnits : enUnits;
    const secondUnits = secondLang === 'sv' ? svUnits : enUnits;
    const totalWords = svUnits.length + enUnits.length + (options.recallGap ? 1 : 0);
    let position = 0;
    let repetition = 0;

    const pushWord = (text, lang) => {
      tokens.push({
        text,
        lang,
        svText: pair.sv,
        pairIndex,
        repetition,
        speedFactor: options.repeatPairs && options.accelerate ? Math.pow(0.9, repetition) : 1,
        isSentence: pair.isSentence,
        wordIndexInPair: position,
        totalWordsInPair: totalWords,
        isPairStart: position === 0,
        isPairEnd: position === totalWords - 1,
        isLangSwitch: lang === secondLang && position === firstUnits.length + (options.recallGap ? 1 : 0),
      });
      position++;
    };

    for (repetition = 0; repetition < (options.repeatPairs ? 10 : 1); repetition++) {
      position = 0;
      firstUnits.forEach(word => pushWord(word, firstLang));
      if (options.recallGap) {
        tokens.push({ type: 'gap', pairIndex, wordIndexInPair: position, durationMs: 600 });
        position++;
      }
      secondUnits.forEach(word => pushWord(word, secondLang));
    }
  });

  return tokens;
}

// For timed training: the same pairs repeating in random order for a fixed
// duration. Builds one long stream up front (reshuffled each lap) instead of
// looping live, so the existing single-pass player never has to know it's
// looping — `minTokens` just needs to comfortably outlast the time budget at
// the fastest possible reading speed.
export function buildTimedTokenStream(pairs, minTokens, options = {}) {
  const tokens = [];
  if (pairs.length === 0) return tokens;

  while (tokens.length < minTokens) {
    tokens.push(...buildTokenStream(shuffleArray(pairs), options));
  }

  return tokens;
}

// Quiz checkpoints follow three complete flash pairs. A final shorter batch
// also gets a question so small lists still exercise both practice modes.
export function buildMixedTokenStream(pairs, minTokens = null, options = {}) {
  if (pairs.length < 2) return [];
  const stream = [];
  let pending = [];
  let flashTokens = 0;
  const addQuestion = () => {
    const pair = pending[Math.floor(Math.random() * pending.length)];
    stream.push({ type: 'quiz', pairIndex: pair.originalIndex ?? pairs.indexOf(pair) });
    pending = [];
  };
  do {
    const lap = minTokens == null ? pairs : shuffleArray(pairs);
    for (const pair of lap) {
      const tokens = buildTokenStream([pair], options);
      stream.push(...tokens);
      flashTokens += tokens.length;
      pending.push(pair);
      if (pending.length === 3) addQuestion();
    }
  } while (minTokens != null && flashTokens < minTokens);
  if (pending.length) addQuestion();
  return stream;
}
