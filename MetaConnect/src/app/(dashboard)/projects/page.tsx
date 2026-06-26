"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  type: "comment" | "lead_form";
  status: "active" | "paused";
  systemeioTag: string;
  createdAt: string;
  metaConnection: { pageName: string; pageId: string };
  _count: { leads: number };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  async function toggleStatus(project: Project) {
    const newStatus = project.status === "active" ? "paused" : "active";
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, status: newStatus } : p)),
    );
  }

  async function deleteProject(id: string) {
    if (!confirm("Delete this project? All leads will also be deleted.")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>
            Projects
          </h1>
          <p style={{ fontSize: 15, color: "#64748b", margin: 0 }}>
            Manage your Meta automations.
          </p>
        </div>
        <Link href="/projects/new" className="btn btn-primary">
          + New Project
        </Link>
      </div>

      {loading ? (
        <div style={{ color: "#94a3b8", padding: 32, textAlign: "center" }}>Loading…</div>
      ) : projects.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗂️</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px", color: "#0f172a" }}>
            No projects yet
          </h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 20px" }}>
            Create your first project to start automating Meta comments or syncing lead forms.
          </p>
          <Link href="/projects/new" className="btn btn-primary">
            Create Project
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {projects.map((project) => (
            <div
              key={project.id}
              className="card"
              style={{
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 0 }}>
                {/* Type icon */}
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: project.type === "comment" ? "#eff6ff" : "#f0fdf4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {project.type === "comment" ? "💬" : "📋"}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>
                      {project.name}
                    </span>
                    <span className={`badge ${project.type === "comment" ? "badge-blue" : "badge-green"}`}>
                      {project.type === "comment" ? "Comment Flow" : "Lead Form"}
                    </span>
                    <span className={`badge ${project.status === "active" ? "badge-green" : "badge-gray"}`}>
                      {project.status === "active" ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                    {project.metaConnection.pageName} · Tag: <strong style={{ color: "#64748b" }}>{project.systemeioTag}</strong>
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
                    {project._count.leads}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>leads</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => toggleStatus(project)}
                >
                  {project.status === "active" ? "Pause" : "Resume"}
                </button>
                <Link href={`/projects/${project.id}`} className="btn btn-ghost btn-sm">
                  Edit
                </Link>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => deleteProject(project.id)}
                  style={{ color: "#dc2626" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
