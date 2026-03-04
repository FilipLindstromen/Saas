"use server";

/**
 * Server action: Scan Reddit for signals and store in DB
 */
import { prisma } from "@/lib/db";
import {
  fetchSubredditPosts,
  fetchPostComments,
  DEFAULT_SUBREDDITS,
  type TimeRange,
  type SortOption,
} from "@/lib/reddit";
import { computeSignalScore } from "@/lib/signal-scoring";

export interface ScanRedditInput {
  subreddits?: string[];
  timeRange?: TimeRange;
  sort?: SortOption;
  postsPerSub?: number;
  fetchComments?: boolean;
}

export interface ScanRedditResult {
  success: boolean;
  signalsCreated: number;
  error?: string;
}

export async function scanReddit(input: ScanRedditInput = {}): Promise<ScanRedditResult> {
  const subreddits = input.subreddits?.length
    ? input.subreddits
    : [...DEFAULT_SUBREDDITS];
  const time = input.timeRange ?? "week";
  const sort = input.sort ?? "top";
  const postsPerSub = input.postsPerSub ?? 10;
  const fetchComments = input.fetchComments ?? true;

  let signalsCreated = 0;

  try {
    // Ensure DB is ready (Prisma may fail if db push not run)
    await prisma.$connect();
  } catch (dbErr) {
    const msg = dbErr instanceof Error ? dbErr.message : "Database error";
    return {
      success: false,
      signalsCreated: 0,
      error: `Database not ready. Run: npx prisma db push. (${msg})`,
    };
  }

  try {
    for (const sub of subreddits) {
      const posts = await fetchSubredditPosts(sub, sort, time, postsPerSub);

      for (const post of posts) {
        const { signalScore, themeTags, flagged } = computeSignalScore(
          post.title,
          post.selftext,
          post.score,
          post.num_comments
        );

        const signal = await prisma.signal.create({
          data: {
            subreddit: post.subreddit,
            title: post.title,
            selftext: post.selftext,
            score: post.score,
            numComments: post.num_comments,
            permalink: post.permalink,
            createdUtc: post.created_utc,
            signalScore,
            themeTags,
            flagged,
          },
        });

        if (fetchComments && !flagged) {
          const comments = await fetchPostComments(post.permalink, 5);
          for (const c of comments) {
            await prisma.comment.create({
              data: {
                signalId: signal.id,
                body: c.body,
                score: c.score,
              },
            });
          }
        }
        signalsCreated++;
      }

      // Rate limit: avoid hammering Reddit
      await new Promise((r) => setTimeout(r, 1000));
    }

    return { success: true, signalsCreated };
  } catch (e) {
    const err = e instanceof Error ? e : new Error("Unknown error");
    let msg = err.message;
    if (msg.includes("fetch") || msg.includes("ECONNREFUSED") || msg.includes("network")) {
      msg = `Network error: ${msg}. Check your connection and that Reddit is reachable.`;
    } else if (msg.includes("Reddit API") || msg.includes("429") || msg.includes("403")) {
      msg = `Reddit API: ${msg}. Try again later or use fewer subreddits.`;
    }
    return { success: false, signalsCreated, error: msg };
  }
}
