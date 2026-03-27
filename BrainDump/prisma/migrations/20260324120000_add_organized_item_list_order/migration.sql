-- OrganizedItem.listOrder: required for ordering in list/text views and batch create.
-- Safe if the column already exists (e.g. after `prisma db push`).
ALTER TABLE "OrganizedItem" ADD COLUMN IF NOT EXISTS "listOrder" DOUBLE PRECISION NOT NULL DEFAULT 0;
