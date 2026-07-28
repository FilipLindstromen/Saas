/** Story target outcomes — the medium or format the story is written for. */
export const TARGET_OUTCOMES = [
  {
    id: 'general',
    name: 'General story',
    description: 'A versatile narrative suitable for any medium.',
    promptInstruction:
      'Write for a general audience. The story should work as spoken or written narrative.',
  },
  {
    id: 'reel',
    name: 'Reel / Short video',
    description: 'Fast-paced hook for Instagram, TikTok, or YouTube Shorts.',
    promptInstruction:
      'Optimize for a 30–90 second social reel. Open with a scroll-stopping hook. Keep sentences short and punchy. Write as spoken voiceover — conversational, high energy, no filler. End with a clear payoff or call to reflect.',
  },
  {
    id: 'vsl',
    name: 'VSL (Video Sales Letter)',
    description: 'Long-form video script that builds desire and converts.',
    promptInstruction:
      'Optimize for a video sales letter. Build emotional tension and credibility. Speak directly to the viewer\'s pain. Each section should move them closer to wanting the solution. Use "you" language. End sections with momentum toward the offer.',
  },
  {
    id: 'youtube',
    name: 'YouTube video',
    description: 'Longer-form video script with retention hooks.',
    promptInstruction:
      'Optimize for YouTube. Strong hook in the first lines. Use pattern interrupts and open loops to maintain retention. Conversational spoken style. Mix storytelling with value.',
  },
  {
    id: 'podcast',
    name: 'Podcast / Audio',
    description: 'Spoken narrative for podcast episodes.',
    promptInstruction:
      'Optimize for spoken audio or podcast. Natural conversational rhythm. Longer sentences are OK. Use vivid sensory detail. Sound like someone telling a story to a friend.',
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Story-driven email copy.',
    promptInstruction:
      'Optimize for email. Intimate, direct tone. Short paragraphs. Personal and relatable. Open with a hook that earns the next sentence.',
  },
  {
    id: 'ad',
    name: 'Ad copy',
    description: 'Concise story for paid ads.',
    promptInstruction:
      'Optimize for paid ads. Extremely concise. Lead with pain or curiosity. Every sentence must earn attention. Clear emotional arc in minimal words.',
  },
  {
    id: 'presentation',
    name: 'Presentation / Talk',
    description: 'Story for live or slide presentation.',
    promptInstruction:
      'Optimize for a live presentation or keynote. Clear beats the audience can follow. Memorable phrases. Build to an inspiring or actionable conclusion.',
  },
];

export const DEFAULT_TARGET_OUTCOME_ID = 'general';

const OUTCOME_IDS = new Set(TARGET_OUTCOMES.map((o) => o.id));

export function getTargetOutcome(id) {
  return TARGET_OUTCOMES.find((o) => o.id === id) ?? TARGET_OUTCOMES[0];
}

export function isValidTargetOutcomeId(id) {
  return OUTCOME_IDS.has(id);
}
