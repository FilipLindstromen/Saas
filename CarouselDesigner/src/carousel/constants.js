export const CAROUSEL_ROLES = [
  { id: 'hook', label: 'Hook', color: '#ff6b35', description: 'Stop the scroll — bold opener' },
  { id: 'value', label: 'Value', color: '#4dabf7', description: 'Core insight or tip' },
  { id: 'proof', label: 'Proof', color: '#51cf66', description: 'Social proof, stats, example' },
  { id: 'story', label: 'Story', color: '#cc5de8', description: 'Narrative beat or case study' },
  { id: 'tip', label: 'Tip', color: '#ffd43b', description: 'Actionable takeaway' },
  { id: 'cta', label: 'CTA', color: '#ff8787', description: 'Clear next step' },
  { id: 'transition', label: 'Bridge', color: '#868e96', description: 'Connects ideas between slides' },
]

export const CAROUSEL_LIMITS = {
  headlineWords: 12,
  headlineChars: 80,
  bodyWords: 35,
  bodyChars: 180,
  slideCopyWords: 45,
  slideCopyChars: 260,
  captionChars: 2200,
}

export const CAROUSEL_STYLE_PRESETS = [
  {
    id: 'bold-dark',
    name: 'Bold dark',
    settings: {
      backgroundColor: '#0a0a0a',
      textColor: '#ffffff',
      textDropShadow: true,
      shadowBlur: 12,
      shadowOffsetY: 2,
      defaultFontWeight: 700,
      contentVerticalAlign: 'bottom',
    },
    slideOverrides: { backgroundOpacity: 0.55, gradientStrength: 0.75 },
  },
  {
    id: 'clean-light',
    name: 'Clean light',
    settings: {
      backgroundColor: '#f8f9fa',
      textColor: '#212529',
      textDropShadow: false,
      defaultFontWeight: 700,
      contentVerticalAlign: 'bottom',
    },
    slideOverrides: { backgroundOpacity: 0.35, gradientStrength: 0.5 },
  },
  {
    id: 'gradient-pop',
    name: 'Gradient pop',
    settings: {
      backgroundColor: '#1a1a2e',
      textColor: '#ffffff',
      textDropShadow: true,
      shadowBlur: 8,
      inlineBgColor: '#ff6b35',
      textInlineBackground: true,
      inlineBgOpacity: 0.85,
      defaultFontWeight: 800,
    },
    slideOverrides: { backgroundOpacity: 0.65, gradientStrength: 0.85 },
  },
  {
    id: 'minimal-type',
    name: 'Minimal type',
    settings: {
      backgroundColor: '#111111',
      textColor: '#fafafa',
      textDropShadow: false,
      defaultFontWeight: 600,
      h1Size: 4.2,
      contentVerticalAlign: 'center',
    },
    slideOverrides: { backgroundOpacity: 0.2, gradientStrength: 0.4, imageScale: 1.05 },
  },
]

export const CAROUSEL_TEMPLATES = {
  hookTipsCta: {
    name: 'Hook → Tips → CTA',
    description: 'Classic educational carousel',
    slideCount: 6,
    roles: ['hook', 'tip', 'tip', 'tip', 'proof', 'cta'],
    promptHint: 'Open with a scroll-stopping hook, deliver 3 numbered tips, add proof, end with CTA.',
  },
  problemAgitateSolution: {
    name: 'Problem → Agitate → Solution',
    description: 'PAS framework for ads',
    slideCount: 5,
    roles: ['hook', 'value', 'value', 'proof', 'cta'],
    promptHint: 'Name the problem, agitate consequences, present solution with proof, strong CTA.',
  },
  mythTruth: {
    name: 'Myth vs Truth',
    description: 'Debunk misconceptions',
    slideCount: 7,
    roles: ['hook', 'value', 'value', 'value', 'proof', 'tip', 'cta'],
    promptHint: 'Hook with a provocative myth. Flip 3 myths. Proof slide. Actionable tip. CTA.',
  },
  beforeAfter: {
    name: 'Before / After',
    description: 'Transformation story',
    slideCount: 5,
    roles: ['hook', 'story', 'value', 'proof', 'cta'],
    promptHint: 'Contrast before vs after states. One insight per slide. End with transformation CTA.',
  },
  listicle5: {
    name: '5 Things You Need',
    description: 'Listicle format',
    slideCount: 7,
    roles: ['hook', 'tip', 'tip', 'tip', 'tip', 'tip', 'cta'],
    promptHint: 'Numbered list carousel. Each slide = one item. Save last slide for CTA.',
  },
  storyArc: {
    name: 'Story arc',
    description: 'Narrative-driven carousel',
    slideCount: 6,
    roles: ['hook', 'story', 'value', 'proof', 'tip', 'cta'],
    promptHint: 'Tell a mini story across slides with emotional hook and practical payoff.',
  },
}

export function getRoleMeta(roleId) {
  return CAROUSEL_ROLES.find((r) => r.id === roleId) || null
}

export function suggestRoleForIndex(index, total, explicitRoles) {
  if (explicitRoles?.[index]) return explicitRoles[index]
  if (index === 0) return 'hook'
  if (index === total - 1) return 'cta'
  if (index === total - 2 && total > 3) return 'proof'
  return 'value'
}
