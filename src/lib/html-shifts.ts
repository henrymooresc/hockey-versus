/**
 * Fallback shift chart parser that scrapes NHL HTML shift reports
 * when the Stats API returns empty data.
 *
 * HTML reports are at:
 *   https://www.nhl.com/scores/htmlreports/{seasonId}/TV{gameSuffix}.HTM  (visitor)
 *   https://www.nhl.com/scores/htmlreports/{seasonId}/TH{gameSuffix}.HTM  (home)
 */
import { rateLimitedFetch } from "../../scripts/lib/rate-limiter";
import type {
  ShiftChartResponse,
  ShiftEntry,
  RosterSpot,
} from "@/types/nhl-api";

const NHL_REPORTS_BASE = "https://www.nhl.com/scores/htmlreports";

/**
 * Build the HTML shift report URL for a given game and team side.
 *
 * Game ID format: 2025020171 → season prefix "2025", suffix "020171"
 * Season ID format: "20252026"
 */
function buildReportUrl(
  gameId: number,
  seasonId: string,
  side: "home" | "visitor"
): string {
  const gameSuffix = String(gameId).slice(4); // e.g. "020171"
  const prefix = side === "home" ? "TH" : "TV";
  return `${NHL_REPORTS_BASE}/${seasonId}/${prefix}${gameSuffix}.HTM`;
}

/**
 * Build a lookup map from sweater number → roster info, keyed per team.
 */
function buildRosterLookup(rosterSpots: RosterSpot[]) {
  // Map: teamId → Map<sweaterNumber, RosterSpot>
  const lookup = new Map<number, Map<number, RosterSpot>>();
  for (const spot of rosterSpots) {
    if (!lookup.has(spot.teamId)) lookup.set(spot.teamId, new Map());
    lookup.get(spot.teamId)!.set(spot.sweaterNumber, spot);
  }
  return lookup;
}

/**
 * Parse a single HTML shift report (one team) and return ShiftEntry[].
 *
 * The HTML structure per player:
 *   <td class="playerHeading + border" colspan="8">3 PELECH, ADAM</td>
 * followed by shift rows with class "oddColor" or "evenColor":
 *   <td>1</td>          shift number
 *   <td>1</td>          period
 *   <td>0:00 / 20:00</td>  start (elapsed / game clock)
 *   <td>0:33 / 19:27</td>  end (elapsed / game clock)
 *   <td>00:33</td>      duration
 *   <td>&nbsp;</td>     event
 */
function parseShiftReportHtml(
  html: string,
  gameId: number,
  teamId: number,
  teamAbbrev: string,
  teamName: string,
  rosterByNumber: Map<number, RosterSpot>
): ShiftEntry[] {
  const entries: ShiftEntry[] = [];
  let syntheticId = 0;

  // Find all player heading cells: class contains "playerHeading"
  // Pattern: <td ... class="playerHeading + border" ...>NUMBER LAST, FIRST</td>
  const playerHeadingRe =
    /class="playerHeading[^"]*"[^>]*>\s*(\d+)\s+([^<]+)<\/td>/g;

  // Find all shift data rows (oddColor or evenColor classes on <tr>)
  // We need to associate shifts with the preceding player heading.
  // Strategy: split HTML by player headings, parse shifts in each section.

  // Collect player heading positions and info
  const players: {
    sweaterNumber: number;
    nameText: string;
    htmlIndex: number;
  }[] = [];

  let match;
  while ((match = playerHeadingRe.exec(html)) !== null) {
    players.push({
      sweaterNumber: parseInt(match[1], 10),
      nameText: match[2].trim(), // "PELECH, ADAM"
      htmlIndex: match.index,
    });
  }

  // Shift row pattern within a section
  const shiftRowRe =
    /class="\s*(?:oddColor|evenColor)\s*">\s*<td[^>]*>\s*(\d+)\s*<\/td>\s*<td[^>]*>\s*(\d+)\s*<\/td>\s*<td[^>]*>\s*(\d+:\d+)\s*\/\s*\d+:\d+\s*<\/td>\s*<td[^>]*>\s*(\d+:\d+)\s*\/\s*\d+:\d+\s*<\/td>\s*<td[^>]*>\s*(\d+:\d+)\s*<\/td>\s*<td[^>]*>\s*([^<]*)<\/td>/g;

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const sectionStart = player.htmlIndex;
    const sectionEnd =
      i + 1 < players.length ? players[i + 1].htmlIndex : html.length;
    const section = html.slice(sectionStart, sectionEnd);

    // Resolve player ID from roster
    const rosterSpot = rosterByNumber.get(player.sweaterNumber);
    if (!rosterSpot) continue; // skip players not in roster lookup

    const nameParts = player.nameText.split(",");
    const lastName = nameParts[0]?.trim() ?? "";
    const firstName = nameParts[1]?.trim() ?? "";

    // Parse shifts in this section
    shiftRowRe.lastIndex = 0;
    let shiftMatch;
    while ((shiftMatch = shiftRowRe.exec(section)) !== null) {
      const shiftNumber = parseInt(shiftMatch[1], 10);
      const period = parseInt(shiftMatch[2], 10);
      const startTime = shiftMatch[3]; // elapsed time e.g. "0:00"
      const endTime = shiftMatch[4];
      const duration = shiftMatch[5];
      const eventDesc = shiftMatch[6].replace(/&nbsp;/g, "").trim() || null;

      entries.push({
        id: syntheticId++,
        detailCode: 0,
        duration,
        endTime,
        eventDescription: eventDesc,
        eventDetails: null,
        eventNumber: 0,
        firstName,
        gameId,
        hexValue: "",
        lastName,
        period,
        playerId: rosterSpot.playerId,
        shiftNumber,
        startTime,
        teamAbbrev,
        teamId,
        teamName,
        typeCode: 0,
      });
    }
  }

  return entries;
}

/**
 * Fetch shift chart data from NHL HTML reports as a fallback.
 * Returns data in the same shape as the Stats API response.
 */
export async function getShiftChartFromHtml(
  gameId: number,
  seasonId: string,
  homeTeam: { id: number; abbrev: string; name: string },
  awayTeam: { id: number; abbrev: string; name: string },
  rosterSpots: RosterSpot[]
): Promise<ShiftChartResponse> {
  const rosterLookup = buildRosterLookup(rosterSpots);

  const visitorUrl = buildReportUrl(gameId, seasonId, "visitor");
  const homeUrl = buildReportUrl(gameId, seasonId, "home");

  const [visitorHtml, homeHtml] = await Promise.all([
    rateLimitedFetch(visitorUrl).then((r) => {
      if (!r.ok)
        throw new Error(`HTML report error: ${r.status} for ${visitorUrl}`);
      return r.text();
    }),
    rateLimitedFetch(homeUrl).then((r) => {
      if (!r.ok)
        throw new Error(`HTML report error: ${r.status} for ${homeUrl}`);
      return r.text();
    }),
  ]);

  const visitorShifts = parseShiftReportHtml(
    visitorHtml,
    gameId,
    awayTeam.id,
    awayTeam.abbrev,
    awayTeam.name,
    rosterLookup.get(awayTeam.id) ?? new Map()
  );

  const homeShifts = parseShiftReportHtml(
    homeHtml,
    gameId,
    homeTeam.id,
    homeTeam.abbrev,
    homeTeam.name,
    rosterLookup.get(homeTeam.id) ?? new Map()
  );

  const data = [...visitorShifts, ...homeShifts];
  return { data, total: data.length };
}
