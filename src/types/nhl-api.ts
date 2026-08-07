// Schedule / Game discovery
export interface ScheduleResponse {
  nextStartDate: string;
  previousStartDate: string;
  gameWeek: GameWeek[];
}

export interface GameWeek {
  date: string;
  dayAbbrev: string;
  numberOfGames: number;
  games: ScheduleGame[];
}

export interface ScheduleGame {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  gameState: string;
  homeTeam: {
    id: number;
    abbrev: string;
    score?: number;
  };
  awayTeam: {
    id: number;
    abbrev: string;
    score?: number;
  };
}

// Club season schedule
export interface ClubSeasonScheduleResponse {
  games: ClubScheduleGame[];
}

export interface ClubScheduleGame {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  gameState: string;
  homeTeam: {
    id: number;
    abbrev: string;
    score?: number;
    commonName?: { default: string };
  };
  awayTeam: {
    id: number;
    abbrev: string;
    score?: number;
    commonName?: { default: string };
  };
}

// Play-by-play
export interface PlayByPlayResponse {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  homeTeam: {
    id: number;
    abbrev: string;
  };
  awayTeam: {
    id: number;
    abbrev: string;
  };
  plays: Play[];
  rosterSpots: RosterSpot[];
}

export interface Play {
  eventId: number;
  periodDescriptor: {
    number: number;
    periodType: string;
  };
  timeInPeriod: string;
  timeRemaining: string;
  situationCode: string;
  typeDescKey: string;
  typeCode: number;
  details?: PlayDetails;
}

export interface PlayDetails {
  eventOwnerTeamId?: number;
  xCoord?: number;
  yCoord?: number;
  scoringPlayerId?: number;
  assist1PlayerId?: number;
  assist2PlayerId?: number;
  shootingPlayerId?: number;
  goalieInNetId?: number;
  hittingPlayerId?: number;
  hitteePlayerId?: number;
  winningPlayerId?: number;
  losingPlayerId?: number;
  committedByPlayerId?: number;
  drawnByPlayerId?: number;
  blockingPlayerId?: number;
  playerId?: number;
  reason?: string;
  descKey?: string;
  /** O, D or N. */
  zoneCode?: string;
  /** wrist, slap, snap, tip-in, backhand, and so on. */
  shotType?: string;
  /** Penalty minutes served. */
  duration?: number;
  /** Penalty class: MIN, MAJ or MIS. */
  typeCode?: string;
  /** Running score, present on goals. */
  homeScore?: number;
  awayScore?: number;
  /** Running shots on goal, present on shots. */
  homeSOG?: number;
  awaySOG?: number;
}

export interface RosterSpot {
  teamId: number;
  playerId: number;
  firstName: { default: string };
  lastName: { default: string };
  positionCode: string;
  headshot: string;
  sweaterNumber: number;
}

// Shift charts (Stats API)
export interface ShiftChartResponse {
  data: ShiftEntry[];
  total: number;
}

export interface ShiftEntry {
  id: number;
  detailCode: number;
  duration: string;
  endTime: string;
  eventDescription: string | null;
  eventDetails: string | null;
  eventNumber: number;
  firstName: string;
  gameId: number;
  hexValue: string;
  lastName: string;
  period: number;
  playerId: number;
  shiftNumber: number;
  startTime: string;
  teamAbbrev: string;
  teamId: number;
  teamName: string;
  typeCode: number;
}

// Boxscore
export interface BoxscoreResponse {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  homeTeam: BoxscoreTeam;
  awayTeam: BoxscoreTeam;
  playerByGameStats: {
    homeTeam: {
      forwards: BoxscorePlayerStats[];
      defense: BoxscorePlayerStats[];
      goalies: BoxscorePlayerStats[];
    };
    awayTeam: {
      forwards: BoxscorePlayerStats[];
      defense: BoxscorePlayerStats[];
      goalies: BoxscorePlayerStats[];
    };
  };
}

export interface BoxscoreTeam {
  id: number;
  abbrev: string;
  score: number;
  commonName?: { default: string };
}

export interface BoxscorePlayerStats {
  playerId: number;
  name: { default: string };
  position: string;
  sweaterNumber: number;
  goals?: number;
  assists?: number;
  points?: number;
  shots?: number;
  hits?: number;
  toi?: string;
}

// Player landing
export interface PlayerLandingResponse {
  playerId: number;
  isActive: boolean;
  firstName: { default: string };
  lastName: { default: string };
  position: string;
  shootsCatches: string;
  headshot: string;
  birthDate: string;
  currentTeamId?: number;
  currentTeamAbbrev?: string;
  sweaterNumber?: number;
}

// Standings
export interface StandingsResponse {
  standings: StandingsTeam[];
}

export interface StandingsTeam {
  teamAbbrev: { default: string };
  teamCommonName: { default: string };
  teamName: { default: string };
  teamLogo: string;
}
