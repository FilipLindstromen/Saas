# Sound Effects from Voice-Over

Generate a sound effects track from a voice-over recording. **Transcription uses OpenAI only** (Whisper). **Sound effects use ElevenLabs only.** The app also uses OpenAI (GPT) to mark important moments and suggest sound direction; then ElevenLabs generates the actual effect audio. Export a cue sheet + audio files.

## What it does

1. **Upload audio** – Choose a voice-over file (MP3, WAV, etc.).
2. **Transcribe** – Uses OpenAI Whisper to transcribe with segment timestamps.
3. **Mark important parts** – GPT analyzes the transcript and picks the best moments for SFX (punch words, emotional beats, CTAs, etc.).
4. **Generate effects** – Creates short placeholder sound effects (whoosh, impact, ding, etc.) for each moment using the Web Audio API.
5. **Export** – Download a JSON cue sheet (timestamps + effect file names) and/or a ZIP with cue sheet + WAV effect files.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Create a `.env` in the project root:

   ```
   OPENAI_API_KEY=sk-your-key-here
   ELEVENLABS_API_KEY=your-elevenlabs-key
   ```

   Get keys from [OpenAI API keys](https://platform.openai.com/api-keys) and [ElevenLabs API](https://elevenlabs.io/app/settings/api-keys).

3. **Run (recommended: one command for both frontend and backend)**

   ```bash
   npm run dev:all
   ```

   This starts the frontend (Vite) and the backend (API) together. Open the URL shown (e.g. `http://localhost:5173`).

   **Alternatively**, use two terminals:
   - Terminal 1: `npm run server` (backend on port 3001)
   - Terminal 2: `npm run dev` (frontend; proxies `/api` to the backend)

If you see **"Failed to fetch"** or **"Cannot reach the API"**, the backend is not running. Start it with `npm run server` in a separate terminal (or use `npm run dev:all` to run both).

## Export formats

- **Cue sheet (JSON)** – `cues[]` with `startTime`, `endTime`, `text`, `reason`, `effectType`, `effectFile`. Use this in a DAW or editor to place effects.
- **ZIP** – Same cue sheet as `cue-sheet.json` plus one WAV per effect (`effect_1_whoosh.wav`, etc.).

## Sound effects

Effects are generated with **ElevenLabs** (text-to-sound). The app suggests a **sound direction** from the transcript (e.g. "Cinematic, subtle, professional") and uses your **overall feel** text (e.g. "dark and mysterious") when calling ElevenLabs so all effects match the desired style.
