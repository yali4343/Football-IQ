export interface TheSportsDbClient {
  /** Whether a prior request in this run was rate-limited — safe to skip further calls. */
  isRateLimited(): boolean;
  /** Resolves to a photo URL for the venue, or null if no match/image exists. */
  findVenueImageUrl(venueName: string): Promise<string | null>;
}
