# CopyLearner

Swipeable micro-lessons, like an Instagram carousel you learn from. The AI writing the lessons is prompted as an expert direct-response copywriter working as a copywriting mentor — every lesson, whether from the built-in deck or your own uploads, teaches copywriting craft. Comes preloaded with a set of fundamentals, and you can upload your own material (PDF, ZIP, text file, or pasted text) as source material for more lessons.

## Gestures (full screen)

- **Swipe left / right** — next / previous slide within a lesson
- **Swipe down** — a new learning (next lesson)
- **Swipe up** — previous lesson
- Slide text is selectable (click/tap-and-drag to select, then copy) — start a swipe from anywhere else on the card. Arrow keys and trackpad scroll also work on desktop.

## Uploading your own content

Tap the settings icon (top-right) → **My Content** → upload a PDF, Word doc, ZIP, or text file, or paste text directly. The file is only read and stored at this point — no AI call yet, so uploading is instant.

Every topic — not just **My Content** — generates lessons progressively in the background as you swipe: whenever a topic is down to its last few unseen lessons, the next batch is already being written behind the scenes, so no topic ever repeats or runs dry, even on the built-in deck. When you have material uploaded, **every** topic (Headlines, Bullets, CTAs, Intros, Basics, and My Content) pulls its examples from that material specifically — a real claim, product detail, or line from your upload, not a generic stand-in — so the lessons feel written for what you're actually working on. Without any upload, topics still generate endlessly from the mentor persona's own copywriting expertise.

## Choosing what to learn

Tap the topic pill under the Learn/Saved/Transform tabs to quickly switch which topics are mixed into your feed, without opening full Settings.

## Transform

The **Transform** tab is a separate tool: paste a piece of your own copy, give it instructions ("make it punchier", "apply AIDA", "turn into 3 headline options"), and get an expert-copywriter rewrite back. Every instruction you've given is remembered and applied to future transforms too, so it keeps adapting to how you like your copy written.

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
