import { describe, it, expect } from "vitest";
import {
  parsePlayoffGameId,
  roundName,
  groupIntoSeries,
  type GameForSeries,
} from "./playoff-series";

describe("parsePlayoffGameId", () => {
  it("reads round, matchup and game number from a real Final id", () => {
    // 2025030416 is the 2025-26 Stanley Cup Final, game 6.
    expect(parsePlayoffGameId(2025030416)).toEqual({
      round: 4,
      matchup: 1,
      gameNumber: 6,
    });
  });

  it("reads a first-round id", () => {
    expect(parsePlayoffGameId(2025030182)).toEqual({
      round: 1,
      matchup: 8,
      gameNumber: 2,
    });
  });

  it("rejects a regular-season id", () => {
    expect(parsePlayoffGameId(2025020001)).toBeNull();
  });

  it("rejects a malformed id", () => {
    expect(parsePlayoffGameId(123)).toBeNull();
  });

  it("rejects an out-of-range round", () => {
    expect(parsePlayoffGameId(2025030916)).toBeNull();
  });

  it("rejects game 8 of a best-of-seven", () => {
    expect(parsePlayoffGameId(2025030418)).toBeNull();
  });
});

describe("roundName", () => {
  it("names each round the way broadcasters do", () => {
    expect(roundName(1)).toBe("First Round");
    expect(roundName(2)).toBe("Second Round");
    expect(roundName(3)).toBe("Conference Finals");
    expect(roundName(4)).toBe("Stanley Cup Final");
  });
});

function game(
  id: number,
  date: string,
  homeAbbrev: string,
  homeScore: number,
  awayAbbrev: string,
  awayScore: number,
  gameType = 3
): GameForSeries {
  return {
    id,
    date,
    gameType,
    seasonId: "20252026",
    home: { abbrev: homeAbbrev, name: homeAbbrev, logoUrl: null, score: homeScore },
    away: { abbrev: awayAbbrev, name: awayAbbrev, logoUrl: null, score: awayScore },
  };
}

/** The real 2025-26 Final: Carolina beat Vegas 4-2. */
const final = [
  game(2025030411, "2026-06-02", "CAR", 4, "VGK", 5),
  game(2025030412, "2026-06-04", "CAR", 4, "VGK", 3),
  game(2025030413, "2026-06-06", "VGK", 5, "CAR", 4),
  game(2025030414, "2026-06-09", "VGK", 3, "CAR", 5),
  game(2025030415, "2026-06-11", "CAR", 4, "VGK", 2),
  game(2025030416, "2026-06-14", "VGK", 0, "CAR", 3),
];

describe("groupIntoSeries", () => {
  it("counts wins across alternating home and away games", () => {
    const { series } = groupIntoSeries(final);
    expect(series).toHaveLength(1);
    expect(series[0].sides[0]).toMatchObject({ abbrev: "CAR", wins: 4 });
    expect(series[0].sides[1]).toMatchObject({ abbrev: "VGK", wins: 2 });
    expect(series[0].decided).toBe(true);
  });

  it("orders games by game number, not by input order", () => {
    const { series } = groupIntoSeries([...final].reverse());
    expect(series[0].games.map((g) => g.gameNumber)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("reports the latest date in the series", () => {
    const { series } = groupIntoSeries(final);
    expect(series[0].latestDate).toBe("2026-06-14");
  });

  it("keeps a partial series undecided rather than guessing", () => {
    const { series } = groupIntoSeries(final.slice(0, 3));
    expect(series[0].decided).toBe(false);
    expect(series[0].sides[0].wins).toBe(2);
  });

  it("separates regular-season games", () => {
    const regular = game(2025020001, "2025-10-08", "TOR", 3, "MTL", 2, 2);
    const { series, otherGames } = groupIntoSeries([...final, regular]);
    expect(series).toHaveLength(1);
    expect(otherGames).toEqual([regular]);
  });

  it("splits two matchups in the same round", () => {
    const other = [
      game(2025030321, "2026-05-20", "COL", 2, "VGK", 4),
      game(2025030322, "2026-05-22", "COL", 1, "VGK", 3),
    ];
    const { series } = groupIntoSeries([...final, ...other]);
    expect(series).toHaveLength(2);
    // Most recent first.
    expect(series[0].round).toBe(4);
    expect(series[1].round).toBe(3);
  });

  it("credits nobody when a game has no score", () => {
    const noScore: GameForSeries = {
      ...game(2025030411, "2026-06-02", "CAR", 0, "VGK", 0),
      home: { abbrev: "CAR", name: "CAR", logoUrl: null, score: null },
      away: { abbrev: "VGK", name: "VGK", logoUrl: null, score: null },
    };
    const { series } = groupIntoSeries([noScore]);
    expect(series[0].sides[0].wins).toBe(0);
    expect(series[0].sides[1].wins).toBe(0);
    expect(series[0].games[0].winnerAbbrev).toBeNull();
  });
});
