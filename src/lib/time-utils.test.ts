import { describe, it, expect } from "vitest";
import {
  parseTimeToSeconds,
  formatSecondsToTime,
  formatSecondsToHMS,
  intervalOverlap,
  mergeIntervals,
  computeShiftOverlaps,
  isTimeInIntervals,
} from "./time-utils";

describe("parseTimeToSeconds", () => {
  it("parses MM:SS correctly", () => {
    expect(parseTimeToSeconds("00:00")).toBe(0);
    expect(parseTimeToSeconds("01:00")).toBe(60);
    expect(parseTimeToSeconds("12:34")).toBe(754);
    expect(parseTimeToSeconds("20:00")).toBe(1200);
  });

  it("returns 0 for invalid input", () => {
    expect(parseTimeToSeconds("invalid")).toBe(0);
    expect(parseTimeToSeconds("")).toBe(0);
  });
});

describe("formatSecondsToTime", () => {
  it("formats seconds to MM:SS", () => {
    expect(formatSecondsToTime(0)).toBe("00:00");
    expect(formatSecondsToTime(60)).toBe("01:00");
    expect(formatSecondsToTime(754)).toBe("12:34");
    expect(formatSecondsToTime(1200)).toBe("20:00");
  });

  it("round-trips with parseTimeToSeconds", () => {
    const times = ["00:00", "05:30", "12:34", "19:59"];
    for (const t of times) {
      expect(formatSecondsToTime(parseTimeToSeconds(t))).toBe(t);
    }
  });
});

describe("formatSecondsToHMS", () => {
  it("formats seconds to HH:MM:SS", () => {
    expect(formatSecondsToHMS(0)).toBe("00:00:00");
    expect(formatSecondsToHMS(3600)).toBe("01:00:00");
    expect(formatSecondsToHMS(3661)).toBe("01:01:01");
    expect(formatSecondsToHMS(7384)).toBe("02:03:04");
  });
});

describe("intervalOverlap", () => {
  it("returns 0 when no overlap", () => {
    expect(intervalOverlap(0, 10, 20, 30)).toBe(0);
    expect(intervalOverlap(20, 30, 0, 10)).toBe(0);
  });

  it("computes overlap correctly", () => {
    expect(intervalOverlap(0, 30, 20, 50)).toBe(10);
    expect(intervalOverlap(0, 60, 10, 40)).toBe(30);
    expect(intervalOverlap(0, 60, 0, 60)).toBe(60);
  });

  it("returns 0 when intervals only touch at a point", () => {
    expect(intervalOverlap(0, 10, 10, 20)).toBe(0);
  });
});

describe("mergeIntervals", () => {
  it("returns empty array for empty input", () => {
    expect(mergeIntervals([])).toEqual([]);
  });

  it("returns single interval unchanged", () => {
    expect(mergeIntervals([{ start: 0, end: 10 }])).toEqual([{ start: 0, end: 10 }]);
  });

  it("merges overlapping intervals", () => {
    const result = mergeIntervals([
      { start: 0, end: 20 },
      { start: 10, end: 30 },
    ]);
    expect(result).toEqual([{ start: 0, end: 30 }]);
  });

  it("merges adjacent intervals", () => {
    const result = mergeIntervals([
      { start: 0, end: 10 },
      { start: 10, end: 20 },
    ]);
    expect(result).toEqual([{ start: 0, end: 20 }]);
  });

  it("keeps non-overlapping intervals separate", () => {
    const result = mergeIntervals([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ]);
    expect(result).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ]);
  });

  it("handles unsorted input", () => {
    const result = mergeIntervals([
      { start: 20, end: 30 },
      { start: 0, end: 10 },
    ]);
    expect(result).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ]);
  });
});

describe("computeShiftOverlaps", () => {
  it("returns 0 overlap when no shifts overlap", () => {
    const { totalSeconds, intervals } = computeShiftOverlaps(
      [{ start: 0, end: 10 }],
      [{ start: 20, end: 30 }]
    );
    expect(totalSeconds).toBe(0);
    expect(intervals).toEqual([]);
  });

  it("computes overlap between two shifts", () => {
    const { totalSeconds, intervals } = computeShiftOverlaps(
      [{ start: 0, end: 30 }],
      [{ start: 20, end: 50 }]
    );
    expect(totalSeconds).toBe(10);
    expect(intervals).toEqual([{ start: 20, end: 30 }]);
  });

  it("sums overlaps across multiple shift pairs", () => {
    const { totalSeconds } = computeShiftOverlaps(
      [{ start: 0, end: 20 }, { start: 40, end: 60 }],
      [{ start: 10, end: 50 }]
    );
    // First pair: 10-20 = 10s, Second pair: 40-50 = 10s
    expect(totalSeconds).toBe(20);
  });
});

describe("isTimeInIntervals", () => {
  const intervals = [
    { start: 10, end: 20 },
    { start: 40, end: 60 },
  ];

  it("returns true when time is within an interval", () => {
    expect(isTimeInIntervals(15, intervals)).toBe(true);
    expect(isTimeInIntervals(50, intervals)).toBe(true);
  });

  it("returns true at interval boundaries", () => {
    expect(isTimeInIntervals(10, intervals)).toBe(true);
    expect(isTimeInIntervals(20, intervals)).toBe(true);
  });

  it("returns false when time is between intervals", () => {
    expect(isTimeInIntervals(30, intervals)).toBe(false);
  });

  it("returns false when time is outside all intervals", () => {
    expect(isTimeInIntervals(5, intervals)).toBe(false);
    expect(isTimeInIntervals(70, intervals)).toBe(false);
  });
});
