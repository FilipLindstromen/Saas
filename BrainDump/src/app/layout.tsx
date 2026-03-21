import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "BrainDump | Voice capture & thought organization",
  description:
    "AI-powered voice capture and thought organization for personal development, journaling, and work clarity.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d111a" },
    { media: "(prefers-color-scheme: light)", color: "#f0f0f0" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var k='saas-apps-theme';var t=localStorage.getItem(k);if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';localStorage.setItem(k,t);}document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
      </head>
      <body>
        <AuthSessionProvider>
          <I18nProvider>{children}</I18nProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
