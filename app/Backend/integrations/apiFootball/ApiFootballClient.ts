export interface ApiFootballTeam {
  id: number;
  name: string;
  code: string | null;
}

export interface ApiFootballSquadPlayer {
  id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string;
  photo: string | null;
}

// Deliberately excludes `injured`: API-Football's free plan only allows
// season=2022-2024 on /players, and unlike the other bio fields (fixed
// facts, not season-versioned), `injured` is a live status flag whose
// currency relative to that season couldn't be confirmed — see the
// player-profile-modal plan notes.
export interface ApiFootballPlayerProfile {
  id: number;
  name: string;
  firstname: string | null;
  lastname: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  birthCountry: string | null;
  nationality: string | null;
  height: string | null;
  weight: string | null;
  photo: string | null;
}

export interface ApiFootballClient {
  /** Whether it's currently safe to make another request without risking the daily quota. */
  hasQuotaRemaining(): boolean;
  /** Requests used today, or null if no request has been made yet this run. */
  getRequestsUsed(): number | null;
  getLeagueDirectory(
    leagueId: number,
    season: number,
  ): Promise<ApiFootballTeam[]>;
  searchTeam(name: string): Promise<ApiFootballTeam[]>;
  getSquad(teamId: number): Promise<ApiFootballSquadPlayer[]>;
  getPlayerProfile(
    playerId: number,
    season: number,
  ): Promise<ApiFootballPlayerProfile | null>;
}
