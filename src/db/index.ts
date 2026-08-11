import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

/**
 * The site runs on Vercel against the Neon pooled endpoint, so the request
 * path always reaches Postgres through PgBouncer in transaction mode.
 *
 * `prepare: false` is mandatory. Transaction pooling hands a different backend
 * to each transaction, so a named prepared statement from one request is not
 * there for the next. postgres.js names its statements by default.
 *
 * `max` is per instance, not per deployment. Vercel runs many instances, and
 * every one opens its own pool, so keep the number small. 5 is enough for the
 * concurrent requests one instance serves, and it does not serialize them.
 *
 * `idle_timeout` returns a connection to the pooler between bursts. The
 * postgres.js default holds it open forever.
 *
 * TLS comes from `sslmode` in DATABASE_URL. Neon supplies `?sslmode=require`
 * in its connection string, and a local database without TLS omits it. Setting
 * it here instead would break local development.
 *
 * The ingestion scripts build their own client and must use the direct
 * (non-pooled) endpoint. They do bulk writes and gain from prepared statements.
 */
const client = postgres(connectionString, {
  prepare: false,
  max: 5,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });
