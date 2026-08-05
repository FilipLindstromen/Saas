/* Simple Leitner-style boxes: box 0 → due tomorrow, box 1 → 3d, box 2 → 7d, box 3 → 16d, box 4+ → 30d */
const BOX_INTERVALS_DAYS = [1, 3, 7, 16, 30]
const DAY_MS = 24 * 60 * 60 * 1000

export function nextDue(box) {
  const idx = Math.min(box, BOX_INTERVALS_DAYS.length - 1)
  return Date.now() + BOX_INTERVALS_DAYS[idx] * DAY_MS
}

/* Build the feed: interleave selected categories, review-due posts first (still interleaved) */
export function buildFeed(allPosts, selectedCats, progress) {
  const pool = allPosts.filter((p) => selectedCats.includes(p.category))
  const now = Date.now()
  const due = []
  const fresh = []
  pool.forEach((p) => {
    const prog = progress[p.id]
    if (!prog) fresh.push(p)
    else if (prog.due <= now) due.push(p)
  })
  const byCat = {}
  ;[...due, ...fresh].forEach((p) => {
    byCat[p.category] = byCat[p.category] || []
    byCat[p.category].push(p)
  })
  const cats = Object.keys(byCat)
  const feed = []
  let remaining = true
  while (remaining) {
    remaining = false
    for (const c of cats) {
      if (byCat[c].length) {
        feed.push(byCat[c].shift())
        remaining = true
      }
    }
  }
  return feed.length ? feed : pool
}
