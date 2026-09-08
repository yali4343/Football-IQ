import { injectable } from "tsyringe";
import AppError from "../../errors/AppError.js";
import type {
  ApiFootballClient,
  ApiFootballSquadPlayer,
  ApiFootballTeam,
} from "./ApiFootballClient.js";

const BASE_URL = "https://v3.football.api-sports.io";
// Free-tier limit is ~10 requests/minute; stay comfortably under it.
const MIN_DELAY_MS = 6500;
// Stop making requests once the daily quota drops to this many left, rather
// than waiting for the API to start rejecting us.
const DEFAULT_SAFETY_MARGIN = 10;

interface ApiFootballTeamsResponse {
  errors: unknown;
  response: Array<{
    team: { id: number; name: string; code: string | null };
  }>;
}

interface ApiFootballSquadsResponse {
  errors: unknown;
  response: Array<{
    team: { id: number; name: string };
    players: Array<{
      id: number;
      name: string;
      age: number | null;
      number: number | null;
      position: string;
      photo: string | null;
    }>;
  }>;
}

@injectable()
export class HttpApiFootballClient implements ApiFootballClient {
  private lastRequestAt = 0;
  private remaining: number | null = null;
  private limit: number | null = null;
  private readonly safetyMargin = DEFAULT_SAFETY_MARGIN;

  hasQuotaRemaining(): boolean {
    return this.remaining === null || this.remaining > this.safetyMargin;
  }

  getRequestsUsed(): number | null {
    if (this.remaining === null || this.limit === null) {
      return null;
    }

    return this.limit - this.remaining;
  }

  async getLeagueDirectory(
    leagueId: number,
    season: number,
  ): Promise<ApiFootballTeam[]> {
    const body = await this.request<ApiFootballTeamsResponse>(
      `/teams?league=${leagueId}&season=${season}`,
    );

    return body.response.map((entry) => ({
      id: entry.team.id,
      name: entry.team.name,
      code: entry.team.code,
    }));
  }

  async searchTeam(name: string): Promise<ApiFootballTeam[]> {
    const body = await this.request<ApiFootballTeamsResponse>(
      `/teams?search=${encodeURIComponent(name)}`,
    );

    return body.response.map((entry) => ({
      id: entry.team.id,
      name: entry.team.name,
      code: entry.team.code,
    }));
  }

  async getSquad(teamId: number): Promise<ApiFootballSquadPlayer[]> {
    const body = await this.request<ApiFootballSquadsResponse>(
      `/players/squads?team=${teamId}`,
    );

    return (body.response[0]?.players ?? []).map((player) => ({
      id: player.id,
      name: player.name,
      age: player.age,
      number: player.number,
      position: player.position,
      photo: player.photo,
    }));
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.hasQuotaRemaining()) {
      throw new AppError(
        "API-Football daily quota safety margin reached",
        429,
        "API_FOOTBALL_QUOTA_EXCEEDED",
      );
    }

    await this.throttle();

    const apiKey = process.env["API_FOOTBALL_KEY"];

    if (!apiKey) {
      throw new AppError(
        "API_FOOTBALL_KEY is not set",
        500,
        "MISSING_API_KEY",
      );
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { "x-apisports-key": apiKey },
    });

    const remainingHeader = response.headers.get(
      "x-ratelimit-requests-remaining",
    );
    const limitHeader = response.headers.get("x-ratelimit-requests-limit");

    if (remainingHeader !== null) {
      this.remaining = Number(remainingHeader);
    }

    if (limitHeader !== null) {
      this.limit = Number(limitHeader);
    }

    const body = (await response.json()) as T & { errors?: unknown };

    // API-Football signals errors (invalid params, plan restrictions, the
    // daily quota) inside the body with an HTTP 200 — verified live: a
    // quota-exceeded response still returns status 200 with an empty
    // `response` and errors.requests set, and the remaining-quota header is
    // not a reliable signal at that point (it read 99 while genuinely
    // blocked). response.ok alone is not enough.
    const apiErrors = this.extractErrorMessage(body.errors);

    if (apiErrors) {
      if (/request limit/i.test(apiErrors)) {
        // The header can't be trusted here — force the guard to trip so
        // the rest of this run skips gracefully instead of retrying.
        this.remaining = 0;
      }

      throw new AppError(
        `API-Football request failed: ${apiErrors}`,
        response.status,
        "API_FOOTBALL_REQUEST_FAILED",
      );
    }

    if (!response.ok) {
      throw new AppError(
        `API-Football request failed: ${response.statusText}`,
        response.status,
        "API_FOOTBALL_REQUEST_FAILED",
      );
    }

    return body;
  }

  private extractErrorMessage(errors: unknown): string | undefined {
    if (Array.isArray(errors)) {
      return errors.length > 0 ? errors.join("; ") : undefined;
    }

    if (errors && typeof errors === "object") {
      const values = Object.values(errors as Record<string, unknown>);
      return values.length > 0 ? values.join("; ") : undefined;
    }

    return undefined;
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    const wait = MIN_DELAY_MS - elapsed;

    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    this.lastRequestAt = Date.now();
  }
}
