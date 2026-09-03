import { apiError } from "@/lib/api-error";
import { db } from "@/db";
import { players, teams } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { cachedJson, DERIVED } from "@/lib/api-cache";

export interface TeamSummary {
  id: number;
  abbrev: string;
  name: string;
  logoUrl: string | null;
  rosterSize: number;
}

/**
 * The teams a roster page can be shown for, which is the 32 with players on
 * them today.
 *
 * `teams` holds 34 rows, and the two extras are history rather than error:
 *
 * - **ARI (53)** is Arizona before the relocation. 627 games, none since
 *   2024-04-17, no roster and no logo, and its `name` is the abbreviation
 *   because nothing ever filled it in.
 * - **UTA (59)** is Utah's first season. The NHL issued a new franchise id
 *   when they became the Mammoth, so 68 carries the current club and 59 keeps
 *   the 82 games played under the old id.
 *
 * Both still own games and belong in the game record, so neither is deleted.
 * They are excluded here because this endpoint feeds the team index and the
 * roster page, and a club with no players cannot render either.
 *
 * Division comes from `src/lib/divisions.ts` rather than the database, so it
 * is applied on the client and not returned here.
 *
 * GET /api/teams
 */
export async function GET() {
  try {
    // The inner join does both jobs: it counts the roster and drops the two
    // clubs that have none, so no separate EXISTS filter is needed.
    const rows = await db
      .select({
        id: teams.id,
        abbrev: teams.abbrev,
        name: teams.name,
        logoUrl: teams.logoUrl,
        rosterSize: sql<number>`COUNT(${players.id})::int`.as("roster_size"),
      })
      .from(teams)
      .innerJoin(players, eq(players.currentTeamId, teams.id))
      .groupBy(teams.id, teams.abbrev, teams.name, teams.logoUrl)
      .orderBy(asc(teams.name));

    return cachedJson({ teams: rows }, DERIVED);
  } catch (err: unknown) {
    return apiError("Teams API error", err);
  }
}
