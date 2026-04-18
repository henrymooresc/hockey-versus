import { describe, it, expect } from "vitest";
import { computeGameVersus, type ShiftRecord, type EventRecord } from "./versus-engine";

// Two players on opposing teams sharing a 60-second shift
const shiftsBasic: ShiftRecord[] = [
  { playerId: 1, teamId: 10, period: 1, startSeconds: 0, endSeconds: 60 },
  { playerId: 2, teamId: 20, period: 1, startSeconds: 0, endSeconds: 60 },
];

describe("computeGameVersus", () => {
  it("returns empty map when no shifts", () => {
    const result = computeGameVersus([], []);
    expect(result.size).toBe(0);
  });

  it("returns empty map when players have no overlapping ice time", () => {
    const shifts: ShiftRecord[] = [
      { playerId: 1, teamId: 10, period: 1, startSeconds: 0, endSeconds: 30 },
      { playerId: 2, teamId: 20, period: 1, startSeconds: 60, endSeconds: 90 },
    ];
    const result = computeGameVersus(shifts, []);
    expect(result.size).toBe(0);
  });

  it("creates a pair for two players with overlapping shifts", () => {
    const result = computeGameVersus(shiftsBasic, []);
    expect(result.has("1-2")).toBe(true);
  });

  it("uses lower player ID as playerA", () => {
    const result = computeGameVersus(shiftsBasic, []);
    const pair = result.get("1-2")!;
    expect(pair.playerAId).toBe(1);
    expect(pair.playerBId).toBe(2);
  });

  it("computes correct shared TOI", () => {
    const result = computeGameVersus(shiftsBasic, []);
    expect(result.get("1-2")!.toiSharedSeconds).toBe(60);
  });

  it("correctly identifies same-team vs opposing pairs", () => {
    const sameteamShifts: ShiftRecord[] = [
      { playerId: 1, teamId: 10, period: 1, startSeconds: 0, endSeconds: 60 },
      { playerId: 2, teamId: 10, period: 1, startSeconds: 0, endSeconds: 60 },
    ];
    const opposingResult = computeGameVersus(shiftsBasic, []);
    const sameteamResult = computeGameVersus(sameteamShifts, []);

    expect(opposingResult.get("1-2")!.sameTeam).toBe(false);
    expect(sameteamResult.get("1-2")!.sameTeam).toBe(true);
  });

  it("counts goals for and against correctly for opposing teams", () => {
    const events: EventRecord[] = [
      // Team 10 scores while players 1 and 2 share ice
      {
        eventType: "goal",
        period: 1,
        timeSeconds: 30,
        teamId: 10,
        player1Id: 1,
        player2Id: null,
        player3Id: null,
      },
    ];
    const result = computeGameVersus(shiftsBasic, events);
    const pair = result.get("1-2")!;

    expect(pair.goalsForA).toBe(1);   // team A scored
    expect(pair.goalsAgainstB).toBe(1); // team B conceded
    expect(pair.goalsForB).toBe(0);
    expect(pair.goalsAgainstA).toBe(0);
    expect(pair.playerAGoals).toBe(1); // player 1 scored
    expect(pair.playerBGoals).toBe(0);
  });

  it("counts hits between the two players", () => {
    const events: EventRecord[] = [
      {
        eventType: "hit",
        period: 1,
        timeSeconds: 30,
        teamId: 10,
        player1Id: 1, // hitter
        player2Id: 2, // hittee
        player3Id: null,
      },
    ];
    const result = computeGameVersus(shiftsBasic, events);
    const pair = result.get("1-2")!;

    expect(pair.hitsByA).toBe(1);
    expect(pair.hitsByB).toBe(0);
  });

  it("counts faceoff wins", () => {
    const events: EventRecord[] = [
      {
        eventType: "faceoff",
        period: 1,
        timeSeconds: 0,
        teamId: 10,
        player1Id: 2, // player 2 wins faceoff
        player2Id: 1,
        player3Id: null,
      },
    ];
    const result = computeGameVersus(shiftsBasic, events);
    const pair = result.get("1-2")!;

    expect(pair.faceoffWinsB).toBe(1);
    expect(pair.faceoffWinsA).toBe(0);
  });

  it("ignores events outside of shared ice time", () => {
    const shifts: ShiftRecord[] = [
      { playerId: 1, teamId: 10, period: 1, startSeconds: 0, endSeconds: 30 },
      { playerId: 2, teamId: 20, period: 1, startSeconds: 0, endSeconds: 30 },
    ];
    const events: EventRecord[] = [
      {
        eventType: "goal",
        period: 1,
        timeSeconds: 60, // after both are off ice
        teamId: 10,
        player1Id: 1,
        player2Id: null,
        player3Id: null,
      },
    ];
    const result = computeGameVersus(shifts, events);
    const pair = result.get("1-2")!;
    expect(pair.goalsForA).toBe(0);
  });

  it("handles multiple players and creates all overlapping pairs", () => {
    const shifts: ShiftRecord[] = [
      { playerId: 1, teamId: 10, period: 1, startSeconds: 0, endSeconds: 60 },
      { playerId: 2, teamId: 20, period: 1, startSeconds: 0, endSeconds: 60 },
      { playerId: 3, teamId: 10, period: 1, startSeconds: 0, endSeconds: 60 },
    ];
    const result = computeGameVersus(shifts, []);
    expect(result.has("1-2")).toBe(true);
    expect(result.has("1-3")).toBe(true);
    expect(result.has("2-3")).toBe(true);
  });
});
