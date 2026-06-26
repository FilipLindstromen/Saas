// Systeme.io API helpers

const BASE = "https://api.systeme.io/api";

interface SystemeioContact {
  email: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
}

/** Test an API key by fetching the account profile */
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/contacts?itemsPerPage=1`, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Create or update a contact, then add a tag */
export async function upsertContactWithTag(
  apiKey: string,
  contact: SystemeioContact,
  tag: string,
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  try {
    // 1. Upsert contact
    const parts = (contact.firstName || contact.email.split("@")[0]).split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || "";

    const upsertRes = await fetch(`${BASE}/contacts`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: contact.email,
        firstName,
        lastName,
        fields: [],
      }),
    });

    let contactId: string | undefined;

    if (upsertRes.ok) {
      const contactData = await upsertRes.json();
      contactId = contactData.id;
    } else if (upsertRes.status === 422) {
      // Contact already exists — look it up
      const searchRes = await fetch(
        `${BASE}/contacts?email=${encodeURIComponent(contact.email)}`,
        { headers: { "X-API-Key": apiKey, Accept: "application/json" } },
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        contactId = searchData["hydra:member"]?.[0]?.id;
      }
    }

    if (!contactId) {
      return { success: false, error: "Could not create or find contact" };
    }

    // 2. Ensure tag exists and add it
    await addTagToContact(apiKey, contactId, tag);

    return { success: true, contactId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function addTagToContact(
  apiKey: string,
  contactId: string,
  tagName: string,
) {
  // Find or create the tag
  const tagsRes = await fetch(
    `${BASE}/tags?name=${encodeURIComponent(tagName)}`,
    { headers: { "X-API-Key": apiKey, Accept: "application/json" } },
  );

  let tagId: string | undefined;

  if (tagsRes.ok) {
    const tagsData = await tagsRes.json();
    const existing = tagsData["hydra:member"]?.find(
      (t: { name: string }) => t.name.toLowerCase() === tagName.toLowerCase(),
    );
    tagId = existing?.id;
  }

  if (!tagId) {
    const createRes = await fetch(`${BASE}/tags`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ name: tagName }),
    });
    if (createRes.ok) {
      const tagData = await createRes.json();
      tagId = tagData.id;
    }
  }

  if (!tagId) return;

  // Tag the contact
  await fetch(`${BASE}/contacts/${contactId}/tags`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ tagId }),
  });
}
