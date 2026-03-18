import { db } from "@/db";
import { versusStats, players, teams } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { PlayerCard } from "@/components/PlayerCard";
import { VersusTable } from "@/components/VersusTable";
import type { VersusSeasonStats, PlayerInfo } from "@/types/versus";

async function getPlayerInfo(playerId: number): Promise<PlayerInfo | null> {
  const rows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      position: players.position,
      headshotUrl: players.headshotUrl,
      teamAbbrev: teams.abbrev,
      teamLogoUrl: teams.logoUrl,
      teamId: players.currentTeamId,
      sweaterNumber: players.sweaterNumber,
    })
    .from(players)
    .leftJoin(teams, sql`${players.currentTeamId} = ${teams.id}`)
    .where(eq(players.id, playerId))
    .limit(1);

  return rows[0] ?? null;
}

export default async function VersusPage({
  params,
}: {
  params: Promise<{ playerA: string; playerB: string }>;
}) {
  const { playerA: playerAParam, playerB: playerBParam } = await params;
  const requestedA = parseInt(playerAParam, 10);
  const requestedB = parseInt(playerBParam, 10);

  if (isNaN(requestedA) || isNaN(requestedB)) {
    return <div className="text-center text-red-400">Invalid player IDs</div>;
  }

  // Canonicalize for DB lookup
  const dbA = Math.min(requestedA, requestedB);
  const dbB = Math.max(requestedA, requestedB);
  const swapped = requestedA !== dbA;

  const [playerAInfo, playerBInfo] = await Promise.all([
    getPlayerInfo(requestedA),
    getPlayerInfo(requestedB),
  ]);

  if (!playerAInfo || !playerBInfo) {
    return <div className="text-center text-red-400">Player not found</div>;
  }

  const rows = await db
    .select()
    .from(versusStats)
    .where(
      and(eq(versusStats.playerAId, dbA), eq(versusStats.playerBId, dbB))
    )
    .orderBy(versusStats.seasonId);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-10 pt-4">
        <a href="/" className="group self-start inline-flex items-center gap-2 text-sm text-gray-400 transition-all duration-200 hover:text-white hover:gap-3">
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span> Back
        </a>
        <div className="flex items-center justify-center gap-6 md:gap-16">
          <PlayerCard player={playerAInfo} />
          <span className="text-5xl font-black text-gray-700">VS</span>
          <PlayerCard player={playerBInfo} />
        </div>
        <p className="text-gray-500">No shared ice time data found for these players.</p>
      </div>
    );
  }

  // Map DB rows, swapping if needed so display matches the URL order
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
  const totals = seasonStats.reduce(
    (acc, s) => ({
      ...acc,
      gamesShared: acc.gamesShared + s.gamesShared,
      toiSharedSeconds: acc.toiSharedSeconds + s.toiSharedSeconds,
      winsA: acc.winsA + s.winsA,
      winsB: acc.winsB + s.winsB,
      playerA: {
        ...acc.playerA,
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
        ...acc.playerB,
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
    } as VersusSeasonStats
  );

  return (
    <div className="flex flex-col gap-10 pt-4">
      {/* Back */}
      <a href="/" className="group inline-flex items-center gap-2 text-sm text-gray-400 transition-all duration-200 hover:text-white hover:gap-3">
        <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span> Back
      </a>

      {/* Hero */}
      <div className="flex items-center justify-center gap-6 md:gap-16">
        <PlayerCard player={playerAInfo} />
        <div className="flex flex-col items-center gap-1">
          <span className="text-5xl font-black text-[#a62639] md:text-6xl drop-shadow-[0_0_12px_rgba(166,38,57,0.3)]">VS</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            {totals.gamesShared} game{totals.gamesShared !== 1 ? "s" : ""} together
          </span>
        </div>
        <PlayerCard player={playerBInfo} />
      </div>

      {/* Totals */}
      <div>
        <h2 className="mb-4 text-center text-xl font-bold tracking-tight text-gray-200">
          All Seasons Combined
        </h2>
        <VersusTable
          stats={totals}
          playerA={playerAInfo}
          playerB={playerBInfo}
        />
      </div>

      {/* Per-season breakdown */}
      {seasonStats.length > 1 && (
        <div className="w-full">
          <h2 className="mb-6 text-center text-xl font-bold tracking-tight text-gray-200">
            By Season
          </h2>
          <div className="flex flex-col gap-8">
            {seasonStats.map((s) => (
              <div key={s.seasonId}>
                <h3 className="mb-3 text-center text-base font-semibold text-gray-400">
                  {s.seasonId.slice(0, 4)}–{s.seasonId.slice(4)}
                </h3>
                <VersusTable
                  stats={s}
                  playerA={playerAInfo}
                  playerB={playerBInfo}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
