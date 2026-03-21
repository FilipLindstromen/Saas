# BrainDump iOS — Fastlane

Run from **`BrainDump/ios`** (macOS or GitHub Actions):

```bash
bundle install
export APP_STORE_CONNECT_API_KEY_ID=...
export APP_STORE_CONNECT_ISSUER_ID=...
export APP_STORE_CONNECT_API_KEY_CONTENT="$(cat AuthKey_XXXXXXXX.p8)"
export MATCH_PASSWORD=...  # if using Match
# or manual:
# export APPLE_CERTIFICATE_BASE64="$(base64 -i cert.p12)"
# export APPLE_CERTIFICATE_PASSWORD=...
# export APPLE_PROVISION_PROFILE_BASE64="$(base64 -i profile.mobileprovision)"

bundle exec fastlane beta
```

## Signing options

### A — Fastlane Match (recommended)

1. Create a **private** git repo for certificates.
2. Set `MATCH_GIT_URL` in GitHub Actions secrets (and locally).
3. On a Mac once: `bundle exec fastlane match appstore` (creates certs + profiles).
4. CI: set `MATCH_PASSWORD` secret.

Update [`Matchfile`](./Matchfile) `git_url` default or override with `MATCH_GIT_URL`.

### B — Manual

Export **Distribution** `.p12` and **App Store** provisioning profile for `com.braindump.app`.

Base64:

```bash
# macOS / Linux
base64 -i cert.p12 | pbcopy   # or use GitHub secret UI
base64 -i profile.mobileprovision
```

Set secrets: `APPLE_CERTIFICATE_BASE64`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_PROVISION_PROFILE_BASE64`.

## App Store Connect API key

Create a key in App Store Connect → Users and Access → Keys → **App Store Connect API**.

Use the `.p8` contents as `APP_STORE_CONNECT_API_KEY_CONTENT` (full PEM including headers).

## CI build number

`BUILD_NUMBER` in GitHub Actions (e.g. `${{ github.run_number }}`) sets `CFBundleVersion` before `gym`.
