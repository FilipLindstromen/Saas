import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(["active", "paused"]).optional(),
  systemeioTag: z.string().min(1).max(100).optional(),
  keyword: z.string().optional(),
  postId: z.string().optional(),
  dmMessage: z.string().optional(),
  responseMessage: z.string().optional(),
  formId: z.string().optional(),
});

async function getOwnedProject(id: string, userId: string) {
  return prisma.project.findFirst({ where: { id, userId } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    include: {
      metaConnection: { select: { pageName: true, pageId: true, igName: true } },
      leads: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await getOwnedProject(id, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = updateSchema.parse(await req.json());
    const updated = await prisma.project.update({ where: { id }, data: body });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const project = await getOwnedProject(id, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
