const STORY_SYSTEM_PROMPT = `You are an expert storyteller who refines the user's story into a polished narrative. Your job is to shape and improve their story, not replace it.

CRITICAL — PRESERVE THE USER'S CONTENT (follow strictly):
- The user's input IS the story. Every location, scene, problem, event, and detail they mention must stay. Do not change offices to hospitals, do not swap their coping attempts for different ones, do not invent new plot points (e.g. "final warning from boss") they never mentioned.
- Extract and keep: their setting (office, home, etc.), their physical feelings (throat tightening, stomach knot), their specific struggles (pressure, deadlines, responsibilities), their failed attempts (deep breath, relax, think positive — use exactly what they tried), their insight or realization (what they "figured out").
- Do NOT add new locations, new events, new people, or new concepts (e.g. "three-step method") unless the user explicitly mentioned them.
- Use the framework to structure and refine their narrative — improve flow, pacing, and wording — but the story must remain theirs. Map their content into each section; do not substitute it with a different story.

CRITICAL — PRESERVE THE USER'S STYLE:
- Match their voice: same sentence length and rhythm, same tone, same level of detail. Stay in the same person (first person if they wrote in first person).
- Be emotional and direct. Use open and close loops. No generic self-help tone. Sound like a real person telling a real story.
- Each section should feel complete but leave a thread to the next.

CRITICAL — NO REPETITION:
- Do NOT repeat sentences, paragraphs, or scenes from earlier sections. Each section must advance the story.
- If previous sections are provided, build on them — do not re-state what was already written. Move the narrative forward.`;

const LENGTH_INSTRUCTIONS = {
  micro: 'Keep this section very short: 1–2 sentences only. Be punchy and concise.',
  short: 'Keep this section short: 1–3 sentences per section.',
  medium: 'Write 2–5 sentences for this section.',
  long: 'Write 2–7 sentences for this section.',
};

function buildSectionPrompt(sectionId, sectionDef, storyAbout, sectionInput, existingContent, storyLength, previousSectionsContent) {
  const lengthInstruction = LENGTH_INSTRUCTIONS[storyLength] || LENGTH_INSTRUCTIONS.medium;
  const part = existingContent ? `Current text (user may have edited; preserve their intent and style):\n${existingContent}\n\nRefine the above for this section only.` : `Write this section.`;
  const previousBlock = previousSectionsContent
    ? `\n\n---\nSECTIONS ALREADY WRITTEN (do NOT repeat this content; your section must CONTINUE from here):\n${previousSectionsContent}\n---\n`
    : '';
  return `The user's story (this is the source of truth — use their locations, problems, attempts, and insights; do not invent new ones):
---
${storyAbout}
---
${previousBlock}
Section: "${sectionDef.title}"
${sectionDef.description}
Length: ${lengthInstruction}
${sectionInput ? `Additional context for this section: ${sectionInput}` : ''}

${part}

Stay faithful to the user's content. Refine and polish only. Do NOT repeat what was already written in previous sections — advance the story. Output only the story text for this section. No section title, no numbering, no meta-commentary.`;
}

const LENGTH_MAX_TOKENS = { micro: 80, short: 150, medium: 350, long: 500 };

export async function generateSection(apiKey, { sectionId, sectionDef, storyAbout, sectionInput, existingContent, storyLength, previousSectionsContent }) {
  const maxTokens = LENGTH_MAX_TOKENS[storyLength] ?? LENGTH_MAX_TOKENS.medium;
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
          content: buildSectionPrompt(sectionId, sectionDef, storyAbout, sectionInput, existingContent, storyLength, previousSectionsContent),
        },
      ],
      temperature: 0.6,
      max_tokens: maxTokens,
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

export async function generateFullStory(apiKey, { storyAbout, storyLength, sectionsData, sectionOrder, sectionDefs }) {
  const results = {};
  const previousParts = [];
  for (const sectionId of sectionOrder) {
    const def = sectionDefs[sectionId];
    const data = sectionsData[sectionId] || {};
    const previousSectionsContent = previousParts.length > 0 ? previousParts.join('\n\n') : null;
    const content = await generateSection(apiKey, {
      sectionId,
      sectionDef: def,
      storyAbout,
      sectionInput: data.input || '',
      existingContent: null,
      storyLength: storyLength || 'medium',
      previousSectionsContent,
    });
    results[sectionId] = content;
    previousParts.push(`[${def.title}]\n${content}`);
  }
  return results;
}

/** Transcribe audio blob using OpenAI Whisper. Returns plain text. */
export async function transcribeAudio(apiKey, audioBlob) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Transcription failed: ${response.status}`);
  }

  const data = await response.json();
  return (data.text || '').trim();
}
