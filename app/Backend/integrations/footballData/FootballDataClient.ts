export interface FootballDataTeam {
  id: number;
  name: string;
  venue: string | null;
  tla: string | null;
}

export interface FootballDataClient {
  getCompetitionTeams(footballDataId: number): Promise<FootballDataTeam[]>;
}
