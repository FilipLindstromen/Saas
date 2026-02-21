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
    elements: () => {
      _nextId = 1
      return [
        makeEl('image-text', { x: 80, y: 150, width: 180, height: 140, text: 'Step 1', zIndex: 0 }),
        makeEl('image-text', { x: 310, y: 150, width: 180, height: 140, text: 'Step 2', zIndex: 1 }),
        makeEl('image-text', { x: 540, y: 150, width: 180, height: 140, text: 'Step 3', zIndex: 2 })
      ]
    }
  },
  {
    id: '5-step-v',
    name: '5-Step Vertical',
    elements: () => {
      _nextId = 1
      return [
        makeEl('image-text', { x: 80, y: 50, width: 200, height: 70, text: 'Step 1', zIndex: 0 }),
        makeEl('image-text', { x: 80, y: 130, width: 200, height: 70, text: 'Step 2', zIndex: 1 }),
        makeEl('image-text', { x: 80, y: 210, width: 200, height: 70, text: 'Step 3', zIndex: 2 }),
        makeEl('image-text', { x: 80, y: 290, width: 200, height: 70, text: 'Step 4', zIndex: 3 }),
        makeEl('image-text', { x: 80, y: 370, width: 200, height: 70, text: 'Step 5', zIndex: 4 })
      ]
    }
  },
  {
    id: 'hero',
    name: 'Hero',
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
    elements: () => {
      _nextId = 1
      return [
        makeEl('image-text', { x: 50, y: 50, width: 340, height: 170, text: 'Item 1', zIndex: 0 }),
        makeEl('image-text', { x: 410, y: 50, width: 340, height: 170, text: 'Item 2', zIndex: 1 }),
        makeEl('image-text', { x: 50, y: 230, width: 340, height: 170, text: 'Item 3', zIndex: 2 }),
        makeEl('image-text', { x: 410, y: 230, width: 340, height: 170, text: 'Item 4', zIndex: 3 })
      ]
    }
  },
  {
    id: '3-step-arrows',
    name: '3-Step with Arrows',
    elements: () => {
      _nextId = 1
      return [
        makeEl('image-text', { x: 50, y: 150, width: 150, height: 140, text: 'Step 1', zIndex: 0 }),
        makeEl('arrow', { x: 210, y: 200, width: 80, height: 50, arrowDirection: 'right', zIndex: 1 }),
        makeEl('image-text', { x: 310, y: 150, width: 150, height: 140, text: 'Step 2', zIndex: 2 }),
        makeEl('arrow', { x: 470, y: 200, width: 80, height: 50, arrowDirection: 'right', zIndex: 3 }),
        makeEl('image-text', { x: 570, y: 150, width: 150, height: 140, text: 'Step 3', zIndex: 4 })
      ]
    }
  },
  {
    id: 'title-3',
    name: 'Title + 3 Items',
    elements: () => {
      _nextId = 1
      return [
        makeEl('headline', { x: 150, y: 30, width: 500, height: 50, text: 'Section Title', zIndex: 0 }),
        makeEl('image-text', { x: 50, y: 100, width: 220, height: 300, text: 'Item 1', zIndex: 1 }),
        makeEl('image-text', { x: 290, y: 100, width: 220, height: 300, text: 'Item 2', zIndex: 2 }),
        makeEl('image-text', { x: 530, y: 100, width: 220, height: 300, text: 'Item 3', zIndex: 3 })
      ]
    }
  },
  {
    id: '6-grid',
    name: '6-Item Grid',
    elements: () => {
      _nextId = 1
      return [
        makeEl('image-text', { x: 30, y: 30, width: 235, height: 125, text: '1', zIndex: 0 }),
        makeEl('image-text', { x: 277, y: 30, width: 235, height: 125, text: '2', zIndex: 1 }),
        makeEl('image-text', { x: 524, y: 30, width: 235, height: 125, text: '3', zIndex: 2 }),
        makeEl('image-text', { x: 30, y: 167, width: 235, height: 125, text: '4', zIndex: 3 }),
        makeEl('image-text', { x: 277, y: 167, width: 235, height: 125, text: '5', zIndex: 4 }),
        makeEl('image-text', { x: 524, y: 167, width: 235, height: 125, text: '6', zIndex: 5 })
      ]
    }
  },
  {
    id: 'single-focus',
    name: 'Single Focus',
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
