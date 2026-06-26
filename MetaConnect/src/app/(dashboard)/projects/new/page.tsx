"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface MetaPage {
  id: string;
  pageName: string;
  pageId: string;
}

type ProjectType = "comment" | "lead_form";

export default function NewProjectPage() {
  const router = useRouter();

  const [metaPages, setMetaPages] = useState<MetaPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [type, setType] = useState<ProjectType>("comment");
  const [name, setName] = useState("");
  const [metaConnectionId, setMetaConnectionId] = useState("");
  const [systemeioTag, setSystemeioTag] = useState("");

  // Comment fields
  const [keyword, setKeyword] = useState("");
  const [postId, setPostId] = useState("");
  const [dmMessage, setDmMessage] = useState(
    "Hey! Thanks for reaching out 🙌 Reply with your name and email to get more info:\nYour Name | your@email.com",
  );
  const [responseMessage, setResponseMessage] = useState(
    "Amazing! You're all set. Check your inbox — we'll be in touch soon! 🎉",
  );

  // Lead form fields
  const [formId, setFormId] = useState("");

  useEffect(() => {
    fetch("/api/connections")
      .then((r) => r.json())
      .then((data) => {
        setMetaPages(data.metaPages ?? []);
        if (data.metaPages?.length) setMetaConnectionId(data.metaPages[0].id);
        setLoadingPages(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const payload: Record<string, string | undefined> = {
      name,
      type,
      metaConnectionId,
      systemeioTag,
      ...(type === "comment"
        ? { keyword, postId: postId || undefined, dmMessage, responseMessage }
        : { formId }),
    };

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (res.ok) {
      router.push("/projects");
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create project.");
    }
  }

  if (loadingPages) {
    return <div style={{ color: "#94a3b8", padding: 32 }}>Loading…</div>;
  }

  if (!metaPages.length) {
    return (
      <div className="card" style={{ padding: 32, maxWidth: 560, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📘</div>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>No pages connected</h2>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 20px" }}>
          You need to connect a Facebook Page before creating a project.
        </p>
        <Link href="/connections" className="btn btn-primary">
          Connect a Page
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <Link href="/projects" className="btn btn-ghost btn-sm" style={{ padding: "6px 10px" }}>
          ← Back
        </Link>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "0 0 2px" }}>
            New Project
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
            Set up a Meta automation.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

      {/* Project type picker */}
      <div className="card" style={{ padding: 6, marginBottom: 24, display: "flex", gap: 6 }}>
        {([
          { value: "comment", label: "💬 Comment Flow", desc: "Reply to comments via DM" },
          { value: "lead_form", label: "📋 Lead Form", desc: "Sync lead form submissions" },
        ] as { value: ProjectType; label: string; desc: string }[]).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setType(opt.value)}
            style={{
              flex: 1,
              padding: "14px 16px",
              borderRadius: 8,
              border: "none",
              background: type === opt.value ? "#2563eb" : "transparent",
              color: type === opt.value ? "#fff" : "#475569",
              cursor: "pointer",
              textAlign: "center",
              transition: "all 150ms",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14 }}>{opt.label}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{opt.desc}</div>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px", color: "#0f172a" }}>
            General
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <label className="label" htmlFor="name">Project name *</label>
              <input
                id="name"
                className="input"
                placeholder="e.g. Summer Sale Comment Bot"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="page">Facebook Page *</label>
              <select
                id="page"
                className="input"
                value={metaConnectionId}
                onChange={(e) => setMetaConnectionId(e.target.value)}
                required
              >
                {metaPages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.pageName}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="label" htmlFor="tag">Systeme.io Tag *</label>
              <input
                id="tag"
                className="input"
                placeholder="e.g. summer-sale-lead"
                value={systemeioTag}
                onChange={(e) => setSystemeioTag(e.target.value)}
                required
              />
              <span className="helper">
                This tag will be added to every contact created in Systeme.io by this project.
              </span>
            </div>
          </div>
        </div>

        {type === "comment" ? (
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px", color: "#0f172a" }}>
              Comment Flow Settings
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="field">
                <label className="label" htmlFor="keyword">Trigger keyword *</label>
                <input
                  id="keyword"
                  className="input"
                  placeholder="e.g. INFO"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  required
                />
                <span className="helper">
                  When someone comments this word, the DM flow is triggered (case-insensitive).
                </span>
              </div>

              <div className="field">
                <label className="label" htmlFor="postId">Post ID (optional)</label>
                <input
                  id="postId"
                  className="input"
                  placeholder="Leave blank to watch all posts on this page"
                  value={postId}
                  onChange={(e) => setPostId(e.target.value)}
                />
                <span className="helper">
                  Paste the specific Facebook post ID to limit this project to one post.
                </span>
              </div>

              <div className="field">
                <label className="label" htmlFor="dmMessage">Initial DM message *</label>
                <textarea
                  id="dmMessage"
                  className="input"
                  rows={4}
                  value={dmMessage}
                  onChange={(e) => setDmMessage(e.target.value)}
                  required
                />
                <span className="helper">
                  Sent immediately when the keyword is detected. Include instructions for name/email format.
                </span>
              </div>

              <div className="field">
                <label className="label" htmlFor="responseMessage">Confirmation DM message *</label>
                <textarea
                  id="responseMessage"
                  className="input"
                  rows={3}
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  required
                />
                <span className="helper">
                  Sent after the user provides their name and email.
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px", color: "#0f172a" }}>
              Lead Form Settings
            </h3>
            <div className="field">
              <label className="label" htmlFor="formId">Lead Form ID *</label>
              <input
                id="formId"
                className="input"
                placeholder="e.g. 123456789012345"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                required
              />
              <span className="helper">
                Find the Form ID in Meta Business Suite → Ads Manager → Lead Forms.
              </span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <span className="spinner" /> : "Create Project"}
          </button>
          <Link href="/projects" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
