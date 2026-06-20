-- Admin-editable AI instruction overrides (null = use built-in defaults from code).
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "organizeSystemPromptEn" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "organizeSystemPromptSv" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "coachSystemPrompt" TEXT;
