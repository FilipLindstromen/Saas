// Meta Graph API helpers

const GRAPH = "https://graph.facebook.com/v21.0";

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; name: string };
}

/** Exchange a short-lived user token for a long-lived one */
export async function getLongLivedUserToken(shortLivedToken: string) {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetch(`${GRAPH}/oauth/access_token?${params}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.access_token as string;
}

/** Get all pages the user manages, with permanent page tokens */
export async function getUserPages(userToken: string): Promise<MetaPage[]> {
  const res = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,name}&access_token=${userToken}`,
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.data ?? [];
}

/** Subscribe a page to webhook events */
export async function subscribePageToWebhook(pageId: string, pageToken: string) {
  const params = new URLSearchParams({
    subscribed_fields: "feed,messages,leadgen",
    access_token: pageToken,
  });
  const res = await fetch(`${GRAPH}/${pageId}/subscribed_apps`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  return data;
}

/** Send a Messenger message to a PSID */
export async function sendMessengerMessage(
  psid: string,
  text: string,
  pageToken: string,
) {
  const res = await fetch(`${GRAPH}/me/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: psid },
      message: { text },
      messaging_type: "RESPONSE",
      access_token: pageToken,
    }),
  });
  const data = await res.json();
  if (data.error) {
    console.error("[meta] sendMessengerMessage error:", data.error);
  }
  return data;
}

/** Send an Instagram DM to an IGSID */
export async function sendInstagramMessage(
  igsid: string,
  text: string,
  igPageToken: string,
) {
  const res = await fetch(`${GRAPH}/me/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: igsid },
      message: { text },
      messaging_type: "RESPONSE",
      access_token: igPageToken,
    }),
  });
  const data = await res.json();
  if (data.error) {
    console.error("[meta] sendInstagramMessage error:", data.error);
  }
  return data;
}

/** Send a private reply to a Facebook comment using comment_id */
export async function sendPrivateReply(
  commentId: string,
  text: string,
  pageToken: string,
) {
  const res = await fetch(`${GRAPH}/me/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text },
      messaging_type: "RESPONSE",
      access_token: pageToken,
    }),
  });
  const data = await res.json();
  return data;
}

/** Fetch lead data from a Meta lead form submission */
export async function fetchLeadData(
  leadId: string,
  pageToken: string,
): Promise<{ name: string; email: string } | null> {
  const res = await fetch(
    `${GRAPH}/${leadId}?fields=field_data&access_token=${pageToken}`,
  );
  const data = await res.json();
  if (data.error || !data.field_data) return null;

  let name = "";
  let email = "";

  for (const field of data.field_data as { name: string; values: string[] }[]) {
    const key = field.name.toLowerCase();
    if (key.includes("full_name") || key.includes("name")) {
      name = field.values[0] ?? "";
    }
    if (key.includes("email")) {
      email = field.values[0] ?? "";
    }
  }

  return name && email ? { name, email } : null;
}

/** Parse name and email from a free-text DM reply.
 *  Accepts formats like:
 *    "John Doe | john@example.com"
 *    "John Doe, john@example.com"
 *    "john@example.com John Doe"
 */
export function parseNameEmail(
  text: string,
): { name: string; email: string } | null {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
  const emailMatch = text.match(emailRegex);
  if (!emailMatch) return null;

  const email = emailMatch[0];
  const rest = text.replace(email, "").replace(/[|,]/g, " ").trim();
  const name = rest.replace(/\s+/g, " ").trim();

  if (!name || !email) return null;
  return { name, email };
}
