import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { versusStats, players, teams } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import type {
  VersusSeasonStats,
  VersusPlayerSeasonStats,
  VersusResult,
} from "@/types/versus";

const playerInfoSelect = {
  id: players.id,
  firstName: players.firstName,
  lastName: players.lastName,
  position: players.position,
  headshotUrl: players.headshotUrl,
  teamAbbrev: teams.abbrev,
  teamId: players.currentTeamId,
  sweaterNumber: players.sweaterNumber,
};

function getPlayerInfo(playerId: number) {
  return db
    .select(playerInfoSelect)
    .from(players)
    .leftJoin(teams, sql`${players.currentTeamId} = ${teams.id}`)
    .where(eq(players.id, playerId))
    .limit(1);
}

type VersusRow = typeof versusStats.$inferSelect;

function mapPlayerStats(
  row: VersusRow,
  side: "a" | "b"
): VersusPlayerSeasonStats {
  const isA = side === "a";
  return {
    teamId: isA ? row.playerATeamId : row.playerBTeamId,
    goalsFor: isA ? row.goalsForA : row.goalsForB,
    goalsAgainst: isA ? row.goalsAgainstA : row.goalsAgainstB,
    shotsFor: isA ? row.shotsForA : row.shotsForB,
    shotsAgainst: isA ? row.shotsAgainstA : row.shotsAgainstB,
    hits: isA ? row.hitsByA : row.hitsByB,
    penalties: isA ? row.penaltiesByA : row.penaltiesByB,
    faceoffWins: isA ? row.faceoffWinsA : row.faceoffWinsB,
    individualGoals: isA ? row.playerAGoals : row.playerBGoals,
    individualAssists: isA ? row.playerAAssists : row.playerBAssists,
    individualShots: isA ? row.playerAShots : row.playerBShots,
  };
}

function emptyPlayerStats(): VersusPlayerSeasonStats {
  return {
    teamId: null,
    goalsFor: 0,
    goalsAgainst: 0,
    shotsFor: 0,
    shotsAgainst: 0,
    hits: 0,
    penalties: 0,
    faceoffWins: 0,
    individualGoals: 0,
    individualAssists: 0,
    individualShots: 0,
  };
}

function addPlayerStats(
  a: VersusPlayerSeasonStats,
  b: VersusPlayerSeasonStats
): VersusPlayerSeasonStats {
  return {
    teamId: b.teamId,
    goalsFor: a.goalsFor + b.goalsFor,
    goalsAgainst: a.goalsAgainst + b.goalsAgainst,
    shotsFor: a.shotsFor + b.shotsFor,
    shotsAgainst: a.shotsAgainst + b.shotsAgainst,
    hits: a.hits + b.hits,
    penalties: a.penalties + b.penalties,
    faceoffWins: a.faceoffWins + b.faceoffWins,
    individualGoals: a.individualGoals + b.individualGoals,
    individualAssists: a.individualAssists + b.individualAssists,
    individualShots: a.individualShots + b.individualShots,
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let playerAId = parseInt(params.get("playerA") ?? "", 10);
  let playerBId = parseInt(params.get("playerB") ?? "", 10);
  const seasonsParam = params.get("seasons");

  if (isNaN(playerAId) || isNaN(playerBId)) {
    return NextResponse.json({ error: "Invalid player IDs" }, { status: 400 });
  }

  // Canonicalize: lower ID = player_a (matches DB storage convention)
  let swapped = false;
  if (playerAId > playerBId) {
    [playerAId, playerBId] = [playerBId, playerAId];
    swapped = true;
  }

  // The "first"/"second" sides map DB columns back to the user's original A/B
  const first = swapped ? "b" : "a";
  const second = swapped ? "a" : "b";

  const conditions = [
    eq(versusStats.playerAId, playerAId),
    eq(versusStats.playerBId, playerBId),
  ];

  if (seasonsParam) {
    const seasonList = seasonsParam.split(",").filter(Boolean);
    if (seasonList.length > 0) {
      conditions.push(inArray(versusStats.seasonId, seasonList));
    }
  }

  const rows = await db
    .select()
    .from(versusStats)
    .where(and(...conditions))
    .orderBy(versusStats.seasonId);

  const [playerAInfo, playerBInfo] = await Promise.all([
    getPlayerInfo(playerAId),
    getPlayerInfo(playerBId),
  ]);

  if (!playerAInfo[0] || !playerBInfo[0]) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const seasonStats: VersusSeasonStats[] = rows.map((row) => ({
    seasonId: row.seasonId,
    sameTeam: row.sameTeam,
    gamesShared: row.gamesShared,
    toiSharedSeconds: row.toiSharedSeconds,
    winsA: swapped ? row.winsB : row.winsA,
    winsB: swapped ? row.winsA : row.winsB,
    playerA: mapPlayerStats(row, first),
    playerB: mapPlayerStats(row, second),
  }));

  const totals: VersusSeasonStats = seasonStats.reduce(
    (acc, s) => ({
      seasonId: "all",
      sameTeam: s.sameTeam,
      gamesShared: acc.gamesShared + s.gamesShared,
      toiSharedSeconds: acc.toiSharedSeconds + s.toiSharedSeconds,
      winsA: acc.winsA + s.winsA,
      winsB: acc.winsB + s.winsB,
      playerA: addPlayerStats(acc.playerA, s.playerA),
      playerB: addPlayerStats(acc.playerB, s.playerB),
    }),
    {
      seasonId: "all",
      sameTeam: false,
      gamesShared: 0,
      toiSharedSeconds: 0,
      winsA: 0,
      winsB: 0,
      playerA: emptyPlayerStats(),
      playerB: emptyPlayerStats(),
    }
  );

  const result: VersusResult = {
    playerA: swapped ? playerBInfo[0] : playerAInfo[0],
    playerB: swapped ? playerAInfo[0] : playerBInfo[0],
    seasons: seasonStats,
    totals,
  };

  return NextResponse.json(result);
}
