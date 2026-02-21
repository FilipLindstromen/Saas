/**
 * 10 layout presets. Positions are for 800x450 (16:9) canvas.
 * Applied layouts replace current elements.
 */
let _nextId = 1
function makeEl(type, overrides) {
  const base = {
    id: _nextId++,
    type,
    x: 100,
    y: 100,
    width: type === 'headline' ? 300 : type === 'cta' ? 180 : type === 'image' ? 80 : 200,
    height: type === 'headline' ? 60 : type === 'cta' ? 48 : type === 'image' ? 80 : 120,
    rotation: 0,
    text: type === 'headline' ? 'Headline' : type === 'cta' ? 'Click Here' : '',
    imageUrl: (type === 'image-text' || type === 'image') ? '' : null,
    imageSource: null,
    imageTint: null,
    imageTintOpacity: 100,
    fontSize: type === 'headline' ? 24 : type === 'cta' ? 16 : 14,
    fontFamily: 'Inter',
    color: '#000000',
    backgroundColor: type === 'cta' ? '#3b82f6' : null,
    arrowDirection: type === 'arrow' ? 'right' : null,
    arrowStyle: type === 'arrow' ? 'simple' : null,
    zIndex: 0,
    visible: true
  }
  return { ...base, ...overrides }
}

export const LAYOUTS = [
  {
    id: '3-step-h',
    name: '3-Step Horizontal',
    description: 'Three steps in a row with arrows',
    elements: () => {
      _nextId = 1
      return [
        makeEl('image-text', { x: 50, y: 150, width: 180, height: 140, text: 'Step 1\nBrief description of the first step.', zIndex: 0 }),
        makeEl('arrow', { x: 240, y: 200, width: 70, height: 50, arrowDirection: 'right', zIndex: 1 }),
        makeEl('image-text', { x: 330, y: 150, width: 180, height: 140, text: 'Step 2\nBrief description of the second step.', zIndex: 2 }),
        makeEl('arrow', { x: 520, y: 200, width: 70, height: 50, arrowDirection: 'right', zIndex: 3 }),
        makeEl('image-text', { x: 610, y: 150, width: 140, height: 140, text: 'Step 3\nBrief description of the third step.', zIndex: 4 })
      ]
    }
  },
  {
    id: '5-step-v',
    name: '5-Step Vertical',
    description: 'Five steps stacked with arrows',
    elements: () => {
      _nextId = 1
      return [
        makeEl('image-text', { x: 80, y: 30, width: 280, height: 60, text: '01. Step 1\nBrief description of the first step.', zIndex: 0 }),
        makeEl('arrow', { x: 200, y: 100, width: 40, height: 30, arrowDirection: 'down', zIndex: 1 }),
        makeEl('image-text', { x: 80, y: 115, width: 280, height: 60, text: '02. Step 2\nBrief description of the second step.', zIndex: 2 }),
        makeEl('arrow', { x: 200, y: 185, width: 40, height: 30, arrowDirection: 'down', zIndex: 3 }),
        makeEl('image-text', { x: 80, y: 200, width: 280, height: 60, text: '03. Step 3\nBrief description of the third step.', zIndex: 4 }),
        makeEl('arrow', { x: 200, y: 270, width: 40, height: 30, arrowDirection: 'down', zIndex: 5 }),
        makeEl('image-text', { x: 80, y: 285, width: 280, height: 60, text: '04. Step 4\nBrief description of the fourth step.', zIndex: 6 }),
        makeEl('arrow', { x: 200, y: 355, width: 40, height: 30, arrowDirection: 'down', zIndex: 7 }),
        makeEl('image-text', { x: 80, y: 370, width: 280, height: 60, text: '05. Step 5\nBrief description of the fifth step.', zIndex: 8 })
      ]
    }
  },
  {
    id: 'hero',
    name: 'Hero',
    description: 'Headline, image, and CTA',
    elements: () => {
      _nextId = 1
      return [
        makeEl('headline', { x: 150, y: 80, width: 500, height: 60, text: 'Your Headline Here', fontSize: 32, zIndex: 0 }),
        makeEl('image', { x: 300, y: 160, width: 200, height: 200, zIndex: 1 }),
        makeEl('cta', { x: 310, y: 380, width: 180, height: 48, text: 'Get Started', zIndex: 2 })
      ]
    }
  },
  {
    id: '2-col',
    name: '2-Column',
    description: 'Title with two content columns',
    elements: () => {
      _nextId = 1
      return [
        makeEl('headline', { x: 150, y: 40, width: 500, height: 50, text: 'Title', zIndex: 0 }),
        makeEl('image-text', { x: 80, y: 110, width: 300, height: 280, text: 'Left column content', zIndex: 1 }),
        makeEl('image-text', { x: 420, y: 110, width: 300, height: 280, text: 'Right column content', zIndex: 2 })
      ]
    }
  },
  {
    id: '4-grid',
    name: '4-Grid',
    description: 'Four items with connecting arrows',
    elements: () => {
      _nextId = 1
      return [
        makeEl('image-text', { x: 50, y: 50, width: 320, height: 160, text: '01. Item 1\nBrief description of the first item.', zIndex: 0 }),
        makeEl('arrow', { x: 385, y: 115, width: 45, height: 40, arrowDirection: 'right', zIndex: 1 }),
        makeEl('image-text', { x: 405, y: 50, width: 320, height: 160, text: '02. Item 2\nBrief description of the second item.', zIndex: 2 }),
        makeEl('arrow', { x: 400, y: 225, width: 40, height: 25, arrowDirection: 'down', zIndex: 3 }),
        makeEl('image-text', { x: 50, y: 235, width: 320, height: 160, text: '03. Item 3\nBrief description of the third item.', zIndex: 4 }),
        makeEl('arrow', { x: 385, y: 315, width: 45, height: 40, arrowDirection: 'right', zIndex: 5 }),
        makeEl('image-text', { x: 405, y: 235, width: 320, height: 160, text: '04. Item 4\nBrief description of the fourth item.', zIndex: 6 })
      ]
    }
  },
  {
    id: '3-step-arrows',
    name: '3-Step with Arrows',
    description: 'Three steps connected by arrows',
    elements: () => {
      _nextId = 1
      return [
        makeEl('image-text', { x: 50, y: 150, width: 150, height: 140, text: 'Step 1\nBrief description.', zIndex: 0 }),
        makeEl('arrow', { x: 210, y: 200, width: 80, height: 50, arrowDirection: 'right', zIndex: 1 }),
        makeEl('image-text', { x: 310, y: 150, width: 150, height: 140, text: 'Step 2\nBrief description.', zIndex: 2 }),
        makeEl('arrow', { x: 470, y: 200, width: 80, height: 50, arrowDirection: 'right', zIndex: 3 }),
        makeEl('image-text', { x: 570, y: 150, width: 150, height: 140, text: 'Step 3\nBrief description.', zIndex: 4 })
      ]
    }
  },
  {
    id: 'title-3',
    name: 'Title + 3 Items',
    description: 'Section title with three items and arrows',
    elements: () => {
      _nextId = 1
      return [
        makeEl('headline', { x: 150, y: 30, width: 500, height: 50, text: 'Section Title', zIndex: 0 }),
        makeEl('image-text', { x: 50, y: 100, width: 200, height: 300, text: '01. Item 1\nBrief description of the first item.', zIndex: 1 }),
        makeEl('arrow', { x: 265, y: 230, width: 35, height: 40, arrowDirection: 'right', zIndex: 2 }),
        makeEl('image-text', { x: 305, y: 100, width: 200, height: 300, text: '02. Item 2\nBrief description of the second item.', zIndex: 3 }),
        makeEl('arrow', { x: 520, y: 230, width: 35, height: 40, arrowDirection: 'right', zIndex: 4 }),
        makeEl('image-text', { x: 560, y: 100, width: 200, height: 300, text: '03. Item 3\nBrief description of the third item.', zIndex: 5 })
      ]
    }
  },
  {
    id: '6-grid',
    name: '6-Item Grid',
    description: 'Six items in a grid with flow arrows',
    elements: () => {
      _nextId = 1
      return [
        makeEl('image-text', { x: 30, y: 30, width: 220, height: 115, text: '01. Item 1', zIndex: 0 }),
        makeEl('arrow', { x: 265, y: 72, width: 25, height: 30, arrowDirection: 'right', zIndex: 1 }),
        makeEl('image-text', { x: 277, y: 30, width: 220, height: 115, text: '02. Item 2', zIndex: 2 }),
        makeEl('arrow', { x: 512, y: 72, width: 25, height: 30, arrowDirection: 'right', zIndex: 3 }),
        makeEl('image-text', { x: 524, y: 30, width: 220, height: 115, text: '03. Item 3', zIndex: 4 }),
        makeEl('arrow', { x: 147, y: 157, width: 25, height: 25, arrowDirection: 'down', zIndex: 5 }),
        makeEl('arrow', { x: 394, y: 157, width: 25, height: 25, arrowDirection: 'down', zIndex: 6 }),
        makeEl('arrow', { x: 641, y: 157, width: 25, height: 25, arrowDirection: 'down', zIndex: 7 }),
        makeEl('image-text', { x: 30, y: 167, width: 220, height: 115, text: '04. Item 4', zIndex: 8 }),
        makeEl('arrow', { x: 265, y: 209, width: 25, height: 30, arrowDirection: 'right', zIndex: 9 }),
        makeEl('image-text', { x: 277, y: 167, width: 220, height: 115, text: '05. Item 5', zIndex: 10 }),
        makeEl('arrow', { x: 512, y: 209, width: 25, height: 30, arrowDirection: 'right', zIndex: 11 }),
        makeEl('image-text', { x: 524, y: 167, width: 220, height: 115, text: '06. Item 6', zIndex: 12 })
      ]
    }
  },
  {
    id: 'single-focus',
    name: 'Single Focus',
    description: 'Headline, main image, and CTA',
    elements: () => {
      _nextId = 1
      return [
        makeEl('headline', { x: 100, y: 40, width: 600, height: 50, text: 'Main Headline', fontSize: 28, zIndex: 0 }),
        makeEl('image', { x: 250, y: 110, width: 300, height: 250, zIndex: 1 }),
        makeEl('cta', { x: 310, y: 380, width: 180, height: 48, text: 'Learn More', zIndex: 2 })
      ]
    }
  },
  {
    id: 'before-after',
    name: 'Before / After',
    description: 'Two states with arrow between',
    elements: () => {
      _nextId = 1
      return [
        makeEl('image-text', { x: 80, y: 120, width: 250, height: 200, text: 'Before', zIndex: 0 }),
        makeEl('arrow', { x: 355, y: 195, width: 90, height: 60, arrowDirection: 'right', zIndex: 1 }),
        makeEl('image-text', { x: 470, y: 120, width: 250, height: 200, text: 'After', zIndex: 2 })
      ]
    }
  }
]

export function applyLayout(layoutId, maxId = 0) {
  const layout = LAYOUTS.find(l => l.id === layoutId)
  if (!layout) return []
  _nextId = maxId + 1
  return layout.elements()
}

/** Number of content slots (image-text, image) for AI generation */
export function getLayoutSlotCount(layoutId, customElements) {
  if (customElements && Array.isArray(customElements)) {
    return customElements.filter(e => e.type === 'image-text' || e.type === 'image').length
  }
  const layout = LAYOUTS.find(l => l.id === layoutId)
  if (!layout) return 5
  const elts = layout.elements()
  return elts.filter(e => e.type === 'image-text' || e.type === 'image').length
}

/** Apply layout and merge generated steps into content slots */
export function applyLayoutWithContent(layoutId, steps = [], maxId = 0, customElements) {
  let raw
  if (customElements && Array.isArray(customElements)) {
    raw = customElements.map((e, i) => ({ ...e, id: maxId + 1 + i, zIndex: e.zIndex ?? i }))
  } else {
    raw = applyLayout(layoutId, maxId)
  }
  const contentSlots = raw
    .filter(e => e.type === 'image-text' || e.type === 'image')
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  return raw.map((e) => {
    if (e.type === 'image-text' || e.type === 'image') {
      const idx = contentSlots.findIndex(s => s === e)
      const step = steps[idx]
      if (step) {
        return {
          ...e,
          text: step.text || e.text,
          imageUrl: step.imageUrl || e.imageUrl || '',
          imageSource: step.imageSource || e.imageSource
        }
      }
    }
    if (e.type === 'headline' && steps[0]) {
      return { ...e, text: steps[0].text || e.text }
    }
    if (e.type === 'cta' && steps.length > 0) {
      return { ...e, text: steps[steps.length - 1].text || e.text }
    }
    return e
  })
}
