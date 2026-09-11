import { injectable } from "tsyringe";
import AppError from "../../errors/AppError.js";
import type { WikipediaClient } from "./WikipediaClient.js";

const BASE_URL = "https://en.wikipedia.org/w/api.php";
// Wikipedia's API etiquette asks for a descriptive User-Agent identifying
// the application and a contact point, rather than a default/blank one —
// see https://meta.wikimedia.org/wiki/User-Agent_policy. No API key is
// needed for this endpoint.
const USER_AGENT =
  "Football-IQ/1.0 (https://github.com/yali4343/Football-IQ; yali4343@gmail.com)";

interface WikipediaPage {
  missing?: string;
  extract?: string;
}

interface WikipediaQueryResponse {
  query?: {
    pages: Record<string, WikipediaPage>;
  };
}

@injectable()
export class HttpWikipediaClient implements WikipediaClient {
  // A club or league's Wikipedia intro effectively never changes day to
  // day, and this is only ever called interactively (one title at a time,
  // as a user selects a club or opens a league's modal) rather than in a
  // bulk sync loop — so a simple in-memory cache for the life of the
  // process is enough, and there's no need for the request-throttling the
  // other providers use to stay under a per-minute quota.
  private readonly cache = new Map<string, string | null>();

  async getIntroExtract(title: string): Promise<string | null> {
    const cached = this.cache.get(title);

    if (cached !== undefined) {
      return cached;
    }

    const extract = await this.fetchIntroExtract(title);
    this.cache.set(title, extract);

    return extract;
  }

  private async fetchIntroExtract(title: string): Promise<string | null> {
    const params = new URLSearchParams({
      action: "query",
      prop: "extracts",
      exintro: "true",
      explaintext: "true",
      redirects: "1",
      format: "json",
      titles: title,
    });

    const response = await fetch(`${BASE_URL}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (!response.ok) {
      throw new AppError(
        `Wikipedia request failed: ${response.statusText}`,
        response.status,
        "WIKIPEDIA_REQUEST_FAILED",
      );
    }

    const body = (await response.json()) as WikipediaQueryResponse;
    const page = Object.values(body.query?.pages ?? {})[0];

    if (!page || page.missing !== undefined || !page.extract) {
      return null;
    }

    return page.extract;
  }
}
