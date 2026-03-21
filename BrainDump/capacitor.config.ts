import path from "path";
import type { CapacitorConfig } from "@capacitor/cli";
import { config as loadEnv } from "dotenv";

// Same root .env as Next.js (repo root Saas/)
loadEnv({ path: path.join(__dirname, "..", ".env") });
loadEnv({ path: path.join(__dirname, "..", ".env.local") });

/**
 * Remote URL mode: the iOS shell loads your deployed Next.js app (same as web).
 * Set CAPACITOR_SERVER_URL when running `npx cap sync ios` (e.g. in CI or before archive).
 * @see docs/ios/APPLE_SETUP.md
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://localhost:3001";

const config: CapacitorConfig = {
  appId: "com.braindump.app",
  appName: "BrainDump",
  webDir: "www",
  server: {
    url: serverUrl,
    androidScheme: "https",
    iosScheme: "https",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
    allowsLinkPreview: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 200,
      backgroundColor: "#ffffff",
    },
    StatusBar: {
      style: "DEFAULT",
    },
  },
};

export default config;
