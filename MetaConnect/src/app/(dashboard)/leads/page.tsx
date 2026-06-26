"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface Lead {
  id: string;
  name: string;
  email: string;
  source: "comment" | "lead_form";
  createdAt: string;
  project: { name: string; type: string };
}

function LeadsContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const url = projectId ? `/api/leads?projectId=${projectId}` : "/api/leads";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setLeads(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [projectId]);

  const filtered = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()),
  );

  function exportCsv() {
    const rows = [
      ["Name", "Email", "Source", "Project", "Date"],
      ...filtered.map((l) => [
        l.name,
        l.email,
        l.source,
        l.project.name,
        new Date(l.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "metaconnect-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
            Leads
          </h1>
          <p style={{ fontSize: 15, color: "#64748b", margin: 0 }}>
            All contacts collected across your projects.
          </p>
        </div>
        {filtered.length > 0 && (
          <button className="btn btn-secondary" onClick={exportCsv}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div className="card" style={{ padding: "14px 20px", display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>{leads.length}</span>
          <span style={{ fontSize: 13, color: "#64748b" }}>Total leads</span>
        </div>
        <div className="card" style={{ padding: "14px 20px", display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#2563eb" }}>
            {leads.filter((l) => l.source === "comment").length}
          </span>
          <span style={{ fontSize: 13, color: "#64748b" }}>From comments</span>
        </div>
        <div className="card" style={{ padding: "14px 20px", display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#16a34a" }}>
            {leads.filter((l) => l.source === "lead_form").length}
          </span>
          <span style={{ fontSize: 13, color: "#64748b" }}>From lead forms</span>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="input"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {loading ? (
        <div style={{ color: "#94a3b8", textAlign: "center", padding: 48 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 8px" }}>
            {search ? "No results" : "No leads yet"}
          </h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
            {search
              ? `No leads match "${search}".`
              : "Leads will appear here once your projects start collecting them."}
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Project</th>
                <th>Source</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 999,
                          background: "#eff6ff",
                          color: "#2563eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {lead.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{lead.name}</span>
                    </div>
                  </td>
                  <td style={{ color: "#64748b" }}>
                    <a href={`mailto:${lead.email}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                      {lead.email}
                    </a>
                  </td>
                  <td style={{ fontSize: 13, color: "#64748b" }}>{lead.project.name}</td>
                  <td>
                    <span className={`badge ${lead.source === "comment" ? "badge-blue" : "badge-green"}`}>
                      {lead.source === "comment" ? "💬 Comment" : "📋 Lead Form"}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: "#94a3b8" }}>
                    {new Date(lead.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div style={{ color: "#94a3b8" }}>Loading…</div>}>
      <LeadsContent />
    </Suspense>
  );
}
