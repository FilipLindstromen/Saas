import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./src/lib/database-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: resolveDatabaseUrl() || "postgresql://localhost:5432/braindump",
  },
});
