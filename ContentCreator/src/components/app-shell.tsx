"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useAppState } from "@/lib/app-state";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { resetData } = useAppState();
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto flex w-full max-w-[1500px]">
        <aside className="sticky top-0 h-screen w-72 border-r p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}>
          <h1 className="mb-1 text-xl font-semibold">AI Content Machine</h1>
          <p className="mb-4 text-xs text-[var(--text-tertiary)]">Local-first v1 (manual + mock mode)</p>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded px-3 py-2 text-sm ${pathname === item.href ? "bg-[var(--accent)]/20 text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button className="mt-6 w-full rounded border px-3 py-2 text-sm" style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-default)" }} onClick={resetData}>
            Reset Seed Data
          </button>
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border p-4" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-elevated)", boxShadow: "var(--shadow-sm)" }}>
      <h3 className="text-base font-semibold">{title}</h3>
      {subtitle ? <p className="mb-3 text-xs text-[var(--text-tertiary)]">{subtitle}</p> : null}
      {children}
    </section>
  );
}

export function V1Badge() {
  return <span className="rounded-full border border-amber-300/40 bg-amber-500/20 px-2 py-1 text-[11px] text-amber-200">v1 manual/mock mode</span>;
}
