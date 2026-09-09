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

@injectable()
export class HttpTheSportsDbClient implements TheSportsDbClient {
  private readonly throttle = createRateLimitThrottle(MIN_DELAY_MS);
  private rateLimited = false;

  isRateLimited(): boolean {
    return this.rateLimited;
  }

  async findVenueImageUrl(venueName: string): Promise<string | null> {
    await this.throttle.wait();

    const apiKey = requireApiKey("THESPORTSDB_API_KEY");

    // The API key is part of the URL path here, not a header — unlike
    // API-Football's x-apisports-key or football-data's X-Auth-Token.
    const response = await fetch(
      `${BASE_URL}/${apiKey}/searchvenues.php?v=${encodeURIComponent(venueName)}`,
    );

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

    const body = (await response.json()) as TheSportsDbVenuesResponse;
    const venue = body.venues?.[0];

    // strFanart1 is TheSportsDB's widescreen backdrop image — the closest
    // fit for a hero background. strThumb (a smaller venue photo) is the
    // fallback when a venue has no fanart on file.
    return venue?.strFanart1 ?? venue?.strThumb ?? null;
  }
}
