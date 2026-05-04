"use client";

import { Card, V1Badge } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";

export default function PostPage() {
  const { data, updateIdeaStatus } = useAppState();
  const queue = data.ideas.filter((i)=>i.status==='Filmed');
  return <div className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-2xl font-semibold">Post Queue</h2><V1Badge /></div>
    <Card title="Manual posting mode" subtitle="No direct publishing in v1. Future integrations: Dropbox, scheduler, IG/TikTok/YouTube/LinkedIn/X/Threads APIs.">
      <p className="text-sm text-zinc-400">Publish manually in v1 and track status here.</p>
    </Card>
    {queue.length===0?<Card title="No filmed items ready">Mark items as filmed first.</Card>:<div className="space-y-3">{queue.map((idea)=>{const script=data.scripts.find((s)=>s.ideaId===idea.id);return <Card key={idea.id} title={idea.title}><p className="text-sm">Posting status: {idea.status}</p><p className="text-xs text-zinc-400 mt-1">Manual notes: post natively per platform best practices.</p><p className="text-xs text-zinc-500 mt-2">Caption variants: {script?.platformCaptions.map((c)=>c.platform).join(', ') || 'Generate script for captions'}</p><div className="mt-2 flex gap-2"><label className="text-xs"><input type="checkbox" className="mr-1"/>TikTok</label><label className="text-xs"><input type="checkbox" className="mr-1"/>Instagram</label><label className="text-xs"><input type="checkbox" className="mr-1"/>YouTube</label><label className="text-xs"><input type="checkbox" className="mr-1"/>LinkedIn</label><label className="text-xs"><input type="checkbox" className="mr-1"/>X</label><label className="text-xs"><input type="checkbox" className="mr-1"/>Threads</label></div><button className="mt-2 rounded bg-emerald-500 px-2 py-1 text-xs text-black" onClick={()=>updateIdeaStatus(idea.id,'Posted')}>Mark as posted</button></Card>;})}</div>}
  </div>
}

