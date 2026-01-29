import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Readable } from 'stream';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB (Whisper limit)
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/m4a'];
    if (allowed.includes(file.mimetype) || file.mimetype?.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

function getOpenAIKey(req) {
  return req.headers['x-openai-api-key'] || process.env.OPENAI_API_KEY;
}

function getElevenLabsKey(req) {
  return req.headers['x-elevenlabs-api-key'] || process.env.ELEVENLABS_API_KEY;
}

// GET /api - health check (confirms backend + proxy work)
app.get('/api', (req, res) => {
  res.json({
    ok: true,
    message: 'Sound effects API',
    endpoints: ['POST /api/transcribe', 'POST /api/analyze-important', 'POST /api/generate-effect', 'POST /api/generate-ambient'],
  });
});

// POST /api/transcribe - OpenAI Whisper only (no other transcription services)
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
    const apiKey = getOpenAIKey(req);
    if (!apiKey) return res.status(500).json({ error: 'OpenAI API key not set. Add OPENAI_API_KEY in .env or in Settings.' });

    const openaiClient = new OpenAI({ apiKey });
    const stream = Readable.from(req.file.buffer);
    stream.path = req.file.originalname || 'audio.mp3';
    const transcription = await openaiClient.audio.transcriptions.create({
      file: stream,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    res.json(transcription);
  } catch (err) {
    console.error('Transcribe error:', err);
    res.status(500).json({ error: err.message || 'Transcription failed' });
  }
});

// POST /api/analyze-important - mark important parts + suggest sound direction
app.post('/api/analyze-important', async (req, res) => {
  try {
    const { segments, text, overallFeel, userImportantFocus, selectedSegments } = req.body;
    const apiKey = getOpenAIKey(req);
    if (!apiKey) return res.status(500).json({ error: 'OpenAI API key not set. Add OPENAI_API_KEY in .env or in Settings.' });

    const segmentList = (segments || [])
      .map((s) => `[${s.start.toFixed(2)}s - ${s.end.toFixed(2)}s] ${s.text}`)
      .join('\n');

    const feelNote = overallFeel
      ? ` Overall feel for sound effects: "${overallFeel}".`
      : '';
    const focusNote = userImportantFocus
      ? ` User focus: "${userImportantFocus}".`
      : '';

    const openaiClient = new OpenAI({ apiKey });

    // When user has selected segments: those ARE the moments. One moment per selected line—no more, no fewer. GPT only enriches them.
    if (selectedSegments && selectedSegments.length > 0) {
      const n = selectedSegments.length;
      const selectedList = selectedSegments
        .map((s, i) => `[${i + 1}] ${Number(s.start).toFixed(2)}s–${Number(s.end).toFixed(2)}s: "${s.text}"`)
        .join('\n');

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `The user has selected exactly ${n} lines from their transcript. Those ${n} lines WILL become the ${n} sound effects. You must return exactly ${n} analyses—no more, no fewer.

Your ONLY job is to analyze each selected line for context and feeling. For each of the ${n} lines, return one object with:
- "reason": one short sentence on why this moment works for a sound effect (mood, imagery, action).
- "effectSuggestion": one word for the type of sound (e.g. whoosh, echo, rise, impact, ding, shimmer).
- "elevenLabsPrompt": a SHORT text-to-sound prompt for ElevenLabs (3–10 words), e.g. "Soft whoosh, calm transition". Match the mood and imagery of the line.

Also return "soundDirection": one short phrase for the overall style (e.g. "Cinematic, clear", "Calm, immersive").

Return a JSON object with:
- "soundDirection": string
- "analyses": array with exactly ${n} objects, in the SAME ORDER as the list below. Each object: { "reason": string, "effectSuggestion": string, "elevenLabsPrompt": string }

You must return exactly ${n} items in "analyses". Do not skip or merge any line.`,
          },
          {
            role: 'user',
            content: `There are exactly ${n} selected lines below. Return "analyses" with exactly ${n} objects, one per line, in this order:\n\n${selectedList}\n\n${feelNote}${focusNote}\n\nReturn JSON with "soundDirection" and "analyses" (array of exactly ${n} objects).`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw);
      const analyses = Array.isArray(parsed.analyses) ? parsed.analyses : [];
      const soundDirection = typeof parsed.soundDirection === 'string' ? parsed.soundDirection : '';

      // Always one moment per selected segment—never fewer, never more. Use selectedSegments as source of truth.
      const moments = selectedSegments.map((seg, i) => {
        const a = analyses[i] || {};
        return {
          start: seg.start,
          end: seg.end,
          text: seg.text,
          reason: a.reason || 'Selected for sound effect',
          effectSuggestion: a.effectSuggestion || 'sfx',
          elevenLabsPrompt: a.elevenLabsPrompt || 'Short sound effect',
        };
      });

      return res.json({ importantMoments: moments, soundDirection });
    }

    // No selection: GPT picks moments from the full transcript
    const focusNotePick = userImportantFocus
      ? `\n\nThe user says the most important things to highlight are: "${userImportantFocus}". Prioritize moments that match this.`
      : '';
    const feelNotePick = overallFeel
      ? `\n\nThe user wants the overall feel of sound effects to be: "${overallFeel}". Use this to suggest sound direction and to write ElevenLabs prompts that match this feel.`
      : '';

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You analyze voice-over transcripts and (1) suggest a SOUND DIRECTION that would fit the content (e.g. "Cinematic, subtle, professional", "Playful, bright, energetic"), and (2) mark the MOST IMPORTANT moments for sound effects with prompts ready for ElevenLabs.

Return a JSON object with:
- "soundDirection": string. One short phrase for overall audio direction.
- "moments": array. Each item: { "start": number (seconds), "end": number (seconds), "text": string, "reason": string, "effectSuggestion": string (one word), "elevenLabsPrompt": string }
Use the exact start/end times from the transcript. "elevenLabsPrompt" = short text-to-sound for ElevenLabs (3–10 words). Pick 3–12 moments – quality over quantity.`,
        },
        {
          role: 'user',
          content: `Transcript with timestamps:\n\n${segmentList}\n\nFull text: ${text || 'N/A'}${feelNotePick}${focusNotePick}\n\nReturn JSON with "soundDirection" and "moments".`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    const moments = Array.isArray(parsed.moments) ? parsed.moments : Array.isArray(parsed) ? parsed : [];
    const soundDirection = typeof parsed.soundDirection === 'string' ? parsed.soundDirection : '';
    res.json({ importantMoments: moments, soundDirection });
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

// POST /api/generate-effect - ElevenLabs only (no other sound-effect services)
app.post('/api/generate-effect', async (req, res) => {
  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const text = body.text || body.prompt;
    const overallFeel = body.overallFeel || body.overall_feel;
    const durationSeconds = body.duration_seconds ?? 3;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "text" (ElevenLabs prompt). Check that every moment has a prompt.' });
    }
    let prompt = String(text).trim();
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt cannot be empty. Add a description in the moment card or re-run "Mark important parts".' });
    }
    const elevenLabsKey = getElevenLabsKey(req);
    if (!elevenLabsKey) {
      return res.status(500).json({ error: 'ElevenLabs API key not set. Add ELEVENLABS_API_KEY in .env or in Settings.' });
    }

    const feel = overallFeel && typeof overallFeel === 'string' ? overallFeel.trim() : '';
    if (feel) {
      // Put style first so the model keeps it consistent across all effects
      prompt = `Style: ${feel}. ${prompt}`;
    }

    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: prompt,
        duration_seconds: Math.min(30, Math.max(0.5, Number(durationSeconds) || 3)),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let message = `ElevenLabs error ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.detail?.message) message = errJson.detail.message;
        else if (errJson.detail?.message?.message) message = errJson.detail.message.message;
        else if (errJson.message) message = errJson.message;
        else if (errJson.detail && typeof errJson.detail === 'string') message = errJson.detail;
      } catch (_) {
        if (errText) message = errText.slice(0, 300);
      }
      const status = response.status >= 500 ? 502 : 400;
      return res.status(status).json({ error: message });
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    res.set('Content-Type', contentType);
    res.send(buffer);
  } catch (err) {
    console.error('Generate effect error:', err);
    res.status(500).json({ error: err.message || 'Effect generation failed' });
  }
});

// POST /api/generate-ambient - one ambient track that shifts with important moments (ElevenLabs)
app.post('/api/generate-ambient', async (req, res) => {
  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const moments = Array.isArray(body.moments) ? body.moments : [];
    const overallFeel = body.overallFeel || body.overall_feel;
    const durationSeconds = Math.min(30, Math.max(10, Number(body.duration_seconds) || 30));

    if (moments.length === 0) {
      return res.status(400).json({ error: 'Mark important parts first so the ambient track can follow the text.' });
    }

    const elevenLabsKey = getElevenLabsKey(req);
    if (!elevenLabsKey) {
      return res.status(500).json({ error: 'ElevenLabs API key not set. Add ELEVENLABS_API_KEY in .env or in Settings.' });
    }

    const themes = moments
      .map((m) => (m.effectSuggestion || m.elevenLabsPrompt || m.text || '').toString().trim())
      .filter(Boolean);
    const themeList = themes.length > 0 ? themes.join(', ') : 'calm, atmospheric';
    const feel = overallFeel && typeof overallFeel === 'string' ? overallFeel.trim() : '';
    let prompt = `Ambient background music, atmospheric and evolving. The mood shifts through these themes in order: ${themeList}. Seamless transitions, no sudden changes, smooth and continuous, suitable for voice-over.`;
    if (feel) {
      prompt = `Style: ${feel}. ${prompt}`;
    }

    const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: prompt,
        duration_seconds: durationSeconds,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let message = `ElevenLabs error ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.detail?.message) message = errJson.detail.message;
        else if (errJson.detail?.message?.message) message = errJson.detail.message.message;
        else if (errJson.message) message = errJson.message;
        else if (errJson.detail && typeof errJson.detail === 'string') message = errJson.detail;
      } catch (_) {
        if (errText) message = errText.slice(0, 300);
      }
      const status = response.status >= 500 ? 502 : 400;
      return res.status(status).json({ error: message });
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    res.set('Content-Type', contentType);
    res.send(buffer);
  } catch (err) {
    console.error('Generate ambient error:', err);
    res.status(500).json({ error: err.message || 'Ambient generation failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('  POST /api/transcribe, /api/analyze-important, /api/generate-effect, /api/generate-ambient');
});
