"use client";

import { Card } from "@/components/app-shell";
import { useAppState } from "@/lib/app-state";

export default function SettingsIntegrationsPage() {
  const { data, setData } = useAppState();
  return <div className="space-y-4"><h2 className="text-2xl font-semibold">Settings / Integrations</h2>
    <div className="grid gap-3 md:grid-cols-2">{data.integrations.map((i)=><Card key={i.id} title={i.name} subtitle={i.description}><p className="text-xs text-zinc-500">Required setup: {i.requiredSetup}</p><p className="mt-1 text-xs text-amber-300">Status: {i.status}</p><input className="mt-2 w-full rounded bg-zinc-950 p-2 text-sm" placeholder="API key placeholder (not used in v1)" value={i.apiKey ?? ''} onChange={(e)=>setData((prev)=>({...prev,integrations:prev.integrations.map((x)=>x.id===i.id?{...x,apiKey:e.target.value}:x),apiKeys:{...prev.apiKeys,[i.id]:e.target.value}}))} /></Card>)}</div>
  </div>
}

