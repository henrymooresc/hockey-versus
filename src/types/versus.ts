export interface PlayerInfo {
  id: number;
  firstName: string;
  lastName: string;
  position: string | null;
  headshotUrl: string | null;
  teamAbbrev: string | null;
  teamLogoUrl: string | null;
  teamId: number | null;
  sweaterNumber: number | null;
}

export interface PlayerSearchResult {
  id: number;
  firstName: string;
  lastName: string;
  position: string | null;
  headshotUrl: string | null;
  sweaterNumber: number | null;
  birthDate: string | null;
  teamAbbrev: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
}

/**
 * Everything a player needs to appear in a bio card.
 *
 * `MatchupPlayer`, `PlayerSearchResult` and the leaderboard player shape all
 * satisfy this, so any of them can sit on either side of a matchup.
 */
export interface BioPlayer {
  firstName: string;
  lastName: string;
  position: string | null;
  headshotUrl: string | null;
  sweaterNumber: number | null;
  birthDate: string | null;
  teamAbbrev: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
}

export interface UpcomingGame {
  gameId: number;
  gameDate: string;
  opponentTeamId: number;
  opponentAbbrev: string;
  opponentLogoUrl: string | null;
  isHome: boolean;
}

export interface MatchupPlayerStats {
  points: number;
  goals: number;
  assists: number;
  individualShots: number;
  shotsFor: number;
  shotsAgainst: number;
  goalsFor: number;
  goalsAgainst: number;
  hits: number;
  blocks: number;
  penalties: number;
  faceoffWins: number;
}

export interface MatchupPlayer {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string | null;
  headshotUrl: string | null;
  sweaterNumber: number | null;
  birthDate: string | null;
  teamAbbrev: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
  gamesShared: number;
  toiSharedSeconds: number;
  rivalryScore: number;
  stats: MatchupPlayerStats;
  oppStats: MatchupPlayerStats;
}

export interface RivalSeasonHistory {
  seasonId: string;
  label: string;
  rivalryScore: number;
  gamesShared: number;
}

export interface RivalGameHistory {
  gameId: number;
  gameDate: string;
  seasonId: string;
  label: string;
  rivalryScore: number;
  toiSharedSeconds: number;
}

export interface StandingsEntry {
  abbrev: string;
  points: number;
  wins: number;
  losses: number;
  otLosses: number;
  gamesPlayed: number;
  l10Record: string;
  streak: string;
}
