import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  ApiFootballClient,
  ApiFootballTeam,
} from "../../integrations/apiFootball/ApiFootballClient.js";
import { normalizeClubName } from "./nameMatching.js";
import type { SyncTargetLeague } from "./types.js";

interface MappableClub {
  id: number;
  name: string;
  footballDataCode: string | null;
  apiFootballId: number | null;
  area: { name: string } | null;
}

// API-Football's free plan only allows recent-but-not-current seasons on
// /teams (verified live: 2025 is rejected, 2022-2024 is allowed). That's
// fine here — this endpoint is only used to look up stable team identities
// (id/name/code), not to determine current league membership, and team
// codes/names rarely change season to season.
const DIRECTORY_SEASON = 2024;

// Resolves each football-data.org club to its API-Football team identity:
// directory-based code/name matching first, search fallback second, never
// guessing on an ambiguous or missing match.
export class ClubMapper {
  private directoryCache = new Map<number, ApiFootballTeam[]>();

  constructor(
    private prisma: PrismaClient,
    private apiFootballClient: ApiFootballClient,
  ) {}

  async mapLeagueClubs(
    league: SyncTargetLeague,
    force: boolean,
    dryRun: boolean,
  ): Promise<{ mapped: number; unmapped: string[] }> {
    const clubs = await this.prisma.club.findMany({
      where: {
        leagueId: league.id,
        isActive: true,
        ...(force ? {} : { apiFootballId: null }),
      },
      include: { area: true },
    });

    let mapped = 0;
    const unmapped: string[] = [];

    for (const club of clubs) {
      const alreadyMapped = club.apiFootballId !== null;
      const nowMapped = await this.resolveClubMapping(club, league, dryRun);

      if (nowMapped) {
        mapped += 1;
      } else if (!alreadyMapped) {
        // Under --force, a club that already had a valid mapping keeps it
        // even if this re-resolution attempt didn't find a match — only
        // clubs with no mapping at all (before or after) count as unmapped.
        unmapped.push(club.name);
      }
    }

    return { mapped, unmapped };
  }

  private async resolveClubMapping(
    club: MappableClub,
    league: SyncTargetLeague,
    dryRun: boolean,
  ): Promise<boolean> {
    if (league.apiFootballLeagueId === null) {
      return false;
    }

    const directory = await this.getDirectory(league.apiFootballLeagueId);

    const match = this.pickUniqueMatch(directory, club);

    if (match) {
      if (!dryRun) {
        await this.prisma.club.update({
          where: { id: club.id },
          data: { apiFootballId: match.id },
        });
      }
      return true;
    }

    if (!this.apiFootballClient.hasQuotaRemaining()) {
      return false;
    }

    const searchMatch = await this.searchAndMatch(club);

    if (searchMatch) {
      if (!dryRun) {
        await this.prisma.club.update({
          where: { id: club.id },
          data: { apiFootballId: searchMatch.id },
        });
      }
      return true;
    }

    return false;
  }

  private async searchAndMatch(
    club: MappableClub,
  ): Promise<ApiFootballTeam | undefined> {
    const normalized = normalizeClubName(club.name);
    const firstWord = normalized.split(" ")[0];
    const queries =
      firstWord && firstWord !== normalized
        ? [normalized, firstWord]
        : [normalized];

    for (const query of queries) {
      if (!this.apiFootballClient.hasQuotaRemaining()) {
        return undefined;
      }

      let results: ApiFootballTeam[];

      try {
        results = await this.apiFootballClient.searchTeam(query);
      } catch {
        return undefined;
      }

      const match = this.pickUniqueMatch(results, club);

      if (match) {
        return match;
      }
    }

    return undefined;
  }

  // A club's own nation (synced from football-data.org's `area`) narrows
  // out same-named clubs from other countries — e.g. Levante UD (Spain)
  // vs. API-Football's unrelated homonym "Levante" (Greece), which
  // otherwise makes the plain name/code match ambiguous. Falls back to the
  // unfiltered candidate list whenever narrowing doesn't yield a match, so
  // this only ever adds precision — it never turns a previously resolvable
  // case into a miss (e.g. a country-name mismatch between providers).
  private pickUniqueMatch(
    candidates: ApiFootballTeam[],
    club: MappableClub,
  ): ApiFootballTeam | undefined {
    if (club.area) {
      const sameCountry = candidates.filter(
        (team) => team.country === club.area?.name,
      );
      const narrowed = this.pickFromCandidates(sameCountry, club);

      if (narrowed) {
        return narrowed;
      }
    }

    return this.pickFromCandidates(candidates, club);
  }

  private pickFromCandidates(
    candidates: ApiFootballTeam[],
    club: MappableClub,
  ): ApiFootballTeam | undefined {
    const codeMatches = club.footballDataCode
      ? candidates.filter(
          (team) =>
            team.code?.toUpperCase() ===
            club.footballDataCode?.toUpperCase(),
        )
      : [];

    if (codeMatches.length === 1) {
      return codeMatches[0];
    }

    const normalizedClubName = normalizeClubName(club.name);
    const nameMatches = candidates.filter(
      (team) => normalizeClubName(team.name) === normalizedClubName,
    );

    return nameMatches.length === 1 ? nameMatches[0] : undefined;
  }

  private async getDirectory(
    apiFootballLeagueId: number,
  ): Promise<ApiFootballTeam[]> {
    const cached = this.directoryCache.get(apiFootballLeagueId);

    if (cached) {
      return cached;
    }

    if (!this.apiFootballClient.hasQuotaRemaining()) {
      this.directoryCache.set(apiFootballLeagueId, []);
      return [];
    }

    try {
      const directory = await this.apiFootballClient.getLeagueDirectory(
        apiFootballLeagueId,
        DIRECTORY_SEASON,
      );
      this.directoryCache.set(apiFootballLeagueId, directory);
      return directory;
    } catch {
      this.directoryCache.set(apiFootballLeagueId, []);
      return [];
    }
  }
}
