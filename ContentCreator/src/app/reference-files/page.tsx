"use client";

import { Card } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";

export default function ReferenceFilesPage() {
  const { data, setData } = useAppState();
  return <div className="space-y-4"><h2 className="text-2xl font-semibold">Reference Files</h2><p className="text-sm text-zinc-400">These docs influence mock generation for script and idea outputs.</p>
    <div className="grid gap-3">{data.references.map((doc)=><Card key={doc.id} title={doc.title}><textarea className="min-h-36 w-full rounded bg-zinc-950 p-2" value={doc.content} onChange={(e)=>setData((prev)=>({...prev,references:prev.references.map((r)=>r.id===doc.id?{...r,content:e.target.value}:r)}))} /></Card>)}</div>
  </div>
}

