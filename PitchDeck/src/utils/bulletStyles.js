export const BULLET_STYLE_OPTIONS = [
  { id: 'dot', label: 'Dot (•)' },
  { id: 'dash', label: 'Dash (–)' },
  { id: 'arrow', label: 'Arrow (→)' },
  { id: 'check', label: 'Check (✓)' },
  { id: 'square', label: 'Square (■)' },
  { id: 'number', label: 'Numbered (1. 2. 3.)' },
]

export function prepareBulletLayoutContent(content) {
  const plain = (content || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()

  const lines = plain
    ? plain.split(/\n+/).map((line) => line.replace(/^[-•*→✓]\s*/, '').trim()).filter(Boolean)
    : []

  if (lines.length >= 2) return lines.join('\n')
  if (lines.length === 1) return `${lines[0]}\nAdd another point\nAdd another point`
  return 'First point\nSecond point\nThird point'
}
