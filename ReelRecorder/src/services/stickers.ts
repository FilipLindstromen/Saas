/**
 * Sticker definitions for timeline clips. Uses Twemoji (Twitter emoji) as stickers.
 * Codepoints in hex; CDN: jsDelivr.
 */
const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72'

function twemojiUrl(codepoint: string): string {
  return `${TWEMOJI_BASE}/${codepoint}.png`
}

export interface StickerDef {
  id: string
  name: string
  url: string
}

export const STICKERS: StickerDef[] = [
  { id: '1f600', name: 'Grinning', url: twemojiUrl('1f600') },
  { id: '1f603', name: 'Smiley', url: twemojiUrl('1f603') },
  { id: '1f604', name: 'Smile', url: twemojiUrl('1f604') },
  { id: '1f389', name: 'Party', url: twemojiUrl('1f389') },
  { id: '2764', name: 'Heart', url: twemojiUrl('2764-fe0f') },
  { id: '1f4af', name: '100', url: twemojiUrl('1f4af') },
  { id: '1f4fa', name: 'TV', url: twemojiUrl('1f4fa') },
  { id: '1f3af', name: 'Target', url: twemojiUrl('1f3af') },
  { id: '1f4a1', name: 'Idea', url: twemojiUrl('1f4a1') },
  { id: '2705', name: 'Check', url: twemojiUrl('2705') },
  { id: '26a1', name: 'Zap', url: twemojiUrl('26a1') },
  { id: '1f4ca', name: 'Chart', url: twemojiUrl('1f4ca') },
  { id: '1f3c6', name: 'Trophy', url: twemojiUrl('1f3c6') },
  { id: '1f4aa', name: 'Muscle', url: twemojiUrl('1f4aa') },
  { id: '1f31f', name: 'Star', url: twemojiUrl('1f31f') },
]

export function fetchStickerAsDataUrl(url: string): Promise<string> {
  return fetch(url, { mode: 'cors' })
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Failed to read sticker image'))
          reader.readAsDataURL(blob)
        })
    )
}
