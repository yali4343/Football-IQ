export interface WikipediaClient {
  /**
   * Returns the plain-text lead section (everything before the first
   * heading) for the given article title, following redirects — or null
   * if no matching article exists.
   */
  getIntroExtract(title: string): Promise<string | null>;
}
