/**
 * Reddit API client - fetches posts and comments from subreddits
 * Uses JSON endpoint (no auth required for public subreddits)
 * Rate limit: Reddit allows ~60 requests/min for unauthenticated
 */

export const DEFAULT_SUBREDDITS = [
  "anxiety",
  "stress",
  "overthinking",
  "selfimprovement",
  "mentalhealth",
  "socialanxiety",
  "productivity",
  "getdisciplined",
  "adhd",
  "depression",
] as const;

export type TimeRange = "day" | "week" | "month" | "year";
export type SortOption = "hot" | "top" | "new";

export interface RedditPost {
  subreddit: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  permalink: string;
  created_utc: number;
  id: string;
}

export interface RedditComment {
  body: string;
  score: number;
}

type CommentChild = { data?: { body?: string; score?: number; replies?: unknown; removed?: boolean } };

/**
 * Fetch posts from a subreddit using Reddit's JSON API
 * Append .json to any Reddit URL to get JSON response
 */
export async function fetchSubredditPosts(
  subreddit: string,
  sort: SortOption = "top",
  time: TimeRange = "week",
  limit: number = 25
): Promise<RedditPost[]> {
  const base = `https://www.reddit.com/r/${subreddit}/${sort}.json`;
  const params = new URLSearchParams({
    t: time,
    limit: String(limit),
    raw_json: "1",
  });

  const res = await fetch(`${base}?${params}`, {
    headers: {
      "User-Agent": "ContentGenerator/1.0 (Personal Development Research)",
    },
  });

  if (!res.ok) {
    throw new Error(`Reddit API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const posts: RedditPost[] = [];

  for (const child of data.data?.children ?? []) {
    const p = child.data;
    if (!p || p.over_18 || p.removed) continue;

    posts.push({
      subreddit: p.subreddit ?? subreddit,
      title: p.title ?? "",
      selftext: (p.selftext ?? "").slice(0, 4000),
      score: p.score ?? 0,
      num_comments: p.num_comments ?? 0,
      permalink: `https://reddit.com${p.permalink ?? ""}`,
      created_utc: p.created_utc ?? 0,
      id: p.id ?? "",
    });
  }

  return posts;
}

/**
 * Fetch top comments for a post
 */
export async function fetchPostComments(
  permalink: string,
  limit: number = 5
): Promise<RedditComment[]> {
  // Reddit comment permalink: /r/sub/comments/ID/title/...
  const jsonUrl = permalink.endsWith("/")
    ? `${permalink}.json`
    : `${permalink}/.json`;

  const res = await fetch(jsonUrl, {
    headers: {
      "User-Agent": "ContentGenerator/1.0 (Personal Development Research)",
    },
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  const comments: RedditComment[] = [];

  // First element is the post, second is comments
  const commentListing = Array.isArray(data) ? data[1] : null;
  if (!commentListing?.data?.children) return comments;

  const flatComments = flattenComments(commentListing.data.children as CommentChild[]);
  flatComments
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit)
    .forEach((c) => {
      if (c.body && !c.removed) {
        comments.push({ body: c.body.slice(0, 1000), score: c.score ?? 0 });
      }
    });

  return comments;
}

function flattenComments(
  children: CommentChild[],
  out: Array<{ body: string; score: number; removed?: boolean }> = []
): Array<{ body: string; score: number; removed?: boolean }> {
  for (const c of children) {
    const d = c.data;
    if (!d) continue;
    if (d.body) out.push({ body: d.body, score: d.score ?? 0, removed: d.removed });
    if (d.replies && typeof d.replies === "object" && "data" in d.replies) {
      const rep = (d.replies as { data?: { children?: CommentChild[] } }).data;
      if (rep?.children) flattenComments(rep.children, out);
    }
  }
  return out;
}
