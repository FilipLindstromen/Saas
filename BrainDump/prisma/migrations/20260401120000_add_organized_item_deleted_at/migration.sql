-- Soft-delete / trash: nullable timestamp; null = active row
ALTER TABLE "OrganizedItem" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
