"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";
import { generateScript } from "@/lib/mock-ai";

export default function ScriptPage() {
  const { data, saveScript } = useAppState();
  const [ideaId, setIdeaId] = useState(data.ideas[0]?.id ?? "");
  const idea = useMemo(() => data.ideas.find((i) => i.id === ideaId), [ideaId, data.ideas]);
  return <div className="space-y-4"><h2 className="text-2xl font-semibold">Script</h2>
    <Card title="Generate filming card" subtitle="Bullet-point style with platform caption variants.">
      <select className="cc-select w-full" value={ideaId} onChange={(e)=>setIdeaId(e.target.value)}>{data.ideas.map((i)=><option key={i.id} value={i.id}>{i.title}</option>)}</select>
      <button type="button" className="cc-btn-primary mt-2" disabled={!idea} onClick={()=> idea && saveScript(generateScript(idea, data.references))}>Generate script card</button>
    </Card>
    <div className="space-y-3">{data.scripts.map((s)=><Card key={s.id} title={data.ideas.find((i)=>i.id===s.ideaId)?.title ?? 'Script card'}><p className="cc-subtle text-sm">Best hook: {s.bestHookRecommendation}</p><p className="mt-1 text-sm">Talking points: {s.talkingPoints.join(' • ')}</p><p className="mt-1 text-sm">CTA: {s.cta}</p><p className="cc-muted mt-1 text-xs">Caption variants: {s.platformCaptions.map((c)=>c.platform).join(', ')}</p></Card>)}</div>
  </div>
}

