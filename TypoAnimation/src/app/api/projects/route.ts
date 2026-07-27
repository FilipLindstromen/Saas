import { NextRequest, NextResponse } from 'next/server';
import { deleteProject, listProjects, loadProject, saveProject } from '@/lib/projectStore';
import type { Project } from '@/types/project';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (id) {
    const project = await loadProject(id);
    if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(project);
  }
  return NextResponse.json(await listProjects());
}

export async function POST(request: NextRequest) {
  const project = (await request.json()) as Project;
  if (!project?.id) return NextResponse.json({ error: 'missing project.id' }, { status: 400 });
  await saveProject(project);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  await deleteProject(id);
  return NextResponse.json({ ok: true });
}
