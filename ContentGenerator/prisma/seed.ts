/**
 * Seed sample signals for local development
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SAMPLE_SIGNALS = [
  {
    subreddit: "anxiety",
    title: "Why do I always feel overwhelmed before bed?",
    selftext: "I can't seem to relax. My mind races with everything I didn't do today.",
    score: 234,
    numComments: 45,
    permalink: "https://reddit.com/r/anxiety/comments/sample1",
    createdUtc: Math.floor(Date.now() / 1000) - 86400,
    signalScore: 42.5,
    themeTags: "overwhelmed,tired,can't relax",
    flagged: false,
  },
  {
    subreddit: "overthinking",
    title: "Am I the only one who can't stop spiraling at 2am?",
    selftext: "Every night I lie there and replay every awkward moment from the day.",
    score: 189,
    numComments: 67,
    permalink: "https://reddit.com/r/overthinking/comments/sample2",
    createdUtc: Math.floor(Date.now() / 1000) - 172800,
    signalScore: 38.2,
    themeTags: "spiraling,stuck",
    flagged: false,
  },
  {
    subreddit: "burnout",
    title: "I'm so tired of feeling guilty when I rest",
    selftext: "Even on weekends I feel like I should be doing something productive.",
    score: 312,
    numComments: 89,
    permalink: "https://reddit.com/r/burnout/comments/sample3",
    createdUtc: Math.floor(Date.now() / 1000) - 259200,
    signalScore: 48.1,
    themeTags: "tired,guilty",
    flagged: false,
  },
  {
    subreddit: "adhd",
    title: "How do you deal with the constant feeling of being behind?",
    selftext: "I always feel like everyone else has it together and I'm playing catch-up.",
    score: 445,
    numComments: 120,
    permalink: "https://reddit.com/r/adhd/comments/sample4",
    createdUtc: Math.floor(Date.now() / 1000) - 345600,
    signalScore: 52.3,
    themeTags: "behind,stuck",
    flagged: false,
  },
  {
    subreddit: "selfimprovement",
    title: "Is it normal to feel numb after burnout?",
    selftext: "I used to care so much. Now I just feel empty.",
    score: 278,
    numComments: 56,
    permalink: "https://reddit.com/r/selfimprovement/comments/sample5",
    createdUtc: Math.floor(Date.now() / 1000) - 432000,
    signalScore: 44.7,
    themeTags: "numb,burnout",
    flagged: false,
  },
];

async function main() {
  console.log("Seeding database...");

  await prisma.signal.deleteMany({});
  for (const s of SAMPLE_SIGNALS) {
    await prisma.signal.create({
      data: s,
    });
  }

  console.log(`Seeded ${SAMPLE_SIGNALS.length} sample signals.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
