/**
 * Built-in curated icon set. No API key or network request required — each icon is
 * an SVG path drawn at insert-time in the currently selected pen color, then rasterized
 * as a data URL so it can be stamped onto the canvas like any other image.
 * Paths use a 24x24 viewBox (stroke-based, matches the rest of the app's icon style).
 */
export const ICONS = [
  { id: 'star', name: 'Star', path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  { id: 'heart', name: 'Heart', path: 'M12 21s-6.7-4.35-9.3-8.2C1 10.1 1.6 6.6 4.6 5c2.2-1.2 4.7-.4 6 1.4l1.4 1.9 1.4-1.9c1.3-1.8 3.8-2.6 6-1.4 3 1.6 3.6 5.1 1.9 7.8C18.7 16.65 12 21 12 21z' },
  { id: 'sun', name: 'Sun', path: 'M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1' },
  { id: 'moon', name: 'Moon', path: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z' },
  { id: 'cloud', name: 'Cloud', path: 'M6.5 19a4.5 4.5 0 010-9 6 6 0 0111.6-1.8A4 4 0 0118 19H6.5z' },
  { id: 'bolt', name: 'Bolt', path: 'M13 2L3 14h7l-1 8 11-14h-8l1-6z' },
  { id: 'arrow-right', name: 'Arrow Right', path: 'M4 12h16M13 5l7 7-7 7' },
  { id: 'arrow-left', name: 'Arrow Left', path: 'M20 12H4M11 5l-7 7 7 7' },
  { id: 'arrow-up', name: 'Arrow Up', path: 'M12 20V4M5 11l7-7 7 7' },
  { id: 'arrow-down', name: 'Arrow Down', path: 'M12 4v16M19 13l-7 7-7-7' },
  { id: 'check', name: 'Check', path: 'M20 6L9 17l-5-5' },
  { id: 'x', name: 'X', path: 'M18 6L6 18M6 6l12 12' },
  { id: 'plus', name: 'Plus', path: 'M12 5v14M5 12h14' },
  { id: 'home', name: 'Home', path: 'M3 11l9-8 9 8M5 10v10h14V10M9 20v-6h6v6' },
  { id: 'house-heart', name: 'House Heart', path: 'M3 11l9-8 9 8M5 10v10h14V10M12 17s-2.5-1.6-2.5-3.4c0-1 .8-1.8 1.7-1.8.6 0 1.1.3 1.4.8.3-.5.8-.8 1.4-.8.9 0 1.7.8 1.7 1.8 0 1.8-3.7 3.4-3.7 3.4z' },
  { id: 'user', name: 'User', path: 'M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7' },
  { id: 'users', name: 'Users', path: 'M9 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 21c0-3.5 3-6 7-6s7 2.5 7 6M17 8a3 3 0 110-6M22 21c0-3-2-5.2-5-5.8' },
  { id: 'gear', name: 'Gear', path: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 15a1.65 1.65 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.65 1.65 0 00-1.8-.3 1.65 1.65 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.65 1.65 0 00-1-1.5 1.65 1.65 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.65 1.65 0 00.3-1.8 1.65 1.65 0 00-1.5-1H3a2 2 0 110-4h.1A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.65 1.65 0 001.8.3H9a1.65 1.65 0 001-1.5V3a2 2 0 114 0v.1a1.65 1.65 0 001 1.5 1.65 1.65 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.65 1.65 0 00-.3 1.8V9c.4.5 1 .8 1.5 1H21a2 2 0 110 4h-.1a1.65 1.65 0 00-1.5 1z' },
  { id: 'lightbulb', name: 'Idea', path: 'M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.5.4.8 1 .8 1.6V17h5.4v-1.5c0-.6.3-1.2.8-1.6A6 6 0 0012 3z' },
  { id: 'star-outline-circle', name: 'Rating', path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  { id: 'flag', name: 'Flag', path: 'M5 21V4M5 4h14l-3 4 3 4H5' },
  { id: 'pin', name: 'Pin', path: 'M12 21s7-6.1 7-11.5a7 7 0 10-14 0C5 14.9 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z' },
  { id: 'clock', name: 'Clock', path: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3.5 2' },
  { id: 'calendar', name: 'Calendar', path: 'M3 10h18M8 2v4M16 2v4M4 6h16v14H4V6z' },
  { id: 'mail', name: 'Mail', path: 'M3 6h18v12H3V6zM3 6l9 7 9-7' },
  { id: 'chat', name: 'Chat', path: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z' },
  { id: 'phone', name: 'Phone', path: 'M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .3 2 .7 3a2 2 0 01-.4 2.1L8 10.3a16 16 0 006 6l1.5-1.4a2 2 0 012.1-.4c1 .4 2 .6 3 .7a2 2 0 011.7 2z' },
  { id: 'camera', name: 'Camera', path: 'M4 8h3l2-3h6l2 3h3v12H4V8zM12 17a4 4 0 100-8 4 4 0 000 8z' },
  { id: 'music', name: 'Music', path: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'globe', name: 'Globe', path: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3a13 13 0 010 18M12 3a13 13 0 000 18' },
  { id: 'shield', name: 'Shield', path: 'M12 2l8 3v6c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V5l8-3z' },
  { id: 'gift', name: 'Gift', path: 'M3 9h18v11H3V9zM2 6h20v3H2V6zM12 6v14M12 6C10 3 6 3 6 6s3.5 0 6 0zM12 6c2-3 6-3 6 0s-3.5 0-6 0z' },
  { id: 'trophy', name: 'Trophy', path: 'M8 4h8v5a4 4 0 01-8 0V4zM8 5H4v2a4 4 0 004 4M16 5h4v2a4 4 0 01-4 4M12 13v4M9 21h6M9.5 17h5l.5 4h-6l.5-4z' },
  { id: 'target', name: 'Target', path: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 13a1 1 0 100-2 1 1 0 000 2z' },
  { id: 'rocket', name: 'Rocket', path: 'M14.5 2.5c3 1 5 3 6 6-3.5 0-6.5.5-9 3-1.5 1.5-2.5 3.5-3 5.5l-2.5-2.5c.6-2.3 1.9-4.7 3.7-6.5 2.5-2.5 5.5-4.5 4.8-5.5zM9.5 14.5L4 20l5.5-1.5' },
  { id: 'leaf', name: 'Leaf', path: 'M5 19c8 1 14-5 14-14C10 5 4 11 5 19z' },
  { id: 'tree', name: 'Tree', path: 'M12 2l5 7h-3l4 6h-4v7h-4v-7H6l4-6H7l5-7z' },
  { id: 'umbrella', name: 'Umbrella', path: 'M3 12a9 9 0 0118 0H3zM12 12v7a2 2 0 01-4 0M12 3v2' },
  { id: 'car', name: 'Car', path: 'M3 13l2-6h14l2 6M3 13v5h2m14-5v5h-2M5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM19 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM3 13h18' },
  { id: 'plane', name: 'Plane', path: 'M2 16l20-8-8 20-3-8-9-4z' },
  { id: 'anchor', name: 'Anchor', path: 'M12 6a2 2 0 100-4 2 2 0 000 4zM12 6v16M5 12H2a10 10 0 0020 0h-3M5 12a7 7 0 0014 0' },
  { id: 'coffee', name: 'Coffee', path: 'M4 8h13v6a5 5 0 01-5 5H9a5 5 0 01-5-5V8zM17 9h1.5a2.5 2.5 0 010 5H17M6 3.5c0 1-1 1-1 2M9.5 3.5c0 1-1 1-1 2' },
  { id: 'paw', name: 'Paw', path: 'M8 9a1.6 1.6 0 100-3.2A1.6 1.6 0 008 9zM13 6.5a1.6 1.6 0 103.2 0 1.6 1.6 0 00-3.2 0zM5 12.5a1.6 1.6 0 103.2 0 1.6 1.6 0 00-3.2 0zM16 12.5a1.6 1.6 0 103.2 0 1.6 1.6 0 00-3.2 0zM12 12c-2.8 0-5 1.8-5 4.2 0 1.6 1.3 2.8 2.9 2.8.9 0 1.4-.3 2.1-.3s1.2.3 2.1.3c1.6 0 2.9-1.2 2.9-2.8 0-2.4-2.2-4.2-5-4.2z' },
  { id: 'question', name: 'Question', path: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9a2.5 2.5 0 015 0c0 1.5-2 2-2.5 3M12 16.5v.1' },
  { id: 'exclaim', name: 'Exclaim', path: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v5M12 16.5v.1' },
  { id: 'infinity', name: 'Infinity', path: 'M6.5 8.5a3.5 3.5 0 100 7c2 0 3.5-1.7 5.5-3.5s3.5-3.5 5.5-3.5a3.5 3.5 0 110 7c-2 0-3.5-1.7-5.5-3.5s-3.5-3.5-5.5-3.5z' },
]

/** Build a data URL of an icon rendered at `size`px in `color`. Same-origin, so it never taints the canvas. */
export function iconToDataUrl(icon, color = '#1a1a1a', size = 128) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><path d="${icon.path}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
