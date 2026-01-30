/** All story frameworks. First is the default (Hero's Arc). */
export const FRAMEWORKS = [
  {
    id: 'heros_arc',
    name: "Hero's Arc",
    sectionIds: [
      'scene',
      'hero_up_tree',
      'throw_stones',
      'bigger_stone',
      'aha',
      'final_attempt',
      'new_life',
      'audience_moral',
    ],
    sections: {
      scene: {
        id: 'scene',
        title: 'Set the scene with high drama',
        description: 'Open with tension. Set the scene and introduce the main character in a way that grabs the audience immediately.',
      },
      hero_up_tree: {
        id: 'hero_up_tree',
        title: 'Put the hero up a tree (the core problem)',
        description: 'Describe their problem. Make it clear why this matters and why they feel stuck.',
      },
      throw_stones: {
        id: 'throw_stones',
        title: 'Throw stones (failed attempts / consequences)',
        description: 'Show how they try to fix it, but it doesn’t work. Consequences spread.',
      },
      bigger_stone: {
        id: 'bigger_stone',
        title: 'Throw a bigger stone (rock bottom)',
        description: 'Escalate until it’s as bad as it can get — almost completely defeating the hero.',
      },
      aha: {
        id: 'aha',
        title: 'The "aha" moment',
        description: 'Reveal the insight that leads to one final attempt. The shift in understanding.',
      },
      final_attempt: {
        id: 'final_attempt',
        title: 'Final attempt — and it works',
        description: 'Show the hero taking action on the solution. It works (or in a tragedy, it doesn’t).',
      },
      new_life: {
        id: 'new_life',
        title: 'The new life',
        description: 'Describe life now that the problem has (or hasn’t) been fixed.',
      },
      audience_moral: {
        id: 'audience_moral',
        title: 'Call out the audience + moral',
        description: 'Speak directly to the reader. Leave them with the takeaway and invitation.',
      },
    },
  },
  {
    id: 'pas',
    name: 'Problem-Agitate-Solve',
    sectionIds: ['problem', 'agitate', 'solve'],
    sections: {
      problem: {
        id: 'problem',
        title: 'Problem',
        description: 'State the problem clearly. What is wrong or missing?',
      },
      agitate: {
        id: 'agitate',
        title: 'Agitate',
        description: 'Make the problem feel urgent. Show the cost of not fixing it.',
      },
      solve: {
        id: 'solve',
        title: 'Solve',
        description: 'Present the solution. Show how it fixes the problem.',
      },
    },
  },
  {
    id: 'before_after_bridge',
    name: 'Before-After-Bridge',
    sectionIds: ['before', 'after', 'bridge'],
    sections: {
      before: {
        id: 'before',
        title: 'Before',
        description: 'Describe the current situation. Where is the hero or audience today?',
      },
      after: {
        id: 'after',
        title: 'After',
        description: 'Paint the desired outcome. What does life look like once the problem is solved?',
      },
      bridge: {
        id: 'bridge',
        title: 'Bridge',
        description: 'Show how to get from before to after. The path or solution.',
      },
    },
  },
  {
    id: 'three_act',
    name: 'Three-Act',
    sectionIds: ['setup', 'confrontation', 'resolution'],
    sections: {
      setup: {
        id: 'setup',
        title: 'Setup',
        description: 'Introduce the world and the hero. Establish the normal and the stakes.',
      },
      confrontation: {
        id: 'confrontation',
        title: 'Confrontation',
        description: 'Raising stakes and obstacles. The hero struggles and things get worse.',
      },
      resolution: {
        id: 'resolution',
        title: 'Resolution',
        description: 'Climax and outcome. The conflict is resolved; new normal is shown.',
      },
    },
  },
  {
    id: 'aida',
    name: 'AIDA',
    sectionIds: ['attention', 'interest', 'desire', 'action'],
    sections: {
      attention: {
        id: 'attention',
        title: 'Attention',
        description: 'Grab attention. Open with something that makes them stop and listen.',
      },
      interest: {
        id: 'interest',
        title: 'Interest',
        description: 'Build interest. Why should they care? What’s in it for them?',
      },
      desire: {
        id: 'desire',
        title: 'Desire',
        description: 'Create desire. Show the outcome they want. Make them want the change.',
      },
      action: {
        id: 'action',
        title: 'Action',
        description: 'Call to action. What they should do next. Clear next step.',
      },
    },
  },
  {
    id: 'storybrand',
    name: 'StoryBrand',
    sectionIds: ['character', 'problem', 'guide', 'plan', 'call_to_action', 'failure', 'success'],
    sections: {
      character: {
        id: 'character',
        title: 'Character',
        description: 'Introduce the hero (or audience). What do they want?',
      },
      problem: {
        id: 'problem',
        title: 'Problem',
        description: 'The villain or obstacle. What stands between them and what they want?',
      },
      guide: {
        id: 'guide',
        title: 'Guide',
        description: 'The guide (you or your solution). Why you understand and can help.',
      },
      plan: {
        id: 'plan',
        title: 'Plan',
        description: 'The plan. Simple steps that remove confusion and risk.',
      },
      call_to_action: {
        id: 'call_to_action',
        title: 'Call to action',
        description: 'Direct call to action. What they need to do next.',
      },
      failure: {
        id: 'failure',
        title: 'Failure',
        description: 'What failure looks like. Stakes if they don’t act.',
      },
      success: {
        id: 'success',
        title: 'Success',
        description: 'What success looks like. The happy ending they can have.',
      },
    },
  },
  {
    id: 'story_email',
    name: 'Story Email',
    sectionIds: ['hook', 'story', 'tension', 'shift', 'result', 'cta'],
    sections: {
      hook: {
        id: 'hook',
        title: 'Hook',
        description: 'First line that stops the scroll. Use a question, bold statement, or story moment. No small talk.',
      },
      story: {
        id: 'story',
        title: 'Story',
        description: 'Relatable situation or mini transformation. Before / struggle / after. Make them see themselves.',
      },
      tension: {
        id: 'tension',
        title: 'Tension',
        description: 'What went wrong or what was at stake. The cost of not fixing it. Keep it specific.',
      },
      shift: {
        id: 'shift',
        title: 'Shift',
        description: 'The turning point or solution. What changed. One clear idea or method.',
      },
      result: {
        id: 'result',
        title: 'Result',
        description: 'Outcome or proof. A result, lesson, or takeaway they can believe.',
      },
      cta: {
        id: 'cta',
        title: 'CTA',
        description: 'One clear next step. Click here, reply with X, or think about Y. No extra links or options.',
      },
    },
  },
  {
    id: 'simple_email',
    name: 'Simple Email',
    sectionIds: ['open', 'value', 'cta'],
    sections: {
      open: {
        id: 'open',
        title: 'Open',
        description: 'One line that states why you’re writing or grabs attention. No greeting fluff.',
      },
      value: {
        id: 'value',
        title: 'Value',
        description: 'The single most important point or benefit. 1–2 sentences. One idea only.',
      },
      cta: {
        id: 'cta',
        title: 'CTA',
        description: 'One clear action. Link, reply, or next step. Nothing else.',
      },
    },
  },
];

const DEFAULT_FRAMEWORK_ID = FRAMEWORKS[0].id;

export function getFramework(id) {
  return FRAMEWORKS.find((f) => f.id === id) ?? FRAMEWORKS[0];
}

export function getDefaultSectionOrder(frameworkId) {
  const f = getFramework(frameworkId);
  return [...f.sectionIds];
}

export function createEmptySections(frameworkId) {
  const f = getFramework(frameworkId);
  return f.sectionIds.reduce((acc, id) => {
    acc[id] = { input: '', content: '' };
    return acc;
  }, {});
}

export function getSectionDefs(frameworkId) {
  return getFramework(frameworkId).sections;
}
