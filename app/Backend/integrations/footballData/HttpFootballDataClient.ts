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

interface RawFootballDataTeam {
  id: number;
  name: string;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
  address: string | null;
  website: string | null;
  founded: number | null;
  clubColors: string | null;
  venue: string | null;
  area: {
    id: number;
    name: string;
    code: string | null;
    flag: string | null;
  } | null;
  runningCompetitions?: Array<{
    id: number;
    name: string;
    code: string | null;
    type: string | null;
    emblem: string | null;
  }>;
  coach: {
    id: number | null;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
    contract: { start: string | null; until: string | null } | null;
  } | null;
  lastUpdated: string | null;
}

interface FootballDataTeamsResponse {
  teams?: RawFootballDataTeam[];
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
      shortName: team.shortName ?? null,
      tla: team.tla ?? null,
      crest: team.crest ?? null,
      address: team.address ?? null,
      website: team.website ?? null,
      founded: team.founded ?? null,
      clubColors: team.clubColors ?? null,
      venue: team.venue ?? null,
      area: team.area
        ? {
            id: team.area.id,
            name: team.area.name,
            code: team.area.code ?? null,
            flag: team.area.flag ?? null,
          }
        : null,
      runningCompetitions: (team.runningCompetitions ?? []).map((comp) => ({
        id: comp.id,
        name: comp.name,
        code: comp.code ?? null,
        type: comp.type ?? null,
        emblem: comp.emblem ?? null,
      })),
      // football-data.org returns an all-null coach object (id included)
      // rather than omitting the field when a team has no coach on record.
      coach:
        team.coach && team.coach.id !== null
          ? {
              id: team.coach.id,
              firstName: team.coach.firstName ?? null,
              lastName: team.coach.lastName ?? null,
              name: team.coach.name ?? null,
              dateOfBirth: team.coach.dateOfBirth ?? null,
              nationality: team.coach.nationality ?? null,
              contractStart: team.coach.contract?.start ?? null,
              contractUntil: team.coach.contract?.until ?? null,
            }
          : null,
      lastUpdated: team.lastUpdated ?? null,
    }));
  }
}
