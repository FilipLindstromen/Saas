import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const createSchema = z.object({
  metaConnectionId: z.string().min(1),
  name: z.string().min(1).max(100),
  type: z.enum(["comment", "lead_form"]),
  systemeioTag: z.string().min(1).max(100),
  // Comment project
  keyword: z.string().optional(),
  postId: z.string().optional(),
  dmMessage: z.string().optional(),
  responseMessage: z.string().optional(),
  // Lead form project
  formId: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    include: {
      metaConnection: { select: { pageName: true, pageId: true } },
      _count: { select: { leads: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await req.json());

    // Verify the connection belongs to this user
    const connection = await prisma.metaConnection.findFirst({
      where: { id: body.metaConnectionId, userId: session.user.id },
    });
    if (!connection) {
      return NextResponse.json({ error: "Invalid connection" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        metaConnectionId: body.metaConnectionId,
        name: body.name,
        type: body.type,
        systemeioTag: body.systemeioTag,
        keyword: body.keyword,
        postId: body.postId || null,
        dmMessage: body.dmMessage,
        responseMessage: body.responseMessage,
        formId: body.formId,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("[projects POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
