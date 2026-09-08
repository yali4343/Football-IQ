export interface ApiFootballTeam {
  id: number;
  name: string;
  code: string | null;
}

export interface ApiFootballClient {
  /** Whether it's currently safe to make another request without risking the daily quota. */
  hasQuotaRemaining(): boolean;
  getLeagueDirectory(
    leagueId: number,
    season: number,
  ): Promise<ApiFootballTeam[]>;
  searchTeam(name: string): Promise<ApiFootballTeam[]>;
}
