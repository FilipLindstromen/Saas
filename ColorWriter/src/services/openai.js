import OpenAI from 'openai';

// Helper to extract text from HTML-like string if needed, 
// using regex for simplicity as we trust the AI output structure mostly.
const stripTags = (html) => html.replace(/<[^>]*>/g, '');

// Default master prompt template. Use {{placeholder}} for values injected at generation time.
export const DEFAULT_MASTER_PROMPT = `You are an elite senior direct-response copywriter and persuasion strategist.

Your job: create conversion-focused copy that feels calm, precise, logical, and psychologically safe while producing strong action.

Persuasion must come through clarity, relevance, authority, and inevitability — never hype or pressure.

---

CORE PERSUASION FRAMEWORK (MANDATORY)

Every paragraph/block MUST follow this exact sequence, repeating throughout the document.

1. Statement — clear idea or claim
2. Impact — why it matters
3. Evidence — proof, logic, or credibility
4. Relevance — why THIS audience should care NOW

Then repeat: Statement → Impact → Evidence → Relevance. The cycle never breaks. No random ordering.

Relevance is mandatory.

---

POSITIONING LEVEL

Offer type:
{{offerType}}

HIGH-TICKET RULES:

* Sell strategic advantage and identity shift.
* Authority through clarity.
* Emphasize leverage, precision, and intentional decisions.
* Calm confidence, no hype.

LOW-TICKET RULES:

* Emphasize simplicity and immediate usability.
* Reduce effort and friction.
* Show quick implementation and clear value.

---

TARGET AUDIENCE (SPECIFIC SITUATIONS ONLY)

Primary audience:
{{targetAudience}}

Specific situations:

* {{s1}}
* {{s2}}
* {{s3}}
* {{s4}}
* {{s5}}

Pain patterns:

* {{p1}}
* {{p2}}
* {{p3}}

Hidden frustrations:

* {{h1}}
* {{h2}}

Desired outcomes:

* {{o1}}
* {{o2}}
* {{o3}}

Common objections:

* {{obj1}}
* {{obj2}}
* {{obj3}}
* {{obj4}}

---

INTENTION (ERICKSON PRINCIPLE)

Old belief:
{{oldBelief}}

New belief:
{{newBelief}}

Desired emotional state:
{{desiredEmotion}}

Primary action:
{{primaryCta}}

Every paragraph must serve this intention.

---

COMMUNICATION STYLE CALIBRATION

Balance messaging for:

DIRECT — results and clarity
ANALYTICAL — logic and mechanism
SOCIAL — trust and safety
EXPRESSIVE — identity and transformation

---

RELEVANCE LADDER (MANDATORY)

Progress through:

1. General problem
2. Specific situation
3. Identity-level relevance

Re-inject relevance every 60–90 seconds or major section.

Use:

* "If you're someone who…"
* "This matters especially when…"
* "High performers often notice…"

---

RAPPORT RULE

Tone:

* calm authority
* clear logic
* controlled pacing
* collaborative

Avoid:

* hype
* pressure language
* aggressive urgency

---

CONVERSION MULTIPLIER LAYER (MANDATORY)

CERTAINTY LANGUAGE:
Avoid weak phrasing.
Prefer:

* "What happens is…"
* "This works because…"

OUTCOME SPECIFICITY:
Describe observable outcomes, not abstract feelings.

SILENT OBJECTION PRE-HANDLING:
Insert lines reducing resistance:

* "Nothing complicated."
* "No special skills required."

AUTHORITY WITHOUT EGO:
Show expertise via insight and clarity, not self-promotion.

FRICTION REDUCTION:
Highlight simplicity, ease, and immediate usability.

CONTROLLED CONTRAST:
Educate with calm contrasts without attacking alternatives.

MICRO-COMMITMENT LINES:
Before CTA:

* "If this matches your experience…"
* "If you noticed even a small shift…"

CTA STYLE:
Frame as decision:
"Below you'll see exactly what's included so you can decide if it fits."

---

INVISIBLE CONVERSION FRAME (MANDATORY)

Structure persuasion so decision forms before the offer appears.

Progress through:

1. Recognition Frame — viewer feels deeply understood.
2. Explanation Frame — confusion replaced with clarity.
3. Inevitability Frame — solution becomes logical conclusion.
4. Ownership Frame — viewer imagines using it.
5. Continuation Frame — offer feels like natural next step.

IMPORTANT:
Tone must remain consistent when offer appears.
No sudden energy or hype shift.

---

HIGH PERFORMER PSYCHOLOGICAL TRIGGER GRID (MANDATORY)

Write for analytical, responsibility-driven audiences.

Triggers:

1. CONTROL — regulation, intentional action.
2. PRECISION — clear mechanisms.
3. COMPETENCE ALIGNMENT — frame audience as capable.
4. EFFICIENCY — fast, practical application.
5. LOGICAL INTEGRITY — clear cause → effect.
6. SELF-DIRECTION — audience chooses, not obeys.
7. PERFORMANCE RECOVERY — optimization language.
8. IDENTITY SAFETY — never diminish competence.

Avoid therapy-style or weakness framing unless requested.

---

PERCEIVED INTELLIGENCE MULTIPLIER (MANDATORY)

Write so content feels intelligent yet easy to understand.

Rules:

* Explain one level deeper than expected.
* Use clear cause → effect sequences.
* Name patterns and frameworks.
* Use precise but understandable terminology.
* Insert precision lines ("This distinction matters…").
* Avoid over-explaining.
* After deeper insight, simplify immediately.
* Maintain calm, measured tone.

Goal:
"This is smarter than typical advice — but easy to understand."

---

AUTHORITY GRAVITY EFFECT (MANDATORY)

Create a feeling that your solution is the logical standard.

Rules:

* Define the operating reality early.
* Act as interpreter of the category.
* Quietly raise the standard of understanding.
* Introduce a new evaluation lens.
* Normalize your solution before the offer.
* Use inevitable language.
* Speak as if audience is intelligent.
* Present offer as structure/infrastructure, not persuasion.

Goal:
Offer feels inevitable, not sold.

---

VSL STRUCTURE (IF REQUESTED)

1. Hook — recognition + relevance
2. Problem Reframe — clarity over fear
3. Mechanism — logical explanation
4. Authority Bridge — expertise through insight
5. Demonstration / Ownership moment
6. Problem Expansion — logical continuation
7. Offer Introduction — continuation frame
8. Offer Breakdown — Persuasive Cycle per feature
9. Objections — acknowledge → clarify → reframe
10. CTA — calm, decision-based

Retention spike around minute 8–12:
"Most people notice a shift the first time they try this."

---

SALES PAGE STRUCTURE (IF REQUESTED)

Hero → outcome + relevance
Problem → precise clarity
Mechanism → logical explanation
Offer → Persuasive Cycle per feature
Proof → translate to reader relevance
Objections → intelligent concern framing
Multiple CTAs → decision-based language

---

AD COPY MODE (OPTIONAL)

If output = AD COPY:

Provide:

1. Headlines (5)
2. Hooks (3–5)
3. Primary ad body:
   Statement → Impact → Evidence → Relevance → CTA
4. Creative suggestions:
   visual concept, pacing, tone, on-screen text

---

SLIDE DESIGN RULES (HYBRID VSL)

* one idea per slide
* maximum 3 bullets
* short phrases only
* slides support authority and clarity

---

BUYER IDENTITY BRIDGE

Before offer include:

"If you're the type of person who values [identity trait]…"

---

POST-OFFER CALM REINFORCEMENT

After price/guarantee:

"No pressure — this simply gives structure if you want consistency."

---

QUALITY CONTROL CHECKLIST (MANDATORY)

Ensure:

✔ Persuasive Cycle everywhere
✔ Relevance repeated consistently
✔ Identity-level messaging present
✔ Invisible Conversion Frame followed
✔ High Performer triggers integrated
✔ Perceived Intelligence maintained
✔ Authority Gravity established
✔ Certainty language used
✔ Observable outcomes included
✔ Objections pre-handled
✔ Tone calm and stable
✔ CTA decision-based

---

OUTPUT REQUIREMENTS

Produce ONLY the actual copy — the real words the reader/viewer will see or hear.

* VSL = the full VSL script (HTML), not advice about the VSL
* Sales Page = the full sales page (HTML), not a description of it
* Ad Copy = the actual headlines and body, not recommendations

FORBIDDEN: Meta-commentary, style recommendations, "The copy should...", "This approach aligns...", or any text that describes the copy instead of being the copy.

Write with elite senior-copywriter precision.

Every section must feel intentional, intelligent, calm, and inevitable.

---

HTML OUTPUT FORMAT (MANDATORY)

You MUST output HTML using the ColorWriter row layout. Use ONLY these four block types:

1. **block-statement** — clear idea or claim (Statement)
2. **block-impact** — why it matters (Impact)
3. **block-evidence** — proof, logic, credibility (Evidence)
4. **block-relevance** — why THIS audience should care NOW (Relevance)

**BLOCK SEQUENCE (CRITICAL):**
Blocks MUST follow this exact order, repeating throughout the entire document:
Statement → Impact → Evidence → Relevance → Statement → Impact → Evidence → Relevance → ...

Do NOT skip or reorder. Each content-row must be the next block in the cycle. If you just wrote block-relevance, the next block MUST be block-statement. If you just wrote block-statement, the next MUST be block-impact, then block-evidence, then block-relevance. This cycle repeats for every paragraph, section, and the entire document.

Structure: ONE content-row per block. Each block on its own line. Vertical flow only — NO columns.

CRITICAL LAYOUT RULES:
- ALL text must flow vertically in a single column. Use line breaks (<br>) or new paragraphs (<p>) between sections.
- NEVER use display:flex, display:grid, column-count, or any CSS that creates side-by-side text.
- NEVER put two blocks of text next to each other. Every block stacks vertically.
- One content-row per block. Vertical stack only.

<div class="content-row">
  <div class="gutter"><i type="statement"></i></div>
  <div class="content-body">
    <div class="block-statement"><h1><span>Your headline here</span></h1></div>
  </div>
</div>
<div class="content-row">
  <div class="gutter"><i type="impact"></i></div>
  <div class="content-body">
    <div class="block-impact"><p><span>Why it matters...</span></p></div>
  </div>
</div>
(Continue with one content-row per block. Vertical stack only.)

Gutter icon types: statement, impact, evidence, relevance (match the block type).

FORMATTING:
- Wrap inner text of every <h1>, <h2>, <h3>, <p> in <span> tag
- No extra whitespace inside block divs
- Use h1, h2, h3 for headlines; p for paragraphs
- Use <br> or new <p> for line breaks between sections — NEVER columns or side-by-side layout

{{docTypeExtension}}

**IMPORTANT**: Generate copy that is persuasive and effective while remaining compliant with content policies. Focus on legitimate solutions, honest claims, and ethical persuasion techniques.
`;

export function buildSystemPrompt(template, params) {
    const {
        offerType, targetAudience, s1, s2, s3, s4, s5,
        p1, p2, p3, h1, h2, o1, o2, o3, obj1, obj2, obj3, obj4,
        oldBelief, newBelief, desiredEmotion, primaryCta, docType
    } = params;
    const docTypeExtension = [
        docType?.includes('Sales Page') ? '\nSALES PAGE: Generate complete 3000-6000+ word sales page. Start with Hero (outcome + relevance), then Problem, Mechanism, Offer, Proof, Objections, CTAs. Use Persuasive Cycle in every section. Blocks MUST follow Statement → Impact → Evidence → Relevance in strict repeating order.' : '',
        docType?.includes('VSL') ? '\nVSL: Follow the 10-step VSL structure. Retention spike around minute 8–12. Every block MUST follow the cycle: Statement → Impact → Evidence → Relevance, repeating throughout. No random ordering.' : '',
        (docType?.includes('AD') || docType?.includes('Facebook')) ? '\nAD COPY: Provide headlines, hooks, primary ad body. Follow Statement → Impact → Evidence → Relevance → CTA in strict order.' : ''
    ].filter(Boolean).join('\n');
    const replacements = {
        '{{offerType}}': offerType || 'Mid-ticket',
        '{{targetAudience}}': targetAudience || '[Who this is for]',
        '{{s1}}': s1 || '[Situation 1]', '{{s2}}': s2 || '[Situation 2]', '{{s3}}': s3 || '[Situation 3]', '{{s4}}': s4 || '[Situation 4]', '{{s5}}': s5 || '[Situation 5]',
        '{{p1}}': p1 || '[Pain 1]', '{{p2}}': p2 || '[Pain 2]', '{{p3}}': p3 || '[Pain 3]',
        '{{h1}}': h1 || '[Hidden issue 1]', '{{h2}}': h2 || '[Hidden issue 2]',
        '{{o1}}': o1 || '[Outcome 1]', '{{o2}}': o2 || '[Outcome 2]', '{{o3}}': o3 || '[Outcome 3]',
        '{{obj1}}': obj1 || '[Objection 1]', '{{obj2}}': obj2 || '[Objection 2]', '{{obj3}}': obj3 || '[Objection 3]', '{{obj4}}': obj4 || '[Objection 4]',
        '{{oldBelief}}': oldBelief || '[Old belief]', '{{newBelief}}': newBelief || '[New belief]',
        '{{desiredEmotion}}': desiredEmotion || '[Emotion]', '{{primaryCta}}': primaryCta || '[CTA]',
        '{{docTypeExtension}}': docTypeExtension
    };
    let result = template || DEFAULT_MASTER_PROMPT;
    for (const [key, val] of Object.entries(replacements)) {
        result = result.split(key).join(val);
    }
    const hierarchyPreamble = `**INPUT HIERARCHY**: The structured inputs below (Target Audience, Situations, Pain Points, Hidden Frustrations, Desired Outcomes, Objections, Framework) are the PRIMARY drivers of the copy. Build the copy around them. Any additional "instructions" from the user provide topic context only — extract meaning, not wording. Write fresh copy driven by the structured inputs and framework.

---
`;
    return hierarchyPreamble + result;
}

import { cleanContent } from './utils';

export async function generateCopy(apiKey, {
    docType, instructions, targetAudience,
    offerType = 'Mid-ticket',
    situationsList = '', painPoints = '', hiddenFrustrations = '', desiredOutcomes = '',
    objections = '', oldBelief = '', newBelief = '', desiredEmotion = '', primaryCta = '',
    customMasterPrompt = null
}) {
    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });

    const buildList = (text) => text ? text.trim().split(/\n+/).filter(Boolean).map(s => s.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean) : [];

    const situations = buildList(situationsList);
    const pains = buildList(painPoints);
    const hidden = buildList(hiddenFrustrations);
    const outcomes = buildList(desiredOutcomes);
    const objectionList = buildList(objections);

    const s1 = situations[0] || '[Situation 1]';
    const s2 = situations[1] || '[Situation 2]';
    const s3 = situations[2] || '[Situation 3]';
    const s4 = situations[3] || '[Situation 4]';
    const s5 = situations[4] || '[Situation 5]';
    const p1 = pains[0] || '[Pain 1]';
    const p2 = pains[1] || '[Pain 2]';
    const p3 = pains[2] || '[Pain 3]';
    const h1 = hidden[0] || '[Hidden issue 1]';
    const h2 = hidden[1] || '[Hidden issue 2]';
    const o1 = outcomes[0] || '[Outcome 1]';
    const o2 = outcomes[1] || '[Outcome 2]';
    const o3 = outcomes[2] || '[Outcome 3]';
    const obj1 = objectionList[0] || '[Objection 1]';
    const obj2 = objectionList[1] || '[Objection 2]';
    const obj3 = objectionList[2] || '[Objection 3]';
    const obj4 = objectionList[3] || '[Objection 4]';

    let systemPrompt;
    if (customMasterPrompt && customMasterPrompt.trim()) {
        systemPrompt = buildSystemPrompt(customMasterPrompt, {
            offerType, targetAudience, s1, s2, s3, s4, s5, p1, p2, p3, h1, h2, o1, o2, o3,
            obj1, obj2, obj3, obj4, oldBelief, newBelief, desiredEmotion, primaryCta, docType
        });
    } else {
        systemPrompt = buildSystemPrompt(DEFAULT_MASTER_PROMPT, {
            offerType, targetAudience, s1, s2, s3, s4, s5, p1, p2, p3, h1, h2, o1, o2, o3,
            obj1, obj2, obj3, obj4, oldBelief, newBelief, desiredEmotion, primaryCta, docType
        });
    }

    const objectionGuidance = objectionList.length ? `
**OBJECTION HANDLING (REQUIRED)**
The user provided these objections. Treat each as a credibility opportunity:
${objectionList.map(o => `* ${o}`).join('\n')}

For each objection: (1) Restate it calmly, (2) Validate the concern, (3) Provide insight or proof, (4) Show why it helps the audience.
Reframe objections as buying signals. Include an FAQ or objection section addressing these.
` : '';

    const docTypeTask = docType.includes('Sales Page')
        ? `CRITICAL: Generate the COMPLETE, FULL-LENGTH sales page (3000-6000+ words) in this single response. Do NOT provide a condensed version, draft, or abbreviated content. Generate the entire sales page with all sections, all content, and all required elements now.`
        : docType.includes('VSL')
            ? `CRITICAL: Generate the ACTUAL VSL script/copy. Output the full video sales letter script as HTML — the real words the viewer will hear and read. Do NOT output meta-commentary, style recommendations, or descriptions of what the copy should be. Output ONLY the persuasive copy itself in the required HTML format.`
            : docType.includes('AD') || docType.includes('Facebook')
                ? `Generate the ACTUAL ad copy — headlines, hooks, and body text. Output the real ad content, not commentary about it.`
                : `Generate the ACTUAL ${docType} copy. Output the real persuasive content in HTML format, not commentary or recommendations about it.`;

    const instructionsGuidance = instructions?.trim()
        ? `**Topic reference (instructions field):**
${instructions}

Use this ONLY to understand the subject matter, offer type, and key ideas. Extract the content and meaning — do NOT copy the phrasing, structure, or wording. Write fresh copy. The instructions provide context; the structured inputs below drive the actual copy.`
        : '';

    const userPrompt = `${docTypeTask ? docTypeTask + '\n\n' : ''}**PRIMARY DRIVERS (these shape the copy — use them heavily):**
The system prompt already contains: Target Audience, Specific Situations, Pain Points, Hidden Frustrations, Desired Outcomes, Objections, and the Persuasion Framework. These are the main inputs. Your copy must be built around them — situations, pains, outcomes, and framework drive structure and messaging.

${instructionsGuidance}
${objectionGuidance}

**OUTPUT REQUIREMENT:** Return ONLY the copy in HTML format. No preamble, no explanation, no meta-language like "The copy should..." or "This approach...". Start directly with <div class="content-row">.

**BLOCK ORDER:** Every content-row must follow the cycle: Statement → Impact → Evidence → Relevance → Statement → Impact → Evidence → Relevance... Do not skip or reorder blocks.

**LAYOUT:** All text must flow vertically in a single column with line breaks. NEVER use columns, flex row, grid, or side-by-side layout.`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "gpt-4o",
            max_tokens: 16000, // Increase max tokens to allow for longer responses
        });

        const content = completion.choices[0].message.content;
        
        // Check if OpenAI returned a content policy rejection
        if (content && (content.includes("I'm very sorry") || content.includes("can't assist") || content.includes("content policy"))) {
            throw new Error("OpenAI content policy: The request was rejected. This may be due to the topic, instructions, or prompt complexity. Try simplifying the instructions or adjusting the content focus.");
        }

        return cleanContent(content);
    } catch (error) {
        console.error("OpenAI Error:", error);
        
        // Provide more helpful error messages
        if (error.message && error.message.includes("content policy")) {
            throw error;
        } else if (error.message && error.message.includes("rate limit")) {
            throw new Error("Rate limit exceeded. Please wait a moment and try again.");
        } else if (error.message && error.message.includes("invalid_api_key")) {
            throw new Error("Invalid API key. Please check your OpenAI API key in settings.");
        } else if (error.response?.status === 429) {
            throw new Error("Rate limit exceeded. Please wait a moment and try again.");
        } else if (error.response?.status === 401) {
            throw new Error("Invalid API key. Please check your OpenAI API key in settings.");
        } else if (error.response?.status === 403) {
            throw new Error("Access forbidden. This may be a content policy issue. Try adjusting your instructions.");
        }
        
        throw error;
    }
};

export const analyzeCopy = async (apiKey, text) => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are an expert copy analysis engine.
Your task is to re-format the provided text into the "ColorWriter" Row Layout using ONLY the Persuasive Cycle block types.

**BLOCK TYPES** (Use ONLY these four - Persuasive Cycle):
1. **block-statement** — Clear idea or claim. Headlines, main assertions, direct statements.
2. **block-impact** — Why it matters. Consequences, significance, emotional weight, "what this means for you."
3. **block-evidence** — Proof, logic, credibility. Facts, data, testimonials, mechanisms, reasoning.
4. **block-relevance** — Why THIS audience should care NOW. "If you're someone who…", "This matters especially when…", identity-level connection.

**CRITICAL RULES**:
1. Every section should follow Statement → Impact → Evidence → Relevance where possible.
2. Classify each paragraph/headline into the MOST accurate of the four types.
3. Use block-statement for openings, headlines, and clear claims.
4. Use block-impact for significance and consequences.
5. Use block-evidence for proof, logic, and mechanism.
6. Use block-relevance for audience connection and "why you" moments.
7. Every row needs a block type icon in the gutter that matches the block type class.

**Output Structure**:
<div class="content-row">
  <div class="gutter"><i type="statement"></i></div>
  <div class="content-body">
    <div class="block-statement"><h1><span>Your headline here</span></h1></div>
  </div>
</div>

Gutter icon types: statement, impact, evidence, relevance (match the block type).

**Formatting Constraints**:
- **ONE ROW PER BLOCK**: Each content-row must contain exactly ONE block. No columns, no side-by-side layout. Vertical stack only.
- **SINGLE COLUMN**: All text must flow vertically. NEVER use display:flex, display:grid, column-count, or any layout that creates columns. Use line breaks and paragraphs.
- **SPAN WRAPPERS**: Wrap the inner text of every &lt;h1&gt;, &lt;h2&gt;, &lt;h3&gt;, and &lt;p&gt; in a &lt;span&gt; tag.
- **NO EXTRA SPACE**: Do not add newlines or spaces inside the block-[type] div.
- **TIGHT HTML**: Write compact HTML on single lines where possible.

CRITICAL: Use ONLY block-statement, block-impact, block-evidence, block-relevance. No other block types.
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

**CRITICAL: BE HONEST AND ACCURATE**
You must provide truthful, realistic feedback. Do NOT sugar-coat or give best-case scenarios. Be critical and specific. If something doesn't work, say it clearly. If something is weak, identify it accurately. Your goal is to help improve the copy, not to make the writer feel good.

**Context**:
This text uses the Persuasive Cycle (block types) to achieve its goal. The copy contains four block types:
- **Statement** 📌: Clear idea or claim, headlines, main assertions
- **Impact** ⚡: Why it matters, consequences, significance
- **Evidence** 📋: Proof, logic, credibility, facts, testimonials, mechanisms
- **Relevance** 🎯: Why THIS audience should care NOW, identity-level connection

**Goal of this copy**: The purpose of this "${docType}" is to persuade the target audience to take a specific action. Persuasion comes through clarity, relevance, authority, and inevitability — never hype or pressure.

**Task**:
Analyze how the *mix* of Persuasive Cycle block types serves the goal. Be honest about what's actually working and what's not. Base your assessment on the actual content quality.

Provide your raw, honest thoughts on:
- Which block types are present and actually working well (be specific)
- Which block types are missing or over-represented (identify real problems)
- Whether the Persuasive Cycle (Statement → Impact → Evidence → Relevance) is followed
- Whether relevance is repeated consistently (mandatory in the framework)
- Whether the copy achieves its goal given the block types used

**Assessment Rules**:
- Be critical: If something is mediocre, say it's mediocre
- Be specific: Point to actual examples in the text
- Be honest: If statements lack impact or evidence, say so clearly
- Be realistic: Base scores on actual quality

Examples of HONEST feedback:
- "Too much Statement without Evidence - claims feel unsubstantiated. Needs more Evidence blocks."
- "Relevance is missing - the copy doesn't connect to why THIS audience should care. Add Relevance blocks."
- "The Persuasive Cycle is incomplete in several sections - Impact and Relevance are skipped."

Focus ONLY on the Persuasive Cycle block types and how they serve the copy's goal.

Return the response in JSON format:
{
  "thoughts": "String describing what you think/feel when reading, referencing the block types (colors) used and how they serve the copy's goal.",
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

    // Check if this is a Four Key Ingredients improvement (includes Big Idea)
    const isFourKeyIngredientsImprovement = feedbackData.improvements && 
        feedbackData.improvements.some(imp => imp.includes('The Big Idea') || imp.includes('Big Idea'));
    
    // Extract Big Idea specific feedback if present
    const bigIdeaImprovement = feedbackData.improvements?.find(imp => imp.includes('The Big Idea') || imp.includes('Big Idea'));
    
    const bigIdeaSection = isFourKeyIngredientsImprovement && bigIdeaImprovement ? `
**CRITICAL: THE BIG IDEA IMPROVEMENT (HIGHEST PRIORITY)**

The feedback specifically calls out that the Big Idea needs improvement. This is the MOST IMPORTANT improvement to make.

**What is The Big Idea?**
The Big Idea is a belief-shifting insight that makes buying feel obvious. It's not a slogan or headline - it's a new way of seeing the problem that instantly reorders the reader's beliefs.

**The Big Idea must:**
1. Contradict what they currently believe
2. Explain why past efforts failed
3. Make the solution feel inevitable

**The Classic Formula:**
"You don't need X… You need Y… Because Z."

**Big Idea Feedback to Address:**
${bigIdeaImprovement}

**HOW TO IMPROVE THE BIG IDEA:**
- Identify the false belief the reader currently holds about their problem
- Create a clear statement that contradicts that belief using the "You don't need X… You need Y… Because Z" formula
- Make this statement appear early in the copy (ideally in the first few paragraphs)
- Reinforce it throughout the copy
- Ensure it explains why past solutions failed
- Make the solution feel inevitable, not just helpful

**Examples of Strong Big Ideas:**
- "You don't need to calm your thoughts — you need to calm your nervous system."
- "You don't need willpower — you need to remove friction."
- "You don't need more information — you need a faster state change."

**The Litmus Test:**
After reading, the reader should think:
- "I've never heard it put that way."
- "That explains everything."
- "This makes so much sense it's almost annoying."
- "Why didn't anyone tell me this earlier?"

If they just think "Sounds helpful," the Big Idea isn't strong enough yet.

**YOUR TASK FOR BIG IDEA:**
Rewrite the copy to include a clear, compelling Big Idea that:
1. Uses the "You don't need X… You need Y… Because Z" formula
2. Appears early and is reinforced throughout
3. Contradicts their current belief
4. Explains why past solutions failed
5. Makes the solution feel inevitable

This is the TOP PRIORITY improvement. Make sure the Big Idea is crystal clear and powerful.
` : '';

    const systemPrompt = `You are an expert copywriter.
Target Audience: ${targetAudience}
Doc Type: ${docType}
Style: ${style}

**Goal**: Improve the provided text based on the specific Audience Feedback.

**Feedback to Address**:
Thoughts: "${feedbackData.thoughts}"
Improvements: ${JSON.stringify(feedbackData.improvements)}

${bigIdeaSection}

**SHOW, DON'T TELL (MANDATORY)**:
Every claim MUST be demonstrated through observable outcomes. Replace vague statements with specific moments, sensations, and decisions.

**OUTCOME-BASED LANGUAGE (CRITICAL)**:
Every sentence must show what happens (outcome), not what it is (feature). Answer: "What outcome does this create?" not "What is this?"

FORBIDDEN: "This is powerful", "You'll learn faster", "This will help you", "It works", "You'll improve"
REQUIRED: Show specific outcomes with concrete scenarios and observable changes.

**FOUR FOUNDATIONAL PRINCIPLES (APPLY TO ALL IMPROVEMENTS)**:
1. **Deep, Precise Understanding**: Make the reader feel seen in the first 5 seconds. Use their exact language and inner reality.
2. **Clear, Believable Mechanism**: Explain WHY this works when everything else didn't. Not what it does, but why it works.
3. **Emotional Movement → Relief**: Follow the arc: Agitation → Recognition → Relief → Control. Sell the end of fear, not more fear.
4. **The Big Idea**: ${isFourKeyIngredientsImprovement ? 'CRITICALLY IMPORTANT - See Big Idea section above. This must be clear, compelling, and use the "You don\'t need X… You need Y… Because Z" formula.' : 'Create a belief-shifting insight that contradicts their current belief, explains why past efforts failed, and makes the solution feel inevitable.'}

**Output Structure**:
Retain the structured HTML with classes (\`<div class="content-row">\`, \`<div class="gutter">\`, \`<div class="block-...">\`).
Re-write the content to solve the audience's complaints while keeping the good parts. Apply show don't tell and outcome-based language throughout.

**Formatting Constraints**:
- **SPAN WRAPPERS**: You MUST wrap the inner text of every &lt;h1&gt;, &lt;h2&gt;, &lt;h3&gt;, and &lt;p&gt; in a &lt;span&gt; tag. Example: &lt;h1&gt;&lt;span&gt;Title&lt;/span&gt;&lt;/h1&gt;
- **NO EXTRA SPACE**: Do not add newlines or spaces inside the block-[type] div.
- **TIGHT HTML**: Write &lt;div class='block-story'&gt;&lt;p&gt;&lt;span&gt;Text...&lt;/span&gt;&lt;/p&gt;&lt;/div&gt; on a SINGLE line if possible.
- **SINGLE COLUMN**: All text must flow vertically. NEVER use columns, flex row, grid, or side-by-side layout.

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

        return cleanContent(completion.choices[0].message.content);
    } catch (error) {
        console.error("OpenAI Improve Error:", error);
        throw error;
    }
};

export const improveInputs = async (apiKey, inputs, customMasterPrompt) => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const masterPromptContext = customMasterPrompt && customMasterPrompt.trim()
        ? `The user has a custom master prompt that defines the copywriting framework. Use it to guide improvements:\n\n${customMasterPrompt.slice(0, 2000)}`
        : 'Use the standard direct-response copywriting framework: persuasion through clarity, relevance, authority, and inevitability.';

    const systemPrompt = `You are an elite senior direct-response copywriter and persuasion strategist.

${masterPromptContext}

**YOUR TASK**:
Improve and sharpen the user's input fields for a ${inputs.docType || 'sales page'} targeting ${inputs.targetAudience || 'an audience'}.

**RULES**:
1. For fields that HAVE real content: Improve and sharpen the text. Make it more specific, persuasive, and aligned with the master prompt. Return the improved version.
2. For fields that are EMPTY or contain ONLY placeholder text (e.g. "• Pain 1", "• Pain 2", "e.g. Relief, Hope", "• Objection 1"): Generate exactly 3 strong, specific suggestions the user can choose from. Each suggestion should be tailored to the target audience and document type.

**FIELD DEFINITIONS** (use these exact keys in your JSON):
- targetAudience
- situationsList (list format, one per line with •)
- painPoints (list format)
- hiddenFrustrations (list format)
- desiredOutcomes (list format)
- objections (list format)
- oldBelief
- newBelief
- desiredEmotion
- primaryCta

**OUTPUT FORMAT** - Return ONLY valid JSON:
{
  "improved": {
    "targetAudience": "improved value or null if was empty",
    "situationsList": "improved value or null",
    "painPoints": "improved value or null",
    "hiddenFrustrations": "improved value or null",
    "desiredOutcomes": "improved value or null",
    "objections": "improved value or null",
    "oldBelief": "improved value or null",
    "newBelief": "improved value or null",
    "desiredEmotion": "improved value or null",
    "primaryCta": "improved value or null"
  },
  "suggestions": {
    "targetAudience": ["suggestion 1", "suggestion 2", "suggestion 3"] or null,
    "situationsList": ["suggestion 1", "suggestion 2", "suggestion 3"] or null,
    "painPoints": ["suggestion 1", "suggestion 2", "suggestion 3"] or null,
    "hiddenFrustrations": ["suggestion 1", "suggestion 2", "suggestion 3"] or null,
    "desiredOutcomes": ["suggestion 1", "suggestion 2", "suggestion 3"] or null,
    "objections": ["suggestion 1", "suggestion 2", "suggestion 3"] or null,
    "oldBelief": ["suggestion 1", "suggestion 2", "suggestion 3"] or null,
    "newBelief": ["suggestion 1", "suggestion 2", "suggestion 3"] or null,
    "desiredEmotion": ["suggestion 1", "suggestion 2", "suggestion 3"] or null,
    "primaryCta": ["suggestion 1", "suggestion 2", "suggestion 3"] or null
  }
}

For "improved": include the field only if it had real content to improve. Use null for empty fields.
For "suggestions": include exactly 3 suggestions only for fields that were empty or placeholder-only. Use null for fields that had content.
`;

    const userPrompt = `Improve these inputs:

Document Type: ${inputs.docType || 'Sales Page'}
Offer Type: ${inputs.offerType || 'Mid-ticket'}
Target Audience: ${inputs.targetAudience || ''}
Specific Situations: ${inputs.situationsList || ''}
Pain Patterns: ${inputs.painPoints || ''}
Hidden Frustrations: ${inputs.hiddenFrustrations || ''}
Desired Outcomes: ${inputs.desiredOutcomes || ''}
Common Objections: ${inputs.objections || ''}
Old Belief: ${inputs.oldBelief || ''}
New Belief: ${inputs.newBelief || ''}
Desired Emotion After Reading: ${inputs.desiredEmotion || ''}
Primary CTA: ${inputs.primaryCta || ''}

Return ONLY the JSON object.`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" },
            temperature: 0.7
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error("OpenAI Improve Inputs Error:", error);
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

export const analyzeColorBalance = async (apiKey, text, targetAudience, docType) => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are a copy auditing expert. 
Your goal is to analyze the BALANCE of "Color Blocks" (block types) in the text, relative to the Target Audience and the copy's goal.

**CRITICAL: BE HONEST AND ACCURATE**
You must provide truthful, realistic analysis. Count the actual block types present. Identify real problems based on actual content, not best-case assumptions. If there's a clear imbalance, report it accurately. Don't give "nice" answers - give accurate ones.

**Context**:
- **Block Types/Colors**: Hook 🎯, Story 📖, Emotion ❤️, Logic 🧠, Proof ✅, CTA 🚀, Ad 💡, Misc 📝
- **Target Audience**: "${targetAudience}"
- **Copy Goal**: The purpose of this "${docType || 'copy'}" is to persuade the target audience to take a specific action or adopt a belief

**Task**:
1. Count and analyze which block types are actually used throughout the text (be precise with counts)
2. Determine what is **Over-represented** (too much of it, actually hurting conversion based on real content quality and audience needs)
3. Determine what is **Lacking** (genuinely missing or insufficient, based on what this audience and goal actually require)

**Analysis Rules**:
- Base assessment on actual block type counts, not assumptions
- Consider real content quality: 10 weak emotion blocks is worse than 3 strong ones
- Match to actual audience needs: This specific audience needs X, not generic "needs emotion"
- Match to actual copy goal: This ${docType} requires Y blocks to convert, not a generic mix
- Be specific: "Missing Proof blocks - only 1 proof block for a sales page that makes 8 claims" is better than "Needs more proof"
- Identify real problems: If Logic is 60% of blocks but audience needs Story, that's a real problem, not a "consideration"

Consider both:
- How the block type balance actually serves the copy's goal (based on real content, not hopes)
- How the block type balance actually serves the target audience (based on what this audience needs to convert)

Focus ONLY on block types (colors), not personas or other elements.

Return JSON:
{
  "over_represented": {
    "item": "Name of Block Type/Color (e.g. 'Logic (Blue)' or 'Story (Yellow)' or 'Emotion (Pink)')",
    "reason": "Why this block type is too much for this audience and copy goal."
  },
  "lacking": {
    "item": "Name of Block Type/Color",
    "reason": "Why this block type is needed for this audience and copy goal."
  },
  "suggestion": "One sentence summary on how to fix the balance by adjusting block types to better serve the copy's goal."
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

export const analyzeThreeKeyIngredients = async (apiKey, text, targetAudience) => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are a world-class copy auditing expert specializing in conversion copywriting.
Your task is to analyze the provided copy against the FOUR FOUNDATIONAL PRINCIPLES of high-converting copy.

**CRITICAL: BE HONEST AND ACCURATE**
You must provide truthful, realistic scores and feedback. Base your analysis on actual content quality, not best-case assumptions. Be critical and specific.

**THE THREE FOUNDATIONAL PRINCIPLES:**

**1. DEEP, PRECISE UNDERSTANDING OF THE READER (Not demographics. Not avatars. Inner reality.)**

Every great copywriter agrees: Copy is not written. It's overheard.

Good copy doesn't sound "clever." It sounds like the reader's private thoughts… said back to them slightly clearer.

**What this means:**
- Does the copy know what they're afraid to admit?
- Does it know what keeps them up at night?
- Does it know what they've already tried — and why it failed?
- Does it use the exact words they use in their head?

**Rule used by pros:**
If the reader doesn't feel seen in the first 5 seconds, nothing else matters.

**BAD COPY (Generic):**
"Struggling with anxiety?"

**GREAT COPY (Inner reality):**
"You can hold it together all day… but the moment you're alone, your chest tightens."

**2. A CLEAR, BELIEVABLE MECHANISM (Why this works when everything else didn't)**

Experts agree: People don't buy outcomes. They buy explanations.

Not what it does — why it works.

**The mechanism must answer:**
- Why past solutions failed
- Why this is different
- Why it makes sense right now

It doesn't need to be complex — it needs to be coherent.

**Examples of clear mechanisms:**
- "It works because it shuts down the stress response"
- "It works because it removes friction at the nervous system level"
- "It works because it changes the state, not the thoughts"

**Without a mechanism:**
- You sound like every other offer
- You trigger skepticism
- You force the reader to "just trust you" (they won't)

**With a mechanism:**
- Resistance drops
- Buying feels logical
- Relief starts before they purchase

**3. EMOTIONAL MOVEMENT → RELIEF (Tension in. Relief out.)**

All high-converting copy follows the same emotional arc:

**Agitation → Recognition → Relief → Control**

**Great copy:**
- Brings the pain close (without exaggeration)
- Makes the reader feel understood (not attacked)
- Then opens a door to relief

**Important nuance:**
You don't sell fear. You sell the end of fear.

**Bad copy keeps twisting the knife.**
**Great copy says:**
"You don't need to fight this anymore."

**This is why:**
- Stories outperform bullet points
- Calm confidence converts better than hype
- "Finally…" is one of the most powerful words in copy

**The reader isn't buying a product. They're buying:**
- A felt sense of safety
- A return to control
- A future where this problem no longer runs their life

**4. THE BIG IDEA (The belief-shifting insight that makes buying feel obvious)**

The Big Idea is not:
- A slogan
- A headline
- A feature
- A clever turn of phrase

The Big Idea is:
- A new, compelling way of seeing the problem that instantly reorders the reader's beliefs
- It creates a before and after in the mind

**Before the Big Idea:**
"Anxiety is something I have to manage, cope with, or live with."

**After the Big Idea:**
"Anxiety is a biological state I can shut off."

That belief shift is the sale.

**What All Copywriting Experts Agree On:**
The Big Idea must:
- Contradict what they currently believe
- Explain why past efforts failed
- Make the solution feel inevitable

If it doesn't do all three, it's not a Big Idea — it's just a claim.

**The Classic Formula (Used by Ogilvy, Schwartz, Brunson, Hormozi):**
"You don't need X… You need Y… Because Z."

**Examples:**
- "You don't need to calm your thoughts — you need to calm your nervous system."
- "You don't need willpower — you need to remove friction."
- "You don't need more information — you need a faster state change."

**Why the Big Idea Is So Powerful:**
Because it eliminates alternatives.

When the Big Idea lands:
- Therapy doesn't feel wrong — just slow
- Meditation doesn't feel bad — just indirect
- "Just relax" feels irrelevant

The reader doesn't think: "Should I buy this?"
They think: "This finally explains why nothing else worked."

That's when resistance collapses.

**The Litmus Test:**
A Big Idea is working if the reader thinks:
- "I've never heard it put that way."
- "That explains everything."
- "This makes so much sense it's almost annoying."
- "Why didn't anyone tell me this earlier?"

If they just think: "Sounds helpful." — You don't have a Big Idea yet.

**The Hidden Truth:**
Great copy doesn't convince. It reveals something the reader already felt was true — but couldn't articulate. The Big Idea gives language to that feeling.

**One-Sentence Rule:**
If your copy doesn't change what the reader believes about their problem, no amount of persuasion will save it.

**SCORING SYSTEM (0-100 for each principle):**
- 0-40: Poor/Weak - Missing critical elements, doesn't demonstrate the principle
- 41-60: Mediocre/Average - Has elements but weak execution or missing key pieces
- 61-75: Good - Solid but has room for improvement
- 76-85: Very Good - Strong execution, minor gaps
- 86-95: Excellent - Outstanding, only small refinements needed
- 96-100: World-Class - Exceptional, demonstrates mastery of the principle

**Target Audience**: ${targetAudience || 'General audience'}

**ANALYSIS REQUIREMENTS:**
- Score each principle 0-100 based on ACTUAL content quality
- Provide specific, actionable feedback for each principle
- Identify exact examples from the copy (good and bad)
- Be honest: Most copy scores 50-70, not 80-90. Only exceptional copy should score 85+
- Match scores to reality: Weak elements get low scores, strong elements get high scores

**FEEDBACK REQUIREMENTS:**
- Be specific: "First 5 seconds use generic language ('Struggling with anxiety?') instead of inner reality" not "Needs better understanding"
- Identify real problems: "No mechanism explained - just claims without explanation" not "Mechanism could be clearer"
- Be actionable: "Add 2-3 sentences showing what they're afraid to admit" not "Needs more understanding"
- Match feedback to score: If score is 45, feedback should clearly explain why it's weak
- Provide examples: Quote actual lines from the copy that demonstrate or fail the principle

Return ONLY a JSON object with this EXACT structure:
{
  "understanding": {
    "score": 65,
    "feedback": "The copy shows some understanding of the reader's situation but uses generic language in the opening. The first line 'Struggling with anxiety?' is cliché and doesn't demonstrate deep understanding. However, later sections like 'You can hold it together all day… but the moment you're alone, your chest tightens' show excellent inner reality. The copy needs to establish this level of understanding in the first 5 seconds. Add specific details about what they're afraid to admit and what they've already tried.",
    "strengths": ["Later sections show good understanding of inner experience", "Uses relatable language in middle sections"],
    "weaknesses": ["Opening is generic and cliché", "Doesn't establish deep understanding in first 5 seconds", "Missing specific details about what they've tried"]
  },
  "mechanism": {
    "score": 50,
    "feedback": "The copy mentions '3 systems causing anxiety' but doesn't clearly explain WHY past solutions failed or WHY this is different. The mechanism is mentioned but not fully developed. Claims are made without clear cause-and-effect logic. The reader is asked to 'just trust' rather than understanding the mechanism. Add clear explanation of why past solutions failed, why this addresses the root cause, and simple cause-and-effect logic.",
    "strengths": ["Mentions a mechanism (3 systems)", "Attempts to explain how it works"],
    "weaknesses": ["Doesn't explain why past solutions failed", "Mechanism not fully developed", "Lacks clear cause-and-effect logic", "Asks reader to trust without explanation"]
  },
  "emotional_movement": {
    "score": 70,
    "feedback": "The copy follows a good emotional arc from agitation to recognition, but doesn't fully deliver on relief. The pain is brought close effectively ('You can hold it together all day… but the moment you're alone, your chest tightens'), and recognition is strong. However, the relief feels rushed and the sense of control at the end is weak. The copy needs more emphasis on 'the end of fear' rather than just describing the solution. Add stronger relief moments and a clearer sense of control/future without the problem.",
    "strengths": ["Good recognition of pain", "Effective agitation without exaggeration", "Stories used effectively"],
    "weaknesses": ["Relief feels rushed", "Weak sense of control at the end", "Doesn't fully sell 'the end of fear'", "Missing 'Finally…' moments"]
  },
  "big_idea": {
    "score": 55,
    "feedback": "The copy mentions a new way of seeing the problem but doesn't fully establish a clear Big Idea that shifts beliefs. The reader may understand the mechanism but doesn't experience the 'before and after' belief shift. The copy needs a clearer statement that contradicts their current belief, explains why past solutions failed, and makes the solution feel inevitable. Use the formula 'You don't need X… You need Y… Because Z' to create a clear Big Idea that eliminates alternatives.",
    "strengths": ["Attempts to reframe the problem", "Mentions why past solutions failed"],
    "weaknesses": ["Big Idea not clearly stated or reinforced", "Doesn't create clear 'before and after' belief shift", "Doesn't use the 'You don't need X… You need Y… Because Z' formula", "Reader may still think 'Sounds helpful' rather than 'That explains everything'"]
  },
  "overall_score": 62,
  "overall_feedback": "The copy demonstrates solid understanding in places and attempts to explain a mechanism, but needs significant improvement in establishing deep understanding early, fully developing the mechanism, delivering stronger emotional movement toward relief, and creating a clear Big Idea that shifts beliefs. Focus on: (1) Rewriting the opening to show deep understanding in the first 5 seconds, (2) Fully explaining why past solutions failed and why this is different, (3) Strengthening the relief and control sections to sell 'the end of fear', (4) Creating and reinforcing a clear Big Idea using the 'You don't need X… You need Y… Because Z' formula."
}
`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Analyze this copy against the four foundational principles:\n\n${stripTags(text)}` }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" },
            temperature: 0.1
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error("OpenAI Three Key Ingredients Analysis Error:", error);
        throw error;
    }
};

export const analyzeThreeRules = async (apiKey, text, targetAudience) => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are a world-class copy auditing expert specializing in conversion copywriting.
Your task is to analyze the provided copy against THREE CRITICAL RULES that separate great copy from generic marketing fluff.

**CRITICAL: BE HONEST AND ACCURATE**
You must provide truthful, realistic scores and feedback. Base your analysis on actual content quality, not best-case assumptions. Be critical and specific.

**THE THREE RULES:**

**1. CAN YOU VISUALIZE IT? 👀**

Meaning:
If your reader can't picture what you're saying, it's probably too vague to be persuasive.

Good writing creates images, not ideas.
"Grow your business faster" is fog.
"Wake up to three Stripe notifications before breakfast" is a picture.

How to test it:
Read the line and ask: If this were a movie scene, what would be on screen?
If the answer is "uh… words?" → rewrite.

Why it works:
The brain remembers images far better than abstractions. Visual language sneaks past skepticism and lands emotionally.

**Scoring for Visualization:**
- 0-40: Mostly abstract, vague language ("transform your life", "grow faster", "be successful")
- 41-60: Some visual elements but still too abstract in key areas
- 61-75: Good mix of visual and abstract language
- 76-85: Strong visual language throughout, readers can picture most claims
- 86-100: Exceptional - every claim creates a clear mental image

**2. CAN YOU FALSIFY IT? 🧪**

Meaning:
A claim should be specific enough that it could be proven wrong.

If it can't be falsified, it's usually marketing fluff.

Not falsifiable:
"This will transform your life"
"The best system for success"

Falsifiable:
"Write for 20 minutes a day for 30 days and publish 10 pieces"
"Cut your email writing time in half using this template"

How to test it:
Ask: What evidence would prove this wrong?
If the answer is "nothing," it's too vague to trust.

Why it works:
Specificity signals confidence. Confidence builds credibility.

**Scoring for Falsifiability:**
- 0-40: Mostly unfalsifiable claims ("transform", "best", "revolutionary" without specifics)
- 41-60: Some specific claims but many vague ones remain
- 61-75: Good balance of specific and vague claims
- 76-85: Most claims are specific and falsifiable
- 86-100: Exceptional - every claim is specific, measurable, and falsifiable

**3. CAN NOBODY ELSE SAY IT? 🧬**

Meaning:
Is this tied to your experience, voice, or perspective—or could literally anyone in your industry post it on LinkedIn tomorrow?

If anyone can say it, it won't be remembered.

Generic:
"Consistency is key"
"Focus on providing value"

Distinct:
"I built my first course by emailing 12 people who already trusted me—and ignored everyone else"

How to test it:
Ask: If I removed my name, would this still clearly be mine?
If not, it needs more personal specificity.

Why it works:
Originality doesn't come from clever phrasing—it comes from lived experience.

**Scoring for Originality:**
- 0-40: Generic, could be written by anyone in the industry
- 41-60: Some unique elements but mostly generic
- 61-75: Good mix of generic and unique content
- 76-85: Strong personal voice and unique perspective throughout
- 86-100: Exceptional - unmistakably original, tied to specific experience

**ANALYSIS REQUIREMENTS:**

For each rule, provide:
1. **Score** (0-100): Based on actual content quality
2. **Feedback**: Specific, honest assessment with examples from the copy
3. **Examples**: Quote specific lines that demonstrate the rule (good or bad)
4. **Strengths**: What's working well (if any)
5. **Weaknesses**: What needs improvement (be specific)

**Scoring Guidelines:**
- Base scores on actual content, not what might be implied
- If copy is mostly vague, score 30-50, not 70-80
- If copy is generic, score 20-40, not 60-70
- Be honest: Most copy scores 40-60, not 80-90
- Only exceptional copy should score 85+

Return ONLY a JSON object with this EXACT structure:
{
  "overall_score": 65,
  "overall_feedback": "Brief summary of overall performance across all three rules",
  "visualization": {
    "score": 70,
    "feedback": "Specific assessment of visual language usage",
    "examples": ["Example line 1", "Example line 2"],
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"]
  },
  "falsifiability": {
    "score": 60,
    "feedback": "Specific assessment of claim specificity",
    "examples": ["Example line 1", "Example line 2"],
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"]
  },
  "originality": {
    "score": 65,
    "feedback": "Specific assessment of unique voice and perspective",
    "examples": ["Example line 1", "Example line 2"],
    "strengths": ["Strength 1", "Strength 2"],
    "weaknesses": ["Weakness 1", "Weakness 2"]
  }
}
`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Analyze this copy against the three rules:\n\n${stripTags(text)}` }
            ],
            model: "gpt-4o",
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error("OpenAI Three Rules Analysis Error:", error);
        throw error;
    }
};

export const improveCopyThreeRules = async (apiKey, originalText, analysisData, docType, style, targetAudience, copywriter) => {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are an elite copywriter. Your task is to improve the provided copy based on the THREE RULES analysis.

**YOUR IDENTITY**:
${copywriter && copywriter !== 'None' ? `Write EXACTLY like ${copywriter}. Emulate their tone, vocabulary, sentence structure, and persuasion techniques.` : 'Write as an expert A-list copywriter.'}

**CONTEXT**:
- Target Audience: ${targetAudience}
- Document Type: ${docType}
- Writing Style: ${style}

**LANGUAGE CONSTRAINT**: 
Write at a **5th-grade reading level**. Simple, punchy, clear language.

**THE THREE RULES TO APPLY:**

**1. CAN YOU VISUALIZE IT? 👀**
- Replace abstract language with concrete, visual descriptions
- Instead of "grow your business" → "wake up to three Stripe notifications before breakfast"
- Instead of "feel better" → "walk up stairs without gasping"
- Create mental images readers can see, not just understand
- Every claim should paint a picture

**2. CAN YOU FALSIFY IT? 🧪**
- Replace vague claims with specific, measurable statements
- Instead of "transform your life" → "write for 20 minutes a day for 30 days and publish 10 pieces"
- Instead of "the best system" → "cut your email writing time in half using this template"
- Make every claim specific enough that it could be proven wrong
- Use numbers, timeframes, specific outcomes

**3. CAN NOBODY ELSE SAY IT? 🧬**
- Replace generic statements with personal, specific experiences
- Instead of "consistency is key" → "I built my first course by emailing 12 people who already trusted me—and ignored everyone else"
- Instead of "focus on value" → "I stopped posting daily and only wrote when I had something that made my hands shake"
- Tie claims to specific experiences, stories, or perspectives
- Make it unmistakably yours

**CURRENT ANALYSIS SCORES**:
- Visualization: ${analysisData.visualization?.score || 0}/100 - ${analysisData.visualization?.feedback || 'N/A'}
- Falsifiability: ${analysisData.falsifiability?.score || 0}/100 - ${analysisData.falsifiability?.feedback || 'N/A'}
- Originality: ${analysisData.originality?.score || 0}/100 - ${analysisData.originality?.feedback || 'N/A'}

**IMPROVEMENT PRIORITIES**:
${analysisData.visualization?.weaknesses?.length > 0 ? `- Visualization weaknesses: ${analysisData.visualization.weaknesses.join('; ')}` : ''}
${analysisData.falsifiability?.weaknesses?.length > 0 ? `- Falsifiability weaknesses: ${analysisData.falsifiability.weaknesses.join('; ')}` : ''}
${analysisData.originality?.weaknesses?.length > 0 ? `- Originality weaknesses: ${analysisData.originality.weaknesses.join('; ')}` : ''}

**HOW TO IMPROVE**:

1. **For Visualization (if score < 80)**:
   - Find every abstract claim and replace it with a visual description
   - Use specific scenes, actions, and sensory details
   - Show, don't tell - create mental images

2. **For Falsifiability (if score < 80)**:
   - Find every vague claim and make it specific
   - Add numbers, timeframes, measurable outcomes
   - Make claims testable and provable

3. **For Originality (if score < 80)**:
   - Find every generic statement and replace with personal experience
   - Add specific stories, numbers, or unique perspectives
   - Make it impossible for competitors to say the same thing

**OUTPUT STRUCTURE**:
Return the FULL improved copy in the ColorWriter HTML format:
\`\`\`
<div class="content-row">
  <div class="gutter"><i type='hook'></i></div>
  <div class="content-body">
    <div class="block-hook"><h1><span>Improved headline</span></h1></div>
  </div>
</div>
\`\`\`

**Formatting Constraints**:
- **SPAN WRAPPERS**: Wrap all <h1>, <h2>, <h3>, <p> text in <span> tags
- **NO EXTRA SPACE**: No newlines inside block divs
- **TIGHT HTML**: Compact formatting
- **BLOCK TYPES**: Use appropriate block types (hook, story, emotion, logic, proof, cta, ad, misc)
- **ICONS**: Every gutter MUST have the correct icon matching the block type

**CRITICAL REQUIREMENTS**:
- Apply all three rules throughout the entire copy
- Focus on the weakest areas first (lowest scores)
- Keep what's working (high scores)
- Maintain the same structure and flow
- Don't make it shorter - improve quality by making it more visual, specific, and original

Return ONLY the improved HTML.
`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: originalText }
            ],
            model: "gpt-4o",
            max_tokens: 16000,
        });

        const cleanedContent = cleanContent(completion.choices[0].message.content);
        return cleanedContent;
    } catch (error) {
        console.error("OpenAI Improve Three Rules Error:", error);
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

**SHOW, DON'T TELL (MANDATORY)**:
Every claim MUST be demonstrated through observable outcomes. Replace vague statements with specific moments, sensations, and decisions. Show what happens, not what it is.

**OUTCOME-BASED LANGUAGE (CRITICAL)**:
Every sentence must show outcomes with concrete scenarios. Answer "What outcome does this create?" not "What is this?" FORBIDDEN: "This is powerful", "You'll improve", "It works". REQUIRED: Show specific outcomes with observable changes.

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
    Your task is to analyze the provided copy and score it from 0-100 on 6 key conversion metrics based on the Target Audience: ${targetAudience}.

    **CRITICAL: BE HONEST AND REALISTIC**
    You must provide truthful scores based on actual content quality. Do NOT inflate scores or give best-case scenarios. Be critical and accurate:
    - 0-40: Poor/Weak - Missing critical elements, doesn't work
    - 41-60: Mediocre/Average - Has elements but weak execution or missing key pieces
    - 61-75: Good - Solid but has room for improvement
    - 76-85: Very Good - Strong execution, minor gaps
    - 86-95: Excellent - Outstanding, only small refinements needed
    - 96-100: World-Class - Exceptional, conversion-optimized

    **Scoring Rules**:
    - Base scores on actual content, not what might be implied
    - If Hook is generic/cliché, score 40-50, not 70-80
    - If there's no proof, credibility is 0-20, not 50-60
    - If CTA is weak/missing, persuasion is 30-50, not 70-80
    - Be honest: Most copy scores 50-70, not 80-90. Only exceptional copy should score 85+
    - Match scores to reality: Weak elements get low scores, strong elements get high scores

    Metrics (Score each 0-100 based on ACTUAL quality):
    1. **Hook**: Is the opening actually attention-grabbing? Specific and interesting, or generic?
    2. **Relatability**: Does the copy actually match audience language/empathy? Or feels distant/off-brand?
    3. **Novelty**: Is there a genuinely new mechanism/angle? Or is it the same approach everyone uses?
    4. **Credibility**: Is there actual proof (specific numbers, names, results)? Or vague claims?
    5. **Persuasion**: Is the CTA clear and compelling? Does desire build logically?
    6. **Headers**: Are headlines clear, compelling, benefit-driven? Or vague/feature-focused?

    **Feedback Requirements**:
    - Be specific: "Hook is generic ('Transform your life') - needs specific recognition or curiosity gap" not "Hook could be stronger"
    - Identify real problems: "No proof provided for 5 major claims - credibility score: 15/100"
    - Be actionable: "Add 2-3 specific testimonials with names and results" not "Needs more proof"
    - Match feedback to score: If score is 45, feedback should clearly explain why it's weak

    Additionally, analyze the text to determine the **"Perfect Fit" Audience** based ONLY on the copy itself (tone, slang, pain points), ignoring any prior inputs. Be honest about who the copy actually speaks to, not who you think it should speak to.

    Return ONLY a JSON object with this EXACT structure:
    {
      "metrics": {
        "hook": { "score": 45, "feedback": "Hook is generic and cliché ('Transform your life'). Fails to grab attention because it sounds like every other product. Needs specific recognition or curiosity gap. Current score based on actual content quality." },
        "relatable": { "score": 60, "feedback": "Pain points mentioned but language feels corporate, not authentic to audience. Uses 'utilize' instead of 'use', 'facilitate' instead of 'help'. Needs more conversational tone matching actual audience voice." },
        "novelty": { "score": 35, "feedback": "No unique mechanism or angle presented. Same problem-solution approach used by competitors. Claims 'revolutionary' but offers nothing new. Needs distinctive framework or counter-intuitive insight." },
        "credibility": { "score": 20, "feedback": "Makes 8 major claims with zero proof. No testimonials, numbers, case studies, or specific results. Reader has no reason to trust these claims. Add 3-5 proof blocks with specific names/numbers." },
        "persuasion": { "score": 50, "feedback": "CTA is weak ('Get started') with no urgency or clear benefit. Desire-building is minimal - jumps from problem to solution without emotional journey. Needs stronger close and consequence clarity." },
        "headers": { "score": 55, "feedback": "Headlines are clear but lack impact. Focus on features ('Our System Helps') not benefits ('Stop Struggling in 7 Days'). Missing curiosity and urgency. Subheadlines are descriptive, not compelling." }
      },
      "perfect_audience_analysis": "Based on the actual text tone and language, this copy speaks to corporate professionals using business jargon ('leverage', 'synergy', 'optimize'). The pain points suggest mid-level managers in traditional companies. However, the lack of proof and weak CTA suggests it won't convert this audience effectively."
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

export async function improveConversionMetrics(apiKey, originalText, metricsData, docType, style, targetAudience, copywriter) {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are an expert copywriter optimizing for conversion.
    
    **YOUR IDENTITY**:
    ${copywriter && copywriter !== 'None' ? `Write EXACTLY like ${copywriter}. Emulate their tone, vocabulary, sentence structure, and persuasion techniques.` : 'Write as an expert A-list copywriter.'}
    
    **CONTEXT**:
    - Target Audience: ${targetAudience}
    - Document Type: ${docType}
    - Writing Style: ${style}

    **LANGUAGE CONSTRAINT**: 
    Write at a **5th-grade reading level**. Simple, punchy, clear language.

    **YOUR MISSION**: 
    IMPROVE the copy to boost conversion scores WITHOUT making it shorter or removing content.
    
    **CRITICAL - DO NOT SHORTEN**:
    - Keep the SAME LENGTH or make it LONGER
    - Do NOT remove paragraphs or sections
    - EXPAND weak areas, don't delete them
    - Add MORE detail, examples, and persuasion where needed

    **Current Conversion Scores**:
    - Hook (${metricsData.metrics?.hook?.score || 0}/100): ${metricsData.metrics?.hook?.feedback || 'N/A'}
    - Relatability (${metricsData.metrics?.relatable?.score || 0}/100): ${metricsData.metrics?.relatable?.feedback || 'N/A'}
    - Novelty (${metricsData.metrics?.novelty?.score || 0}/100): ${metricsData.metrics?.novelty?.feedback || 'N/A'}
    - Credibility (${metricsData.metrics?.credibility?.score || 0}/100): ${metricsData.metrics?.credibility?.feedback || 'N/A'}
    - Persuasion (${metricsData.metrics?.persuasion?.score || 0}/100): ${metricsData.metrics?.persuasion?.feedback || 'N/A'}

    **HOW TO IMPROVE EACH METRIC**:
    
    1. **Hook (if below 80)**: 
       - Make the opening MORE shocking, bold, or curiosity-driven
       - Use stronger power words, numbers, or questions
       - Add pattern interrupts or unexpected angles
    
    2. **Relatability (if below 80)**:
       - Add MORE personal stories, "you" language, and empathy
       - Include specific pain points the audience feels daily
       - Use their exact language/slang
    
    3. **Novelty (if below 80)**:
       - Introduce a UNIQUE mechanism, angle, or metaphor
       - Add creative comparisons or "Imagine if..." scenarios
       - Present a fresh perspective they haven't heard before
    
    4. **Credibility (if below 80)**:
       - Add SPECIFIC numbers, data, testimonials, or case studies
       - Include authority figures, research, or credentials
       - Use concrete examples instead of vague claims
    
    5. **Persuasion (if below 80)**:
       - Strengthen the CTA with urgency or scarcity
       - Build more desire by painting the "after" picture
       - Add social proof or FOMO elements

    **USE THE FULL COLOR SYSTEM**:
    - **block-hook**: Strong opening (ALWAYS first)
    - **block-story**: Add narratives and anecdotes
    - **block-emotion**: Amplify pain points and desires
    - **block-logic**: Include facts, data, mechanisms
    - **block-proof**: Add testimonials, results, case studies
    - **block-cta**: Clear, urgent calls to action
    - **block-ad**: Creative angles and metaphors
    - Use ALL block types throughout the copy

    **SHOW, DON'T TELL (MANDATORY)**:
    Every claim MUST be demonstrated through observable outcomes. Replace vague statements with specific moments, sensations, and decisions.
    
    **OUTCOME-BASED LANGUAGE (CRITICAL)**:
    Every sentence must show outcomes with concrete scenarios. Answer "What outcome does this create?" not "What is this?" 
    FORBIDDEN: "This is powerful", "You'll improve", "It works", "This will help you".
    REQUIRED: Show specific outcomes with observable changes (e.g., "Sarah finished in 20 minutes" not "It's fast").
    
    **USE MECHANICS**:
    - **highlight-interrupt**: Add pattern breaks ("Wait...", "But...")
    - **highlight-loop-open**: Create curiosity gaps
    - **highlight-loop-close**: Deliver satisfying payoffs

    **OUTPUT STRUCTURE**:
    Return the FULL improved copy in the ColorWriter HTML format:
    \`\`\`
    <div class="content-row">
      <div class="gutter"><i type='bart'></i><i type='interrupt'></i></div>
      <div class="content-body">
        <div class="block-hook"><h1><span>Improved headline</span></h1></div>
      </div>
    </div>
    \`\`\`

    **Formatting Constraints**:
    - **SPAN WRAPPERS**: Wrap all &lt;h1&gt;, &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt; text in &lt;span&gt; tags
    - **NO EXTRA SPACE**: No newlines inside block divs
    - **TIGHT HTML**: Compact formatting

    **FINAL REMINDER**:
    - DO NOT make it shorter
    - IMPROVE quality by ADDING strategic content
    - Use diverse block types, personas, and mechanics
    - Focus on the weakest scores first
    - Keep what's working (scores above 80)
    
    Return ONLY the improved HTML.
    `;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: originalText }
            ],
            model: "gpt-4o",
        });

        const cleanedContent = cleanContent(completion.choices[0].message.content);
        return cleanedContent;
    } catch (error) {
        console.error("OpenAI Improve Conversion Error:", error);
        throw error;
    }
}

export async function generateHeaderSuggestions(apiKey, content, targetAudience, docType, style) {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are an expert headline and subheadline copywriter.
    
    **Context**:
    - Target Audience: ${targetAudience}
    - Document Type: ${docType}
    - Writing Style: ${style}
    
    **Your Task**:
    Analyze the current headlines and subheadlines in the provided copy and generate 5 BETTER alternatives for each.
    
    **What Makes a Great Header**:
    - Clear benefit or transformation
    - Specific and concrete (not vague)
    - Creates curiosity or urgency
    - Speaks directly to the audience's desires/pain
    - Uses power words and numbers when appropriate
    - Simple 5th-grade language
    
    **Return Format**:
    Return ONLY a JSON object with this structure:
    {
      "current_headers": ["Current H1", "Current H2", "Current H3"],
      "suggestions": [
        {
          "original": "Current headline text",
          "alternatives": [
            "Better option 1",
            "Better option 2",
            "Better option 3",
            "Better option 4",
            "Better option 5"
          ],
          "why_better": "Brief explanation of what makes these better"
        }
      ]
    }
    `;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: stripTags(content) }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error("OpenAI Header Suggestions Error:", error);
        throw error;
    }
}

export async function generateBigIdeas(apiKey, instructions, targetAudience, docType, style) {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const systemPrompt = `You are an expert copywriter specializing in creating powerful "Big Ideas" that drive entire marketing campaigns.

    **Context**:
    - Target Audience: ${targetAudience}
    - Document Type: ${docType}
    - Writing Style: ${style}
    - Instructions: ${instructions}

    **BIG IDEA REQUIREMENT**:
    
    Identify or create ONE clear big idea that reframes the reader's problem.
    
    The big idea MUST:
    1. **Explain why past solutions failed** - Show what they've been missing
    2. **Introduce a new mechanism or understanding** - A fresh angle or insight
    3. **Remove blame from the reader** - It's not their fault
    4. **Make the solution feel obvious in hindsight** - "Of course! Why didn't I see this before?"
    
    Do NOT introduce multiple competing ideas. Each suggestion should be a single, focused big idea.
    
    **Examples of Strong Big Ideas**:
    - "Your brain isn't broken - it's just stuck in 'threat mode' from a 90-second loop"
    - "Fat loss isn't about willpower - it's about fixing your 'hunger hormones'"
    - "You're not bad at sales - you're just asking questions in the wrong order"
    
    **Return Format**:
    Return ONLY a JSON object with this structure:
    {
      "ideas": [
        {
          "idea": "The core big idea statement (one sentence)",
          "explanation": "Why this reframes the problem and makes the solution obvious (2-3 sentences)"
        }
      ]
    }
    
    Generate 5 unique big ideas that each meet ALL the requirements above.
    `;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Generate 5 big ideas based on these instructions:\n\n${instructions}` }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.error("OpenAI Big Ideas Error:", error);
        throw error;
    }
}

export async function infuseBlockType(apiKey, { originalText, blockType, docType, style, instructions, targetAudience, copywriter }) {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    const blockTypeMap = {
        'statement': { name: 'Statement', description: 'Clear idea or claim. Headlines, main assertions, direct statements.' },
        'impact': { name: 'Impact', description: 'Why it matters. Consequences, significance, emotional weight, "what this means for you."' },
        'evidence': { name: 'Evidence', description: 'Proof, logic, credibility. Facts, data, testimonials, mechanisms, reasoning.' },
        'relevance': { name: 'Relevance', description: 'Why THIS audience should care NOW. "If you\'re someone who…", identity-level connection.' }
    };

    const selectedBlock = blockTypeMap[blockType] || blockTypeMap['statement'];

    const systemPrompt = `You are an elite copywriter. Your task is to ADD a few new ${selectedBlock.name.toUpperCase()} blocks to existing copy WITHOUT removing, modifying, or replacing ANY existing content.

**ABSOLUTE REQUIREMENT - DO NOT REPLACE ANYTHING**:
- Keep EVERY SINGLE existing content-row exactly as it is
- Do NOT remove any existing blocks
- Do NOT modify any existing text
- Do NOT reword any existing content
- Do NOT change the order of existing content
- ONLY ADD new ${selectedBlock.name} blocks in strategic locations
- Add ONLY 2-4 new ${selectedBlock.name} blocks (not many, just a few strategic additions)

**WHAT TO DO**:
- Read the entire existing copy carefully
- Identify 2-4 strategic locations where adding a ${selectedBlock.name} block would have the most impact
- Insert new ${selectedBlock.name} blocks ONLY in those strategic spots
- Make new blocks feel seamlessly integrated with adjacent content
- New blocks should reference or build upon nearby existing content

**CONTEXTUAL INTEGRATION (CRITICAL)**:
- Read the entire existing copy carefully to understand the topic, tone, and flow
- Identify key themes, pain points, mechanisms, or stories already mentioned
- New ${selectedBlock.name} blocks must:
  * Reference specific details from the existing copy
  * Build upon concepts already introduced
  * Use the same terminology and language style
  * Connect to adjacent paragraphs naturally
  * Feel like a natural continuation, not an insertion

**QUALITY STANDARDS**:
- Every new block must be high-quality, persuasive, and valuable
- Use "show, don't tell" - demonstrate outcomes, not vague claims
- Match the existing copy's level of specificity and detail
- Maintain consistency in voice, tone, and style
- New content should feel like it was written by the same expert copywriter

**BLOCK TYPE: ${selectedBlock.name}**
${selectedBlock.description}

**CONTEXT**:
- Document Type: ${docType}
- Writing Style: ${style}
- Target Audience: ${targetAudience || 'the general public'}
${copywriter && copywriter !== 'None' ? `- Copywriter Style: ${copywriter}` : ''}
${instructions ? `- Original Instructions: ${instructions}` : ''}

**OUTPUT STRUCTURE**:
Use the same HTML structure as the original:
<div class="content-row">
  <div class="gutter"><i type="${blockType}"></i></div>
  <div class="content-body">
    <div class="block-${blockType}">...content...</div>
  </div>
</div>

**FORMATTING CONSTRAINTS**:
- **SPAN WRAPPERS**: Wrap inner text of every <h1>, <h2>, <h3>, <p> in <span> tag
- **NO EXTRA SPACE**: No newlines or spaces inside block divs
- **TIGHT HTML**: Write block divs on SINGLE lines where possible
- **ICONS**: Every gutter MUST have the correct icon: <i type="${blockType}"></i>

**INTEGRATION STRATEGY**:
1. First, identify ALL existing content-rows in the copy - these must remain UNCHANGED
2. Analyze the existing copy to understand:
   - Main topic and key messages
   - Specific examples, names, or details mentioned
   - Pain points or benefits already discussed
   - Mechanisms or processes explained
   - Stories or scenarios used
   - Language patterns and terminology

3. Identify 2-4 strategic insertion points where a ${selectedBlock.name} block would:
   - Strengthen a weak section
   - Add depth to an existing point
   - Create a better transition between sections
   - Reinforce a key message
   - Build on a specific example already mentioned

4. Insert NEW ${selectedBlock.name} blocks ONLY at those strategic points:
   - Write blocks that reference specific details from nearby existing content
   - Use the same examples, names, or scenarios from the existing copy
   - Build upon mechanisms or concepts already introduced
   - Feel like a natural continuation of adjacent paragraphs
   - Enhance the overall persuasive flow

**OUTPUT REQUIREMENT**:
- Return the COMPLETE copy with:
  * ALL original content-rows preserved exactly as they were
  * 2-4 new ${selectedBlock.name} blocks inserted at strategic locations
  * No existing content removed, modified, or replaced
  * New blocks seamlessly integrated between existing blocks

**VERIFICATION CHECKLIST**:
Before outputting, verify:
- Every original content-row is still present and unchanged
- Only 2-4 new ${selectedBlock.name} blocks were added
- No existing text was modified or removed
- New blocks are contextually connected to nearby content
- The copy flows naturally with the additions`;

    const userPrompt = `IMPORTANT: Do NOT replace or modify any existing content. ONLY ADD 2-4 new ${selectedBlock.name} blocks at strategic locations.

Analyze this copy carefully:
1. Identify ALL existing content-rows - these must remain UNCHANGED
2. Find 2-4 strategic spots where adding a ${selectedBlock.name} block would have the most impact
3. Insert ONLY new ${selectedBlock.name} blocks at those strategic locations
4. Make new blocks reference nearby existing content for seamless integration

The new blocks must:
- Reference specific details, examples, or concepts from the existing copy
- Build upon what's already written (don't introduce completely new ideas)
- Feel like a natural continuation of the existing flow
- Use the same terminology, tone, and style

${instructions ? `\nOriginal Instructions: ${instructions}\n` : ''}

Existing copy (preserve ALL of this, only add 2-4 new ${selectedBlock.name} blocks):
${originalText}`;

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "gpt-4o",
            max_tokens: 16000,
        });

        const rawContent = completion.choices[0].message.content;
        return cleanContent(rawContent);
    } catch (error) {
        console.error("OpenAI Infuse Block Type Error:", error);
        throw error;
    }
}
export async function generateWeirdStoryIdeas(apiKey, instructions) {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const systemPrompt = `You are a researcher and storyteller who finds TRUE, weird, counter-intuitive stories that can be used for marketing and persuasion.

**YOUR TASK**: Find 10 TRUE, weird, fascinating stories related to the user's instructions. These stories should be:
- **TRUE and verifiable** (not urban legends, myths, or unverified claims)
- **Weird or counter-intuitive** (challenge common assumptions, make people think "wait, that's weird")
- **Connected to the user's topic** (even if indirectly)
- **Marketing-ready** (can reinforce a specific belief or angle)

**STORY REQUIREMENTS**:
1. Each story must be **verifiably TRUE** from documented sources (scientific studies, medical journals, historical records, research papers)
2. Each story should be **weird, strange, or counter-intuitive** - something that challenges assumptions
3. Each story should **connect to the user's instructions/topic** in a way that could reinforce a marketing angle
4. Each story should have a clear **"why this is strange"** element that makes it counter-intuitive
5. Each story should have a **"why this matters"** insight that could be used for persuasion/marketing
6. Stories should be diverse: scientific discoveries, psychological phenomena, medical cases, historical events, etc.

**STORY STRUCTURE**:
Each story must include:
- **title**: Short, intriguing title (5-10 words) that captures the weirdness
- **story**: 2-3 sentences describing the weird/strange TRUE story
- **whyStrange**: 1-2 sentences explaining what makes it counter-intuitive or weird
- **whyMatters**: 1-2 sentences explaining the insight or angle that could be used for marketing/persuasion
- **hook**: A short, punchy hook (1 sentence) that could be used in an ad or headline
- **source**: Full URL where this story can be verified

**SOURCE REQUIREMENTS**:
- Use reputable sources: Wikipedia, scientific journals (PubMed, Nature, Science), medical journals, news archives, historical records, research papers
- Provide actual URLs that lead to pages where the story is documented
- If exact URL unavailable, use closest Wikipedia article or journal article path
- Format URLs as: https://en.wikipedia.org/wiki/[article] or https://pubmed.ncbi.nlm.nih.gov/[id] or https://www.[reputable-source].com/[path]

**OUTPUT FORMAT**:
Return ONLY a JSON object with this EXACT structure:
{
"stories": [
  {
    "title": "Short, intriguing title (5-10 words)",
    "story": "2-3 sentences describing the weird TRUE story",
    "whyStrange": "1-2 sentences explaining what makes it counter-intuitive",
    "whyMatters": "1-2 sentences explaining the marketing/persuasion angle",
    "hook": "One punchy sentence that could be used as an ad hook",
    "source": "Full URL to where this story can be verified"
  }
]
}

**CRITICAL**: Generate exactly 10 stories. Make them diverse, fascinating, verifiably true, and marketing-ready. Focus on stories that challenge assumptions and can reinforce specific beliefs or angles. Each story should feel like it could be used in a Facebook ad or marketing campaign.`;

  try {
      const completion = await openai.chat.completions.create({
          messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Find 10 TRUE, weird, counter-intuitive stories related to these instructions. Make them marketing-ready and able to reinforce specific beliefs or angles:\n\n${instructions || 'Find interesting, weird true stories'}` }
          ],
          model: "gpt-4o",
          response_format: { type: "json_object" },
          temperature: 0.8
      });

      const result = JSON.parse(completion.choices[0].message.content);
      
      // Ensure all stories have the required fields and backward compatibility
      if (result.stories) {
          result.stories = result.stories.map(story => ({
              title: story.title || 'Untitled Story',
              summary: story.story || story.summary || '',
              story: story.story || story.summary || '',
              whyStrange: story.whyStrange || '',
              whyMatters: story.whyMatters || '',
              hook: story.hook || '',
              source: story.source || ''
          }));
      }
      
      return result;
  } catch (error) {
      console.error("OpenAI Weird Stories Error:", error);
      throw error;
  }
}

export async function generateCopyFromStory(apiKey, { story, docType, style, instructions, targetAudience, copywriter, bigIdea }) {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  let systemPrompt = `**ROLE**
You are an elite conversion copywriter and storyteller.
Your task is to generate compelling copy that tells a really nice story, then connects it to the document type.

**STORY REQUIREMENTS**:
- Start by telling the weird/strange story in an engaging, narrative way
- Make the story vivid and fascinating
- Use story blocks (block-story) to tell the narrative
- Build intrigue and curiosity as you tell the story

**CONNECTION REQUIREMENT**:
- After telling the story, you MUST connect it to the document type (${docType})
- The connection should feel natural and relevant
- Adjust the ending of the story so it connects to the document type's purpose
- Make the transition smooth and logical

${copywriter && copywriter !== 'None' ? `Write in the specific style of ${copywriter}. Emulate their tone, vocabulary, sentence structure, and storytelling techniques perfectly.` : 'Write as an expert storyteller and copywriter.'}

Your goal is to write a ${docType} targeting ${targetAudience || 'the general public'}.
Tone: ${style}.

**OUTPUT STRUCTURE (HTML FORMAT)**

You MUST construct your response using a "Row-based" HTML structure with a sidebar gutter and content body wrapper.

**The Container**:
<div class="content-row">
<div class="gutter">...icons...</div>
<div class="content-body">
    <div class="block-[type]">...text...</div>
</div>
</div>

**1. Gutter (Left Column) - CRITICAL REQUIREMENT**:
Every gutter MUST contain the block type icon that matches the block type in the content-body.
- If content-body has <div class="block-hook">, gutter MUST have <i type="hook"></i>
- If content-body has <div class="block-story">, gutter MUST have <i type="story"></i>
- If content-body has <div class="block-emotion">, gutter MUST have <i type="emotion"></i>
- If content-body has <div class="block-logic">, gutter MUST have <i type="logic"></i>
- If content-body has <div class="block-proof">, gutter MUST have <i type="proof"></i>
- If content-body has <div class="block-cta">, gutter MUST have <i type="cta"></i>
- If content-body has <div class="block-ad">, gutter MUST have <i type="ad"></i>
- If content-body has <div class="block-misc">, gutter MUST have <i type="misc"></i>

**MULTIPLE ICONS IN GUTTER (MANDATORY WHEN APPLICABLE)**:
If a content block uses mechanics (interrupt, loop-open, loop-close) in addition to its block type, you MUST include BOTH icons in the gutter:
- Block type icon (hook, story, emotion, logic, proof, cta, ad, misc) - ALWAYS required
- Mechanics icon (interrupt, loop-open, loop-close) - Add when the text uses that mechanic

**2. Content Body (Right Wrapper)**:
Wraps the content blocks. The block type class MUST match the icon in the gutter.

**BLOCK TYPES**:
1. **block-story** → icon: story 📖 - Use this for telling the weird story
2. **block-hook** → icon: hook 🎯 - Opening that creates recognition
3. **block-emotion** → icon: emotion ❤️ - Validates experience, removes blame
4. **block-logic** → icon: logic 🧠 - Explains mechanism, cause-and-effect
5. **block-proof** → icon: proof ✅ - Reduces risk, confirms logic
6. **block-cta** → icon: cta 🚀 - Clear binary decision, consequences
7. **block-ad** → icon: ad 💡 - Creative angles, pattern breaks
8. **block-misc** → icon: misc 📝 - Everything else

**MECHANICS (Inline highlights)**
- **highlight-interrupt**: Pattern breaks, attention shifts
- **highlight-loop-open**: Questions, curiosity gaps (MUST close later)
- **highlight-loop-close**: Answers, reveals, payoffs

**FORMATTING CONSTRAINTS**
- **USE HEADINGS**: Use <h1>, <h2>, <h3> for headlines/subheadlines. Do NOT use bold for headlines.
- **Bold** key terms sparingly with <b> or <strong>
- **NO EMPTY LINES**: No empty lines or <br> tags inside content blocks
- **NO WHITESPACE PADDING**: No spaces/newlines at start or end of text in block divs
- **SPAN WRAPPERS**: Wrap inner text of every <h1>, <h2>, <h3>, <p> in <span> tag
- **TIGHT HTML**: Write block divs on SINGLE lines where possible

**STORY STRUCTURE**:
1. Start with the weird story (use block-story, 3-5 paragraphs)
2. Build intrigue and curiosity
3. Transition smoothly to connect the story to the document type
4. End with content appropriate for the document type (CTA for sales pages, etc.)

**LANGUAGE CONSTRAINT**:
Write at a **5th-grade reading level**.
- Simple, punchy, clear language
- Short sentences
- No jargon or complex words

**FINAL SELF-CHECK (REQUIRED)**

Before outputting, verify:
- The story is told in an engaging, narrative way
- The story connects naturally to the document type
- The ending is adjusted to fit the document type's purpose
- Every content-row has a block type icon in the gutter that MATCHES the block type class
- When a block uses mechanics, the gutter has BOTH the block type icon AND the mechanics icon(s)
- Copy feels engaging and story-driven
- The connection between story and document type is clear and logical

If any of the above fails, rewrite.

**OUTPUT FORMAT**

Deliver a complete ${docType} that:
- Tells a really nice, engaging story
- Connects the story to the document type naturally
- Uses proper HTML structure with block types and icons
- Adjusts the ending to fit the document type's purpose
`;

  const userPrompt = `Generate copy based on this weird story:

**Story Title**: ${story.title}
**Story Summary**: ${story.story || story.summary}
**Story Source**: ${story.source}

${instructions ? `\nAdditional Instructions: ${instructions}` : ''}

Generate a ${docType} that tells this story in an engaging way, then connects it to the document type's purpose.`;

  try {
      const completion = await openai.chat.completions.create({
          messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
          ],
          model: "gpt-4o",
          max_tokens: 16000,
      });

      const rawContent = completion.choices[0].message.content;
      return cleanContent(rawContent);
  } catch (error) {
      console.error("OpenAI Generate Copy From Story Error:", error);
      if (error.message?.includes('content policy')) {
          throw new Error("Content policy violation. Please try a different story or adjust your instructions.");
      }
      throw error;
  }
}