import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { ffprobeDurationMs } from '@/lib/transcribe';

export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get('video');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing "video" file field' }, { status: 400 });
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name) || '.webm';
  const id = crypto.randomUUID();
  const filename = `${id}${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  const durationMs = await ffprobeDurationMs(filePath);

  return NextResponse.json({ path: `/uploads/${filename}`, durationMs });
}
