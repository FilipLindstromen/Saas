"use client";

import { useState } from "react";
import { Card, V1Badge } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";
import { RESEARCH_SOURCES } from "@/lib/constants";
import { generateResearchIdeas } from "@/lib/mock-ai";
import { ContentIdea, Platform } from "@/lib/types";

const platforms: Platform[] = ["LinkedIn", "Instagram", "YouTube Shorts", "TikTok", "X", "Threads"];

export default function ResearchPage() {
  const { data, addIdeas } = useAppState();
  const [topic, setTopic] = useState("AI-assisted content systems");
  const [audience, setAudience] = useState("Coaches and creator-educators");
  const [trendNotes, setTrendNotes] = useState("");
  const [count, setCount] = useState(10);
  const [selectedSources, setSelectedSources] = useState(RESEARCH_SOURCES.slice(0, 4));
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(platforms);
  const [results, setResults] = useState<ContentIdea[]>([]);

  return <div className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Research</h2><V1Badge /></div>
    <Card title="Research Inputs" subtitle="Instagram/YouTube/etc are selectable but not live-connected in v1.">
      <div className="grid gap-3 md:grid-cols-2">
        <input className="rounded border border-zinc-700 bg-zinc-950 p-2" value={topic} onChange={(e)=>setTopic(e.target.value)} placeholder="Topic or niche" />
        <input className="rounded border border-zinc-700 bg-zinc-950 p-2" value={audience} onChange={(e)=>setAudience(e.target.value)} placeholder="Target audience" />
        <input className="rounded border border-zinc-700 bg-zinc-950 p-2" value={trendNotes} onChange={(e)=>setTrendNotes(e.target.value)} placeholder="Optional trend notes" />
        <input type="number" className="rounded border border-zinc-700 bg-zinc-950 p-2" value={count} onChange={(e)=>setCount(Number(e.target.value))} min={1} max={20} />
      </div>
      <p className="mt-3 text-xs text-zinc-500">Sources</p><div className="mt-1 flex flex-wrap gap-2">{RESEARCH_SOURCES.map((s)=><button key={s} className={`rounded px-2 py-1 text-xs ${selectedSources.includes(s)?"bg-emerald-500/20":"bg-zinc-800"}`} onClick={()=>setSelectedSources((p)=>p.includes(s)?p.filter((x)=>x!==s):[...p,s])}>{s}</button>)}</div>
      <p className="mt-3 text-xs text-zinc-500">Platforms</p><div className="mt-1 flex flex-wrap gap-2">{platforms.map((p)=><button key={p} className={`rounded px-2 py-1 text-xs ${selectedPlatforms.includes(p)?"bg-indigo-500/20":"bg-zinc-800"}`} onClick={()=>setSelectedPlatforms((v)=>v.includes(p)?v.filter((x)=>x!==p):[...v,p])}>{p}</button>)}</div>
      <button className="mt-4 rounded bg-emerald-500 px-4 py-2 text-sm text-black" onClick={()=>setResults(generateResearchIdeas({topic,audience,platforms:selectedPlatforms,selectedSources,trendNotes,count},data.brandProfile))}>Generate opportunities</button>
    </Card>
    <Card title={`Results (${results.length})`} subtitle="Save selected ideas into pipeline.">{results.length===0?<p className="text-sm text-zinc-400">No results yet.</p>:<div className="space-y-2">{results.map((r)=><div key={r.id} className="rounded border border-zinc-800 p-3 text-sm"><p className="font-medium">{r.title}</p><p className="text-zinc-400">{r.whyTrending}</p><p className="text-xs text-zinc-500">Source: {r.selectedSource} | Scores: A{r.audienceSizeScore}/D{r.demoAbilityScore}/H{r.hookPotentialScore}</p><button className="mt-2 rounded bg-zinc-800 px-2 py-1 text-xs" onClick={()=>addIdeas([r])}>Save to pipeline</button></div>)}</div>}</Card>
  </div>
}

