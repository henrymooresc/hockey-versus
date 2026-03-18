/**
 * Parse "MM:SS" time string to total seconds.
 */
export function parseTimeToSeconds(time: string): number {
  const parts = time.split(":");
  if (parts.length !== 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * Format seconds to "MM:SS" string.
 */
export function formatSecondsToTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Format seconds to "HH:MM:SS" for longer durations (e.g., total shared TOI).
 */
export function formatSecondsToHMS(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Compute overlap in seconds between two time intervals [s1, e1] and [s2, e2].
 * Returns 0 if no overlap.
 */
export function intervalOverlap(
  s1: number,
  e1: number,
  s2: number,
  e2: number
): number {
  return Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
}

/**
 * Given two lists of shifts (each as {start, end} in seconds within the same period),
 * compute total overlap seconds and the merged overlap intervals.
 */
export interface Interval {
  start: number;
  end: number;
}

export function computeShiftOverlaps(
  shiftsA: Interval[],
  shiftsB: Interval[]
): { totalSeconds: number; intervals: Interval[] } {
  const intervals: Interval[] = [];
  let totalSeconds = 0;

  for (const a of shiftsA) {
    for (const b of shiftsB) {
      const overlapStart = Math.max(a.start, b.start);
      const overlapEnd = Math.min(a.end, b.end);
      if (overlapStart < overlapEnd) {
        intervals.push({ start: overlapStart, end: overlapEnd });
        totalSeconds += overlapEnd - overlapStart;
      }
    }
  }

  return { totalSeconds, intervals };
}

/**
 * Check if a point in time falls within any of the given intervals.
 */
export function isTimeInIntervals(
  time: number,
  intervals: Interval[]
): boolean {
  return intervals.some((iv) => time >= iv.start && time <= iv.end);
}
