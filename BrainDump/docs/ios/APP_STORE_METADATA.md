# App Store listing & review (BrainDump)

## Versioning

- **Marketing version** (`CFBundleShortVersionString`): align with [`package.json`](../../package.json) `version` or bump manually in Xcode before release.
- **Build number** (`CFBundleVersion`): CI sets this from GitHub Actions `run_number` via Fastlane when `BUILD_NUMBER` is set.

## Guideline 4.2 (minimum functionality)

Apple may reject apps that are only a thin wrapper around a website. Mitigations:

- Position the app as the **official client** for your BrainDump / SaaS product.
- Add native value over time: push notifications, widgets, Siri shortcuts, offline messaging, Face ID, etc.
- In **Review Notes**, explain auth, data handling, and that the app requires your backend (if applicable).

## Suggested review notes (template)

```
BrainDump is the official iOS client for our productivity service. The app connects to our secure servers (same account as the web app). Users sign in with [email/OAuth]. Data is stored according to our privacy policy at [URL].

Test account (if required):
- Email: review@example.com
- Password: [one-time password]
```

## Screenshots & metadata

Prepare in App Store Connect:

- iPhone 6.7" and 6.1" screenshots (required sizes per Apple’s current rules).
- Privacy policy URL, support URL, marketing URL (optional).

## Keywords

Choose keywords relevant to your product; avoid trademarked terms you don’t own.
