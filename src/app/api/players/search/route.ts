import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { players, teams } from "@/db/schema";
import { ilike, asc, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  const baseQuery = db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      position: players.position,
      headshotUrl: players.headshotUrl,
      teamAbbrev: teams.abbrev,
      teamLogoUrl: teams.logoUrl,
    })
    .from(players)
    .leftJoin(teams, sql`${players.currentTeamId} = ${teams.id}`);

  const results = await (q && q.length >= 2
    ? baseQuery.where(ilike(players.searchText, `%${q.toLowerCase()}%`)).limit(50)
    : baseQuery.orderBy(asc(players.lastName)).limit(1000));

  return NextResponse.json({ players: results });
}
