import { injectable } from "tsyringe";
import AppError from "../../errors/AppError.js";
import { createRateLimitThrottle } from "../http/rateLimitThrottle.js";
import { requireApiKey } from "../http/requireApiKey.js";
import type {
  FootballDataClient,
  FootballDataTeam,
} from "./FootballDataClient.js";

const BASE_URL = "https://api.football-data.org/v4";
// Free-tier limit is ~10 requests/minute; stay comfortably under it.
const MIN_DELAY_MS = 6500;

interface FootballDataTeamsResponse {
  teams?: Array<{
    id: number;
    name: string;
    venue: string | null;
    tla: string | null;
  }>;
  message?: string;
}

@injectable()
export class HttpFootballDataClient implements FootballDataClient {
  private readonly throttle = createRateLimitThrottle(MIN_DELAY_MS);

  async getCompetitionTeams(
    footballDataId: number,
  ): Promise<FootballDataTeam[]> {
    await this.throttle.wait();

    const apiKey = requireApiKey("FOOTBALL_DATA_API_KEY");

    const response = await fetch(
      `${BASE_URL}/competitions/${footballDataId}/teams`,
      {
        headers: { "X-Auth-Token": apiKey },
      },
    );

    const body = (await response.json()) as FootballDataTeamsResponse;

    if (!response.ok) {
      throw new AppError(
        `football-data.org request failed: ${body.message ?? response.statusText}`,
        response.status,
        "FOOTBALL_DATA_REQUEST_FAILED",
      );
    }

    return (body.teams ?? []).map((team) => ({
      id: team.id,
      name: team.name,
      venue: team.venue ?? null,
      tla: team.tla ?? null,
    }));
  }
}
