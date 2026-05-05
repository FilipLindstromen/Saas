import { ResearchSource } from "./types";

export type SourceSignal = {
  source: ResearchSource;
  title: string;
  detail: string;
  url?: string;
};

async function fetchRedditSignals(): Promise<SourceSignal[]> {
  const subs = ["entrepreneur", "marketing", "contentmarketing", "smallbusiness"];
  const out: SourceSignal[] = [];
  for (const sub of subs) {
    const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=4`);
    if (!res.ok) continue;
    const json = (await res.json()) as { data?: { children?: Array<{ data?: { title?: string; score?: number; permalink?: string } }> } };
    const posts = json.data?.children ?? [];
    for (const p of posts) {
      const title = p.data?.title;
      if (!title) continue;
      out.push({
        source: "Reddit",
        title,
        detail: `r/${sub} hot post (score ${p.data?.score ?? 0})`,
        url: p.data?.permalink ? `https://www.reddit.com${p.data.permalink}` : undefined,
      });
    }
  }
  return out.slice(0, 12);
}

async function fetchGithubSignals(): Promise<SourceSignal[]> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const url = `https://api.github.com/search/repositories?q=created:%3E${since}&sort=stars&order=desc&per_page=8`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = (await res.json()) as { items?: Array<{ full_name?: string; stargazers_count?: number; description?: string; html_url?: string }> };
  return (json.items ?? []).map((repo) => ({
    source: "GitHub Trending",
    title: repo.full_name ?? "Trending repo",
    detail: `${repo.stargazers_count ?? 0} stars • ${repo.description ?? "No description"}`,
    url: repo.html_url,
  }));
}

async function fetchTechNewsSignals(): Promise<SourceSignal[]> {
  const res = await fetch("https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=10");
  if (!res.ok) return [];
  const json = (await res.json()) as { hits?: Array<{ title?: string; points?: number; url?: string }> };
  return (json.hits ?? [])
    .filter((h) => h.title)
    .map((h) => ({
      source: "Tech news",
      title: h.title ?? "Tech story",
      detail: `Hacker News points: ${h.points ?? 0}`,
      url: h.url,
    }));
}

export async function fetchSignalsForSources(selected: ResearchSource[]) {
  const signals: SourceSignal[] = [];
  const unavailable: ResearchSource[] = [];
  const errors: string[] = [];

  const want = new Set(selected);

  if (want.has("Reddit")) {
    try {
      signals.push(...(await fetchRedditSignals()));
    } catch (e) {
      errors.push(`Reddit: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  if (want.has("GitHub Trending")) {
    try {
      signals.push(...(await fetchGithubSignals()));
    } catch (e) {
      errors.push(`GitHub Trending: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  if (want.has("Tech news")) {
    try {
      signals.push(...(await fetchTechNewsSignals()));
    } catch (e) {
      errors.push(`Tech news: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  for (const src of selected) {
    if (["Instagram", "YouTube", "TikTok", "X / Twitter", "LinkedIn"].includes(src)) {
      unavailable.push(src);
    }
  }

  return { signals, unavailable, errors };
}
