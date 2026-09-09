export interface TheSportsDbClient {
  /** Resolves to a photo URL for the venue, or null if no match/image exists. */
  findVenueImageUrl(venueName: string): Promise<string | null>;
}
