/**
 * Playoff series, derived from the NHL game id.
 *
 * A playoff id is `SSSS TT 0 R M G`:
 *
 *   2025 03 0 4 1 6  ->  2025-26, playoffs, round 4, matchup 1, game 6
 *
 * Round 4 matchup 1 is the Stanley Cup Final. Verified against the database on
 * 2026-08-11: every 2025-26 playoff game matches this layout.
 *
 * No extra column is needed, so the series grouping costs nothing to store.
 */

/** Playoffs. Matches `games.game_type`. */
export const GAME_TYPE_PLAYOFFS = 3;

export interface PlayoffGameRef {
  round: number;
  matchup: number;
  gameNumber: number;
}

/**
 * Reads round, matchup and game number out of a playoff game id.
 * Returns null for a regular-season id or anything malformed.
 */
export function parsePlayoffGameId(gameId: number): PlayoffGameRef | null {
  const digits = String(gameId);
  if (digits.length !== 10) return null;
  if (digits.slice(4, 6) !== "03") return null;

  const round = Number(digits[7]);
  const matchup = Number(digits[8]);
  const gameNumber = Number(digits[9]);

  // A best-of-seven cannot reach game 8, and the bracket has four rounds.
  if (round < 1 || round > 4) return null;
  if (matchup < 1 || matchup > 8) return null;
  if (gameNumber < 1 || gameNumber > 7) return null;

  return { round, matchup, gameNumber };
}

/** The name broadcasters use, rather than "round 4". */
export function roundName(round: number): string {
  switch (round) {
    case 1:
      return "First Round";
    case 2:
      return "Second Round";
    case 3:
      return "Conference Finals";
    case 4:
      return "Stanley Cup Final";
    default:
      return `Round ${round}`;
  }
}

/** Wins needed to take a best-of-seven. */
export const WINS_TO_TAKE_SERIES = 4;

export interface TeamSide {
  abbrev: string | null;
  name: string | null;
  logoUrl: string | null;
  score: number | null;
}

export interface GameForSeries {
  id: number;
  date: string;
  gameType: number;
  seasonId: string;
  home: TeamSide;
  away: TeamSide;
}

export interface SeriesGame extends GameForSeries {
  gameNumber: number;
  /** Null for a tie or a game with no score recorded. */
  winnerAbbrev: string | null;
}

export interface SeriesSide {
  abbrev: string | null;
  name: string | null;
  logoUrl: string | null;
  wins: number;
}

export interface PlayoffSeries {
  key: string;
  seasonId: string;
  round: number;
  matchup: number;
  /** Two sides, the leader first. */
  sides: [SeriesSide, SeriesSide];
  games: SeriesGame[];
  /** True once a side reaches four wins. */
  decided: boolean;
  /** The most recent game date, used to order series. */
  latestDate: string;
}

function winnerOf(game: GameForSeries): string | null {
  const { home, away } = game;
  if (home.score == null || away.score == null) return null;
  if (home.score === away.score) return null;
  return home.score > away.score ? home.abbrev : away.abbrev;
}

/**
 * Splits games into playoff series and everything else.
 *
 * The series record counts only the games passed in. A caller that fetches a
 * partial playoff therefore sees a partial record, and `decided` stays false
 * until a side actually reaches four wins in the games present. That keeps the
 * label honest rather than guessing at games it cannot see.
 */
export function groupIntoSeries(games: GameForSeries[]): {
  series: PlayoffSeries[];
  otherGames: GameForSeries[];
} {
  const byKey = new Map<string, SeriesGame[]>();
  const otherGames: GameForSeries[] = [];

  for (const game of games) {
    const ref =
      game.gameType === GAME_TYPE_PLAYOFFS ? parsePlayoffGameId(game.id) : null;
    if (!ref) {
      otherGames.push(game);
      continue;
    }
    const key = `${game.seasonId}-${ref.round}-${ref.matchup}`;
    const entry: SeriesGame = {
      ...game,
      gameNumber: ref.gameNumber,
      winnerAbbrev: winnerOf(game),
    };
    const bucket = byKey.get(key);
    if (bucket) bucket.push(entry);
    else byKey.set(key, [entry]);
  }

  const series: PlayoffSeries[] = [];

  for (const [key, bucket] of byKey) {
    bucket.sort((a, b) => a.gameNumber - b.gameNumber);
    const first = bucket[0];
    const ref = parsePlayoffGameId(first.id)!;

    // Home and away swap through a series, so count wins by team, not by side.
    const wins = new Map<string, number>();
    for (const g of bucket) {
      if (g.winnerAbbrev) {
        wins.set(g.winnerAbbrev, (wins.get(g.winnerAbbrev) ?? 0) + 1);
      }
    }

    const identities = new Map<string, { name: string | null; logoUrl: string | null }>();
    for (const g of bucket) {
      for (const side of [g.home, g.away]) {
        if (side.abbrev && !identities.has(side.abbrev)) {
          identities.set(side.abbrev, { name: side.name, logoUrl: side.logoUrl });
        }
      }
    }

    const sides = Array.from(identities.entries())
      .map(([abbrev, id]) => ({
        abbrev,
        name: id.name,
        logoUrl: id.logoUrl,
        wins: wins.get(abbrev) ?? 0,
      }))
      .sort((a, b) => b.wins - a.wins || (a.abbrev ?? "").localeCompare(b.abbrev ?? ""));

    // A series always has two sides. Guard rather than assume, because a
    // partial fetch could in principle hand us something odd.
    if (sides.length !== 2) {
      otherGames.push(...bucket);
      continue;
    }

    series.push({
      key,
      seasonId: first.seasonId,
      round: ref.round,
      matchup: ref.matchup,
      sides: [sides[0], sides[1]],
      games: bucket,
      decided: sides[0].wins >= WINS_TO_TAKE_SERIES,
      latestDate: bucket.reduce((a, g) => (g.date > a ? g.date : a), bucket[0].date),
    });
  }

  // Most recent series first, then the deeper round when two end the same day.
  series.sort((a, b) => b.latestDate.localeCompare(a.latestDate) || b.round - a.round);

  return { series, otherGames };
}
