export interface LeagueMembershipSummary {
  leagueName: string;
  clubsCreated: number;
  clubsUpdated: number;
  clubsDeactivated: number;
  clubsMapped: number;
  unmappedClubs: string[];
  failed: boolean;
  error?: string;
}

export interface SyncSummary {
  leagues: LeagueMembershipSummary[];
}

export interface SyncOptions {
  leagueSlug?: string;
  force?: boolean;
}

export interface FootballSyncService {
  run(options?: SyncOptions): Promise<SyncSummary>;
}
