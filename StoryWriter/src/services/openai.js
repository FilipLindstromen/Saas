const STORY_SYSTEM_PROMPT = `You are an expert storyteller who writes emotional, gripping stories that keep the audience hooked.

You follow a specific narrative framework. For each section you write:
- Be emotional and direct. Grab the audience and keep them wanting to know how it goes.
- Use open and close loops: create curiosity and pay it off.
- Write in first person when appropriate (the hero's voice).
- Use short, punchy sentences where it hits hardest. Longer sentences for reflection.
- No generic self-help tone. Sound like a real person telling a real story.
- Each section should feel complete but leave a thread to the next.

Framework reminder:
1. Set the scene with high drama — open with tension, introduce the hero.
2. Put the hero up a tree — the core problem, why it matters, why they're stuck.
3. Throw stones — failed attempts, consequences spreading.
4. Throw a bigger stone — rock bottom, almost completely defeated.
5. The "aha" moment — the insight that changes everything.
6. Final attempt — action on the solution, it works (or doesn't).
7. The new life — what life looks like now.
8. Call out the audience + moral — speak to the reader, leave the takeaway.`;

function buildSectionPrompt(sectionId, sectionDef, storyAbout, sectionInput, existingContent) {
  const part = existingContent ? `Current text (user may have edited; preserve their intent, improve if needed):\n${existingContent}\n\nRewrite or refine the above for this section only.` : `Write this section from scratch.`;
  return `Story theme: ${storyAbout}
Section: "${sectionDef.title}"
${sectionDef.description}
${sectionInput ? `Additional context for this section: ${sectionInput}` : ''}

${part}
Output only the story text for this section. No section title, no numbering, no meta-commentary.`;
}

export async function generateSection(apiKey, { sectionId, sectionDef, storyAbout, sectionInput, existingContent }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: STORY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildSectionPrompt(sectionId, sectionDef, storyAbout, sectionInput, existingContent),
        },
      ],
      temperature: 0.8,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  return text;
}

export async function generateFullStory(apiKey, { storyAbout, sectionsData, sectionOrder, sectionDefs }) {
  const results = {};
  for (const sectionId of sectionOrder) {
    const def = sectionDefs[sectionId];
    const data = sectionsData[sectionId] || {};
    const content = await generateSection(apiKey, {
      sectionId,
      sectionDef: def,
      storyAbout,
      sectionInput: data.input || '',
      existingContent: null,
    });
    results[sectionId] = content;
  }
  return results;
}
