import { rateLimitedFetch } from "../../scripts/lib/rate-limiter";
import type {
  ScheduleResponse,
  PlayByPlayResponse,
  ShiftChartResponse,
  BoxscoreResponse,
  PlayerLandingResponse,
  StandingsResponse,
  ClubSeasonScheduleResponse,
} from "@/types/nhl-api";

const WEB_API = "https://api-web.nhle.com";
const STATS_API = "https://api.nhle.com/stats/rest";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await rateLimitedFetch(url);
  if (!response.ok) {
    throw new Error(`NHL API error: ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json() as Promise<T>;
}

// Schedule
export function getSchedule(date: string): Promise<ScheduleResponse> {
  return fetchJson(`${WEB_API}/v1/schedule/${date}`);
}

export function getScheduleNow(): Promise<ScheduleResponse> {
  return fetchJson(`${WEB_API}/v1/schedule/now`);
}

// Club season schedule (to get all games for a team in a season)
export function getClubSeasonSchedule(
  teamAbbrev: string,
  season: string
): Promise<ClubSeasonScheduleResponse> {
  return fetchJson(
    `${WEB_API}/v1/club-schedule-season/${teamAbbrev}/${season}`
  );
}

// Play-by-play
export function getPlayByPlay(gameId: number): Promise<PlayByPlayResponse> {
  return fetchJson(`${WEB_API}/v1/gamecenter/${gameId}/play-by-play`);
}

// Boxscore
export function getBoxscore(gameId: number): Promise<BoxscoreResponse> {
  return fetchJson(`${WEB_API}/v1/gamecenter/${gameId}/boxscore`);
}

// Shift charts
export function getShiftChart(gameId: number): Promise<ShiftChartResponse> {
  return fetchJson(
    `${STATS_API}/en/shiftcharts?cayenneExp=gameId=${gameId}`
  );
}

// Player info
export function getPlayerLanding(
  playerId: number
): Promise<PlayerLandingResponse> {
  return fetchJson(`${WEB_API}/v1/player/${playerId}/landing`);
}

// Standings (for team discovery)
export function getStandings(): Promise<StandingsResponse> {
  return fetchJson(`${WEB_API}/v1/standings/now`);
}
