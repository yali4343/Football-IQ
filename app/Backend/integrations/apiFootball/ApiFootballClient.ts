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
}
