# BrainDump

AI-powered voice capture and thought organization for personal development, journaling, emotional processing, focus, and work clarity.

## Flow

1. **Record** – Click **Dump** to record audio; click **Stop** when done.
2. **Transcribe** – Click **Transcribe** to convert the recording to text (OpenAI Whisper).
3. **Organize** – Click **Organize** to split and classify the transcript into structured items (domain, category, item type, project, etc.).
4. **Review** – Edit titles, content, domain, category, and project in the right panel. Use **Move to needs_review** for items to review later.
5. **Save** – Click **Save** to persist the dump and all items to the database.

## Modes

- **Inbox** – New or mixed/unreviewed content.
- **Work** – Projects, tasks, notes, ideas, meetings, decisions, problems.
- **Personal** – Journal, emotions, reflections, goals, habits, unresolved issues.

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set:
   - `DATABASE_URL="file:./dev.db"`
   - `OPENAI_API_KEY="your-openai-api-key"`
3. Create the database: `npm run db:push`
4. (Optional) Seed: `npm run db:seed`
5. Run the app: `npm run dev` (default port 3001)

**From the SaaS hub:** BrainDump is listed under “Personal / Productivity”. To run it from the same origin as the hub (e.g. at `/BrainDump/`), build with `NEXT_PUBLIC_BASE_PATH=/BrainDump` and serve the Next app so that path routes to it (e.g. reverse proxy or host config).

## Tech

- **Next.js 14** (App Router), **Prisma** (SQLite), **OpenAI** (Whisper + GPT for organize).
- Shared UI styles (CSS variables) and theme (e.g. `saas-apps-theme` in localStorage).
- In-progress transcript and form state are stored in browser localStorage and restored on refresh.

## API

- `POST /api/transcribe` – FormData with `file` (audio) → `{ transcript }`
- `POST /api/organize` – JSON `{ transcript }` → `{ items }`
- `GET/POST /api/dumps`, `GET/PATCH/DELETE /api/dumps/[id]`
- `GET/POST /api/organized-items`, `POST /api/organized-items/batch`, `GET/PATCH/DELETE /api/organized-items/[id]`
- `GET/POST /api/projects`, `GET /api/tags`
