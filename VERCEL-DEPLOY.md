# Deploying to Vercel

The SaaS hub and all static/Vite apps can be deployed to Vercel so everything runs on Vercel (like BrainDump) instead of GitHub Pages.

## Overview

- **One Vercel project (repo root)** — Serves the hub + all built apps (ReelRecorder, InfoGraphics, Story Writer, etc.) from a single deployment. The root `vercel.json` and `scripts/vercel-build.mjs` build the hub and each Vite app with the correct base path and output to `deploy/`.
- **BrainDump (separate project)** — BrainDump is a Next.js app with API routes and a database, so it stays a **separate Vercel project** with **Root Directory** set to `BrainDump`. The hub’s “BrainDump” card goes to `/BrainDump/`, which shows a landing page that links to your deployed BrainDump URL.

## 1. Deploy the hub + all apps (one project)

1. In the [Vercel dashboard](https://vercel.com), click **Add New** → **Project**.
2. Import your Git repository (e.g. `Saas`).
3. Leave **Root Directory** as **.** (repo root).
4. Vercel will use the repo’s `vercel.json`:
   - **Build Command:** `npm run build`
   - **Output Directory:** `deploy`
   - **Install Command:** `npm install`
5. (Optional) **Environment variable** for the BrainDump link on the landing page:
   - Name: `BRAINDUMP_APP_URL`
   - Value: your BrainDump app URL (e.g. `https://saas-silk-tau.vercel.app` or your custom domain).
   - If you don’t set this, the build uses `https://saas-silk-tau.vercel.app` by default.
6. Deploy. Your hub will be at `https://<project>.vercel.app/` and each app at `https://<project>.vercel.app/ReelRecorder/`, `https://<project>.vercel.app/InfoGraphics/`, etc.

## 2. Deploy BrainDump (separate project)

1. In Vercel, **Add New** → **Project** and import the **same** repository.
2. Set **Root Directory** to **BrainDump**.
3. Configure env vars for BrainDump (e.g. `DATABASE_URL`, `AUTH_SECRET`) as in BrainDump’s docs.
4. Deploy. Note the project URL (e.g. `https://saas-silk-tau.vercel.app`).
5. In the **hub** project (step 1), set `BRAINDUMP_APP_URL` to this URL so the “BrainDump” card and landing page point to the correct app.

## Summary

| What                    | Vercel project        | Root directory | URL example                          |
|-------------------------|----------------------|----------------|--------------------------------------|
| Hub + all static apps   | One project          | `.` (repo root)| `https://your-hub.vercel.app/`       |
| BrainDump                | Second project       | `BrainDump`    | `https://braindump.vercel.app` (set in `BRAINDUMP_APP_URL`) |

After this, the SaaS page and all apps are served from Vercel; you can keep or remove GitHub Pages deployment as you prefer.
