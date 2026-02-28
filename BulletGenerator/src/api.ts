export async function generateBulletsWithOpenAI(
  apiKey: string,
  params: {
    offer: string;
    targetAudience: string;
    documentType: string;
    offerType: string;
    situations: string;
    painPatterns: string;
    hiddenFrustrations: string;
    desiredOutcomes: string;
    objections: string;
    oldBelief: string;
    newBelief: string;
    desiredEmotion: string;
    primaryCta: string;
  }
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert copywriter specializing in high-converting bullet points for sales pages, VSLs, and marketing copy.

Your bullets MUST follow this exact formula: [LEAD] - [VERB] - [HOOK (The subject)] - [CLOSE]

Where:
- LEAD: Opening phrase that creates curiosity (e.g. "The invisible pattern", "A near-instant way to", "How you can rapidly", "PLUS: How to", "The most important")
- VERB: Action word or phrase (e.g. "which holds on to", "interrupt", "stop", "release", "sequence to")
- HOOK: The subject/topic - what the bullet is about (e.g. "your anxiety", "Anxiety Spikes", "replaying conversations")
- CLOSE: Closing phrase - the payoff or twist (e.g. "and you don't even know it", "Without Meditation", "using only your body")

Examples of correct bullets:
- [The invisible pattern] [which holds on to] [your anxiety] [and] [you don't even know it].
- [A near-instant way to] [interrupt] [Anxiety Spikes] [Without] [Meditation]
- [How you can rapidly] [stop] [replaying conversations] [using only] [your body... revealed in Module 3]
- [PLUS: How to] [release] [that uncomfortable feeling] [without] [guessing how to do it in just 90 seconds.]
- [The most important] [sequence to] [calm your mind] [using only] [your body]

Output ONLY the bullet points, one per line. No numbering, no extra commentary. Each bullet should be a complete, compelling sentence following the formula.`,
        },
        {
          role: 'user',
          content: buildUserPrompt(params),
        },
      ],
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

function buildUserPrompt(params: {
  offer: string;
  targetAudience: string;
  documentType: string;
  offerType: string;
  situations: string;
  painPatterns: string;
  hiddenFrustrations: string;
  desiredOutcomes: string;
  objections: string;
  oldBelief: string;
  newBelief: string;
  desiredEmotion: string;
  primaryCta: string;
}): string {
  const parts: string[] = [
    `Generate 8-12 high-converting bullet points for:`,
    ``,
    `**Document Type:** ${params.documentType || 'Sales Page'}`,
    `**Offer Type:** ${params.offerType || 'Mid-ticket'}`,
    `**Target Audience:** ${params.targetAudience || 'Not specified'}`,
    `**Offer/Product:** ${params.offer || 'Not specified'}`,
  ];

  if (params.situations?.trim()) {
    parts.push('', '**Specific Situations:**', params.situations.trim());
  }
  if (params.painPatterns?.trim()) {
    parts.push('', '**Pain Patterns:**', params.painPatterns.trim());
  }
  if (params.hiddenFrustrations?.trim()) {
    parts.push('', '**Hidden Frustrations:**', params.hiddenFrustrations.trim());
  }
  if (params.desiredOutcomes?.trim()) {
    parts.push('', '**Desired Outcomes:**', params.desiredOutcomes.trim());
  }
  if (params.objections?.trim()) {
    parts.push('', '**Common Objections:**', params.objections.trim());
  }
  if (params.oldBelief?.trim()) {
    parts.push('', '**Old Belief (to shift):**', params.oldBelief.trim());
  }
  if (params.newBelief?.trim()) {
    parts.push('', '**New Belief:**', params.newBelief.trim());
  }
  if (params.desiredEmotion?.trim()) {
    parts.push('', '**Desired Emotion After Reading:**', params.desiredEmotion.trim());
  }
  if (params.primaryCta?.trim()) {
    parts.push('', '**Primary CTA:**', params.primaryCta.trim());
  }

  parts.push('', 'Generate bullets that speak directly to this audience and address their pains, outcomes, and objections. Follow the [LEAD] - [VERB] - [HOOK] - [CLOSE] formula strictly.');

  return parts.join('\n');
}
