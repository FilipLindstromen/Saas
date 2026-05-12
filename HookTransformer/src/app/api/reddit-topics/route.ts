import { NextResponse } from "next/server";

const REDDIT_USER_AGENT = "HookTransformer/1.0 (educational content-research tool)";
const SUBREDDITS = ["Showerthoughts", "Damnthatsinteresting"] as const;

type RedditChild = {
  data?: {
    id?: string;
    title?: string;
    permalink?: string;
    score?: number;
    num_comments?: number;
    subreddit?: string;
    stickied?: boolean;
    over_18?: boolean;
    is_self?: boolean;
    url?: string;
  };
};

function buildSearchQueries(topicOne: string, topicTwo: string): string[] {
  const t1 = topicOne.replace(/\s+/g, " ").trim();
  const t2 = topicTwo.replace(/\s+/g, " ").trim();
  const combined = [t1, t2].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 280);
  const out: string[] = [];
  if (t1 && t2 && t1.toLowerCase() !== t2.toLowerCase()) {
    out.push(t1.slice(0, 200), t2.slice(0, 200));
  }
  if (combined) out.push(combined);
  const seen = new Set<string>();
  return out.filter((q) => {
    const k = q.toLowerCase();
    if (seen.has(k) || !k) return false;
    seen.add(k);
    return true;
  });
}

function rankScore(score: number, numComments: number, fromControversial: boolean): number {
  const s = Math.max(0, score);
  const c = Math.max(0, numComments);
  const engagement = Math.log1p(s) + 0.45 * Math.log1p(c) + 0.00015 * c;
  return fromControversial ? engagement * 1.22 : engagement;
}

async function fetchSearchListings(
  subreddit: string,
  query: string,
  sort: "top" | "controversial",
): Promise<{ data: RedditChild["data"]; fromControversial: boolean }[]> {
  const params = new URLSearchParams({
    q: query,
    restrict_sr: "true",
    sort,
    t: "all",
    limit: "15",
    raw_json: "1",
  });
  const url = `https://www.reddit.com/r/${subreddit}/search.json?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": REDDIT_USER_AGENT },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`Reddit returned ${res.status} for r/${subreddit}`);
  }
  const json = (await res.json()) as { data?: { children?: RedditChild[] } };
  const children = json.data?.children ?? [];
  return children
    .map((ch) => ch.data)
    .filter((d): d is NonNullable<typeof d> => Boolean(d?.id && d.title && !d.stickied))
    .map((data) => ({ data, fromControversial: sort === "controversial" }));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { topicOneHook?: string; topicTwoHook?: string };
    const topicOneHook = typeof body.topicOneHook === "string" ? body.topicOneHook : "";
    const topicTwoHook = typeof body.topicTwoHook === "string" ? body.topicTwoHook : "";
    const queries = buildSearchQueries(topicOneHook, topicTwoHook);
    if (queries.length === 0) {
      return NextResponse.json({ error: "Enter at least one hook in Topic 1 or Topic 2 to search Reddit." }, { status: 400 });
    }

    const jobs: Promise<{ data: RedditChild["data"]; fromControversial: boolean }[]>[] = [];
    for (const sub of SUBREDDITS) {
      for (const q of queries) {
        jobs.push(fetchSearchListings(sub, q, "top"));
        jobs.push(fetchSearchListings(sub, q, "controversial"));
      }
    }

    const settled = await Promise.allSettled(jobs);
    const rows: { data: NonNullable<RedditChild["data"]>; fromControversial: boolean }[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled") {
        for (const row of r.value) {
          if (row.data?.id && row.data.title) rows.push(row as { data: NonNullable<RedditChild["data"]>; fromControversial: boolean });
        }
      }
    }

    const byId = new Map<
      string,
      {
        id: string;
        title: string;
        permalink: string;
        score: number;
        numComments: number;
        subreddit: string;
        url: string;
        rank: number;
      }
    >();

    for (const { data, fromControversial } of rows) {
      const id = data.id as string;
      const score = typeof data.score === "number" ? data.score : 0;
      const numComments = typeof data.num_comments === "number" ? data.num_comments : 0;
      const permalink = typeof data.permalink === "string" ? data.permalink : "";
      const title = (data.title ?? "").trim();
      if (!title || !permalink) continue;
      const r = rankScore(score, numComments, fromControversial);
      const existing = byId.get(id);
      const sub = String(data.subreddit ?? "");
      const linkUrl = permalink.startsWith("http") ? permalink : `https://www.reddit.com${permalink}`;
      if (!existing || r > existing.rank) {
        byId.set(id, {
          id,
          title,
          permalink: linkUrl,
          score,
          numComments,
          subreddit: sub,
          url: linkUrl,
          rank: r,
        });
      }
    }

    const posts = [...byId.values()].sort((a, b) => b.rank - a.rank).slice(0, 10).map(({ rank: _r, ...rest }) => rest);

    if (posts.length === 0) {
      return NextResponse.json(
        { error: "No posts found for that search. Try different hook wording or broader keywords." },
        { status: 404 },
      );
    }

    return NextResponse.json({ posts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reddit search failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
