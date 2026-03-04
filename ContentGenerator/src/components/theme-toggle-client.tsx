"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ThemeToggle = dynamic(
  () => import("@shared/ThemeToggle").then((m) => m.default),
  { ssr: false }
);

export function ThemeToggleClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return <ThemeToggle className="shared-header-btn" onToggle={() => {}} />;
}
