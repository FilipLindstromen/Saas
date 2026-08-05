# CopyLearner

Swipeable micro-lessons, like an Instagram carousel you learn from. Comes preloaded with a set of copywriting fundamentals, and you can upload your own material (PDF, ZIP, text file, or pasted text) to generate more lessons from it.

## Gestures (full screen)

- **Swipe left / right** — next / previous slide within a lesson
- **Swipe down** — a new learning (next lesson)
- **Swipe up** — previous lesson
- Tap the left/right edge of the card also moves slides; arrow keys and trackpad scroll work on desktop.

## Uploading your own content

Tap the settings icon (top-right) → **My Content** → upload a PDF, ZIP, or text file, or paste text directly. The content is read locally in your browser, then OpenAI turns it into a set of swipeable lessons (title → point/example/quiz/challenge → takeaway), tagged under the **My Content** topic.

This uses the same OpenAI key as the rest of the SaaS apps — set `OPENAI_API_KEY` in the repo root `.env`, or add your key in another app's Settings (keys are shared via `localStorage` across all apps here).

## Syncing across devices

By default, everything is saved to `localStorage` — one device only.

To see the same lessons and progress on your phone, this app can sync through [Firebase Firestore](https://console.firebase.google.com):

1. Create a free Firebase project → Build → Firestore Database → **Create database** (start in test mode is fine for personal use).
2. Project settings → **Add app** → Web app → copy the config values.
3. Add them to the repo root `.env` (see `.env.example`):
   ```
   VITE_FIREBASE_API_KEY=
   VITE_FIREBASE_AUTH_DOMAIN=
   VITE_FIREBASE_PROJECT_ID=
   VITE_FIREBASE_STORAGE_BUCKET=
   VITE_FIREBASE_MESSAGING_SENDER_ID=
   VITE_FIREBASE_APP_ID=
   ```
4. Restart the dev server (or redeploy). Open Settings → **My Content** — you'll see an 8-character sync code.
5. On your phone, open CopyLearner, go to Settings → **My Content**, and enter that same code under "Enter a code from another device". Both devices now read/write the same Firestore data in real time.

**Security note:** there's no login — the sync code *is* the access key to that data (like a share link). It's random and long enough not to be guessed, but anyone who has it can read/write that workspace. Firestore rules should allow open read/write on the `workspaces/{code}/**` path for this to work without auth; don't put anything sensitive in it. If you want real accounts and stricter access control later, that's a bigger change (Firebase Auth + security rules keyed by user id) — ask and it can be added.

## Local development

```bash
cd CopyLearner
npm install
npm run dev
```
