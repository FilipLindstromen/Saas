import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
  const redirectUri = `${APP_URL}/api/meta/callback`;

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri,
    scope: [
      "pages_manage_metadata",
      "pages_read_engagement",
      "pages_messaging",
      "instagram_basic",
      "instagram_manage_messages",
      "leads_retrieval",
      "pages_show_list",
    ].join(","),
    response_type: "code",
    state: session.user.id,
  });

  return NextResponse.redirect(
    `https://www.facebook.com/v21.0/dialog/oauth?${params}`,
  );
}
