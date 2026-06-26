# Deploying to Vercel

The SaaS hub and all static/Vite apps can be deployed to Vercel so everything runs on Vercel (like BrainDump) instead of GitHub Pages.

## Overview

- **One Vercel project (repo root)** — Serves the hub + all built apps (ReelRecorder, InfoGraphics, Story Writer, etc.) from a single deployment. The root `vercel.json` and `scripts/vercel-build.mjs` build the hub and each Vite app with the correct base path and output to `deploy/`.
- **BrainDump (separate project)** — BrainDump is a Next.js app with API routes and a database, so it stays a **separate Vercel project** with **Root Directory** set to `BrainDump`. The hub's "BrainDump" card goes to `/BrainDump/`, which shows a landing page that links to your deployed BrainDump URL.
- **MetaConnect (separate project)** — MetaConnect is a Next.js app with API routes and a database. It stays a **separate Vercel project** with **Root Directory** set to `MetaConnect`. The hub's "MetaConnect" card goes to `/MetaConnect/`, which shows a landing page that links to your deployed MetaConnect URL.

## 1. Deploy the hub + all apps (one project)

1. In the [Vercel dashboard](https://vercel.com), click **Add New** → **Project**.
2. Import your Git repository (e.g. `Saas`).
3. Leave **Root Directory** as **.** (repo root).
4. Vercel will use the repo's `vercel.json`:
   - **Build Command:** `npm run build`
   - **Output Directory:** `deploy`
   - **Install Command:** `npm install`
5. (Optional) **Environment variables** for app links on the landing page:
   - `BRAINDUMP_APP_URL` — your BrainDump app URL (e.g. `https://saas-silk-tau.vercel.app`)
   - `METACONNECT_APP_URL` — your MetaConnect app URL
   - If not set, the links will fall back to `#` (placeholder).
6. Deploy. Your hub will be at `https://<project>.vercel.app/` and each app at `https://<project>.vercel.app/ReelRecorder/`, `https://<project>.vercel.app/MetaConnect/`, etc.

## 2. Deploy BrainDump (separate project)

1. In Vercel, **Add New** → **Project** and import the **same** repository.
2. Set **Root Directory** to **BrainDump**.
3. Configure env vars for BrainDump (e.g. `DATABASE_URL`, `AUTH_SECRET`) as in BrainDump's docs.
4. Deploy. Note the project URL (e.g. `https://saas-silk-tau.vercel.app`).
5. In the **hub** project (step 1), set `BRAINDUMP_APP_URL` to this URL so the "BrainDump" card and landing page point to the correct app.

## 3. Deploy MetaConnect (separate project)

1. In Vercel, **Add New** → **Project** and import the **same** repository.
2. Set **Root Directory** to **MetaConnect**.
3. Configure env vars (see `MetaConnect/.env.example`):
   - `DATABASE_URL` — Vercel Postgres connection string
   - `AUTH_SECRET` — run `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your MetaConnect production URL
   - `META_APP_ID` / `META_APP_SECRET` — from Meta Developer App
   - `META_WEBHOOK_VERIFY_TOKEN` — any secret string you choose
   - `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — for password reset emails
   - `NEXT_PUBLIC_APP_URL` — your MetaConnect production URL
4. Vercel will use `MetaConnect/vercel.json` → Build Command `npm run build:vercel`.
5. Deploy. Note the project URL.
6. In the **hub** project (step 1), add env var `METACONNECT_APP_URL` set to your MetaConnect URL so the hub card links correctly.
7. In your **Meta Developer App**, update the OAuth redirect URI and webhook URL to your production domain.

## Summary

| What                  | Vercel project  | Root directory | Env var for hub link    |
|-----------------------|-----------------|----------------|-------------------------|
| Hub + all static apps | One project     | `.` (repo root)| —                       |
| BrainDump             | Second project  | `BrainDump`    | `BRAINDUMP_APP_URL`     |
| MetaConnect           | Third project   | `MetaConnect`  | `METACONNECT_APP_URL`   |

After this, the SaaS page and all apps are served from Vercel; you can keep or remove GitHub Pages deployment as you prefer.
