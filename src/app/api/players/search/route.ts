import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { players, teams } from "@/db/schema";
import { ilike, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ players: [] });
  }

  const searchTerm = `%${q.toLowerCase()}%`;

  const results = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      position: players.position,
      headshotUrl: players.headshotUrl,
      teamAbbrev: teams.abbrev,
    })
    .from(players)
    .leftJoin(teams, sql`${players.currentTeamId} = ${teams.id}`)
    .where(ilike(players.searchText, searchTerm))
    .limit(10);

  return NextResponse.json({ players: results });
}
