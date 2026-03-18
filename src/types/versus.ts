export interface PlayerInfo {
  id: number;
  firstName: string;
  lastName: string;
  position: string | null;
  headshotUrl: string | null;
  teamAbbrev: string | null;
  teamId: number | null;
  sweaterNumber: number | null;
}

export interface VersusSeasonStats {
  seasonId: string;
  sameTeam: boolean;
  gamesShared: number;
  toiSharedSeconds: number;
  playerA: VersusPlayerSeasonStats;
  playerB: VersusPlayerSeasonStats;
}

export interface VersusPlayerSeasonStats {
  teamId: number | null;
  goalsFor: number;
  goalsAgainst: number;
  shotsFor: number;
  shotsAgainst: number;
  hits: number;
  penalties: number;
  faceoffWins: number;
  individualGoals: number;
  individualAssists: number;
}

export interface VersusResult {
  playerA: PlayerInfo;
  playerB: PlayerInfo;
  seasons: VersusSeasonStats[];
  totals: VersusSeasonStats;
}

export interface PlayerSearchResult {
  id: number;
  firstName: string;
  lastName: string;
  position: string | null;
  headshotUrl: string | null;
  teamAbbrev: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
}
