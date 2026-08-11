import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit runs DDL, so it prefers `DIRECT_DATABASE_URL`, the endpoint that
 * bypasses the connection pooler. The scripts do the same — see
 * `scripts/lib/db.ts`. A local database sets only `DATABASE_URL`.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: (process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL)!,
  },
});
