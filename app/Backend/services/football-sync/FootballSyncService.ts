export interface FailedClub {
  clubName: string;
  error: string;
}

export interface LeagueMembershipSummary {
  leagueName: string;
  clubsCreated: number;
  clubsUpdated: number;
  clubsDeactivated: number;
  clubsMapped: number;
  unmappedClubs: string[];
  playersCreated: number;
  playersUpdated: number;
  playersDeactivated: number;
  clubsSkippedFresh: number;
  clubsSkippedQuota: number;
  failedClubs: FailedClub[];
  failed: boolean;
  error?: string;
}

export interface SyncSummary {
  leagues: LeagueMembershipSummary[];
  requestsUsed: number | null;
}

export interface SyncOptions {
  leagueSlug?: string;
  clubSlug?: string;
  force?: boolean;
  dryRun?: boolean;
}

export interface FootballSyncService {
  run(options?: SyncOptions): Promise<SyncSummary>;
}
