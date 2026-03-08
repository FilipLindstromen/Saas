const DB_SETUP_HINT =
  'Database not set up. In the BrainDump folder run: npm run db:push (and ensure .env has DATABASE_URL="file:./dev.db").';

const DB_ERROR_PATTERN =
  /no such table|SQLITE_ERROR|Can't reach database|PrismaClientInitializationError|Environment variable not found: DATABASE_URL/i;

export function getDbErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return DB_ERROR_PATTERN.test(raw) ? DB_SETUP_HINT : raw || "Database error";
}
