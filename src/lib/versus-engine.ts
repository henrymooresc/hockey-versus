import {
  computeShiftOverlaps,
  isTimeInIntervals,
  type Interval,
} from "./time-utils";

export interface ShiftRecord {
  playerId: number;
  teamId: number;
  period: number;
  startSeconds: number;
  endSeconds: number;
}

export interface EventRecord {
  eventType: string;
  period: number;
  timeSeconds: number;
  teamId: number | null;
  player1Id: number | null;
  player2Id: number | null;
  player3Id: number | null;
}

export interface PairStats {
  playerAId: number;
  playerBId: number;
  playerATeamId: number;
  playerBTeamId: number;
  sameTeam: boolean;
  toiSharedSeconds: number;
  goalsForA: number;
  goalsAgainstA: number;
  goalsForB: number;
  goalsAgainstB: number;
  shotsForA: number;
  shotsAgainstA: number;
  shotsForB: number;
  shotsAgainstB: number;
  hitsByA: number;
  hitsByB: number;
  penaltiesByA: number;
  penaltiesByB: number;
  faceoffWinsA: number;
  faceoffWinsB: number;
  playerAGoals: number;
  playerAAssists: number;
  playerAShots: number;
  playerBGoals: number;
  playerBAssists: number;
  playerBShots: number;
}

/**
 * Compute versus stats for all player pairs in a single game.
 * Returns a map of "playerAId-playerBId" -> PairStats.
 *
 * Only computes pairs where players have overlapping ice time.
 * playerAId is always the lower ID.
 */
export function computeGameVersus(
  gameShifts: ShiftRecord[],
  gameEvents: EventRecord[]
): Map<string, PairStats> {
  const results = new Map<string, PairStats>();

  // Group shifts by player
  const shiftsByPlayer = new Map<number, ShiftRecord[]>();
  const playerTeams = new Map<number, number>();

  for (const shift of gameShifts) {
    if (!shiftsByPlayer.has(shift.playerId)) {
      shiftsByPlayer.set(shift.playerId, []);
    }
    shiftsByPlayer.get(shift.playerId)!.push(shift);
    playerTeams.set(shift.playerId, shift.teamId);
  }

  const playerIds = Array.from(shiftsByPlayer.keys()).sort((a, b) => a - b);

  // For each pair of players
  for (let i = 0; i < playerIds.length; i++) {
    const playerA = playerIds[i];
    const teamA = playerTeams.get(playerA)!;
    const shiftsA = shiftsByPlayer.get(playerA)!;

    for (let j = i + 1; j < playerIds.length; j++) {
      const playerB = playerIds[j];
      const teamB = playerTeams.get(playerB)!;
      const shiftsB = shiftsByPlayer.get(playerB)!;

      // Compute overlap per period
      const periods = new Set([
        ...shiftsA.map((s) => s.period),
        ...shiftsB.map((s) => s.period),
      ]);

      let totalOverlap = 0;
      const allOverlapIntervals: Map<number, Interval[]> = new Map();

      for (const period of periods) {
        const pShiftsA = shiftsA
          .filter((s) => s.period === period)
          .map((s) => ({ start: s.startSeconds, end: s.endSeconds }));
        const pShiftsB = shiftsB
          .filter((s) => s.period === period)
          .map((s) => ({ start: s.startSeconds, end: s.endSeconds }));

        if (pShiftsA.length === 0 || pShiftsB.length === 0) continue;

        const { totalSeconds, intervals } = computeShiftOverlaps(
          pShiftsA,
          pShiftsB
        );
        totalOverlap += totalSeconds;
        if (intervals.length > 0) {
          allOverlapIntervals.set(period, intervals);
        }
      }

      // Skip pairs with no shared ice time
      if (totalOverlap === 0) continue;

      const sameTeam = teamA === teamB;
      const pairKey = `${playerA}-${playerB}`;

      const stats: PairStats = {
        playerAId: playerA,
        playerBId: playerB,
        playerATeamId: teamA,
        playerBTeamId: teamB,
        sameTeam,
        toiSharedSeconds: totalOverlap,
        goalsForA: 0,
        goalsAgainstA: 0,
        goalsForB: 0,
        goalsAgainstB: 0,
        shotsForA: 0,
        shotsAgainstA: 0,
        shotsForB: 0,
        shotsAgainstB: 0,
        hitsByA: 0,
        hitsByB: 0,
        penaltiesByA: 0,
        penaltiesByB: 0,
        faceoffWinsA: 0,
        faceoffWinsB: 0,
        playerAGoals: 0,
        playerAAssists: 0,
        playerAShots: 0,
        playerBGoals: 0,
        playerBAssists: 0,
        playerBShots: 0,
      };

      // Attribute events during overlap intervals
      for (const event of gameEvents) {
        const periodIntervals = allOverlapIntervals.get(event.period);
        if (!periodIntervals) continue;
        if (!isTimeInIntervals(event.timeSeconds, periodIntervals)) continue;

        const eventTeam = event.teamId;

        switch (event.eventType) {
          case "goal": {
            if (eventTeam === teamA) {
              stats.goalsForA++;
              if (sameTeam) {
                stats.goalsForB++;
              } else {
                stats.goalsAgainstB++;
              }
            } else if (eventTeam === teamB) {
              stats.goalsForB++;
              if (sameTeam) {
                stats.goalsForA++;
              } else {
                stats.goalsAgainstA++;
              }
            }
            // Individual stats
            if (event.player1Id === playerA) stats.playerAGoals++;
            if (event.player1Id === playerB) stats.playerBGoals++;
            if (
              event.player2Id === playerA ||
              event.player3Id === playerA
            )
              stats.playerAAssists++;
            if (
              event.player2Id === playerB ||
              event.player3Id === playerB
            )
              stats.playerBAssists++;
            break;
          }
          case "shot":
          case "missed_shot":
          case "blocked_shot": {
            if (eventTeam === teamA) {
              stats.shotsForA++;
              if (sameTeam) {
                stats.shotsForB++;
              } else {
                stats.shotsAgainstB++;
              }
            } else if (eventTeam === teamB) {
              stats.shotsForB++;
              if (sameTeam) {
                stats.shotsForA++;
              } else {
                stats.shotsAgainstA++;
              }
            }
            // Individual shots (shooter is player1)
            if (event.player1Id === playerA) stats.playerAShots++;
            if (event.player1Id === playerB) stats.playerBShots++;
            break;
          }
          case "hit": {
            if (event.player1Id === playerA && event.player2Id === playerB) stats.hitsByA++;
            if (event.player1Id === playerB && event.player2Id === playerA) stats.hitsByB++;
            break;
          }
          case "penalty": {
            if (event.player1Id === playerA && event.player2Id === playerB) stats.penaltiesByA++;
            if (event.player1Id === playerB && event.player2Id === playerA) stats.penaltiesByB++;
            break;
          }
          case "faceoff": {
            if (event.player1Id === playerA) stats.faceoffWinsA++;
            if (event.player1Id === playerB) stats.faceoffWinsB++;
            break;
          }
        }
      }

      results.set(pairKey, stats);
    }
  }

  return results;
}
