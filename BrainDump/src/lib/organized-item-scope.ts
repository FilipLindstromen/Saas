import type { Prisma } from "../../prisma/generated/prisma/client";

/** Combine filters with “not in trash”. */
export function withActiveOrganizedItems(
  where: Prisma.OrganizedItemWhereInput
): Prisma.OrganizedItemWhereInput {
  return { AND: [where, { deletedAt: null }] };
}

/** Combine filters with “in trash” only. */
export function withTrashedOrganizedItems(
  where: Prisma.OrganizedItemWhereInput
): Prisma.OrganizedItemWhereInput {
  return { AND: [where, { deletedAt: { not: null } }] };
}
