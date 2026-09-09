import { injectable } from "tsyringe";
import AppError from "../../errors/AppError.js";
import { createRateLimitThrottle } from "../http/rateLimitThrottle.js";
import { requireApiKey } from "../http/requireApiKey.js";
import type { TheSportsDbClient } from "./TheSportsDbClient.js";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json";
// No documented rate limit for this endpoint (unlike API-Football/
// football-data.org, which both advertise ~10 req/min) — a conservative
// default to stay polite rather than a verified figure.
const MIN_DELAY_MS = 1000;

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

  async findVenueImageUrl(venueName: string): Promise<string | null> {
    await this.throttle.wait();

    const apiKey = requireApiKey("THESPORTSDB_API_KEY");

    // The API key is part of the URL path here, not a header — unlike
    // API-Football's x-apisports-key or football-data's X-Auth-Token.
    const response = await fetch(
      `${BASE_URL}/${apiKey}/searchvenues.php?v=${encodeURIComponent(venueName)}`,
    );

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
