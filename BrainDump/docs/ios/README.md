# BrainDump iOS (Capacitor shell)

The iOS app is a **native shell** that loads your deployed **Next.js** site in a web view — one codebase for web and app.

## Quick start

1. Deploy BrainDump to HTTPS (same as your web app).
2. Point Capacitor at that URL and sync:

   ```bash
   set CAPACITOR_SERVER_URL=https://your-domain.com
   npm run cap:sync
   ```

   On macOS, open Xcode: `npm run cap:open:ios`.

3. Configure signing and TestFlight — see [APPLE_SETUP.md](./APPLE_SETUP.md) and [`ios/fastlane/README.md`](../../ios/fastlane/README.md).

## Environment

| Variable | Purpose |
|----------|---------|
| `CAPACITOR_SERVER_URL` | Production HTTPS origin loaded in the app (set before `cap sync`). |
| `NEXT_PUBLIC_BASE_PATH` | If the web app uses a subpath, set in Next.js env and deploy; use the **full** URL including path in `CAPACITOR_SERVER_URL` if needed. |

GitHub Actions sets `CAPACITOR_SERVER_URL` via secret `BRAINDUMP_CAPACITOR_SERVER_URL` on each build.

## After `git pull`

Regenerate native config (ignored in git):

```bash
npm run cap:sync
```

## Auth / cookies

Test sign-in on a **device** or simulator: cookies must work over HTTPS with correct `SameSite` / domain for your NextAuth config.

## CI

See [`.github/workflows/braindump-ios.yml`](../../../.github/workflows/braindump-ios.yml) — runs on **push** only when the first line of the commit message is **`ios`** (case-insensitive; see workflow `if` condition).
