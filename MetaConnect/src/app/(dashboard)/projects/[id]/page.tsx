"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Lead {
  id: string;
  name: string;
  email: string;
  source: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  type: "comment" | "lead_form";
  status: "active" | "paused";
  systemeioTag: string;
  keyword: string | null;
  postId: string | null;
  dmMessage: string | null;
  responseMessage: string | null;
  formId: string | null;
  metaConnection: { pageName: string; pageId: string; igName: string | null };
  leads: Lead[];
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit state
  const [name, setName] = useState("");
  const [systemeioTag, setSystemeioTag] = useState("");
  const [keyword, setKeyword] = useState("");
  const [postId, setPostId] = useState("");
  const [dmMessage, setDmMessage] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [formId, setFormId] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((data: Project) => {
        setProject(data);
        setName(data.name);
        setSystemeioTag(data.systemeioTag);
        setKeyword(data.keyword ?? "");
        setPostId(data.postId ?? "");
        setDmMessage(data.dmMessage ?? "");
        setResponseMessage(data.responseMessage ?? "");
        setFormId(data.formId ?? "");
        setLoading(false);
      });
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        systemeioTag,
        keyword: keyword || undefined,
        postId: postId || undefined,
        dmMessage: dmMessage || undefined,
        responseMessage: responseMessage || undefined,
        formId: formId || undefined,
      }),
    });

    setSaving(false);
    if (res.ok) {
      setSuccess("Project saved!");
      setTimeout(() => setSuccess(""), 3000);
    } else {
      setError("Failed to save.");
    }
  }

  async function toggleStatus() {
    if (!project) return;
    const newStatus = project.status === "active" ? "paused" : "active";
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setProject({ ...project, status: newStatus });
  }

  async function deleteProject() {
    if (!confirm("Delete this project? All leads will be lost.")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/projects");
  }

  if (loading) return <div style={{ color: "#94a3b8", padding: 32 }}>Loading…</div>;
  if (!project) return <div style={{ color: "#dc2626", padding: 32 }}>Project not found.</div>;

  return (
    <div style={{ maxWidth: 660 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <Link href="/projects" className="btn btn-ghost btn-sm" style={{ padding: "6px 10px" }}>
          ← Back
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>
            {project.name}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <span className={`badge ${project.type === "comment" ? "badge-blue" : "badge-green"}`}>
              {project.type === "comment" ? "💬 Comment Flow" : "📋 Lead Form"}
            </span>
            <span className={`badge ${project.status === "active" ? "badge-green" : "badge-gray"}`}>
              {project.status}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={toggleStatus}>
            {project.status === "active" ? "Pause" : "Resume"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={deleteProject} style={{ color: "#dc2626" }}>
            Delete
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 16 }}>{success}</div>}

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px", color: "#0f172a" }}>General</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <label className="label">Page</label>
              <div className="input" style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}>
                {project.metaConnection.pageName}
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="name">Project name</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="field">
              <label className="label" htmlFor="tag">Systeme.io Tag</label>
              <input id="tag" className="input" value={systemeioTag} onChange={(e) => setSystemeioTag(e.target.value)} required />
            </div>
          </div>
        </div>

        {project.type === "comment" ? (
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px", color: "#0f172a" }}>Comment Flow</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="field">
                <label className="label" htmlFor="keyword">Trigger keyword</label>
                <input id="keyword" className="input" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
              </div>

              <div className="field">
                <label className="label" htmlFor="postId">Post ID (optional)</label>
                <input id="postId" className="input" placeholder="Leave blank = all posts" value={postId} onChange={(e) => setPostId(e.target.value)} />
              </div>

              <div className="field">
                <label className="label" htmlFor="dmMessage">Initial DM</label>
                <textarea id="dmMessage" className="input" rows={4} value={dmMessage} onChange={(e) => setDmMessage(e.target.value)} />
              </div>

              <div className="field">
                <label className="label" htmlFor="responseMessage">Confirmation DM</label>
                <textarea id="responseMessage" className="input" rows={3} value={responseMessage} onChange={(e) => setResponseMessage(e.target.value)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px", color: "#0f172a" }}>Lead Form</h3>
            <div className="field">
              <label className="label" htmlFor="formId">Lead Form ID</label>
              <input id="formId" className="input" value={formId} onChange={(e) => setFormId(e.target.value)} />
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <span className="spinner" /> : "Save Changes"}
        </button>
      </form>

      {/* Leads table */}
      <div className="card" style={{ marginTop: 32, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Leads ({project.leads.length})</h3>
          <Link href={`/leads?projectId=${id}`} style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}>
            View all →
          </Link>
        </div>

        {project.leads.length === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center", color: "#94a3b8" }}>
            No leads yet. The project is {project.status}.
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Source</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {project.leads.slice(0, 20).map((lead) => (
                  <tr key={lead.id}>
                    <td style={{ fontWeight: 500 }}>{lead.name}</td>
                    <td style={{ color: "#64748b" }}>{lead.email}</td>
                    <td>
                      <span className={`badge ${lead.source === "comment" ? "badge-blue" : "badge-green"}`}>
                        {lead.source === "comment" ? "Comment" : "Lead Form"}
                      </span>
                    </td>
                    <td style={{ color: "#94a3b8", fontSize: 13 }}>
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
