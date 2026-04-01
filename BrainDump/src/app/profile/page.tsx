"use client";

import { UserProfilePanel } from "@/components/ProfileOverlay";

export default function ProfileRoutePage() {
  return (
    <div
      className="bd-page-gate"
      style={{
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        padding: "2rem 1.25rem 3rem",
        minHeight: "100dvh",
      }}
    >
      <UserProfilePanel variant="page" />
    </div>
  );
}
