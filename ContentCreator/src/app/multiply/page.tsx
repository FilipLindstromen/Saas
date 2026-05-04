"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";
import { generateVariations } from "@/lib/mock-ai";

export default function MultiplyPage() {
  const { data, setData, saveVariationAsIdea } = useAppState();
  const [ideaId, setIdeaId] = useState(data.ideas[0]?.id ?? "");
  const selectedIdea = useMemo(() => data.ideas.find((i) => i.id === ideaId), [data.ideas, ideaId]);

  return <div className="space-y-4"><h2 className="text-2xl font-semibold">Multiply</h2>
    <Card title="Turn one idea into 5 variations"><select className="w-full rounded bg-zinc-950 p-2" value={ideaId} onChange={(e)=>setIdeaId(e.target.value)}>{data.ideas.map((i)=><option key={i.id} value={i.id}>{i.title}</option>)}</select>
      <button className="mt-2 rounded bg-emerald-500 px-3 py-2 text-sm text-black disabled:opacity-50" disabled={!selectedIdea} onClick={()=> selectedIdea && setData((prev)=>({ ...prev, variations:[...generateVariations(selectedIdea), ...prev.variations]}))}>Generate variations</button>
    </Card>
    <Card title={`Variations (${data.variations.length})`}>{data.variations.length===0?<p className="text-sm text-zinc-400">No variations yet.</p>:<div className="space-y-2">{data.variations.map((v)=><div key={v.id} className="rounded border border-zinc-800 p-3 text-sm"><p className="font-medium">{v.title}</p><p>{v.formatType} | target: {v.targetViewer}</p><p className="text-zinc-400">{v.hookIdea}</p><p className="text-xs text-zinc-500">Difficulty {v.difficultyScore} • Est. performance {v.estimatedPerformanceScore}</p><button className="mt-2 rounded bg-zinc-800 px-2 py-1 text-xs" onClick={()=>saveVariationAsIdea(v)}>Save variation to pipeline</button></div>)}</div>}</Card>
  </div>
}

