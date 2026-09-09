export interface FootballDataArea {
  id: number;
  name: string;
  code: string | null;
  flag: string | null;
}

export interface FootballDataCompetition {
  id: number;
  name: string;
  code: string | null;
  type: string | null;
  emblem: string | null;
}

export interface FootballDataCoach {
  id: number;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  contractStart: string | null;
  contractUntil: string | null;
}

export interface FootballDataTeam {
  id: number;
  name: string;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
  address: string | null;
  website: string | null;
  founded: number | null;
  clubColors: string | null;
  venue: string | null;
  area: FootballDataArea | null;
  runningCompetitions: FootballDataCompetition[];
  coach: FootballDataCoach | null;
  lastUpdated: string | null;
}

export interface FootballDataClient {
  getCompetitionTeams(footballDataId: number): Promise<FootballDataTeam[]>;
}
