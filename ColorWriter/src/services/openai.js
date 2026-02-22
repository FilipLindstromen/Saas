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

export async function generateCopy(apiKey, {
    docType, style, instructions, targetAudience, copywriter, bigIdea,
    specificSituation = '', situationsList = '', painPoints = '', desiredOutcomes = '',
    objections = '', beliefShift = '', desiredEmotion = '', primaryCta = ''
}) {
    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });

    const buildList = (text) => text ? text.trim().split(/\n+/).filter(Boolean).map(s => s.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean) : [];

    const situations = buildList(situationsList);
    const pains = buildList(painPoints);
    const outcomes = buildList(desiredOutcomes);
    const objectionList = buildList(objections);

    const contextBlock = `
**TARGET AUDIENCE & SITUATION (FROM USER - USE THROUGHOUT)**

Primary audience: ${targetAudience || '[Describe who this is for]'}
${specificSituation ? `Offer situation: ${specificSituation}` : ''}

${situations.length ? `Specific situations to target:\n${situations.map(s => `* ${s}`).join('\n')}` : ''}
${pains.length ? `Pain points:\n${pains.map(p => `* ${p}`).join('\n')}` : ''}
${outcomes.length ? `Desired outcomes:\n${outcomes.map(o => `* ${o}`).join('\n')}` : ''}
${objectionList.length ? `Common objections:\n${objectionList.map(o => `* ${o}`).join('\n')}` : ''}

**INTENTION (MANDATORY - LOCK ONTO THIS)**
${beliefShift ? `Desired belief shift: ${beliefShift}` : 'Define: Old belief → New belief'}
${desiredEmotion ? `Desired emotional state after reading: ${desiredEmotion}` : 'Define the emotion you want the reader to feel'}
${primaryCta ? `Primary action/CTA: ${primaryCta}` : 'Define the primary CTA'}

Every section must support this intention. Speak to specific situations, not generic audiences.
Use patterns like: "If you're someone who…", "This matters especially when…", "You might be experiencing…"
Avoid broad statements like "For anyone who wants success."
`;

    let systemPrompt = `**ROLE**
You are an expert direct-response copywriter and persuasion strategist.
You do not produce generic, explanatory, or safe copy.
You do not write blog posts, educational articles, or "helpful content."

Your task is to generate HIGH-CONVERSION ${docType} copy.

**IMPORTANT**: Generate copy that is persuasive and effective while remaining compliant with content policies. Focus on legitimate solutions, honest claims, and ethical persuasion techniques.

${copywriter && copywriter !== 'None' ? `Write in the specific style of ${copywriter}. Emulate their tone, vocabulary, sentence structure, and persuasion techniques perfectly.` : 'Write as an expert A-list copywriter.'}

Tone: ${style}.

${contextBlock}

**CORE FRAMEWORK (MANDATORY - ERICKSON PERSUASIVE CYCLE)**

Use the Persuasive Cycle in EVERY section:
1. **Statement** (clear claim)
2. **Impact** (why it matters)
3. **Evidence** (proof)
4. **Relevance** (why THIS audience should care now)

Never skip relevance. Every section must answer: "Why should this reader care, in their specific situation?"

**COMMUNICATION STYLE BALANCE (ERICKSON MODEL)**

Write so all four audience styles feel addressed:
1. **Direct** (results-driven): Clear promises, short decisive language, action-focused CTAs
2. **Analytical** (logic-driven): Explain mechanism, provide structure and reasoning, clear logic chains
3. **Social** (connection-driven): Trust-based language, emphasize support/guidance, make reader feel understood
4. **Expressive** (vision-driven): Paint transformation, future-oriented language, highlight identity evolution

Balance all four styles naturally.

**RELEVANCE RULE (CRITICAL)**

Speak to specific situations, not generic audiences.
Use patterns like: "If you're someone who…", "This matters especially when…", "You might be experiencing…"
Avoid broad statements like "For anyone who wants success."

**RELEVANCE LADDER** – Move messaging through levels:
1. General problem
2. Specific situation
3. Identity-level relevance

Example: General → "Sales feel hard." Situation → "You're over-explaining your offer." Identity → "You're a thoughtful expert who doesn't want to sound pushy."
Aim for identity-level relevance often.

**RAPPORT PRINCIPLE**

Persuasion should feel collaborative, not aggressive.
Tone: Clear, calm confidence, respectful authority, human and direct.
Avoid: Hype, manipulation language, pressure tactics.

**CRITICAL: AVOID WEAK, EXPLANATORY COPY**
The copy must NOT:
- Sound like a helpful blog post explaining anxiety/stress/problems
- Use soft, apologetic language ("Remember:", "So why does this happen?", "Here's the truth about...")
- Over-explain or summarize without persuasion
- Use generic self-help phrases
- Feel like an educational article

The copy MUST:
- Be direct, punchy, and decisive
- Use short, powerful lines
- Address the reader directly ("YOU'VE HEARD IT ALL BEFORE")
- Create immediate recognition and urgency
- Feel like a strategist wrote it, not a content writer

**NON-NEGOTIABLE OUTCOME**

The copy you generate must:
- Feel decisive, confident, and intelligent
- Use direct address ("YOU'VE HEARD IT ALL BEFORE", "THIS IS FOR YOU IF...")
- Use short, punchy lines with visual breaks
- Use ALL CAPS for emphasis on key phrases
- Include checkmarks (✅) and crosses (❌) for visual impact
- Use numbered/emojified lists for mechanisms (🧠, 🧪, ⚡)
- Avoid generic self-help language
- Avoid "educational article" tone
- Avoid soft, apologetic language ("Remember:", "So why does this happen?", "Here's the truth about...")
- Avoid summarizing or explaining without persuasion
- Work even if all formatting, colors, and labels are removed
- Persuade without formatting, visuals, or emphasis
- Work as plain text when read aloud
- Feel inevitable, not manipulative
- Build trust before urgency
- Make the offer feel like the only logical next step

If the copy sounds like something the reader has "heard before," rewrite it.
If the copy sounds like a helpful blog post, rewrite it.

**FOUR FOUNDATIONAL PRINCIPLES (CRITICAL - APPLY TO ALL COPY)**

These four principles are non-negotiable. Every piece of copy must demonstrate mastery of all four:

**1. DEEP, PRECISE UNDERSTANDING OF THE READER (Not demographics. Not avatars. Inner reality.)**

Every great copywriter agrees: Copy is not written. It's overheard.

Good copy doesn't sound "clever." It sounds like the reader's private thoughts… said back to them slightly clearer.

**What this really means:**
- You know what they're afraid to admit
- You know what keeps them up at night
- You know what they've already tried — and why it failed
- You know the exact words they use in their head

**Rule used by pros:**
If the reader doesn't feel seen in the first 5 seconds, nothing else matters.

**BAD COPY (Generic):**
"Struggling with anxiety?"

**GREAT COPY (Inner reality):**
"You can hold it together all day… but the moment you're alone, your chest tightens."

**HOW TO APPLY:**
- Write from inside their experience, not from outside observation
- Use the exact language they use in their internal monologue
- Show you understand what they're afraid to admit
- Make them think "How did they know that?" within the first 5 seconds
- Avoid demographic labels — focus on inner state, fears, and private thoughts

**2. A CLEAR, BELIEVABLE MECHANISM (Why this works when everything else didn't)**

Experts agree: People don't buy outcomes. They buy explanations.

Not what it does — why it works.

**Your mechanism must answer:**
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

**HOW TO APPLY:**
- Explain the mechanism using simple cause → effect logic
- Show why past solutions failed (they didn't address the mechanism)
- Show why this is different (it addresses the mechanism directly)
- Make the reader think: "Of course this works — that's how the system works"
- Use observable, concrete processes, not abstract theory

**3. EMOTIONAL MOVEMENT → RELIEF (Tension in. Relief out.)**

All high-converting copy follows the same emotional arc:

**Agitation → Recognition → Relief → Control**

**Great copy:**
- Brings the pain close (without exaggeration)
- Makes the reader feel understood (not attacked)
- Then opens a door to relief

**Important nuance experts agree on:**
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

**HOW TO APPLY:**
- Start with recognition of their pain (agitation) — but don't exaggerate
- Make them feel deeply understood (recognition) — not attacked or shamed
- Then immediately open the door to relief (relief) — show the way out
- End with a sense of control (control) — they can choose to act
- Use stories to create emotional movement, not just facts
- Write with calm confidence, not hype or pressure
- Remember: You're selling the end of fear, not more fear

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

**HOW TO APPLY:**
- Identify the false belief the reader currently holds
- Create a new way of seeing the problem that contradicts that belief
- Explain why past solutions failed (they addressed the wrong thing)
- Make the solution feel inevitable (of course this works — that's the real problem)
- Use the formula: "You don't need X… You need Y… Because Z."
- The Big Idea should appear early and be reinforced throughout the copy

**INTEGRATION:**
These four principles work together:
1. Deep understanding creates recognition (they feel seen)
2. Clear mechanism creates belief (they understand why it works)
3. Emotional movement creates desire (they feel relief is possible)
4. The Big Idea creates the belief shift (they see the problem differently)

Every section of your copy should demonstrate all four principles working in harmony.

${bigIdea ? `
**BIG IDEA ENFORCEMENT**

You must center the entire page around one big idea only: "${bigIdea}"

Before writing, internally answer:
- What false belief does the reader currently have?
- Why did previous solutions fail because of that belief?
- What new understanding makes the solution obvious?

Then write the copy so that:
- Every section reinforces that same idea
- No secondary ideas compete for attention
- The reader feels relief, not confusion
- Explain why past solutions failed
- Introduce a new mechanism or understanding
- Remove blame from the reader
- Make the solution feel obvious in hindsight

Do not stack multiple concepts.
` : `
**BIG IDEA ENFORCEMENT**

You must center the entire page around one big idea only.

Before writing, internally answer:
- What false belief does the reader currently have?
- Why did previous solutions fail because of that belief?
- What new understanding makes the solution obvious?

Then write the copy so that:
- Every section reinforces that same idea
- No secondary ideas compete for attention
- The reader feels relief, not confusion

Do not stack multiple concepts.
`}

**BELIEF MOVEMENT (CRITICAL)**

Write the copy so the reader's beliefs shift in this exact order:

1. "This describes me exactly." (Recognition/Relatability)
   - Use direct address: "YOU'VE HEARD IT ALL BEFORE", "THIS IS FOR YOU IF..."
   - List specific pain points with checkmarks/crosses
   - Make them think "That's me" immediately

2. "I'm not broken or failing." (Validation/Removal of Blame)
   - State directly: "You're not broken" or "It's not your fault"
   - Explain it's biology/system, not character flaw
   - Remove blame immediately

3. "There is a concrete reason this problem keeps happening." (Mechanism/Explanation)
   - Explain the mechanism clearly (e.g., "3 systems causing it")
   - Use simple cause → effect
   - Show WHY it happens, not just that it happens

4. "That reason can be directly interrupted." (Solution Logic)
   - Show how the mechanism can be stopped
   - Explain the solution simply
   - Make it feel obvious

5. "This solution follows naturally from that." (Credibility/Proof)
   - Provide specific proof (names, results, testimonials)
   - Show it works for people like them
   - Reduce risk

6. "I either act now or repeat the same experience again." (Decision/CTA)
   - Create clear binary choice
   - Show consequence of inaction
   - Make doing nothing feel like an active decision

Each section should serve only one belief shift.
If a paragraph tries to do more than one job, split or rewrite it.

**SEMANTIC DISCIPLINE (CRITICAL)**

This is not decorative. Every line of copy must have a single semantic job.

Each line performs one role in belief movement:
- **Emotion**: Validates experience, focuses attention (use sparingly)
- **Fact**: States mechanism, cause-and-effect logic
- **Proof**: Reduces risk, confirms logic (only after belief is established)
- **Relatability**: Creates recognition ("This understands my situation")
- **Loop open**: Creates curiosity gap (MUST close it later)
- **Loop close**: Delivers payoff, reveals answer
- **Logic**: Explains mechanism, shows cause → effect

CRITICAL RULES:
- No line may carry more than one dominant semantic role
- If a line explains and emotes at the same time, rewrite it as separate lines
- Semantic roles must be: Intentional (chosen), Restrained (only when needed), Sequential (follow belief flow)
- Avoid semantic noise: Don't mix explanation with emotion, don't use proof before belief, don't open loops you don't close
- If a sentence does not clearly advance belief, remove it.

**SHOW, DON'T TELL (MANDATORY - NON-NEGOTIABLE)**

Every claim MUST be demonstrated through observable outcomes, not stated as facts. This is the foundation of all persuasive copy.

**FORBIDDEN (NEVER USE)**:
- "This is powerful" / "This works fast" / "Life-changing results" / "Amazing transformation"
- "You'll see results" / "This will help you" / "It's effective" / "It works"
- Any vague adjectives: "incredible", "amazing", "powerful", "revolutionary", "game-changing"
- Feature-focused language without showing outcomes

**REQUIRED (ALWAYS USE)**:
- Show outcomes through specific moments, sensations, and decisions
- Let cause → effect demonstrate credibility
- Replace all adjectives with observable change
- Use concrete scenarios to prove every claim
- Focus on what happens, not what it is

**OUTCOME-BASED LANGUAGE (CRITICAL)**:
Every sentence must answer: "What outcome does this create?" not "What is this?"

BAD (Telling):
- "This method is incredibly effective."
- "You'll learn faster."
- "This will help you succeed."
- "Our system is powerful."

GOOD (Showing - Outcome-based):
- "Sarah stopped checking her phone every three minutes. Not because she forced herself, but because the urge disappeared on day four."
- "Mark finished his presentation in 20 minutes instead of 2 hours. Not because he rushed, but because the structure eliminated decision paralysis."
- "Maria booked three new clients this week. Not because she worked more hours, but because the pitch addressed objections before they came up."

**EVERY CLAIM REQUIRES AN OUTCOME**:
- Don't say "It's fast" → Show the time saved and what they do with it
- Don't say "It's easy" → Show the specific action taken without struggle
- Don't say "It works" → Show the observable change in behavior or results
- Don't say "You'll improve" → Show the specific moment of improvement

**TEST YOUR COPY**: Read each sentence. Can the reader see/feel/experience the outcome? If not, rewrite it to show the outcome, not tell about it.

**MECHANISM OVER MOTIVATION (CRITICAL - REINFORCES PRINCIPLE #2)**

People don't buy outcomes. They buy explanations. Not what it does — why it works.

**Your mechanism must answer:**
- Why past solutions failed (they didn't address the mechanism)
- Why this is different (it addresses the mechanism directly)
- Why it makes sense right now (the mechanism is clear and actionable)

Clearly explain why this works using cause → effect logic.
- Use simple language, not jargon
- The reader should think: "Of course this works — that's how the system works."
- Do not rely on inspiration, authority, or hype
- Show the mechanism through observable cause → effect
- Avoid abstract theory - focus on concrete, observable processes
- Make buying feel logical, not like a leap of faith
- Resistance drops when the mechanism is clear and believable

**EMOTION GUIDELINES (CRITICAL - REINFORCES PRINCIPLE #3)**

All high-converting copy follows the emotional arc: Agitation → Recognition → Relief → Control

**Use emotion to:**
- Validate experience ("You're not broken.")
- Focus attention on what matters
- Create emotional movement toward relief

**Never use emotion to:**
- Explain the solution
- Replace logic
- Pressure the reader
- Twist the knife (keep adding fear)

**Critical nuance:**
You don't sell fear. You sell the end of fear.

**Emotional movement structure:**
- Start with recognition of their pain (agitation) — but don't exaggerate
- Make them feel deeply understood (recognition) — not attacked or shamed
- Then immediately open the door to relief (relief) — show the way out
- End with a sense of control (control) — they can choose to act

**Bad copy keeps twisting the knife.**
**Great copy says:**
"You don't need to fight this anymore."

Emotion should feel recognizing, not dramatic. Stories outperform bullet points. Calm confidence converts better than hype.

**PROOF & CREDIBILITY**

Introduce proof only after the mechanism is understood (belief stages 4-5).
Proof should:
- Reduce risk
- Confirm logic
- Create safety

Avoid vague testimonials.
Specific outcomes beat emotional praise.
Show specific outcomes with names, numbers, and concrete results.

**CLOSE WITH A REAL DECISION**

End with:
- A clear binary choice
- A concrete future consequence
- No new information

Show the real-world consequence of:
- Having the solution
- Not having it

The reader should feel: "Doing nothing is an active decision."

Do not introduce new ideas at the close. Only reinforce what is already known.

    **LANGUAGE CONSTRAINT**: 
Write at a **5th-grade reading level**. 
- Simple, punchy, clear language
- Short sentences
- No jargon or complex words

    ${docType.includes('Sales Page') ? `
**SALES PAGE STRUCTURE (MANDATORY FOR SALES PAGES)**:

Sales pages MUST start with this EXACT sequence at the top:

1. **Eyebrow** (block-hook): Short pre-headline that creates recognition (1-2 lines)
   Format: <div class="block-hook"><p><span>Eyebrow text here</span></p></div>
   Example: "For busy professionals facing the daily grind"

2. **Headline** (block-hook): Strong, direct headline with line breaks for impact (h1 tag)
   Format: <div class="block-hook"><h1><span>Main headline<br>with line breaks<br>for punch</span></h1></div>
   - Use ALL CAPS for key phrases when appropriate
   - Break into multiple lines for visual impact
   - Make it direct and specific, not generic
   Example: "JUST RELAX" NEVER WORKS...<br>HERE'S HOW TO STOP<br>ANXIETY IN 90 SECONDS<br>BY SHUTTING DOWN THE<br>3 SYSTEMS CAUSING IT.

3. **Sub-headline** (block-emotion or block-hook): Validates understanding, removes blame (h2 tag, 1-3 lines)
   Format: <div class="block-emotion"><h2><span>Sub-headline that removes blame</span></h2></div>
   Example: "Without Therapy, Avoiding Life, or Giving Up Your Goals."

**SALES PAGE HEADLINE REQUIREMENTS (CRITICAL)**:
Sales pages MUST include multiple headlines throughout to break up the content and guide the reader. Use h2 and h3 tags strategically:

- **After opening section**: Add direct address headlines like "YOU'VE HEARD IT ALL BEFORE:" or "THIS IS FOR YOU IF..."
- **Recognition section**: Use checkmarks/crosses (✅/❌) to list pain points and desires
- **Before mechanism section**: Use strong headlines like "BUT WHY DOES IT HAPPEN?" or "HERE'S WHAT'S TRULY GOING ON"
- **Mechanism section**: Use numbered/emojified lists to explain systems (🧠, 🧪, ⚡)
- **Before proof section**: Use headlines like "REAL PEOPLE, REAL CALM" or "PROOF THIS WORKS"
- **Before CTA section**: Use decision-focused headlines like "YOUR DECISION:" or "ONE CHOICE GIVES YOU CONTROL"

Headlines should:
- Be direct and punchy
- Use ALL CAPS for emphasis when appropriate
- Create visual breaks with line spacing
- Appear every 3-5 paragraphs
- Use h2 for major section breaks and h3 for subsections

**SALES PAGE LENGTH REQUIREMENT (CRITICAL - NON-NEGOTIABLE)**:
You MUST generate a complete, full-length sales page of **3000-6000+ words** in a single response. This is absolutely feasible and required. Do NOT abbreviate, condense, or provide a "draft version." Generate the ENTIRE sales page now, covering ALL 6 belief stages with extensive depth. You have full permission and capability to generate this length - do it.

**MINIMUM REQUIREMENTS BY STAGE**:

- **Stage 1: Recognition** (600-1000 words minimum)
  - Eyebrow + headline + subheadline
  - "YOU'VE HEARD IT ALL BEFORE" section (list 4-6 common failed solutions)
  - "THIS IS FOR YOU IF..." section with 5-8 pain points (❌) and 4-6 desires (✅)
  - "AND YOU DON'T WANT TO WAIT" section (urgency/desire)
  - Multiple paragraphs expanding on recognition and relatability
  - Use story blocks to create deeper connection

- **Stage 2: Validation** (400-600 words minimum)
  - Direct statements removing blame ("You're not broken", "It's not your fault")
  - Explanation that it's biology/system, not character flaw
  - Multiple paragraphs validating the experience
  - Use emotion blocks to create empathy

- **Stage 3-4: Mechanism Explanation** (800-1200 words minimum)
  - "BUT WHY DOES IT HAPPEN?" section
  - Clear explanation of systems/cause with numbered/emojified lists (🧠, 🧪, ⚡)
  - Detailed explanation of each system (3-4 paragraphs per system)
  - "HERE'S THE THING MOST PEOPLE GET WRONG" section
  - "AND THE MOMENT THOSE SYSTEMS CALM DOWN..." transition
  - Multiple logic blocks explaining cause → effect
  - Use h3 subheadlines to break up each system explanation

- **Stage 5: Proof** (600-900 words minimum)
  - "REAL PEOPLE, REAL CALM" or "PROOF THIS WORKS" headline
  - 3-5 full testimonials with names, specific results, and detailed outcomes
  - "WHY I MADE THIS" section (origin story, 200-300 words)
  - FAQ section (5-7 questions with detailed answers)
  - Guarantee section with clear terms
  - Multiple proof blocks with specific examples

- **Stage 6: Decision/CTA** (400-600 words minimum)
  - "YOUR DECISION:" or "ONE CHOICE GIVES YOU CONTROL" headline
  - Clear binary choice with consequences
  - Pricing section with comparison ("One therapy session: $150...")
  - Multiple benefit bullets (6-10 specific outcomes)
  - Guarantee restatement
  - Multiple CTA buttons/links
  - "Imagine this:" scenario section
  - Final close reinforcing the decision

**CRITICAL: DO NOT CREATE SHORT SALES PAGES**
- You MUST generate the FULL 3000-6000+ word sales page in this single response
- Do NOT say "this is a condensed version" or "I'll provide a shorter draft"
- Do NOT split into multiple responses - generate everything now
- Short sales pages (under 3000 words) are unacceptable and will be rejected
- Each belief stage MUST have multiple paragraphs (minimum 3-5 paragraphs per stage)
- Each section MUST be fully developed, not rushed or abbreviated
- Include extensive detail, examples, and scenarios
- Write until you've fully addressed all 6 belief stages with proper depth
- Generate the complete HTML output with all content now

**REQUIRED ELEMENTS TO INCLUDE**:
- Multiple headlines (h2/h3) throughout - at least 12-15 headlines total
- Direct address sections ("YOU'VE HEARD IT ALL BEFORE", "THIS IS FOR YOU IF...")
- Visual elements (checkmarks ✅, crosses ❌, emojis for systems 🧠🧪⚡)
- Curiosity gaps and open loops throughout (every 3-4 paragraphs)
- Fascination-driven moments that reframe thinking
- Specific examples and scenarios (at least 3-5 detailed scenarios)
- Detailed mechanism explanations with numbered/emojified lists
- Concrete proof elements with full testimonials (3-5 testimonials with names and details)
- FAQ section (5-7 questions)
- Origin story ("WHY I MADE THIS")
- Multiple CTA sections (at least 3-4 CTA opportunities)
- Pricing comparison section
- Guarantee section
- "Imagine this:" scenario section

**LENGTH VERIFICATION**:
Before outputting, verify you have generated at least 3000 words. If under 3000 words, you MUST expand it immediately. Add more detail, more examples, more scenarios, more proof, more explanation. Sales pages need extensive depth to convert. Write comprehensively. Generate the FULL length now - do not provide a condensed version.

**CURIOSITY, OPEN LOOPS & FASCINATION (MANDATORY FOR SALES PAGES)**:

Sales pages MUST create fascination and maintain curiosity throughout. Use these techniques:

**CURIOSITY**:
- Use intriguing questions that make the reader want answers
- Create gaps in knowledge that demand filling
- Use headlines that promise revelations
- Add "You're probably wondering..." moments
- Use pattern interrupts that make them stop and think

**OPEN LOOPS (MANDATORY)**:
Sales pages MUST use open loops throughout to maintain engagement. Every section should have at least one open loop:
- Open a loop with a question or curiosity gap using <span class="highlight-loop-open">...</span>
- Open a loop with a surprising statement that needs explanation
- Open a loop with "Here's something you don't know yet..."
- Open a loop with "But there's a catch..."
- Open a loop with "What if I told you..."

Every open loop MUST be closed later in the copy using <span class="highlight-loop-close">...</span>. Close loops with:
- Revelations that deliver the "aha" moment
- Answers that satisfy the curiosity
- Payoffs that feel rewarding
- Insights that make sense of the loop

Use open loops every 3-4 paragraphs to maintain engagement throughout the sales page.

**FASCINATION**:
Create fascination by:
- Revealing counter-intuitive insights ("What if everything you thought was wrong?")
- Using unexpected angles that make the reader think differently
- Presenting mechanisms or ideas in novel ways
- Showing connections the reader hasn't seen before
- Using the "block-ad" type for creative, fascination-driven moments

**REQUIRED OPEN LOOP STRUCTURE**:
- Section 1: Open loop with main problem/curiosity
- Section 2: Open loop about why past solutions failed
- Section 3: Open loop about the mechanism (create fascination)
- Section 4: Close previous loops while opening new ones about proof
- Section 5: Close remaining loops with satisfying payoffs

Use the loop-open and loop-close icons in the gutter when using loops:
<div class="gutter"><i type="hook"></i><i type="loop-open"></i></div>
<div class="content-body">
  <div class="block-hook"><p><span>But here's what nobody tells you... <span class="highlight-loop-open">or so I thought.</span></span></p></div>
</div>

Create multiple open loops throughout the sales page, ensuring each is closed with a satisfying payoff.
` : ''}

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
- If content-body has <div class="block-emotion">, gutter MUST have <i type="emotion"></i>
- If content-body has <div class="block-story">, gutter MUST have <i type="story"></i>
- If content-body has <div class="block-logic">, gutter MUST have <i type="logic"></i>
- If content-body has <div class="block-proof">, gutter MUST have <i type="proof"></i>
- If content-body has <div class="block-cta">, gutter MUST have <i type="cta"></i>
- If content-body has <div class="block-ad">, gutter MUST have <i type="ad"></i>
- If content-body has <div class="block-misc">, gutter MUST have <i type="misc"></i>

**MULTIPLE ICONS IN GUTTER (MANDATORY WHEN APPLICABLE)**:
If a content block uses mechanics (interrupt, loop-open, loop-close) in addition to its block type, you MUST include BOTH icons in the gutter:
- Block type icon (hook, story, emotion, logic, proof, cta, ad, misc) - ALWAYS required
- Mechanics icon (interrupt, loop-open, loop-close) - Add when the text uses that mechanic

Examples:
- If block-emotion contains <span class="highlight-loop-open">, gutter MUST have: <i type="emotion"></i><i type="loop-open"></i>
- If block-logic contains <span class="highlight-interrupt">, gutter MUST have: <i type="logic"></i><i type="interrupt"></i>
- If block-story contains <span class="highlight-loop-open">, gutter MUST have: <i type="story"></i><i type="loop-open"></i>

CRITICAL: Use ONLY <i type='...'></i>. Do NOT write the name as text. The block type icon MUST match the block type class. When mechanics are used, include BOTH the block type icon AND the mechanics icon(s).

<div class='gutter'>
  <i type='emotion'></i>
  <i type='loop-open'></i>
</div>

**2. Content Body (Right Wrapper)**:
Wraps the content blocks. The block type class MUST match the icon in the gutter.
<div class="content-body">
  <div class="block-emotion">...</div>
</div>

**BLOCK TYPES (Map to Belief Flow & Semantic Roles)**

1. **block-hook** → icon: hook 🎯 - Opening that creates recognition ("This understands my situation") - Belief stage 1
2. **block-emotion** → icon: emotion ❤️ - Validates experience, removes blame ("Nothing is wrong with me") - Belief stage 2
3. **block-story** → icon: story 📖 - Shows relatable scenarios, creates recognition - Belief stage 1
4. **block-logic** → icon: logic 🧠 - Explains mechanism, cause-and-effect ("Clear reason exists") - Belief stages 3-4
5. **block-proof** → icon: proof ✅ - Reduces risk, confirms logic (AFTER belief established) - Belief stage 5
6. **block-cta** → icon: cta 🚀 - Clear binary decision, consequences - Belief stage 6
7. **block-ad** → icon: ad 💡 - Creative angles, pattern breaks (use sparingly)
8. **block-misc** → icon: misc 📝 - Everything else

**MANDATORY ICON-TO-BLOCK MAPPING**:
block-hook = hook icon (🎯)
block-emotion = emotion icon (❤️)
block-story = story icon (📖)
block-logic = logic icon (🧠)
block-proof = proof icon (✅)
block-cta = cta icon (🚀)
block-ad = ad icon (💡)
block-misc = misc icon (📝)

**MECHANICS (Inline highlights)**
- **highlight-interrupt**: Pattern breaks, attention shifts
- **highlight-loop-open**: Questions, curiosity gaps (MUST close later)
- **highlight-loop-close**: Answers, reveals, payoffs

**Icon Types** (Block Types):
hook, story, emotion, logic, proof, cta, ad, misc

**Icon Types** (Mechanics):
interrupt, loop-open, loop-close

**FORMATTING CONSTRAINTS**
- **USE HEADINGS**: Use &lt;h1&gt;, &lt;h2&gt;, &lt;h3&gt; for headlines/subheadlines. Do NOT use bold for headlines.
- **Bold** key terms sparingly with &lt;b&gt; or &lt;strong&gt;
- **NO EMPTY LINES**: No empty lines or &lt;br&gt; tags inside content blocks
- **NO WHITESPACE PADDING**: No spaces/newlines at start or end of text in block divs
- **SPAN WRAPPERS**: Wrap inner text of every &lt;h1&gt;, &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt; in &lt;span&gt; tag
- **TIGHT HTML**: Write block divs on SINGLE lines where possible

**CRITICAL LOOP RULE**:
- Every **highlight-loop-open** MUST have a corresponding **highlight-loop-close**
- Close loops in the same belief stage or immediately after
- Do not leave curiosity gaps unanswered
${docType.includes('Sales Page') ? `
**SALES PAGE LOOP REQUIREMENT**:
Sales pages MUST use open loops extensively throughout:
- Use <span class="highlight-loop-open">...</span> every 3-4 paragraphs to maintain curiosity
- Use <i type="loop-open"></i> in the gutter when opening loops
- Close each loop with <span class="highlight-loop-close">...</span> and <i type="loop-close"></i>
- Create fascination with unexpected insights and counter-intuitive angles
- Use loops to make readers want to continue reading` : ''}

**FINAL SELF-CHECK (REQUIRED)**

Before outputting, verify:
- The copy does not sound like a blog post or educational article
- The copy does not use soft, apologetic language ("Remember:", "So why does this happen?", "Here's the truth about...")
- The copy does not over-explain or summarize without persuasion
- The copy does not repeat itself
- The copy leads to a natural conclusion
- The copy feels calm, not salesy
- The copy uses direct address ("YOU'VE HEARD IT ALL BEFORE", "THIS IS FOR YOU IF...")
- The copy has strong, punchy headlines with visual breaks
- The copy explains mechanisms clearly (numbered lists, emojis for systems)
- The copy has specific proof (names, testimonials, not vague)
- If this copy were written by a cautious content writer instead of a strategist, it needs rewriting
- The copy feels decisive and confident, not helpful and explanatory
${docType.includes('Sales Page') ? `- Sales Page length: Minimum 3000 words (preferably 4000-6000 words). Count the words. If under 3000, expand with more detail, examples, scenarios, proof, and explanation.
- Sales Page has all required sections: "YOU'VE HEARD IT ALL BEFORE", "THIS IS FOR YOU IF...", mechanism explanation with systems, proof section, FAQ, origin story, multiple CTAs
- Each belief stage has 3-5+ paragraphs minimum, not rushed` : ''}

**Technical Requirements**:
- Every content-row has a block type icon in the gutter that MATCHES the block type class (block-hook = hook icon, block-emotion = emotion icon, etc.)
- When a block uses mechanics (highlight-interrupt, highlight-loop-open, highlight-loop-close), the gutter has BOTH the block type icon AND the mechanics icon(s)
- Multiple icons in gutter are used whenever mechanics are present in the text
${docType.includes('Sales Page') ? `- For Sales Pages: Opening has eyebrow (p tag), headline (h1 tag), subheadline (h2 tag) in that order
- For Sales Pages: Multiple headlines (h2/h3) appear throughout every 3-5 paragraphs to break up sections
- For Sales Pages: Copy is comprehensive length (3000-6000+ words minimum), NOT abbreviated or rushed
- For Sales Pages: All 6 belief stages are covered with multiple paragraphs each
- For Sales Pages: Major section transitions use h2 headlines, subsections use h3 headlines
- For Sales Pages: Multiple icons in gutter when blocks use loops/interrupts (block type + mechanics icons)` : ''}
- Every paragraph has ONE clear belief purpose
- No sentence mixes semantic roles
- All curiosity loops are closed
${docType.includes('Sales Page') ? `- Sales Pages: Multiple open loops throughout (every 3-4 paragraphs) using highlight-loop-open
- Sales Pages: All open loops are closed with satisfying payoffs using highlight-loop-close
- Sales Pages: Curiosity and fascination maintained throughout each section` : ''}
- Copy persuades without formatting (works as plain text)
- Reader feels guided, not sold
- **Show, don't tell is used consistently**: Every claim shows observable outcomes, not vague statements
- **Outcome-based language throughout**: Every sentence shows what happens (outcome), not what it is (feature)
- **No vague adjectives**: No "powerful", "amazing", "effective" without showing the specific outcome
- Proof appears only after belief is established
- Emotion validates, doesn't pressure
- Mechanism is explained through cause → effect

If any of the above fails, rewrite.

**OUTPUT FORMAT**

You MUST deliver the COMPLETE, FULL-LENGTH sales page (3000-6000+ words) in this single response. Do NOT provide a condensed version, draft, or abbreviated content. Generate everything now. The complete sales page must be:
- Direct
- Belief-driven
- Mechanism-based
- Free of filler
- Free of clichés
- Calm, precise, and confident
- **Uses show, don't tell consistently**: Every claim shows observable outcomes, not vague statements
- **Uses outcome-based language throughout**: Shows what happens (outcome), not what it is (feature)
- Demonstrates semantic discipline throughout
- Leads to an inevitable conclusion
- Follows belief flow structure in order
- Uses proper HTML structure with block types and icons
${docType.includes('Sales Page') ? `
- For Sales Pages: MUST start with eyebrow, headline, subheadline in that exact order
- For Sales Pages: MUST be comprehensive length (3000-6000+ words minimum) covering all 6 belief stages in extensive depth with multiple paragraphs per stage
- For Sales Pages: MUST include sufficient paragraphs for each section (not rushed or abbreviated)
` : ''}

**Example Structure (CORRECT - Icon matches block type)**:
${docType.includes('Sales Page') ? `
**SALES PAGE EXAMPLE (Showing mandatory opening structure, headline usage, and multiple icons)**:
<div class="content-row">
  <div class="gutter"><i type="hook"></i></div>
  <div class="content-body">
    <div class="block-hook"><p><span>For busy professionals who can't sleep</span></p></div>
</div>
</div>
<div class="content-row">
  <div class="gutter"><i type="hook"></i><i type="loop-open"></i></div>
  <div class="content-body">
    <div class="block-hook"><h1><span>The 90-Second Method That Stops Your Mind From Racing <span class="highlight-loop-open">(But here's what nobody tells you...)</span></span></h1></div>
  </div>
</div>
<div class="content-row">
  <div class="gutter"><i type="emotion"></i></div>
  <div class="content-body">
    <div class="block-emotion"><h2><span>Your brain isn't broken. It's just stuck in a pattern.</span></h2></div>
  </div>
</div>
<div class="content-row">
  <div class="gutter"><i type="story"></i><i type="loop-open"></i></div>
  <div class="content-body">
    <div class="block-story"><p><span>I remember when I felt the same way... <span class="highlight-loop-open">or so I thought.</span></span></p></div>
  </div>
</div>
[... several paragraphs ...]
<div class="content-row">
  <div class="gutter"><i type="logic"></i><i type="interrupt"></i></div>
  <div class="content-body">
    <div class="block-logic"><h2><span><span class="highlight-interrupt">Wait.</span> Here's Why This Happens (And Why You're Not Broken)</span></h2></div>
  </div>
</div>
[... mechanism explanation paragraphs ...]
<div class="content-row">
  <div class="gutter"><i type="logic"></i><i type="loop-close"></i></div>
  <div class="content-body">
    <div class="block-logic"><h3><span>How Your Brain Gets Stuck <span class="highlight-loop-close">(Here's the answer you've been waiting for)</span></span></h3></div>
  </div>
</div>
[... more paragraphs with h3 headlines breaking up subsections ...]
<div class="content-row">
  <div class="gutter"><i type="proof"></i></div>
  <div class="content-body">
    <div class="block-proof"><h2><span>Real Results From People Just Like You</span></h2></div>
  </div>
</div>
[... proof paragraphs ...]
<div class="content-row">
  <div class="gutter"><i type="cta"></i></div>
  <div class="content-body">
    <div class="block-cta"><h2><span>Your Decision: Peace or More Sleepless Nights?</span></h2></div>
  </div>
</div>
[Continue with comprehensive content covering all 6 belief stages with headlines every 3-5 paragraphs...]

**CRITICAL**: When a block uses mechanics (highlight-interrupt, highlight-loop-open, highlight-loop-close), the gutter MUST show BOTH the block type icon AND the mechanics icon(s). Multiple icons in the gutter are required and expected.
` : `
<div class="content-row">
  <div class="gutter"><i type="hook"></i></div>
  <div class="content-body">
    <div class="block-hook"><h1><span>Headline that shows recognition</span></h1></div>
  </div>
</div>
<div class="content-row">
  <div class="gutter"><i type="emotion"></i></div>
  <div class="content-body">
    <div class="block-emotion"><p><span>Validation that removes blame. You're not broken.</span></p></div>
  </div>
</div>
<div class="content-row">
  <div class="gutter"><i type="story"></i></div>
  <div class="content-body">
    <div class="block-story"><p><span>I remember when I felt the same way...</span></p></div>
  </div>
</div>
<div class="content-row">
  <div class="gutter"><i type="logic"></i></div>
  <div class="content-body">
    <div class="block-logic"><p><span>Here's why this happens and how it works.</span></p></div>
  </div>
</div>
`}

**CRITICAL**: Every content-row MUST have a block type icon in the gutter that matches the block type class in content-body. This is mandatory and non-negotiable.

**MULTIPLE ICONS REQUIRED**: When a content block uses mechanics (highlight-interrupt, highlight-loop-open, highlight-loop-close), you MUST include BOTH icons in the gutter:
- The block type icon (hook, story, emotion, logic, proof, cta, ad, misc) - ALWAYS
- The mechanics icon(s) (interrupt, loop-open, loop-close) - When that mechanic is used in the text

Example: If block-emotion contains <span class="highlight-loop-open">, the gutter MUST have:
<div class="gutter"><i type="emotion"></i><i type="loop-open"></i></div>

This is mandatory. Multiple icons in the gutter are expected and required when mechanics are used.

${docType.includes('Sales Page') ? `For Sales Pages: (1) The eyebrow-headline-subheadline sequence at the top is MANDATORY. (2) Use multiple h2/h3 headlines throughout (every 3-5 paragraphs) to break up sections and maintain readability. (3) Use multiple icons in gutter when blocks use mechanics (block type + loop/interrupt icons).` : ''}
`;

    const objectionGuidance = objectionList.length ? `
**OBJECTION HANDLING (REQUIRED)**
The user provided these objections. Treat each as a credibility opportunity:
${objectionList.map(o => `* ${o}`).join('\n')}

For each objection: (1) Restate it calmly, (2) Validate the concern, (3) Provide insight or proof, (4) Show why it helps the audience.
Reframe objections as buying signals. Include an FAQ or objection section addressing these.
` : '';

    const userPrompt = `${docType.includes('Sales Page') ? `CRITICAL: Generate the COMPLETE, FULL-LENGTH sales page (3000-6000+ words) in this single response. Do NOT provide a condensed version, draft, or abbreviated content. Generate the entire sales page with all sections, all content, and all required elements now.

` : ''}Instructions: ${instructions}${objectionGuidance}`;

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
Your task is to re-format the provided text into the "ColorWriter" Row Layout with ACCURATE classification.

**CRITICAL CLASSIFICATION RULES**:

**BLOCK TYPES** (Choose the MOST accurate):
1. **block-hook**: The OPENING/FIRST element that grabs attention. Headlines, shocking statements, bold claims, questions that stop scrolling. This is ALWAYS at the start.
2. **block-story**: Narratives, anecdotes, "I remember when...", character-driven content, relatable scenarios.
3. **block-emotion**: Pain points, desires, fears, dreams, empathy statements ("You feel...", "Tired of...").
4. **block-logic**: Facts, data, numbers, explanations, "Here's how it works", mechanisms, reasoning.
5. **block-proof**: Testimonials, case studies, results, "John lost 30lbs", social proof, credentials, authority.
6. **block-cta**: Direct calls to action, "Click here", "Buy now", "Get started", urgency/scarcity.
7. **block-ad**: Creative/unique angles, metaphors, "Imagine if...", pattern breaks, unusual comparisons.
8. **block-misc**: Everything else that doesn't fit above.

**MECHANICS** (Inline highlights):
- **highlight-interrupt**: Pattern breaks, "Wait...", "But here's the thing...", unexpected twists.
- **highlight-loop-open**: Questions, curiosity gaps, "You're probably wondering...", unfinished thoughts.
- **highlight-loop-close**: Answers, reveals, "Here's why...", payoffs, "Aha!" moments.

**CRITICAL RULES**:
1. The FIRST paragraph/headline is almost ALWAYS **block-hook** (not story!).
2. Use ALL block types - don't default to story for everything.
3. Add interrupt/loop highlights to create engagement.
4. Every row needs a block type icon in the gutter that matches the block type class.

**Output Structure**:
<div class="content-row">
  <div class="gutter"><i type='hook'></i><i type='interrupt'></i></div>
  <div class="content-body">
    <div class="block-hook"><h1><span>Your headline here</span></h1></div>
  </div>
</div>

**Formatting Constraints**:
- **SPAN WRAPPERS**: You MUST wrap the inner text of every &lt;h1&gt;, &lt;h2&gt;, &lt;h3&gt;, and &lt;p&gt; in a &lt;span&gt; tag.
- **NO EXTRA SPACE**: Do not add newlines or spaces inside the block-[type] div.
- **TIGHT HTML**: Write compact HTML on single lines where possible.

CRITICAL: Analyze CAREFULLY. The first element should be block-hook. Use diverse block types throughout.
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
This text uses a "Color Block" system (block types) to achieve its goal. The copy contains different block types:
- **Hook** 🎯: Attention-grabbing opening
- **Story** 📖: Narratives and relatable scenarios
- **Emotion** ❤️: Pain points, desires, empathy
- **Logic** 🧠: Facts, data, mechanisms, explanations
- **Proof** ✅: Testimonials, case studies, social proof
- **CTA** 🚀: Calls to action, urgency
- **Ad/Creative** 💡: Creative angles, metaphors
- **Misc** 📝: Everything else

**Goal of this copy**: The purpose of this "${docType}" is to persuade the target audience to take a specific action or adopt a belief.

**Task**:
Analyze how the *mix* of block types (colors) serves the goal of this copy. Be honest about what's actually working and what's not. Base your assessment on the actual content quality, not on what you hope is there.

Provide your raw, honest thoughts on:
- Which block types are present and actually working well (be specific about what makes them work)
- Which block types are missing or over-represented (identify real problems, not hypothetical ones)
- How the balance of colors actually affects the copy's effectiveness (be truthful about weaknesses)
- Whether the copy actually achieves its goal given the block types used (be realistic, not optimistic)
- What block types would better serve the copy's goal (specific, actionable guidance)

**Assessment Rules**:
- Be critical: If something is mediocre, say it's mediocre (score 50-60), not "good" (70-80)
- Be specific: Point to actual examples in the text, not vague generalities
- Be honest: If the Hook doesn't grab attention, say so clearly
- Be realistic: Base scores on actual quality, not best-case interpretation
- Identify real problems: Don't invent problems, but don't ignore obvious ones either

Examples of HONEST feedback:
- "The Hook (Orange) is generic - it sounds like every other product. Score: 45/100. Needs specific recognition or curiosity gap."
- "Too much Logic (Blue) without proof - 8 logic blocks but only 1 proof block. I don't trust claims without evidence. Score: 40/100."
- "Stories (Yellow) are there but feel scripted, not relatable. They don't make me think 'that's me.' Score: 55/100."
- "The copy jumps straight to CTA without building desire. Missing emotion and proof blocks. Score: 30/100."

Focus ONLY on block types (colors) and how they serve the copy's goal. Do not reference personas.

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
        'hook': { name: 'Hook', description: 'Attention-grabbing opening, headlines, bold claims, questions that stop scrolling' },
        'story': { name: 'Story', description: 'Narratives, anecdotes, "I remember when...", character-driven content, relatable scenarios' },
        'emotion': { name: 'Emotion', description: 'Pain points, desires, fears, dreams, empathy statements ("You feel...", "Tired of...")' },
        'logic': { name: 'Logic', description: 'Facts, data, numbers, explanations, "Here\'s how it works", mechanisms, reasoning' },
        'proof': { name: 'Proof', description: 'Testimonials, case studies, results, "John lost 30lbs", social proof, credentials, authority' },
        'cta': { name: 'CTA', description: 'Direct calls to action, "Click here", "Buy now", "Get started", urgency/scarcity' },
        'ad': { name: 'Ad/Creative', description: 'Creative/unique angles, metaphors, "Imagine if...", pattern breaks, unusual comparisons' },
        'misc': { name: 'Misc', description: 'Everything else that doesn\'t fit above categories' }
    };

    const selectedBlock = blockTypeMap[blockType] || blockTypeMap['story'];

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