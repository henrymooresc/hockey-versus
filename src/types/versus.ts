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

export interface VersusSeasonStats {
  seasonId: string;
  sameTeam: boolean;
  gamesShared: number;
  toiSharedSeconds: number;
  winsA: number;
  winsB: number;
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
  individualShots: number;
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

export interface RivalEntry {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string | null;
  headshotUrl: string | null;
  teamAbbrev: string | null;
  teamLogoUrl: string | null;
  value: number;
  opponentValue: number;
  toiSharedSeconds: number;
  gamesShared: number;
  breakdown?: { goals: number; assists: number; shots?: number };
  opponentBreakdown?: { goals: number; assists: number; shots?: number };
}

export interface StatRivals {
  label: string;
  top: RivalEntry[];
  bottom: RivalEntry[];
  hideOpponentValue?: boolean;
  valueFormat?: "savePct";
}

export interface UpcomingGame {
  gameId: number;
  gameDate: string;
  opponentTeamId: number;
  opponentAbbrev: string;
  opponentLogoUrl: string | null;
  isHome: boolean;
}

export interface MatchupPlayer {
  playerId: number;
  firstName: string;
  lastName: string;
  position: string | null;
  headshotUrl: string | null;
  sweaterNumber: number | null;
  gamesShared: number;
  toiSharedSeconds: number;
  stats: {
    points: number;
    goals: number;
    assists: number;
    individualShots: number;
    shotsFor: number;
    shotsAgainst: number;
    goalsFor: number;
    goalsAgainst: number;
    hits: number;
    penalties: number;
    faceoffWins: number;
  };
  oppStats: {
    points: number;
    goals: number;
    assists: number;
    individualShots: number;
    shotsFor: number;
    shotsAgainst: number;
    goalsFor: number;
    goalsAgainst: number;
    hits: number;
    penalties: number;
    faceoffWins: number;
  };
}
