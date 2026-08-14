import { apiError } from "@/lib/api-error";
import { db } from "@/db";
import { seasons } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { cachedJson, DERIVED } from "@/lib/api-cache";

export async function GET() {
  try {
    const rows = await db
      .select({ id: seasons.id, startDate: seasons.startDate, endDate: seasons.endDate })
      .from(seasons)
      .where(eq(seasons.ingested, true))
      .orderBy(desc(seasons.id));

    return cachedJson({ seasons: rows }, DERIVED);
  } catch (err: unknown) {
    return apiError("Seasons API error", err);
  }
}
