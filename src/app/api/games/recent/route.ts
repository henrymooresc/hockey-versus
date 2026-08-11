import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { unwrapRows } from "@/lib/db-utils";
import { cachedJson, SCHEDULE } from "@/lib/api-cache";

interface Row {
  id: number;
  game_date: string;
  home_score: number | null;
  away_score: number | null;
  home_abbrev: string | null;
  home_name: string | null;
  home_logo_url: string | null;
  away_abbrev: string | null;
  away_name: string | null;
  away_logo_url: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") ?? "30", 10) || 30,
      100
    );
    const teamAbbrev = request.nextUrl.searchParams.get("team");

    const rows = await db.execute(sql`
      SELECT g.id, g.game_date, g.home_score, g.away_score,
             ht.abbrev AS home_abbrev, ht.name AS home_name, ht.logo_url AS home_logo_url,
             at.abbrev AS away_abbrev, at.name AS away_name, at.logo_url AS away_logo_url
      FROM games g
      LEFT JOIN teams ht ON ht.id = g.home_team_id
      LEFT JOIN teams at ON at.id = g.away_team_id
      WHERE g.shifts_ingested = true
        AND g.events_ingested = true
        AND g.home_score IS NOT NULL
        ${teamAbbrev ? sql`AND (ht.abbrev = ${teamAbbrev} OR at.abbrev = ${teamAbbrev})` : sql``}
      ORDER BY g.game_date DESC, g.id DESC
      LIMIT ${limit}
    `);

    const games = unwrapRows<Row>(rows).map((r) => ({
      id: r.id,
      date: r.game_date,
      home: {
        abbrev: r.home_abbrev,
        name: r.home_name,
        logoUrl: r.home_logo_url,
        score: r.home_score,
      },
      away: {
        abbrev: r.away_abbrev,
        name: r.away_name,
        logoUrl: r.away_logo_url,
        score: r.away_score,
      },
    }));

    return cachedJson({ games }, SCHEDULE);
  } catch (err) {
    console.error("Recent games API error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
