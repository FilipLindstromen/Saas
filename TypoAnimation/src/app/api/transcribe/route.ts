import { NextRequest } from 'next/server';
import path from 'path';
import { transcribeVideo, type TranscribeProgressEvent } from '@/lib/transcribe';

export const runtime = 'nodejs';
// Whisper install (first run) + model download + transcription can legitimately take
// minutes; the platform's default route timeout would otherwise cut this off.
export const maxDuration = 600;

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

type StreamLine =
  | { type: 'progress'; phase: TranscribeProgressEvent['phase']; message: string; progress: number }
  | { type: 'done'; captions: Awaited<ReturnType<typeof transcribeVideo>> }
  | { type: 'error'; error: string };

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { videoPath?: string };
  const videoPath = body.videoPath;
  if (!videoPath || !videoPath.startsWith('/uploads/')) {
    return new Response(JSON.stringify({ error: 'videoPath must be an /uploads/... path returned by /api/upload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const filename = path.basename(videoPath);
  const absolutePath = path.join(UPLOAD_DIR, filename);
  if (path.dirname(absolutePath) !== UPLOAD_DIR) {
    return new Response(JSON.stringify({ error: 'invalid path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (line: StreamLine) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      };

      (async () => {
        try {
          const captions = await transcribeVideo(absolutePath, (event) => {
            send({
              type: 'progress',
              phase: event.phase,
              message: event.message,
              progress: event.progress,
            });
          });
          send({ type: 'done', captions });
        } catch (err) {
          send({ type: 'error', error: err instanceof Error ? err.message : String(err) });
        } finally {
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
