/**
 * NHL divisions, as a constant rather than a column.
 *
 * `teams` holds no division or conference, and adding one would mean an
 * ingestion change to fill it. The alignment changes at most once a season and
 * is already correct here, so the constant stays and the table does not grow.
 *
 * "Other" catches a relocated or renamed club whose abbreviation has not been
 * added yet, so a missing entry drops a team into its own group rather than
 * out of the list entirely.
 */
export const DIVISIONS: Record<string, string[]> = {
  Atlantic:     ["BOS", "BUF", "DET", "FLA", "MTL", "OTT", "TBL", "TOR"],
  Metropolitan: ["CAR", "CBJ", "NJD", "NYI", "NYR", "PHI", "PIT", "WSH"],
  Central:      ["CHI", "COL", "DAL", "MIN", "NSH", "STL", "UTA", "WPG"],
  Pacific:      ["ANA", "CGY", "EDM", "LAK", "SJS", "SEA", "VAN", "VGK"],
};

export const DIVISION_ORDER = [
  "Atlantic",
  "Metropolitan",
  "Central",
  "Pacific",
  "Other",
];

/** Eastern conference first, matching how standings are usually presented. */
export const CONFERENCES: Record<string, string[]> = {
  Eastern: ["Atlantic", "Metropolitan"],
  Western: ["Central", "Pacific"],
};

export function abbrevToDivision(abbrev: string | null): string {
  if (!abbrev) return "Other";
  for (const [division, abbrevs] of Object.entries(DIVISIONS)) {
    if (abbrevs.includes(abbrev)) return division;
  }
  return "Other";
}
