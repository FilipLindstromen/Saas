# MetaConnect

Automate Facebook & Instagram comment-to-DM flows and lead form syncing to Systeme.io.

## Features

- **Email/password auth** with forgot-password (via Resend)
- **Meta integration** — connect Facebook Pages + linked Instagram accounts
- **Comment Projects** — when someone comments a keyword, they get a DM asking for name & email, then get added to Systeme.io with a tag
- **Lead Form Projects** — when someone submits a Meta lead form, they get added to Systeme.io with a tag
- **Leads dashboard** — view all collected leads, search, export CSV

---

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

> **Systeme.io note:** Use your **Public API key** (found under Profile → Public API keys → Create). Do NOT use the MCP key — that's for AI assistants only.

```bash
# Database (Vercel Postgres recommended)
DATABASE_URL=

# Auth (run: openssl rand -base64 32)
AUTH_SECRET=
NEXTAUTH_URL=http://localhost:3002

# Google OAuth (optional — leave blank to hide the Google button)
# Console: https://console.cloud.google.com → APIs & Services → Credentials
# Authorized redirect URI: https://your-domain.com/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Meta Developer App
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=   # any secret string you choose

# Resend (for password reset emails)
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@yourdomain.com

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

### 2. Meta App Setup

In your [Meta Developer App](https://developers.facebook.com/apps/):

1. Add **Facebook Login** product → set OAuth redirect URI to `https://your-domain.com/api/meta/callback`
2. Add **Webhooks** product → set:
   - Callback URL: `https://your-domain.com/api/meta/webhook`
   - Verify Token: your `META_WEBHOOK_VERIFY_TOKEN`
   - Subscribe to: `feed`, `messages`, `leadgen`
3. Required permissions: `pages_manage_metadata`, `pages_read_engagement`, `pages_messaging`, `instagram_basic`, `instagram_manage_messages`, `leads_retrieval`, `pages_show_list`

### 3. Database

```bash
npm run db:push   # push schema to your DB
```

### 4. Run locally

```bash
npm run dev       # starts on http://localhost:3002
```

---

## How Comment Projects Work

1. User comments the trigger keyword (e.g. "INFO") on your Facebook post
2. MetaConnect detects it via webhook and sends an initial DM with your pre-written message
3. User is prompted to reply with: `Name | email@example.com`
4. MetaConnect parses the reply, sends your confirmation DM, and creates the contact in Systeme.io with your tag

> **Note:** Facebook's Messenger API requires the user to have messaged your page before for DMs to work. For Instagram, the DM is sent via `comment_id` recipient.

## How Lead Form Projects Work

1. User fills out your Meta lead form ad
2. MetaConnect receives the `leadgen` webhook event, fetches the lead data
3. Contact is created in Systeme.io with your tag

---

## Deploy to Vercel

1. Import this folder as a new Vercel project
2. Add environment variables in Vercel Dashboard
3. Set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to your production URL
4. After deploy, update your Meta App redirect URIs and webhook URL to production

```bash
# Run DB migrations against Vercel Postgres
npm run db:migrate
```
