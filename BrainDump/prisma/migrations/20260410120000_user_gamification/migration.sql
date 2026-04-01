CREATE TABLE IF NOT EXISTS "UserGamification" (
    "userId" TEXT NOT NULL,
    "dumpsCapturedCount" INTEGER NOT NULL DEFAULT 0,
    "tasksCompletedLifetime" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGamification_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "UserGamification" DROP CONSTRAINT IF EXISTS "UserGamification_userId_fkey";
ALTER TABLE "UserGamification" ADD CONSTRAINT "UserGamification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
