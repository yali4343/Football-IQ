export interface LeagueMembershipSummary {
  leagueName: string;
  clubsCreated: number;
  clubsUpdated: number;
  clubsDeactivated: number;
  failed: boolean;
  error?: string;
}

export interface SyncSummary {
  leagues: LeagueMembershipSummary[];
}

export interface FootballSyncService {
  run(options?: { leagueSlug?: string }): Promise<SyncSummary>;
}
