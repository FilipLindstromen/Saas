# Apple Developer & CI signing (BrainDump iOS)

One-time setup you do in Apple’s portals. **CI builds on GitHub Actions macOS**; you do not need Xcode on Windows.

## 1. Apple Developer Program

1. Enroll at [developer.apple.com](https://developer.apple.com) (paid membership).
2. Note your **Team ID** (Membership details).

## 2. App Store Connect

1. Create an app: **My Apps → + → New App** (platform: iOS, bundle ID must match Capacitor `appId`, e.g. `com.yourorg.braindump`).
2. Create an **App Store Connect API key** (Users and Access → Keys → App Store Connect API):
   - Role: **App Manager** or **Developer** (upload needs appropriate access).
   - Download the `.p8` private key once; store it securely.
   - Note **Key ID** and **Issuer ID**.

### GitHub Actions secrets (API key method)

| Secret | Value |
|--------|--------|
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID |
| `APP_STORE_CONNECT_API_KEY_CONTENT` | Full contents of the `.p8` file (including `-----BEGIN PRIVATE KEY-----`) |

Fastlane will write the key to a file in CI from `APP_STORE_CONNECT_API_KEY_CONTENT`.

## 3. Bundle identifier

- Must match **Xcode project** `PRODUCT_BUNDLE_IDENTIFIER` and App Store Connect.
- Default in this repo: `com.braindump.app` — change in [`capacitor.config.ts`](../../capacitor.config.ts) and Xcode if you use your own domain.

## 4. Signing: Match vs manual

### Option A — Fastlane Match (recommended for teams)

- Creates a **private git repo** (or encrypted storage) holding distribution certs and provisioning profiles.
- One-time: `fastlane match appstore` on a Mac (or rely on CI after configuring Matchfile).
- GitHub secret: `MATCH_GIT_BASIC_AUTHORIZATION` (base64 `user:token` for HTTPS) or SSH key for the certs repo.
- GitHub secret: `MATCH_PASSWORD` (encrypts the repo).

### Option B — Manual certificates in CI

- Export **Distribution certificate** as `.p12` + password.
- Download **App Store** provisioning profile for the bundle ID.
- Base64-encode and store as secrets (see [`fastlane/README.md`](../../ios/App/fastlane/README.md)).

The included Fastlane setup supports **manual** signing via env vars for a minimal first ship; you can switch to Match later.

### GitHub Actions secrets (full list)

| Secret | When needed |
|--------|-------------|
| `BRAINDUMP_CAPACITOR_SERVER_URL` | Production HTTPS URL embedded at `cap sync` (required for real builds). |
| `APP_STORE_CONNECT_API_KEY_ID` | TestFlight upload |
| `APP_STORE_CONNECT_ISSUER_ID` | TestFlight upload |
| `APP_STORE_CONNECT_API_KEY_CONTENT` | `.p8` PEM contents |
| `MATCH_PASSWORD` | Fastlane Match |
| `MATCH_GIT_URL` | Optional; overrides [`Matchfile`](../../ios/fastlane/Matchfile) default |
| `FASTLANE_APPLE_ID` | Match (Apple ID email) |
| **Manual signing** | `APPLE_CERTIFICATE_BASE64`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_PROVISION_PROFILE_BASE64`, `APPLE_TEAM_ID`, `APPLE_PROVISIONING_PROFILE_NAME` |

See [`ios/fastlane/README.md`](../../ios/fastlane/README.md).

## 5. Device testing (optional)

- For ad-hoc/device builds, add devices in the Developer portal and use a **Development** profile; TestFlight does not require USB provisioning.

## 6. NextAuth / cookies in WKWebView

- Serve production over **HTTPS**.
- Cookie `SameSite` and domain must allow your production host; test sign-in on a real device after first TestFlight build.
