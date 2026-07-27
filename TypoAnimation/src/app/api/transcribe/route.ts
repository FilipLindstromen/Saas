import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { transcribeVideo } from '@/lib/transcribe';

export const runtime = 'nodejs';
// Whisper install (first run) + model download + transcription can legitimately take
// minutes; the platform's default route timeout would otherwise cut this off.
export const maxDuration = 600;

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { videoPath?: string };
  const videoPath = body.videoPath;
  if (!videoPath || !videoPath.startsWith('/uploads/')) {
    return NextResponse.json({ error: 'videoPath must be an /uploads/... path returned by /api/upload' }, { status: 400 });
  }

  const filename = path.basename(videoPath);
  const absolutePath = path.join(UPLOAD_DIR, filename);
  if (path.dirname(absolutePath) !== UPLOAD_DIR) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 });
  }

  try {
    const captions = await transcribeVideo(absolutePath);
    return NextResponse.json({ captions });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
