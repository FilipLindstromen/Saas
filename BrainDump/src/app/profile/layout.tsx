import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile | BrainDump",
  description: "Your BrainDump account profile, photo, and sign-in details.",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
