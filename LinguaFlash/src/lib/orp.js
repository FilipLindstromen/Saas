// Optimal Recognition Point: the letter a reader's eye naturally fixates on.
// Keeping this one letter pinned to a fixed screen position (see WordDisplay)
// is what makes RSVP reading fast — the eye never has to move.
export function getOrpIndex(word) {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

export function splitAtOrp(word) {
  const idx = getOrpIndex(word);
  return {
    pre: word.slice(0, idx),
    focus: word.slice(idx, idx + 1),
    post: word.slice(idx + 1),
  };
}
