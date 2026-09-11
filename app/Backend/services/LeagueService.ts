export interface LeagueStats {
  name: string;
  slug: string;
  emblem: string | null;
  description: string;
  averageAge: number | null;
  totalActivePlayers: number;
  playersWithKnownNationality: number;
  foreignPlayerPercentage: number | null;
}

export interface LeagueService {
  getLeagueStatsBySlug(slug: string): Promise<LeagueStats | undefined>;
}
