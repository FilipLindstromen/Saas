import type { Prisma } from "../../prisma/generated/prisma/client";

/** Interactive transaction client (has .project, .organizedItem, …) */
type Tx = Prisma.TransactionClient;

/**
 * Projects in DB are scoped to work | personal. Organized items may be inbox — infer where to store the project.
 */
export function inferProjectStorageDomain(itemDomain: string, category: string): "work" | "personal" {
  if (itemDomain === "work") return "work";
  if (itemDomain === "personal") return "personal";
  const c = (category || "").toLowerCase();
  const workLike = new Set(["projects", "tasks", "notes", "ideas", "meetings", "opportunities"]);
  if (workLike.has(c)) return "work";
  return "personal";
}

/**
 * Find existing project by case-insensitive name or create it. Returns project id.
 */
export async function resolveOrCreateProjectByName(
  tx: Tx,
  userId: string,
  projectName: string,
  itemDomain: string,
  category: string
): Promise<string> {
  const trimmed = projectName.trim();
  if (!trimmed) {
    throw new Error("projectName is required");
  }
  const domain = inferProjectStorageDomain(itemDomain, category);

  const existing = await tx.project.findFirst({
    where: {
      userId,
      domain,
      name: { equals: trimmed, mode: "insensitive" },
    },
  });
  if (existing) return existing.id;

  const created = await tx.project.create({
    data: { name: trimmed, domain, status: "active", userId },
  });
  return created.id;
}
