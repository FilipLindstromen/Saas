/** Text layout + motion archetypes (Typo-style slide intent). */

import { applyMotionPresetToSlide } from './motionPresets'

export const TEXT_ARCHETYPE_OPTIONS = [
  {
    id: 'custom',
    label: 'Custom',
    description: 'Use layout and motion settings as configured.',
  },
  {
    id: 'statement',
    label: 'Statement',
    description: 'Few bold words, centered, auto-sized headline, stat motion.',
    apply: {
      layout: 'centered',
      textHeadingLevel: 'h1',
      autoFitHeadline: true,
      textMaxWidth: 88,
      motionPreset: 'stat',
    },
  },
  {
    id: 'explain',
    label: 'Explain',
    description: 'Calm line-by-line reveals with explain motion.',
    apply: {
      lineStepReveal: true,
      motionPreset: 'explain',
    },
  },
  {
    id: 'quote',
    label: 'Quote',
    description: 'Centered, soft fade, delayed subtitle.',
    apply: {
      layout: 'centered',
      textMaxWidth: 72,
      motionPreset: 'quote',
    },
  },
  {
    id: 'stat',
    label: 'Stat / proof',
    description: 'Large number headline with zoom motion.',
    apply: {
      textHeadingLevel: 'h1',
      autoFitHeadline: true,
      motionPreset: 'stat',
    },
  },
]

export function getTextArchetype(id) {
  return TEXT_ARCHETYPE_OPTIONS.find((item) => item.id === id) || TEXT_ARCHETYPE_OPTIONS[0]
}

export function applyTextArchetypeToSlide(slide, archetypeId) {
  if (!archetypeId || archetypeId === 'custom') {
    return { textArchetype: 'custom' }
  }
  const archetype = getTextArchetype(archetypeId)
  const motionFields = archetype.apply?.motionPreset
    ? applyMotionPresetToSlide(slide, archetype.apply.motionPreset)
    : {}
  const { motionPreset, ...restMotion } = motionFields
  return {
    textArchetype: archetype.id,
    ...archetype.apply,
    motionPreset,
    ...restMotion,
  }
}

export function resolveTextArchetypeId(slide) {
  const id = slide?.textArchetype
  if (id && id !== 'custom') return id
  return 'custom'
}
