/**
 * Shared season helpers for ingestion and computation scripts.
 *
 * Default behaviour (no --seasons flag): current season only.
 * Bulk runs: --seasons 20242025,20232024,20222023
 */

export function getCurrentSeasonId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 0-indexed
  // NHL season starts in October; before October we're still in the prior year's season.
  const startYear = month >= 10 ? year : year - 1;
  return `${startYear}${startYear + 1}`;
}

/**
 * Returns the list of season IDs to process.
 * - No flag  → [currentSeason]
 * - --seasons 20242025,20232024  → [20242025, 20232024]
 */
export function parseTargetSeasons(): string[] {
  const val = process.argv.find((_, i, a) => a[i - 1] === "--seasons");
  if (val) return val.split(",").map((s) => s.trim());
  return [getCurrentSeasonId()];
}
