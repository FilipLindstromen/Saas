"use client";

import { useEffect, useState } from "react";

export default function GoogleCalendarCallbackPage() {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("Connecting…");

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const error = params.get("error");

    if (error) {
      setMessage(error === "access_denied" ? "Access was denied." : `Error: ${error}`);
      setStatus("error");
      return;
    }

    if (accessToken && window.opener) {
      try {
        window.opener.postMessage(
          { type: "braindump-google-calendar-token", accessToken },
          window.location.origin
        );
        setMessage("Connected. You can close this window.");
        setStatus("done");
        window.close();
      } catch {
        setMessage("Failed to send token.");
        setStatus("error");
      }
    } else {
      if (!accessToken) setMessage("No access token received.");
      else setMessage("This page should be opened from Settings.");
      setStatus("error");
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary, #f5f5f5)",
        fontFamily: "system-ui, sans-serif",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "var(--bg-elevated, #fff)",
          border: "1px solid var(--border-default, #e5e5e5)",
          borderRadius: 12,
          padding: "1.5rem",
          maxWidth: 360,
          textAlign: "center",
        }}
      >
        {status === "loading" && (
          <p style={{ margin: 0, color: "var(--text-secondary, #666)" }}>{message}</p>
        )}
        {status === "done" && (
          <p style={{ margin: 0, color: "var(--text-primary, #111)" }}>{message}</p>
        )}
        {status === "error" && (
          <>
            <p style={{ margin: "0 0 1rem", color: "var(--text-secondary, #666)" }}>{message}</p>
            <button
              type="button"
              onClick={() => window.close()}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Close window
            </button>
          </>
        )}
      </div>
    </div>
  );
}
