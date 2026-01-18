import OpenAI from 'openai';

// Helper to extract text from HTML-like string if needed, 
// using regex for simplicity as we trust the AI output structure mostly.
const stripTags = (html) => html.replace(/<[^>]*>/g, '');

// Helper to aggressively strip markdown fences
const cleanContent = (text) => {
    if (!text) return '';
    return text
        .replace(/^```html\s*/i, '') // Remove start fence
        .replace(/^```\s*/i, '')      // Remove generic start fence
        .replace(/```\s*$/i, '')      // Remove end fence
        .replace(/>\s+</g, '><')      // REMOVE WHITESPACE BETWEEN TAGS (Aggressive tightness)
        .trim();
};

export async function generateCopy(apiKey, { docType, style, instructions, targetAudience, copywriter }) {
    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });

    let systemPrompt = `You are an expert copywriter and color-coded content architect.
    
    CRITICAL ROLE: You must write in the specific style of: ${copywriter && copywriter !== 'None' ? copywriter : 'an expert A-list copywriter'}. 
    ${copywriter && copywriter !== 'None' ? `Emulate ${copywriter}'s tone, vocabulary, sentence structure, and persuasion techniques perfectly.` : ''}

    Your goal is to write a ${docType} targeting ${targetAudience || 'the general public'}.
    Tone: ${style}.

    **LANGUAGE CONSTRAINT**: 
    You MUST write at a **5th-grade reading level**. 
    - Avoid jargon, complex words, and long sentences.
    - Use simple, punchy, and clear language.
    - If a complex concept is needed, explain it simply.

    **CRITICAL STRUCTURE REQUIREMENTS**:
    1. **STRONG HOOK**: The very first sentence/paragraph MUST be a powerful, attention-grabbing hook. It must be impossible to ignore.
    ${docType.includes('Sales Page') ? `
    2. **SALES PAGE HEADER STRUCTURE**:
       You must start the sales page with this EXACT sequence:
       - **Eyebrow**: A short, pre-headline teaser (e.g. "Attention Business Owners...").
       - **Headline**: A massive, bold promise or curiosity-driven headline.
       - **Sub-headline**: Clarifies the promise or adds proof/urgency.
    ` : ''}

**Target Audience**: ${targetAudience}


**Output Structure**:
You MUST construct your response using a "Row-based" HTML structure with a **sidebar gutter** and a **content body wrapper**.

**The Container**:
<div class="content-row">
  <div class="gutter">...icons...</div>
  <div class="content-body">
      <div class="block-[type]">...text...</div>
  </div>
</div>

**1. Gutter (Left Column)**:
Contains the icons.
CRITICAL: Use ONLY <i type='...'></i>. Do NOT write the name (e.g. "homer") as text. 
<div class='gutter'>
  <i type='homer'></i>
  <i type='loop-open'></i>
</div>

**2. Content Body (Right Wrapper)**:
Wraps the content blocks. This is CRITICALLY IMPORTANT for layout.
<div class="content-body">
  <div class="block-story">
     My text here...
  </div>
</div>

**Content Blocks**:
Types: block-hook, block-story, block-emotion, block-logic, block-proof, block-cta, block-ad, block-misc.

**Highlights (Inline spans)**:
<span class="highlight-interrupt">...</span>
<span class="highlight-loop-open">...</span>
<span class="highlight-loop-close">...</span>

**Icon Types**:
homer, bart, marge, lisa, interrupt, loop-open, loop-close.

**Formatting**:
- **USE HEADINGS**: You MUST use &lt;h1&gt;, &lt;h2&gt;, and &lt;h3&gt; tags for ALL headlines and subheadlines. Do NOT use bold text for headlines.
- **Bold** key terms using &lt;b&gt; or &lt;strong&gt;.
- **NO EMPTY LINES**: Do NOT put empty lines or &lt;br&gt; tags inside a content block. 
- **NO WHITESPACE PADDING**: Do NOT add spaces or newlines at the start or end of the text inside the div. 

**Critical Creative Rule - LOOPS**:
- **Open Loops**: Create curiosity or a question.
- **Close Loops**: MUST provide a satisfying "Aha-moment", a reveal, or a powerful payoff. Do not just close the sentence; deliver a punchline or insight.

**Example**:
<div class="content-row">
  <div class="gutter"><i type="homer"></i><i type="loop-open"></i></div>
  <div class="block-story">My neighbor Dave had a secret... <span class="highlight-loop-open">or so I thought.</span></div>
</div>

**Instructions**:
- Use proper valid HTML5.
- ALWAYS wrap every paragraph in a .content-row.
- Do NOT nest .content-row inside another .content-row.
- **SPAN WRAPPERS**: You MUST wrap the inner text of every &lt;h1&gt;, &lt;h2&gt;, &lt;h3&gt;, and &lt;p&gt; in a &lt;span&gt; tag. Example: &lt;h1&gt;&lt;span&gt;Title&lt;/span&gt;&lt;/h1&gt;
- **NO EXTRA SPACE**: Do not add newlines or spaces inside the block-[type] div.
- **TIGHT HTML**: Write &lt;div class='block-story'&gt;&lt;p&gt;&lt;span&gt;Text...&lt;/span&gt;&lt;/p&gt;&lt;/div&gt; on a SINGLE line if possible.
`;

    const userPrompt = `Instructions: ${instructions}`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "gpt-4o",
        });

        return cleanContent(completion.choices[0].message.content);
    } catch (error) {
        console.error("OpenAI Error:", error);
        throw error;
    }
};

export const analyzeCopy = async (apiKey, text) => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are an expert copy analysis engine.
Your task is to re-format the provided text into the "ColorWriter" Row Layout.

**Output Structure**:
<div class="content-row">
  <div class="gutter">...icons...</div>
  <div class="content-body">
    <div class="block-[type]">...text...</div>
  </div>
</div>

**Types**: block-story, block-emotion, block-logic, block-cta, block-ad, block-misc.
**Icons**: homer, bart, marge, lisa, interrupt, loop-open, loop-close.
CRITICAL: Use <i type='name'></i>. Do NOT write the name as text.

**Logistics**:
1. Identify the tone/persona of each paragraph.
2. Put the corresponding Icon in the <div class='gutter'>.
3. Put the text in the <div class='content-body'><div class='block-...'>.
4. Wrap them in <div class='content-row'>.

**Formatting Constraints**:
- **SPAN WRAPPERS**: You MUST wrap the inner text of every &lt;h1&gt;, &lt;h2&gt;, &lt;h3&gt;, and &lt;p&gt; in a &lt;span&gt; tag. Example: &lt;h1&gt;&lt;span&gt;Title&lt;/span&gt;&lt;/h1&gt;
- **NO EXTRA SPACE**: Do not add newlines or spaces inside the block-[type] div.
- **TIGHT HTML**: Write &lt;div class='block-story'&gt;&lt;p&gt;&lt;span&gt;Text...&lt;/span&gt;&lt;/p&gt;&lt;/div&gt; on a SINGLE line if possible.
`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ],
            model: "gpt-4o",
        });

        return cleanContent(completion.choices[0].message.content);
    } catch (error) {
        console.error("OpenAI Analysis Error:", error);
        throw error;
    }
};

export const analyzeAudienceFeedback = async (apiKey, text, targetAudience, docType) => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are a representative of the target audience: "${targetAudience}".
You are reviewing a "${docType}".

**Context**:
This text uses a "Color Block" psychology system:
- Story (Warm/Nostalgic)
- Emotion (Deep connection)
- Logic (Data/Facts)
- CTA (Action)
- Personas: Homer (Fun/Fails), Bart (Fast/Speed), Marge (Stories/Connection), Lisa (Details/Data).

**Task**:
Provide your raw, honest thoughts on the copy.
Specifically mention if the *mix* of personas feels right for you.
(e.g., "Too much data (Lisa) for me, I want more fun (Homer)" or "Great stories (Marge) but I need to know the price (Logic)").

Return the response in JSON format:
{
  "thoughts": "String describing what you think/feel when reading, referencing the personas/mix.",
  "improvements": ["Point 1", "Point 2", "Point 3"]
}
`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error("OpenAI Feedback Error:", error);
        throw error;
    }
};

export const improveCopy = async (apiKey, originalText, feedbackData, docType, style, targetAudience) => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are an expert copywriter.
Target Audience: ${targetAudience}
Doc Type: ${docType}
Style: ${style}

**Goal**: Improve the provided text based on the specific Audience Feedback.

**Feedback to Address**:
Thoughts: "${feedbackData.thoughts}"
Improvements: ${JSON.stringify(feedbackData.improvements)}

**Output Structure**:
Retain the structured HTML with classes (\`<div class="content-row">\`, \`<div class="gutter">\`, \`<div class="block-...">\`).
Re-write the content to solve the audience's complaints while keeping the good parts.

**Formatting Constraints**:
- **SPAN WRAPPERS**: You MUST wrap the inner text of every &lt;h1&gt;, &lt;h2&gt;, &lt;h3&gt;, and &lt;p&gt; in a &lt;span&gt; tag. Example: &lt;h1&gt;&lt;span&gt;Title&lt;/span&gt;&lt;/h1&gt;
- **NO EXTRA SPACE**: Do not add newlines or spaces inside the block-[type] div.
- **TIGHT HTML**: Write &lt;div class='block-story'&gt;&lt;p&gt;&lt;span&gt;Text...&lt;/span&gt;&lt;/p&gt;&lt;/div&gt; on a SINGLE line if possible.

CRITICAL: Return ONLY the full valid HTML with rows, gutters, and blocks.
`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: originalText }
            ],
            model: "gpt-4o",
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("OpenAI Improve Error:", error);
        throw error;
    }
};

export const improveInstructions = async (apiKey, currentInstructions, docType, style, targetAudience) => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are a "Prompt Engineer" expert.
Your goal is to rewrite the user's rough instructions into a HIGH-PERFORMANCE PROMPT for an AI copywriter.

**Context**:
- **Target Audience**: "${targetAudience}"
- **Document Type**: "${docType}"
- **Writing Style**: "${style}"

**Task**:
Take the user's current instructions (which might be vague or simple) and expand them into a detailed, powerful set of instructions that will yield the best possible result. 
Focus on:
- Tone validation (matches style).
- Specificity for the target audience.
- Formatting requirements (implicit).
- Key selling points (if mentioned, make them shine).

**Constraint**:
Return ONLY the new improved text version of the instructions. Do not add "Here is the prompt:". Just the raw instructions text.
`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: currentInstructions }
            ],
            model: "gpt-4o",
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("OpenAI Instruction Start Error:", error);
        throw error;
    }
};

export const analyzeColorBalance = async (apiKey, text, targetAudience) => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are a copy auditing expert. 
Your goal is to analyze the BALANCE of "Color Blocks" and "Personas" in the text, relative to the Target Audience.

**Context**:
- **Colors**: Story, Emotion, Logic, CTA, Ad.
- **Personas**: Homer (Fun), Bart (Speed), Marge (Connection), Lisa (Data).
- **Target Audience**: "${targetAudience}"

**Task**:
Identify what is **Over-represented** (too much of it, hurting conversion) and what is **Lacking** (missing, would help conversion).

Return JSON:
{
  "over_represented": {
    "item": "Name of Color or Persona (e.g. 'Logic (Blue)' or 'Lisa')",
    "reason": "Why it is too much for this audience."
  },
  "lacking": {
    "item": "Name of Color or Persona",
    "reason": "Why it is needed for this audience."
  },
  "suggestion": "One sentence summary on how to fix the balance."
}
`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error("OpenAI Balance Error:", error);
        throw error;
    }
};

export const improveBalance = async (apiKey, originalText, balanceData, docType, style, targetAudience) => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are an expert copywriter.
Target Audience: ${targetAudience}
Doc Type: ${docType}
Style: ${style}

**Goal**: REWRITE the text to fix the "Color Balance" issues identified.

**Balance Analysis**:
- **Over-Represented**: ${balanceData.over_represented?.item} (${balanceData.over_represented?.reason})
- **Lacking**: ${balanceData.lacking?.item} (${balanceData.lacking?.reason})
- **Advice**: ${balanceData.suggestion}

**Task**:
Rewrite the copy to:
1. Reduce the "Over-Represented" elements.
2. Increase the "Lacking" elements.
3. Maintain the overall flow and persuasion.

**Output Structure**:
Retain the structured HTML with classes (\`<div class='content-row'>\`, \`<div class='gutter'>\`, \`<div class='block-...'>\`).
**Formatting Constraints**:
- **SPAN WRAPPERS**: You MUST wrap the inner text of every &lt;h1&gt;, &lt;h2&gt;, &lt;h3&gt;, and &lt;p&gt; in a &lt;span&gt; tag. Example: &lt;h1&gt;&lt;span&gt;Title&lt;/span&gt;&lt;/h1&gt;
- **NO EXTRA SPACE**: Do not add newlines or spaces inside the block-[type] div.
- **TIGHT HTML**: Write &lt;div class='block-story'&gt;&lt;p&gt;&lt;span&gt;Text...&lt;/span&gt;&lt;/p&gt;&lt;/div&gt; on a SINGLE line if possible.

CRITICAL: Return ONLY the valid HTML.
`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: originalText }
            ],
            model: "gpt-4o",
        });

        const cleanContent = (text) => {
            if (!text) return '';
            return text
                .replace(/^```html\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/```\s*$/i, '')
                .trim();
        };

        return cleanContent(completion.choices[0].message.content);
    } catch (error) {
        console.error("OpenAI Improve Balance Error:", error);
        throw error;
    }
};
export async function analyzeConversionMetrics(apiKey, content, targetAudience) {
    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });

    const systemPrompt = `You are a world-class conversion copywriter and auditor.
    Your task is to analyze the provided copy and score it from 0-100 on 5 key conversion metrics based on the Target Audience: ${targetAudience}.

    Metrics:
    1. **Hook**: Attention grabbing?
    2. **Relatability**: Empathy/Language match?
    3. **Novelty**: New mechanism/Unique angle?
    4. **Credibility**: Proof/Trust?
    5. **Persuasion**: Desire/CTA?

    Additionally, analyze the text to determine the **"Perfect Fit" Audience** based ONLY on the copy itself (tone, slang, pain points), ignoring any prior inputs.

    Return ONLY a JSON object with this EXACT structure:
    {
      "metrics": {
        "hook": { "score": 85, "feedback": "Strong opening, but simpler words needed." },
        "relatable": { "score": 70, "feedback": "Good pain points, but feels too distant." },
        "novelty": { "score": 60, "feedback": "Angle is common. Needs a twist." },
        "credibility": { "score": 40, "feedback": "Needs more specific numbers or names." },
        "persuasion": { "score": 90, "feedback": "Excellent CTA." }
      },
      "perfect_audience_analysis": "Based on the text, this is perfect for [Who] struggling with [Problem] who wants [Desire]. The tone implies..."
    }
    `

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analyze this content:\n\n${stripTags(content)}` }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
}
