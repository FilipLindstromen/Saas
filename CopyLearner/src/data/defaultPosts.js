/* ---------------------------------------------------------
   STARTER CONTENT — copywriting fundamentals.
   Every uploaded source you add generates more posts in the
   "mine" category alongside these.
--------------------------------------------------------- */
export const BUILT_IN_CATEGORIES = [
  { id: 'basics', label: 'Basics', accent: '#6E9BC7' },
  { id: 'headlines', label: 'Headlines', accent: '#E06868' },
  { id: 'intros', label: 'Intros', accent: '#E6B84C' },
  { id: 'bullets', label: 'Bullets', accent: '#3FBBA8' },
  { id: 'cta', label: 'CTAs', accent: '#D64E7A' },
]

export const CUSTOM_CATEGORY = { id: 'mine', label: 'My Content', accent: '#9B7FE0' }

export function accentOf(categories, cat) {
  return categories.find((c) => c.id === cat)?.accent || '#8A8A8A'
}
export function labelOf(categories, cat) {
  return categories.find((c) => c.id === cat)?.label || cat
}

export const DEFAULT_POSTS = [
  // ---------------- BASICS ----------------
  {
    id: 'b1', category: 'basics', title: 'Features vs. Benefits',
    slides: [
      { kind: 'title', kicker: 'Basics', heading: 'Features vs. Benefits' },
      { kind: 'point', heading: 'A feature is what it IS', body: '"12-hour battery life." True, but nobody buys a fact.' },
      { kind: 'point', heading: 'A benefit is what it DOES for them', body: '"Never charge it mid-shoot again." That\'s the thing they\'re actually paying for.' },
      { kind: 'example', label: 'Feature → Benefit', before: 'Made from merino wool', after: 'Stays warm even when it\'s soaked through' },
      { kind: 'quiz', prompt: 'Which line sells the benefit, not the feature?', options: ['Runs on a 2000mAh battery', 'Lasts a full workday without a charger'], correct: 1, explanation: 'Same fact, translated into what it means for the reader\'s day.' },
      { kind: 'takeaway', body: 'Rule of thumb: after every feature, ask "so what?" until you hit something the reader actually feels.' },
    ],
  },
  {
    id: 'b2', category: 'basics', title: 'Write to One Reader',
    slides: [
      { kind: 'title', kicker: 'Basics', heading: 'Write to One Reader' },
      { kind: 'point', heading: '"Everyone" is nobody', body: 'Copy aimed at a whole market feels generic because it\'s trying to fit everyone at once.' },
      { kind: 'point', heading: 'Pick one person, one moment', body: 'Picture them mid-scroll, mid-problem. Write like you\'re answering their specific question.' },
      { kind: 'example', label: 'Broad → Specific', before: 'For people who want to get fit', after: 'For the parent who has 20 minutes before the school run' },
      { kind: 'challenge', prompt: 'Describe your one reader in a single sentence: where are they, what just happened, what do they want right now?', hint: 'Time of day, device, emotional state — get concrete.', modelAnswer: 'It\'s 9pm, she\'s on her phone in bed, exhausted from the day, wishing tomorrow could feel easier.' },
      { kind: 'takeaway', body: 'Every line should sound like it\'s for one person — not a demographic.' },
    ],
  },
  {
    id: 'b3', category: 'basics', title: 'The AIDA Skeleton',
    slides: [
      { kind: 'title', kicker: 'Basics', heading: 'The AIDA Skeleton' },
      { kind: 'point', heading: 'Attention', body: 'Interrupt the scroll. A headline, a visual, a claim.' },
      { kind: 'point', heading: 'Interest', body: 'Give them a reason to keep reading — usually by naming their problem precisely.' },
      { kind: 'point', heading: 'Desire', body: 'Show the outcome. Make them picture having it.' },
      { kind: 'point', heading: 'Action', body: 'Tell them exactly what to do next. One action, not three.' },
      { kind: 'quiz', prompt: 'A page that hooks well but never says what to click next is missing which step?', options: ['Interest', 'Action'], correct: 1, explanation: 'Desire without a clear next step just leaves people scrolling on.' },
      { kind: 'takeaway', body: 'Most weak copy is missing one of these four — find which one before you rewrite the whole thing.' },
    ],
  },
  {
    id: 'b4', category: 'basics', title: 'Specificity Sells',
    slides: [
      { kind: 'title', kicker: 'Basics', heading: 'Specificity Sells' },
      { kind: 'point', heading: 'Vague claims feel like marketing', body: '"Fast results" — every competitor says that too.' },
      { kind: 'point', heading: 'Specific claims feel like facts', body: 'A number, a timeframe, a detail — it reads as true because it\'s too oddly precise to be made up.' },
      { kind: 'example', label: 'Vague → Specific', before: 'Lose weight fast', after: 'Drop 4kg in the first 14 days' },
      { kind: 'example', label: 'Vague → Specific', before: 'Loved by customers', after: 'Reordered by 3 out of 4 customers within 60 days' },
      { kind: 'takeaway', body: 'Whenever you write "a lot", "fast", or "many" — stop and find the real number.' },
    ],
  },

  // ---------------- HEADLINES ----------------
  {
    id: 'h1', category: 'headlines', title: 'The Curiosity Gap',
    slides: [
      { kind: 'title', kicker: 'Headlines', heading: 'The Curiosity Gap' },
      { kind: 'point', heading: 'Open a loop, don\'t close it', body: 'Give the reader enough to want the answer — not enough to already have it.' },
      { kind: 'example', label: 'Closed → Open', before: '5 tips to sleep better tonight', after: 'The one bedtime habit that was quietly wrecking my sleep' },
      { kind: 'point', heading: 'The gap needs a promise', body: 'Curiosity alone feels like clickbait. Pair it with a benefit so the reader knows why closing the gap matters to them.' },
      { kind: 'quiz', prompt: 'Which headline creates a real curiosity gap (not just vague mystery)?', options: ['This will surprise you', 'The pricing mistake that\'s costing you your best customers'], correct: 1, explanation: 'It names a specific stake, so the mystery has something to lose.' },
      { kind: 'takeaway', body: 'Ask: does this headline make the reader NEED to know what comes next, or could they guess it in one second?' },
    ],
  },
  {
    id: 'h2', category: 'headlines', title: 'The 4 U\'s',
    slides: [
      { kind: 'title', kicker: 'Headlines', heading: 'The 4 U\'s' },
      { kind: 'point', heading: 'Urgent', body: 'Gives a reason to act now, not later.' },
      { kind: 'point', heading: 'Unique', body: 'Says something a competitor couldn\'t say about their own product.' },
      { kind: 'point', heading: 'Ultra-specific', body: 'Uses a real number, name, or detail instead of a vague claim.' },
      { kind: 'point', heading: 'Useful', body: 'Promises a clear, concrete benefit to the reader.' },
      { kind: 'challenge', prompt: 'Take a headline you\'ve written recently. Score it 0–4 for how many U\'s it hits.', hint: 'Most first-draft headlines only hit one.', modelAnswer: 'Weak drafts usually nail \'useful\' and skip the rest — that\'s the gap to close on your next pass.' },
      { kind: 'takeaway', body: 'You rarely need all 4 in one headline — but the strongest ones usually stack at least 2.' },
    ],
  },
  {
    id: 'h3', category: 'headlines', title: 'How-To Headlines',
    slides: [
      { kind: 'title', kicker: 'Headlines', heading: 'How-To Headlines' },
      { kind: 'point', heading: 'Why they still work', body: '"How to ___" promises a transformation and a method in four words. It\'s the most reliable structure in the toolbox.' },
      { kind: 'example', label: 'Formula', before: 'How to [get desired result] without [common obstacle]', after: 'How to write faster copy without sounding robotic' },
      { kind: 'point', heading: 'The trap', body: 'It\'s easy to write a bland one. The obstacle clause is what separates generic from magnetic.' },
      { kind: 'takeaway', body: 'If your how-to headline could apply to any product in the category, the obstacle isn\'t specific enough yet.' },
    ],
  },
  {
    id: 'h4', category: 'headlines', title: 'Numbers in Headlines',
    slides: [
      { kind: 'title', kicker: 'Headlines', heading: 'Numbers in Headlines' },
      { kind: 'point', heading: 'Numbers signal structure', body: 'A number tells the reader exactly what they\'re getting into before they click — that reduces friction.' },
      { kind: 'point', heading: 'Odd numbers read as more honest', body: '"7 ways" feels more researched than "10 ways" — round numbers can read as padded.' },
      { kind: 'example', label: 'Weak → Strong', before: 'Several ways to improve your emails', after: '7 subject line fixes that took our open rate from 12% to 31%' },
      { kind: 'takeaway', body: 'A number plus a specific result beats a number alone every time.' },
    ],
  },
  {
    id: 'h5', category: 'headlines', title: 'The Enemy Headline',
    slides: [
      { kind: 'title', kicker: 'Headlines', heading: 'Name the Enemy' },
      { kind: 'point', heading: 'Give the problem a face', body: 'People rally against a named villain faster than an abstract issue. The enemy can be a habit, an industry, or a myth.' },
      { kind: 'example', label: 'Abstract → Enemy', before: 'Get better sleep', after: 'Your mattress ad is lying to you about "deep sleep"' },
      { kind: 'point', heading: 'Keep it honest', body: 'This only works if the enemy is real. Manufactured outrage reads as manipulative fast.' },
      { kind: 'takeaway', body: 'Ask: who or what is quietly working against my reader\'s goal? That\'s your headline\'s villain.' },
    ],
  },

  // ---------------- INTROS ----------------
  {
    id: 'i1', category: 'intros', title: 'Open Mid-Scene',
    slides: [
      { kind: 'title', kicker: 'Intros', heading: 'Open Mid-Scene' },
      { kind: 'point', heading: 'Skip the throat-clearing', body: 'Don\'t warm up with context. Drop the reader straight into a moment — a specific line of dialogue, a specific hour, a specific mistake.' },
      { kind: 'example', label: 'Weak → Mid-scene', before: 'In today\'s fast-paced world, many people struggle with stress.', after: '3:14am. Staring at the ceiling. Again.' },
      { kind: 'takeaway', body: 'If your first line could open literally any article on the topic, it\'s not an opening — it\'s a placeholder.' },
    ],
  },
  {
    id: 'i2', category: 'intros', title: 'The Surprising Stat Hook',
    slides: [
      { kind: 'title', kicker: 'Intros', heading: 'The Surprising Stat Hook' },
      { kind: 'point', heading: 'Numbers stop the scroll', body: 'A specific, unexpected number does what a claim can\'t — it feels verifiable, so the brain pauses on it.' },
      { kind: 'example', label: 'Example opener', before: '', after: 'Most people quit their morning routine by day 9 — not because it\'s hard, but because it\'s boring.' },
      { kind: 'point', heading: 'Pair it with a reframe', body: 'The stat alone is trivia. Add the twist ("not because... but because...") and it becomes an insight.' },
      { kind: 'takeaway', body: 'A stat hook works best when it contradicts what the reader assumed was true.' },
    ],
  },
  {
    id: 'i3', category: 'intros', title: 'The Bold Claim Open',
    slides: [
      { kind: 'title', kicker: 'Intros', heading: 'The Bold Claim Open' },
      { kind: 'point', heading: 'State the controversial version first', body: 'Say the thing your reader\'s peers wouldn\'t say out loud. It signals you\'re not writing the same safe article everyone else did.' },
      { kind: 'example', label: 'Safe → Bold', before: 'Cold outreach can be effective if done right.', after: 'Cold outreach isn\'t dead. Your cold outreach is just boring.' },
      { kind: 'point', heading: 'Earn it fast', body: 'A bold claim buys you one paragraph of trust. Back it up immediately or you lose the reader.' },
      { kind: 'takeaway', body: 'Bold opens work because they take a side. Vague opens don\'t work because they take no risk.' },
    ],
  },
  {
    id: 'i4', category: 'intros', title: 'Pattern Interrupts',
    slides: [
      { kind: 'title', kicker: 'Intros', heading: 'Pattern Interrupts' },
      { kind: 'point', heading: 'Break the expected format', body: 'If every post in the feed starts with a question, start with a flat statement. If everyone opens wide, open narrow.' },
      { kind: 'example', label: 'Expected → Interrupt', before: 'Are you struggling to grow your audience?', after: 'I deleted 40,000 followers on purpose.' },
      { kind: 'quiz', prompt: 'Why does a pattern interrupt work in a feed specifically?', options: ['It\'s louder than other posts', 'It doesn\'t match the shape the brain expects, so it can\'t be skimmed past on autopilot'], correct: 1, explanation: 'The brain filters by pattern, not volume — breaking the pattern is what earns the extra half-second.' },
      { kind: 'takeaway', body: 'Scroll past your own draft fast. Where does your eye actually catch? That\'s the intro.' },
    ],
  },

  // ---------------- BULLETS ----------------
  {
    id: 'bu1', category: 'bullets', title: 'Bullets Sell Benefits, Not Lists',
    slides: [
      { kind: 'title', kicker: 'Bullets', heading: 'Bullets Sell Benefits' },
      { kind: 'point', heading: 'A feature list is a spec sheet', body: 'Rows of features read like an inventory — nobody gets excited reading a spec sheet.' },
      { kind: 'example', label: 'Spec → Benefit', before: 'Adjustable straps', after: 'Fits comfortably whether you\'re layering up for winter or in a t-shirt' },
      { kind: 'takeaway', body: 'Before you write a bullet, finish the sentence: "...which means the reader gets to ___."' },
    ],
  },
  {
    id: 'bu2', category: 'bullets', title: 'Fascination Bullets',
    slides: [
      { kind: 'title', kicker: 'Bullets', heading: 'Fascination Bullets' },
      { kind: 'point', heading: 'Tease the payoff, withhold the how', body: 'A fascination bullet promises a specific, desirable result without giving away the method — the gap is what makes people keep reading.' },
      { kind: 'example', label: 'Example', before: '', after: 'The 90-second trick that makes a follow-up email impossible to ignore (page 14)' },
      { kind: 'point', heading: 'Stay specific, not vague', body: '"A secret tip that works" is empty. "The exact subject line that got a 61% open rate" earns curiosity because it\'s concrete.' },
      { kind: 'quiz', prompt: 'Which is a true fascination bullet?', options: ['Learn our best marketing secrets', 'Why sending your email at 6:58am beats 9am — and what happens at the 2-minute mark'], correct: 1, explanation: 'It\'s specific enough to feel real, but withholds the actual mechanism.' },
      { kind: 'takeaway', body: 'Fascinations work because specificity + withheld payoff = irresistible. Either one alone falls flat.' },
    ],
  },
  {
    id: 'bu3', category: 'bullets', title: 'Bucket Brigades',
    slides: [
      { kind: 'title', kicker: 'Bullets', heading: 'Bucket Brigades' },
      { kind: 'point', heading: 'Short transitional phrases that pull the eye down', body: '"Here\'s why:" "But there\'s a catch:" "And that\'s not all:" — they act like handholds between ideas.' },
      { kind: 'example', label: 'Without → With', before: 'The product is durable. It also ships fast.', after: 'The product is durable. But here\'s the part people don\'t expect: it also ships in 24 hours.' },
      { kind: 'takeaway', body: 'Use bucket brigades to rescue a page that reads flat — they add momentum without adding new content.' },
    ],
  },
  {
    id: 'bu4', category: 'bullets', title: 'One Idea Per Bullet',
    slides: [
      { kind: 'title', kicker: 'Bullets', heading: 'One Idea Per Bullet' },
      { kind: 'point', heading: 'Stacked ideas dilute each other', body: 'A bullet trying to sell three benefits at once ends up selling none of them memorably.' },
      { kind: 'example', label: 'Stacked → Isolated', before: 'Lightweight, waterproof, and comes in 6 colors', after: 'So light you\'ll forget it\'s in your bag' },
      { kind: 'takeaway', body: 'If a bullet has an "and", check whether it should actually be two bullets.' },
    ],
  },

  // ---------------- CTA ----------------
  {
    id: 'c1', category: 'cta', title: 'One Action, Not Three',
    slides: [
      { kind: 'title', kicker: 'CTAs', heading: 'One Action, Not Three' },
      { kind: 'point', heading: 'Every extra option is a chance to leave', body: '"Buy now, learn more, or follow us" gives the brain three doors — and it\'s easier to walk through none of them.' },
      { kind: 'example', label: 'Cluttered → Single', before: 'Shop now / Read reviews / Join newsletter', after: 'Get 20% off your first order' },
      { kind: 'takeaway', body: 'One page, one primary action. Put everything else somewhere else.' },
    ],
  },
  {
    id: 'c2', category: 'cta', title: 'Risk Reversal',
    slides: [
      { kind: 'title', kicker: 'CTAs', heading: 'Risk Reversal' },
      { kind: 'point', heading: 'Move the risk from the buyer to you', body: 'A guarantee, a free trial, a no-questions-asked return — it answers the objection right at the moment of decision.' },
      { kind: 'example', label: 'Without → With', before: 'Buy now', after: 'Try it for 30 days — if it doesn\'t work, you don\'t pay' },
      { kind: 'point', heading: 'Placement matters', body: 'The strongest spot for a guarantee is right next to the CTA button, not buried in the footer.' },
      { kind: 'takeaway', body: 'Ask: what\'s the one thought stopping them from clicking? Your guarantee should answer that exact thought.' },
    ],
  },
  {
    id: 'c3', category: 'cta', title: 'Real vs. Fake Urgency',
    slides: [
      { kind: 'title', kicker: 'CTAs', heading: 'Real vs. Fake Urgency' },
      { kind: 'point', heading: 'Fake urgency erodes trust', body: 'A countdown timer that resets every visit teaches the reader to ignore your deadlines forever.' },
      { kind: 'point', heading: 'Real urgency is honest and specific', body: 'Limited stock that\'s actually limited. A bonus that actually expires. A cohort that actually starts on a date.' },
      { kind: 'quiz', prompt: 'Which builds long-term trust?', options: ['"Sale ends in 10:00" that resets on refresh', '"Only 12 spots — the program starts Monday and won\'t reopen until next quarter"'], correct: 1, explanation: 'Specific and true urgency still works next time you use it. Fake urgency only works once.' },
      { kind: 'takeaway', body: 'If you wouldn\'t say the deadline out loud to the customer\'s face, don\'t put it in the copy.' },
    ],
  },
  {
    id: 'c4', category: 'cta', title: 'The Reason-Why Close',
    slides: [
      { kind: 'title', kicker: 'CTAs', heading: 'The Reason-Why Close' },
      { kind: 'point', heading: 'Give a reason for the offer, not just the offer', body: '"20% off" invites suspicion. "20% off because we\'re clearing stock ahead of the new model" invites belief.' },
      { kind: 'example', label: 'Bare → Reasoned', before: 'Limited time discount', after: 'We\'re discounting last season\'s batch to make room for the new one — once it\'s gone, this price is gone' },
      { kind: 'takeaway', body: 'A believable "why" behind an offer converts better than a bigger discount with no explanation.' },
    ],
  },
]
