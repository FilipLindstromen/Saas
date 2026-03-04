import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "ContentGenerator | Personal Development Video Questions",
  description:
    "Generate highly relatable, curiosity-driven video questions from Reddit pain points",
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
            __html: `(function(){var k='saas-apps-theme';var t=localStorage.getItem(k);if(!t){var L=['appTheme','typographyTheme','theme','cw_theme','reelRecorderTheme','contentgenerator_theme'];for(var i=0;i<L.length;i++){var v=localStorage.getItem(L[i]);if(v==='light'||v==='dark'){t=v;localStorage.setItem(k,v);break;}}}if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
