import type { MatchupPlayer, MatchupPlayerStats } from "@/types/versus";
import { computeSkaterRivalryScore, computeGoalieRivalryScore } from "@/lib/rivalry-score";

export interface AggRow {
  opponent_id: number;
  player_side: string;
  toi_shared_seconds: number;
  games_shared: number;
  first_name: string;
  last_name: string;
  position: string | null;
  headshot_url: string | null;
  sweater_number: number | null;
  birth_date: string | null;
  team_abbrev: string | null;
  team_name: string | null;
  team_logo_url: string | null;
  player_a_goals: number;
  player_a_assists: number;
  player_a_shots: number;
  player_b_goals: number;
  player_b_assists: number;
  player_b_shots: number;
  goals_for_a: number;
  goals_against_a: number;
  goals_for_b: number;
  goals_against_b: number;
  shots_for_a: number;
  shots_against_a: number;
  shots_for_b: number;
  shots_against_b: number;
  hits_by_a: number;
  hits_by_b: number;
  blocks_by_a: number;
  blocks_by_b: number;
  penalties_by_a: number;
  penalties_by_b: number;
  faceoff_wins_a: number;
  faceoff_wins_b: number;
  wins_a: number;
  wins_b: number;
  [key: string]: unknown;
}

function pick(isA: boolean, aVal: number, bVal: number): number {
  return isA ? aVal : bVal;
}

function buildStats(row: AggRow, isA: boolean): MatchupPlayerStats {
  const goals = pick(isA, row.player_a_goals, row.player_b_goals);
  const assists = pick(isA, row.player_a_assists, row.player_b_assists);
  return {
    points: goals + assists,
    goals,
    assists,
    individualShots: pick(isA, row.player_a_shots, row.player_b_shots),
    shotsFor: pick(isA, row.shots_for_a, row.shots_for_b),
    shotsAgainst: pick(isA, row.shots_against_a, row.shots_against_b),
    goalsFor: pick(isA, row.goals_for_a, row.goals_for_b),
    goalsAgainst: pick(isA, row.goals_against_a, row.goals_against_b),
    hits: pick(isA, row.hits_by_a, row.hits_by_b),
    blocks: pick(isA, row.blocks_by_a, row.blocks_by_b),
    penalties: pick(isA, row.penalties_by_a, row.penalties_by_b),
    faceoffWins: pick(isA, row.faceoff_wins_a, row.faceoff_wins_b),
  };
}

export function mapAggRowToMatchup(
  row: AggRow,
  requestingPlayerPosition: string | null = null
): MatchupPlayer {
  const isA = row.player_side === "A";
  const stats = buildStats(row, isA);
  const oppStats = buildStats(row, !isA);
  const opponentIsGoalie = row.position === "G";
  const requesterIsGoalie = requestingPlayerPosition === "G";

  let rivalryScore: number;
  if (opponentIsGoalie && requesterIsGoalie) {
    rivalryScore = 0;
  } else if (opponentIsGoalie || requesterIsGoalie) {
    const skaterStats = opponentIsGoalie ? stats : oppStats;
    rivalryScore = computeGoalieRivalryScore({
      toiSharedSeconds: row.toi_shared_seconds,
      gamesShared: row.games_shared,
      skaterShots: skaterStats.individualShots,
      skaterGoals: skaterStats.goals,
      skaterAssists: skaterStats.assists,
      winsA: pick(isA, row.wins_a, row.wins_b),
      winsB: pick(isA, row.wins_b, row.wins_a),
    });
  } else {
    rivalryScore = computeSkaterRivalryScore({
      toiSharedSeconds: row.toi_shared_seconds,
      gamesShared: row.games_shared,
      hitsByA: stats.hits,
      hitsByB: oppStats.hits,
      blocksByA: stats.blocks,
      blocksByB: oppStats.blocks,
      penaltiesByA: stats.penalties,
      penaltiesByB: oppStats.penalties,
      faceoffWinsA: stats.faceoffWins,
      faceoffWinsB: oppStats.faceoffWins,
      playerAGoals: stats.goals,
      playerAAssists: stats.assists,
      playerAShots: stats.individualShots,
      playerBGoals: oppStats.goals,
      playerBAssists: oppStats.assists,
      playerBShots: oppStats.individualShots,
      winsA: pick(isA, row.wins_a, row.wins_b),
      winsB: pick(isA, row.wins_b, row.wins_a),
    });
  }

  return {
    playerId: row.opponent_id,
    firstName: row.first_name,
    lastName: row.last_name,
    position: row.position,
    headshotUrl: row.headshot_url,
    sweaterNumber: row.sweater_number,
    birthDate: row.birth_date,
    teamAbbrev: row.team_abbrev,
    teamName: row.team_name,
    teamLogoUrl: row.team_logo_url,
    toiSharedSeconds: row.toi_shared_seconds,
    gamesShared: row.games_shared,
    rivalryScore,
    stats,
    oppStats,
  };
}

export function emptyMatchupStats(): MatchupPlayerStats {
  return {
    points: 0, goals: 0, assists: 0, individualShots: 0,
    shotsFor: 0, shotsAgainst: 0, goalsFor: 0, goalsAgainst: 0,
    hits: 0, blocks: 0, penalties: 0, faceoffWins: 0,
  };
}
