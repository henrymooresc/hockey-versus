import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import type { RivalEntry, StatRivals } from "@/types/versus";

/**
 * For each stat, returns the top 3 opponents where the selected player
 * performed best, and the bottom 3 where they performed worst.
 *
 * "Rivalry" weight = stat difference * log(1 + toiSharedSeconds)
 * so high-interaction matchups rank higher than flukey low-sample ones.
 */

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
  const resolvedParams = await Promise.resolve(context.params);
  const playerId = parseInt(resolvedParams.id, 10);
  if (isNaN(playerId)) {
    return NextResponse.json({ error: "Invalid player ID" }, { status: 400 });
  }

  // Aggregate all seasons into totals per opponent, only opponents (sameTeam = false)
  const rows = await db.execute(sql`
    WITH aggregated AS (
      SELECT
        CASE WHEN player_a_id = ${playerId} THEN player_b_id ELSE player_a_id END AS opponent_id,
        CASE WHEN player_a_id = ${playerId} THEN 'A' ELSE 'B' END AS player_side,
        SUM(toi_shared_seconds)::int AS toi_shared_seconds,
        SUM(games_shared)::int AS games_shared,
        SUM(player_a_goals)::int AS player_a_goals,
        SUM(player_a_assists)::int AS player_a_assists,
        SUM(player_b_goals)::int AS player_b_goals,
        SUM(player_b_assists)::int AS player_b_assists,
        SUM(goals_for_a)::int AS goals_for_a,
        SUM(goals_against_a)::int AS goals_against_a,
        SUM(goals_for_b)::int AS goals_for_b,
        SUM(goals_against_b)::int AS goals_against_b,
        SUM(shots_for_a)::int AS shots_for_a,
        SUM(shots_against_a)::int AS shots_against_a,
        SUM(shots_for_b)::int AS shots_for_b,
        SUM(shots_against_b)::int AS shots_against_b,
        SUM(hits_by_a)::int AS hits_by_a,
        SUM(hits_by_b)::int AS hits_by_b,
        SUM(penalties_by_a)::int AS penalties_by_a,
        SUM(penalties_by_b)::int AS penalties_by_b,
        SUM(faceoff_wins_a)::int AS faceoff_wins_a,
        SUM(faceoff_wins_b)::int AS faceoff_wins_b,
        SUM(wins_a)::int AS wins_a,
        SUM(wins_b)::int AS wins_b
      FROM versus_stats
      WHERE (player_a_id = ${playerId} OR player_b_id = ${playerId})
        AND same_team = false
        AND toi_shared_seconds > 0
      GROUP BY opponent_id, player_side
    )
    SELECT
      a.*,
      p.first_name,
      p.last_name,
      p.position,
      p.headshot_url,
      t.abbrev AS team_abbrev,
      t.logo_url AS team_logo_url
    FROM aggregated a
    JOIN players p ON p.id = a.opponent_id
    LEFT JOIN teams t ON t.id = p.current_team_id
  `);

  // Build a normalized array where stats are from the selected player's perspective
  interface AggRow {
    opponent_id: number;
    player_side: string;
    toi_shared_seconds: number;
    games_shared: number;
    first_name: string;
    last_name: string;
    position: string | null;
    headshot_url: string | null;
    team_abbrev: string | null;
    team_logo_url: string | null;
    [key: string]: unknown;
  }

  const rowsArray = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
  const opponents = (rowsArray as AggRow[]).map((row) => {
    const isA = row.player_side === "A";
    return {
      opponentId: row.opponent_id,
      firstName: row.first_name,
      lastName: row.last_name,
      position: row.position,
      headshotUrl: row.headshot_url,
      teamAbbrev: row.team_abbrev,
      teamLogoUrl: row.team_logo_url,
      toiSharedSeconds: row.toi_shared_seconds,
      gamesShared: row.games_shared,
      // Stat values from selected player's perspective
      stats: {
        goals: isA ? row.player_a_goals as number : row.player_b_goals as number,
        assists: isA ? row.player_a_assists as number : row.player_b_assists as number,
        points: isA
          ? (row.player_a_goals as number) + (row.player_a_assists as number)
          : (row.player_b_goals as number) + (row.player_b_assists as number),
        goalsFor: isA ? row.goals_for_a as number : row.goals_for_b as number,
        goalsAgainst: isA ? row.goals_against_a as number : row.goals_against_b as number,
        shotsFor: isA ? row.shots_for_a as number : row.shots_for_b as number,
        shotsAgainst: isA ? row.shots_against_a as number : row.shots_against_b as number,
        hits: isA ? row.hits_by_a as number : row.hits_by_b as number,
        penalties: isA ? row.penalties_by_a as number : row.penalties_by_b as number,
      },
      // Opponent's stats for the same categories
      oppStats: {
        goals: isA ? row.player_b_goals as number : row.player_a_goals as number,
        assists: isA ? row.player_b_assists as number : row.player_a_assists as number,
        points: isA
          ? (row.player_b_goals as number) + (row.player_b_assists as number)
          : (row.player_a_goals as number) + (row.player_a_assists as number),
        goalsFor: isA ? row.goals_for_b as number : row.goals_for_a as number,
        goalsAgainst: isA ? row.goals_against_b as number : row.goals_against_a as number,
        shotsFor: isA ? row.shots_for_b as number : row.shots_for_a as number,
        shotsAgainst: isA ? row.shots_against_b as number : row.shots_against_a as number,
        hits: isA ? row.hits_by_b as number : row.hits_by_a as number,
        penalties: isA ? row.penalties_by_b as number : row.penalties_by_a as number,
      },
    };
  });

  // Split opponents into goalies and skaters
  const goalieOpponents = opponents.filter((o) => o.position === "G");
  const skaterOpponents = opponents.filter((o) => o.position !== "G");

  type StatKeyDef = { key: string; label: string; higherIsBetter: boolean };

  // Full stat set for skater opponents (goals/assists omitted — surfaced as breakdown under Points)
  const skaterStatKeys: StatKeyDef[] = [
    { key: "points", label: "Points", higherIsBetter: true },
    { key: "shotsFor", label: "Shots", higherIsBetter: true },
    { key: "hits", label: "Hits", higherIsBetter: true },
    { key: "penalties", label: "Penalties", higherIsBetter: false },
  ];

  // Enrich goalie opponents with computed save % (shots faced - goals allowed) / shots faced
  const goalieOpponentsEnriched = goalieOpponents.map((o) => ({
    ...o,
    stats: {
      ...o.stats,
      savePct: o.stats.shotsFor > 0 ? (o.stats.shotsFor - o.stats.goalsFor) / o.stats.shotsFor : 1,
    },
    oppStats: { ...o.oppStats, savePct: 1 },
  }));

  // Goalie opponent stat set — only Points (goals/assists as breakdown); opponent value hidden since goalies rarely score
  const goalieStatKeys: StatKeyDef[] = [
    { key: "points", label: "Points", higherIsBetter: true },
    { key: "savePct", label: "Save %", higherIsBetter: false },
  ];

  function buildRivals(
    pool: typeof opponents,
    keys: StatKeyDef[]
  ): StatRivals[] {
    return keys.map(({ key, label, higherIsBetter }) => {
      const scored = pool.map((opp) => {
        const playerVal = opp.stats[key as keyof typeof opp.stats] as number;
        const oppVal = opp.oppStats[key as keyof typeof opp.oppStats] as number;
        const diff = higherIsBetter ? playerVal - oppVal : oppVal - playerVal;
        const weight = Math.log(1 + opp.toiSharedSeconds);
        return { ...opp, playerVal, oppVal, weightedScore: diff * weight };
      });

      const toRivalEntry = (o: (typeof scored)[number]): RivalEntry => ({
        playerId: o.opponentId,
        firstName: o.firstName,
        lastName: o.lastName,
        position: o.position,
        headshotUrl: o.headshotUrl,
        teamAbbrev: o.teamAbbrev,
        teamLogoUrl: o.teamLogoUrl,
        value: o.playerVal,
        opponentValue: o.oppVal,
        toiSharedSeconds: o.toiSharedSeconds,
        gamesShared: o.gamesShared,
      });

      const sorted = [...scored].sort((a, b) => b.weightedScore - a.weightedScore);
      return {
        label,
        top: sorted.slice(0, 3).map(toRivalEntry),
        bottom: sorted.slice(-3).reverse().map(toRivalEntry),
      };
    });
  }

  const skaterRivals = buildRivals(skaterOpponents, skaterStatKeys);

  // Enrich Points entries with goals+assists breakdown for display
  const skaterOppMap = new Map(skaterOpponents.map((o) => [o.opponentId, o]));
  const pointsEntry = skaterRivals.find((r) => r.label === "Points");
  if (pointsEntry) {
    for (const entry of [...pointsEntry.top, ...pointsEntry.bottom]) {
      const opp = skaterOppMap.get(entry.playerId);
      if (opp) {
        entry.breakdown = { goals: opp.stats.goals, assists: opp.stats.assists };
        entry.opponentBreakdown = { goals: opp.oppStats.goals, assists: opp.oppStats.assists };
      }
    }
  }

  const goalieRivals = buildRivals(goalieOpponentsEnriched, goalieStatKeys);

  // Set formatter and hide opponent value for save %
  const savePctEntry = goalieRivals.find((r) => r.label === "Save %");
  if (savePctEntry) {
    savePctEntry.hideOpponentValue = true;
    savePctEntry.valueFormat = "savePct";
  }

  // Enrich Points entries with goals+assists breakdown for display
  const goalieOppMap = new Map(goalieOpponents.map((o) => [o.opponentId, o]));
  const goaliePointsEntry = goalieRivals.find((r) => r.label === "Points");
  if (goaliePointsEntry) {
    goaliePointsEntry.hideOpponentValue = true;
    for (const entry of [...goaliePointsEntry.top, ...goaliePointsEntry.bottom]) {
      const opp = goalieOppMap.get(entry.playerId);
      if (opp) {
        entry.breakdown = { goals: opp.stats.goals, assists: opp.stats.assists };
      }
    }
  }

  // Enrich Save % entries with goals+assists+shots breakdown for context
  if (savePctEntry) {
    for (const entry of [...savePctEntry.top, ...savePctEntry.bottom]) {
      const opp = goalieOppMap.get(entry.playerId);
      if (opp) {
        entry.breakdown = { goals: opp.stats.goals, assists: opp.stats.assists, shots: opp.stats.shotsFor };
      }
    }
  }

  return NextResponse.json({ skaterRivals, goalieRivals });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Rivals API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
