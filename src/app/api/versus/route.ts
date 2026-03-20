import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { versusStats, players, teams } from "@/db/schema";
import { eq, and, or, sql, inArray } from "drizzle-orm";
import type { VersusSeasonStats, VersusResult } from "@/types/versus";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let playerAId = parseInt(params.get("playerA") ?? "", 10);
  let playerBId = parseInt(params.get("playerB") ?? "", 10);
  const seasonsParam = params.get("seasons");

  if (isNaN(playerAId) || isNaN(playerBId)) {
    return NextResponse.json({ error: "Invalid player IDs" }, { status: 400 });
  }

  // Canonicalize: lower ID = player_a
  let swapped = false;
  if (playerAId > playerBId) {
    [playerAId, playerBId] = [playerBId, playerAId];
    swapped = true;
  }

  // Build conditions
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

  // Fetch player info
  const [playerAInfo, playerBInfo] = await Promise.all([
    db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.position,
        headshotUrl: players.headshotUrl,
        teamAbbrev: teams.abbrev,
        teamId: players.currentTeamId,
        sweaterNumber: players.sweaterNumber,
      })
      .from(players)
      .leftJoin(teams, sql`${players.currentTeamId} = ${teams.id}`)
      .where(eq(players.id, playerAId))
      .limit(1),
    db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        position: players.position,
        headshotUrl: players.headshotUrl,
        teamAbbrev: teams.abbrev,
        teamId: players.currentTeamId,
        sweaterNumber: players.sweaterNumber,
      })
      .from(players)
      .leftJoin(teams, sql`${players.currentTeamId} = ${teams.id}`)
      .where(eq(players.id, playerBId))
      .limit(1),
  ]);

  if (!playerAInfo[0] || !playerBInfo[0]) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Map rows to response, swapping A/B if we canonicalized
  const seasonStats: VersusSeasonStats[] = rows.map((row) => ({
    seasonId: row.seasonId,
    sameTeam: row.sameTeam,
    gamesShared: row.gamesShared,
    toiSharedSeconds: row.toiSharedSeconds,
    winsA: swapped ? row.winsB : row.winsA,
    winsB: swapped ? row.winsA : row.winsB,
    playerA: {
      teamId: swapped ? row.playerBTeamId : row.playerATeamId,
      goalsFor: swapped ? row.goalsForB : row.goalsForA,
      goalsAgainst: swapped ? row.goalsAgainstB : row.goalsAgainstA,
      shotsFor: swapped ? row.shotsForB : row.shotsForA,
      shotsAgainst: swapped ? row.shotsAgainstB : row.shotsAgainstA,
      hits: swapped ? row.hitsByB : row.hitsByA,
      penalties: swapped ? row.penaltiesByB : row.penaltiesByA,
      faceoffWins: swapped ? row.faceoffWinsB : row.faceoffWinsA,
      individualGoals: swapped ? row.playerBGoals : row.playerAGoals,
      individualAssists: swapped ? row.playerBAssists : row.playerAAssists,
      individualShots: swapped ? row.playerBShots : row.playerAShots,
    },
    playerB: {
      teamId: swapped ? row.playerATeamId : row.playerBTeamId,
      goalsFor: swapped ? row.goalsForA : row.goalsForB,
      goalsAgainst: swapped ? row.goalsAgainstA : row.goalsAgainstB,
      shotsFor: swapped ? row.shotsForA : row.shotsForB,
      shotsAgainst: swapped ? row.shotsAgainstA : row.shotsAgainstB,
      hits: swapped ? row.hitsByA : row.hitsByB,
      penalties: swapped ? row.penaltiesByA : row.penaltiesByB,
      faceoffWins: swapped ? row.faceoffWinsA : row.faceoffWinsB,
      individualGoals: swapped ? row.playerAGoals : row.playerBGoals,
      individualAssists: swapped ? row.playerAAssists : row.playerBAssists,
      individualShots: swapped ? row.playerAShots : row.playerBShots,
    },
  }));

  // Compute totals
  const totals: VersusSeasonStats = seasonStats.reduce(
    (acc, s) => ({
      seasonId: "all",
      sameTeam: s.sameTeam,
      gamesShared: acc.gamesShared + s.gamesShared,
      toiSharedSeconds: acc.toiSharedSeconds + s.toiSharedSeconds,
      winsA: acc.winsA + s.winsA,
      winsB: acc.winsB + s.winsB,
      playerA: {
        teamId: s.playerA.teamId,
        goalsFor: acc.playerA.goalsFor + s.playerA.goalsFor,
        goalsAgainst: acc.playerA.goalsAgainst + s.playerA.goalsAgainst,
        shotsFor: acc.playerA.shotsFor + s.playerA.shotsFor,
        shotsAgainst: acc.playerA.shotsAgainst + s.playerA.shotsAgainst,
        hits: acc.playerA.hits + s.playerA.hits,
        penalties: acc.playerA.penalties + s.playerA.penalties,
        faceoffWins: acc.playerA.faceoffWins + s.playerA.faceoffWins,
        individualGoals:
          acc.playerA.individualGoals + s.playerA.individualGoals,
        individualAssists:
          acc.playerA.individualAssists + s.playerA.individualAssists,
        individualShots:
          acc.playerA.individualShots + s.playerA.individualShots,
      },
      playerB: {
        teamId: s.playerB.teamId,
        goalsFor: acc.playerB.goalsFor + s.playerB.goalsFor,
        goalsAgainst: acc.playerB.goalsAgainst + s.playerB.goalsAgainst,
        shotsFor: acc.playerB.shotsFor + s.playerB.shotsFor,
        shotsAgainst: acc.playerB.shotsAgainst + s.playerB.shotsAgainst,
        hits: acc.playerB.hits + s.playerB.hits,
        penalties: acc.playerB.penalties + s.playerB.penalties,
        faceoffWins: acc.playerB.faceoffWins + s.playerB.faceoffWins,
        individualGoals:
          acc.playerB.individualGoals + s.playerB.individualGoals,
        individualAssists:
          acc.playerB.individualAssists + s.playerB.individualAssists,
        individualShots:
          acc.playerB.individualShots + s.playerB.individualShots,
      },
    }),
    {
      seasonId: "all",
      sameTeam: false,
      gamesShared: 0,
      toiSharedSeconds: 0,
      winsA: 0,
      winsB: 0,
      playerA: {
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
      },
      playerB: {
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
      },
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
