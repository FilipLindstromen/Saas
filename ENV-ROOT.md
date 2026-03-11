# API keys and env (root)

On **localhost**, all SaaS apps read API keys from a single env file in **this folder** (the repo root):

- **`.env`** or **`.env.local`** (create from `.env.example`)

Copy `.env.example` to `.env` and fill in your keys. No need to duplicate env files in each app.

- **Next.js apps** (BrainDump, ContentGenerator) load `../.env` and `../.env.local` from their `next.config.js`, and expose client vars (e.g. `NEXT_PUBLIC_OPENAI_API_KEY`) from `OPENAI_API_KEY`.
- **Vite apps** (ReelRecorder, VideoQuiz, StoryWriter, SoundEffectsGenerator, InfoGraphics, webquizgenerator, VIdeoRecorder) use `envDir` pointing to the repo root and `define` to pass `OPENAI_API_KEY` etc. into the client as `VITE_*`.
- **shared/apiKeys.js** uses env first (Vite: `import.meta.env.VITE_*`, Next: `process.env.NEXT_PUBLIC_*`), then localStorage.

For **production** (e.g. Vercel), set the same variables in your host’s environment; root `.env` is for local development only.
