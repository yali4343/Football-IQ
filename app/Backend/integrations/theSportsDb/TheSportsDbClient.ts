export interface TheSportsDbClient {
  /** Whether a prior request in this run was rate-limited — safe to skip further calls. */
  isRateLimited(): boolean;
  /** Fallback for when TheSportsDB has no team record for the club at all: a free-text search over venue names, or null if no match/image exists. */
  findVenueImageUrl(venueName: string): Promise<string | null>;
  /** Resolves the team's current venue via TheSportsDB's own team record — preferred over a venue-name search, which can match an unrelated venue that happens to share a sponsor name. */
  findVenueImageUrlByTeamName(teamName: string): Promise<string | null>;
}
