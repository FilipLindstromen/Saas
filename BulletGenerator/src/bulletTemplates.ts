/** Reference templates for "sexy" curiosity + desire bullets (used in AI prompt). */
export const BULLET_TEMPLATE_GUIDE = `
Bullet points are one-sentence hooks. They break up text, create curiosity, and build desire.
Avoid bland feature lists ("You'll learn X"). Use these 19 proven patterns instead:

1. Wrong! — You think X is good! But you're wrong! (flip a common belief)
2. Two-Step — What to never do when X and why. (If you do this wrong you're risking Y)
3. Giveaway — Say something valuable (actionable insight)
4. Reverse Hook — (Stat/fact). Learn how to leverage (it) to get X.
5. Naked Benefit — How to get (desired result)
6. Transactional — Give me X and I'll give you Y
7. If… Then… — If you (simple qualifier) then you can (big result)
8. Truth About — The truth about (subject). They are to blame. (HINT optional)
9. Single Most — Learn the most important (thing) about (subject)
10. How-To — How to do (something) in (time frame)
11. Number — The X reasons for Y / X ways to Y
12. Sneaky — The sneaky way (someone credible) is doing X
13. Better Than — How to do X better than Y (famous benchmark)
14. Simple Fact — (Stat/fact). This (product/approach) could make sure you (win).
15. What Never — What never to do when X. (Benefit/time saved)
16. Do You? — Do you (painful symptom or mistake)?
17. Reason Why — The reason why (bad outcome keeps happening)
18. Secrets Of — The secret of X without Y (hard thing)
19. Probing Question — Do you have (bad emotion) about Y?

Rules:
- Output 10–14 bullets, one per line, each starting with "- "
- One sentence per bullet (can use parentheses for the twist)
- Specific to the user's topic; no generic filler
- No numbering in output, no intro/outro text
`.trim();
