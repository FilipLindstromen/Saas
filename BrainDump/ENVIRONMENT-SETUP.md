### BrainDump environment setup (developer-managed secrets)

All real API keys are set by the developer as environment variables and are **never committed to Git**.

This app expects at least:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `AUTH_SECRET` (NextAuth v5: use e.g. `openssl rand -base64 32` to generate)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Optional (for stock media in ReelRecorder or shared pickers):

- `UNSPLASH_ACCESS_KEY` (Unsplash)
- `PEXELS_API_KEY` (Pexels)
- `GIPHY_API_KEY` (Giphy)

See `.env.example` for the full list of variables and placeholder values.

---

#### 1. Local development (`.env.local`)

1. Go to the `BrainDump` folder.

2. Create a file named `.env.local` (this file is already git-ignored):

```bash
# Use your Postgres URL (same as production, or a local Postgres instance)
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
OPENAI_API_KEY="sk-your-openai-key"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Optional: stock media (Unsplash, Pexels, Giphy)
UNSPLASH_ACCESS_KEY="your-unsplash-access-key"
PEXELS_API_KEY="your-pexels-api-key"
GIPHY_API_KEY="your-giphy-api-key"
```

3. Run the app as usual:

```bash
npm install
npm run dev
```

Next.js automatically loads `.env.local` in development, and the server-side code reads values via `process.env.*` (centralized in `src/config/env.server.ts`).

---

#### 2. Production (e.g. Vercel) – and where to get the Postgres URL

**Getting the Postgres connection URL (Vercel):**

1. In the Vercel dashboard, open your project.
2. Go to the **Storage** tab (or **Create** → **Database**).
3. Open your **Postgres** database.
4. Go to the **`.env`** or **Connection string** / **Quickstart** section.
5. Copy the variable that looks like:  
   `POSTGRES_URL="postgresql://..."` or `DATABASE_URL="postgresql://..."`  
   Use the **full string** (including `postgresql://`, username, password, host, database, and `?sslmode=require` if present) as your `DATABASE_URL` value.

**Adding env vars:**

1. Open the **BrainDump** project in the Vercel dashboard.
2. Go to **Settings → Environment Variables**.
3. Add each variable with the same names as in `.env.example`:

   - `DATABASE_URL`
   - `OPENAI_API_KEY`
   - `AUTH_SECRET` (required for auth; generate with `openssl rand -base64 32`)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - (Optional) `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`, `GIPHY_API_KEY`

4. **Create tables in Postgres (first time only):**  
   With `DATABASE_URL` set to your Postgres URL (e.g. in `.env.local`), run once in the BrainDump folder:
   ```bash
   npm run db:push
   ```
   This creates all tables in your Postgres database. After that, redeploy if needed.

5. Redeploy the project.

The deployed app then reads these values from the environment; nothing secret lives in the Git repo.

---

#### 3. Keeping Git free of secrets

- `.env`, `.env.local`, and `.env.*.local` are ignored in both the repo root and the `BrainDump` folder.
- Do **not** commit any `.env*` files.
- Optionally enable secret scanning in your Git host (e.g. GitHub → Settings → Code security & analysis) to detect accidental leaks.

