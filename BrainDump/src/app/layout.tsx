import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { I18nProvider } from "@/lib/i18n";
import { Cormorant_Garamond, Inter } from "next/font/google";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontDisplay = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

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
    <html lang="en" suppressHydrationWarning className={`${fontSans.variable} ${fontDisplay.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var k='saas-apps-theme';var t=localStorage.getItem(k);if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';localStorage.setItem(k,t);}document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
      </head>
      <body className={fontSans.className}>
        <AuthSessionProvider>
          <I18nProvider>{children}</I18nProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
