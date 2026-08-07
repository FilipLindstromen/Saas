export const LAYER_BLEND_MODES = [
  { id: 'normal', label: 'Normal' },
  { id: 'multiply', label: 'Multiply' },
  { id: 'screen', label: 'Screen' },
  { id: 'overlay', label: 'Overlay' },
]

const COMPOSITE_BY_BLEND = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
}

export function normalizeBlendMode(id) {
  return COMPOSITE_BY_BLEND[id] ? id : 'normal'
}

export function blendModeToCompositeOperation(blendMode) {
  return COMPOSITE_BY_BLEND[normalizeBlendMode(blendMode)] || 'source-over'
}
