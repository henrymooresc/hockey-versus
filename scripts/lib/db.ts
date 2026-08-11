import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Builds the database client that the ingestion and compute scripts write
 * through. All five scripts repeated this block before.
 *
 * The scripts prefer `DIRECT_DATABASE_URL`, the endpoint that bypasses the
 * connection pooler. They run long bulk writes and gain from prepared
 * statements, which PgBouncer in transaction mode cannot hold. The site uses
 * the pooled endpoint instead — see `src/db/index.ts`.
 *
 * `DATABASE_URL` is the fallback, which is what a local database uses.
 */
export function createScriptDb() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Set DIRECT_DATABASE_URL (preferred) or DATABASE_URL before you run a script"
    );
  }
  const client = postgres(url);
  return { client, db: drizzle(client) };
}
