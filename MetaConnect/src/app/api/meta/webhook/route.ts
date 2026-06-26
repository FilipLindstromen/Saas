import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  sendMessengerMessage,
  sendInstagramMessage,
  fetchLeadData,
  parseNameEmail,
} from "@/lib/meta";
import { upsertContactWithTag } from "@/lib/systemeio";

// ─── Webhook verification (GET) ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// ─── Webhook events (POST) ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.object !== "page" && body.object !== "instagram") {
    return NextResponse.json({ ok: true });
  }

  // Process entries in background — respond immediately to Meta
  void processEntries(body).catch((err) =>
    console.error("[webhook] processEntries error:", err),
  );

  return NextResponse.json({ ok: true });
}

// ─── Event processing ────────────────────────────────────────────────────────

async function processEntries(body: {
  object: string;
  entry: WebhookEntry[];
}) {
  for (const entry of body.entry ?? []) {
    const pageId = entry.id;

    // Find the connected page in our DB
    const metaConnection = await prisma.metaConnection.findFirst({
      where: { pageId },
    });
    if (!metaConnection) continue;

    // ── Feed changes (comments) ──
    for (const change of entry.changes ?? []) {
      if (change.field === "feed" && change.value?.item === "comment") {
        await handleComment(change.value, metaConnection.id, metaConnection.pageAccessToken);
      }
      if (change.field === "leadgen") {
        await handleLeadgen(change.value, metaConnection.id, metaConnection.pageAccessToken);
      }
    }

    // ── Messenger messages ──
    for (const msg of entry.messaging ?? []) {
      if (msg.message && !msg.message.is_echo) {
        await handleMessage(
          msg,
          metaConnection.id,
          metaConnection.pageAccessToken,
          "messenger",
        );
      }
    }

    // ── Instagram messages ──
    for (const msg of entry.messages ?? []) {
      if (msg.message) {
        await handleMessage(
          msg,
          metaConnection.id,
          metaConnection.pageAccessToken,
          "instagram",
        );
      }
    }
  }
}

// ─── Comment handler ─────────────────────────────────────────────────────────

async function handleComment(
  value: CommentValue,
  metaConnectionId: string,
  pageToken: string,
) {
  const commentText = (value.message ?? "").toLowerCase();
  const postId = value.post_id;
  const commentId = value.comment_id;
  const senderPsid = value.from?.id;

  if (!senderPsid) return;

  // Find active comment projects for this connection
  const projects = await prisma.project.findMany({
    where: {
      metaConnectionId,
      type: "comment",
      status: "active",
      OR: [{ postId: null }, { postId: postId }],
    },
  });

  for (const project of projects) {
    if (!project.keyword || !project.dmMessage) continue;

    const keyword = project.keyword.toLowerCase().trim();
    if (!commentText.includes(keyword)) continue;

    // Avoid duplicate conversations
    const existing = await prisma.conversation.findUnique({
      where: { projectId_psid: { projectId: project.id, psid: senderPsid } },
    });
    if (existing) continue;

    // Create conversation
    await prisma.conversation.create({
      data: {
        projectId: project.id,
        psid: senderPsid,
        state: "awaiting_name",
      },
    });

    // Send initial DM
    await sendMessengerMessage(senderPsid, project.dmMessage, pageToken);

    // Send collection prompt
    await sendMessengerMessage(
      senderPsid,
      "To receive more, please reply with your name and email like this:\nJohn Doe | john@example.com",
      pageToken,
    );

    // Break after first matching project per comment
    break;
  }
}

// ─── Message handler (DM reply with name/email) ──────────────────────────────

async function handleMessage(
  msg: MessagingEvent,
  metaConnectionId: string,
  pageToken: string,
  platform: "messenger" | "instagram",
) {
  const psid = msg.sender?.id;
  const text = msg.message?.text ?? "";
  if (!psid || !text) return;

  const conversation = await prisma.conversation.findFirst({
    where: {
      psid,
      state: { in: ["awaiting_name", "awaiting_email"] },
      project: { metaConnectionId },
    },
    include: { project: true },
  });
  if (!conversation) return;

  const send =
    platform === "messenger"
      ? (t: string) => sendMessengerMessage(psid, t, pageToken)
      : (t: string) => sendInstagramMessage(psid, t, pageToken);

  const parsed = parseNameEmail(text);

  if (!parsed) {
    const attempts = conversation.attempts + 1;
    if (attempts >= 3) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { state: "failed" },
      });
      await send("Sorry, I couldn't understand your reply. Please contact us directly.");
      return;
    }
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { attempts },
    });
    await send(
      "I didn't catch that. Please reply with your name and email like:\nJohn Doe | john@example.com",
    );
    return;
  }

  // Mark conversation complete
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { state: "completed", name: parsed.name, email: parsed.email },
  });

  // Send response message
  if (conversation.project.responseMessage) {
    await send(conversation.project.responseMessage);
  }

  // Save lead
  await prisma.lead.create({
    data: {
      projectId: conversation.projectId,
      name: parsed.name,
      email: parsed.email,
      metaUserId: psid,
      source: "comment",
    },
  });

  // Sync to Systeme.io
  await syncToSystemeio(conversation.projectId, parsed.name, parsed.email);
}

// ─── Lead form handler ───────────────────────────────────────────────────────

async function handleLeadgen(
  value: LeadgenValue,
  metaConnectionId: string,
  pageToken: string,
) {
  const formId = String(value.form_id ?? "");
  const leadId = String(value.leadgen_id ?? "");

  if (!formId || !leadId) return;

  const project = await prisma.project.findFirst({
    where: { metaConnectionId, type: "lead_form", status: "active", formId },
  });
  if (!project) return;

  const leadData = await fetchLeadData(leadId, pageToken);
  if (!leadData) return;

  // Save lead
  await prisma.lead.create({
    data: {
      projectId: project.id,
      name: leadData.name,
      email: leadData.email,
      source: "lead_form",
    },
  });

  // Sync to Systeme.io
  await syncToSystemeio(project.id, leadData.name, leadData.email);
}

// ─── Systeme.io sync ─────────────────────────────────────────────────────────

async function syncToSystemeio(
  projectId: string,
  name: string,
  email: string,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { user: { include: { systemeioConnection: true } } },
  });

  const apiKey = project?.user?.systemeioConnection?.apiKey;
  if (!apiKey) return;

  await upsertContactWithTag(apiKey, { email, firstName: name }, project!.systemeioTag);
}

// ─── Webhook types ───────────────────────────────────────────────────────────

interface WebhookEntry {
  id: string;
  time: number;
  changes?: { field: string; value: CommentValue & LeadgenValue }[];
  messaging?: MessagingEvent[];
  messages?: MessagingEvent[];
}

interface CommentValue {
  item?: string;
  message?: string;
  post_id?: string;
  comment_id?: string;
  from?: { id: string; name?: string };
}

interface LeadgenValue {
  form_id?: string | number;
  leadgen_id?: string | number;
  page_id?: string;
}

interface MessagingEvent {
  sender?: { id: string };
  recipient?: { id: string };
  message?: {
    text?: string;
    is_echo?: boolean;
  };
}
