import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getLongLivedUserToken,
  getUserPages,
  subscribePageToWebhook,
} from "@/lib/meta";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/connections?error=meta_denied", req.url),
    );
  }

  try {
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
    const redirectUri = `${APP_URL}/api/meta/callback`;

    // Exchange code for short-lived token
    const tokenParams = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: redirectUri,
      code,
    });
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams}`,
    );
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error.message);

    // Exchange for long-lived token (60-day)
    const longLivedToken = await getLongLivedUserToken(tokenData.access_token);

    // Fetch pages the user manages
    const pages = await getUserPages(longLivedToken);
    if (!pages.length) {
      return NextResponse.redirect(
        new URL("/connections?error=no_pages", req.url),
      );
    }

    // Save all pages and subscribe to webhooks
    await Promise.all(
      pages.map(async (page) => {
        await prisma.metaConnection.upsert({
          where: {
            userId_pageId: { userId, pageId: page.id },
          },
          create: {
            userId,
            pageId: page.id,
            pageName: page.name,
            pageAccessToken: page.access_token,
            igAccountId: page.instagram_business_account?.id,
            igName: page.instagram_business_account?.name,
            webhookSubscribed: false,
          },
          update: {
            pageName: page.name,
            pageAccessToken: page.access_token,
            igAccountId: page.instagram_business_account?.id ?? null,
            igName: page.instagram_business_account?.name ?? null,
          },
        });

        // Subscribe page to webhook events
        try {
          await subscribePageToWebhook(page.id, page.access_token);
          await prisma.metaConnection.update({
            where: {
              userId_pageId: { userId, pageId: page.id },
            },
            data: { webhookSubscribed: true },
          });
        } catch {
          // Non-fatal — user can retry from connections page
        }
      }),
    );

    return NextResponse.redirect(new URL("/connections?success=meta", req.url));
  } catch (err) {
    console.error("[meta/callback]", err);
    return NextResponse.redirect(
      new URL("/connections?error=meta_failed", req.url),
    );
  }
}
