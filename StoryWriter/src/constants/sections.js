/** Story framework section definitions. Order starts with big drama. */
export const SECTION_IDS = [
  'scene',
  'hero_up_tree',
  'throw_stones',
  'bigger_stone',
  'aha',
  'final_attempt',
  'new_life',
  'audience_moral',
];

export const SECTION_DEFINITIONS = {
  scene: {
    id: 'scene',
    title: 'Set the scene with high drama',
    description: 'Open with tension. Set the scene and introduce the main character in a way that grabs the audience immediately.',
    placeholder: 'e.g. morning routine, workplace, moment of crisis…',
  },
  hero_up_tree: {
    id: 'hero_up_tree',
    title: 'Put the hero up a tree (the core problem)',
    description: 'Describe their problem. Make it clear why this matters and why they feel stuck.',
    placeholder: 'e.g. anxiety, lack of control, confusion despite “having it all”…',
  },
  throw_stones: {
    id: 'throw_stones',
    title: 'Throw stones (failed attempts / consequences)',
    description: 'Show how they try to fix it, but it doesn’t work. Consequences spread.',
    placeholder: 'e.g. work suffers, relationships strain, identity feels lost…',
  },
  bigger_stone: {
    id: 'bigger_stone',
    title: 'Throw a bigger stone (rock bottom)',
    description: 'Escalate until it’s as bad as it can get — almost completely defeating the hero.',
    placeholder: 'e.g. lost role, breakdown, lowest point…',
  },
  aha: {
    id: 'aha',
    title: 'The “aha” moment',
    description: 'Reveal the insight that leads to one final attempt. The shift in understanding.',
    placeholder: 'e.g. “It’s not about eliminating it — it’s about interrupting it”…',
  },
  final_attempt: {
    id: 'final_attempt',
    title: 'Final attempt — and it works',
    description: 'Show the hero taking action on the solution. It works (or in a tragedy, it doesn’t).',
    placeholder: 'e.g. learned to interrupt anxiety, body and mind calm…',
  },
  new_life: {
    id: 'new_life',
    title: 'The new life',
    description: 'Describe life now that the problem has (or hasn’t) been fixed.',
    placeholder: 'e.g. work improved, enjoyment returned, clarity…',
  },
  audience_moral: {
    id: 'audience_moral',
    title: 'Call out the audience + moral',
    description: 'Speak directly to the reader. Leave them with the takeaway and invitation.',
    placeholder: 'e.g. “If you feel anxious even though you ‘should’ be happy…” + hope/moral.',
  },
};

export function getDefaultSectionOrder() {
  return [...SECTION_IDS];
}

export function createEmptySections() {
  return SECTION_IDS.reduce((acc, id) => {
    acc[id] = { input: '', content: '' };
    return acc;
  }, {});
}
