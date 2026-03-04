# ContentGenerator

A web app that helps creators generate highly relatable, curiosity-driven video questions in the personal development niche (stress, anxiety, overthinking, burnout, motivation, self-worth).

## Features

- **Source Scanner**: Fetch pain-point content from Reddit (anxiety, stress, overthinking, selfimprovement, mentalhealth, etc.)
- **Signal Scoring**: Rank content by emotion intensity, relatability patterns, and engagement
- **Question Generator**: Use OpenAI to transform signals into video questions + hook variations
- **Results Library**: Save, browse, and copy generated questions and hooks

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Radix UI components
- Prisma + SQLite
- OpenAI API

## Setup

1. **Clone and install**

   ```bash
   cd ContentGenerator
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and add your OpenAI API key:

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   ```
   DATABASE_URL="file:./dev.db"
   OPENAI_API_KEY="sk-..."
   ```

3. **Database**

   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Usage

1. **Scan Reddit** – Click "Scan Reddit" to fetch top posts from personal development subreddits. Results are stored and scored.
2. **Configure** – Set audience, theme, tone, format, platform, intensity, and optional context.
3. **Generate** – Click "Generate" to create video questions and hooks from the top signals.
4. **Copy** – Use "Copy question" and "Copy hooks" on each result, or expand items in the Results Library.

## Disclaimer

This tool generates content ideas only. It does not provide medical advice. If you are experiencing a mental health crisis, please consult a qualified professional.

## Project Structure

```
ContentGenerator/
├── prisma/
│   ├── schema.prisma    # DB schema
│   └── seed.ts          # Sample signals
├── src/
│   ├── app/
│   │   ├── actions/     # Server actions (scan, generate)
│   │   ├── api/         # API routes (signals, results)
│   │   └── page.tsx     # Main page
│   ├── components/      # UI components
│   └── lib/             # Reddit, scoring, OpenAI, cache, rate limit
└── package.json
```
