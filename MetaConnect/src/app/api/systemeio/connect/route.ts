import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { testApiKey } from "@/lib/systemeio";
import prisma from "@/lib/prisma";

const schema = z.object({ apiKey: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiKey } = schema.parse(await req.json());

  const valid = await testApiKey(apiKey);
  if (!valid) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 400 });
  }

  await prisma.systemeioConnection.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, apiKey },
    update: { apiKey },
  });

  return NextResponse.json({ ok: true });
}
