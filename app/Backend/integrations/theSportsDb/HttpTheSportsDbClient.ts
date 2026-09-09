import { injectable } from "tsyringe";
import AppError from "../../errors/AppError.js";
import { createRateLimitThrottle } from "../http/rateLimitThrottle.js";
import { requireApiKey } from "../http/requireApiKey.js";
import type { TheSportsDbClient } from "./TheSportsDbClient.js";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json";
// No documented rate limit for this endpoint, but 1 req/sec was verified
// live to trip Cloudflare's rate limiting (HTTP 429, "error code: 1015")
// after a couple dozen requests. 6.5s matches the other two providers'
// documented ~10 req/min free-tier limits.
const MIN_DELAY_MS = 6500;

interface TheSportsDbVenue {
  strFanart1?: string | null;
  strThumb?: string | null;
}

interface TheSportsDbVenuesResponse {
  // The API returns `{"venues": null}` (not an empty array or an error) when
  // nothing matches — verified live against a nonexistent venue name.
  venues: TheSportsDbVenue[] | null;
}

interface TheSportsDbTeamsResponse {
  teams: Array<{ idVenue: string | null }> | null;
}

@injectable()
export class HttpTheSportsDbClient implements TheSportsDbClient {
  private readonly throttle = createRateLimitThrottle(MIN_DELAY_MS);
  private rateLimited = false;

  isRateLimited(): boolean {
    return this.rateLimited;
  }

  async findVenueImageUrl(venueName: string): Promise<string | null> {
    const body = await this.request<TheSportsDbVenuesResponse>(
      `searchvenues.php?v=${encodeURIComponent(venueName)}`,
    );

    return this.pickImage(body.venues?.[0]);
  }

  // Fallback for when the stored venue name doesn't match TheSportsDB's
  // (outdated name, missing sponsor prefix, etc — verified live: "Camp Nou"
  // misses, but the club's own team record on TheSportsDB carries the
  // current "Spotify Camp Nou" venue). Looks up the team by name, then its
  // venue by id, rather than guessing at name variants ourselves.
  async findVenueImageUrlByTeamName(teamName: string): Promise<string | null> {
    const teamsBody = await this.request<TheSportsDbTeamsResponse>(
      `searchteams.php?t=${encodeURIComponent(teamName)}`,
    );
    const venueId = teamsBody.teams?.[0]?.idVenue;

    if (!venueId) {
      return null;
    }

    const venuesBody = await this.request<TheSportsDbVenuesResponse>(
      `lookupvenue.php?id=${encodeURIComponent(venueId)}`,
    );

    return this.pickImage(venuesBody.venues?.[0]);
  }

  private pickImage(venue: TheSportsDbVenue | undefined): string | null {
    // strFanart1 is TheSportsDB's widescreen backdrop image — the closest
    // fit for a hero background. strThumb (a smaller venue photo) is the
    // fallback when a venue has no fanart on file.
    return venue?.strFanart1 ?? venue?.strThumb ?? null;
  }

  private async request<T>(path: string): Promise<T> {
    await this.throttle.wait();

    const apiKey = requireApiKey("THESPORTSDB_API_KEY");

    // The API key is part of the URL path here, not a header — unlike
    // API-Football's x-apisports-key or football-data's X-Auth-Token.
    const response = await fetch(`${BASE_URL}/${apiKey}/${path}`);

    if (response.status === 429) {
      // Once Cloudflare starts blocking us, every further request this run
      // will fail the same way — flag it so the caller can stop early
      // instead of waiting out the throttle on doomed requests.
      this.rateLimited = true;
    }

    if (!response.ok) {
      throw new AppError(
        `TheSportsDB request failed: ${response.statusText}`,
        response.status,
        "THESPORTSDB_REQUEST_FAILED",
      );
    }

    return (await response.json()) as T;
  }
}
