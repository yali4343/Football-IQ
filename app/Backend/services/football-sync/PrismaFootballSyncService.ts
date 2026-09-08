import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  ApiFootballClient,
  ApiFootballSquadPlayer,
  ApiFootballTeam,
} from "../../integrations/apiFootball/ApiFootballClient.js";
import type { FootballDataClient } from "../../integrations/footballData/FootballDataClient.js";
import type {
  FailedClub,
  FootballSyncService,
  LeagueMembershipSummary,
  SyncOptions,
  SyncSummary,
} from "./FootballSyncService.js";
import { MembershipSyncer } from "./MembershipSyncer.js";
import type { SyncTargetLeague } from "./types.js";

interface MappableClub {
  id: number;
  name: string;
  footballDataCode: string | null;
  apiFootballId: number | null;
}

interface SquadSyncClub {
  id: number;
  name: string;
  apiFootballId: number;
  squadLastSyncedAt: Date | null;
}

// API-Football's free plan only allows recent-but-not-current seasons on
// /teams (verified live: 2025 is rejected, 2022-2024 is allowed). That's
// fine here — this endpoint is only used to look up stable team identities
// (id/name/code), not to determine current league membership, and team
// codes/names rarely change season to season.
const DIRECTORY_SEASON = 2024;

const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;

// Generic kebab-case slugify — also used for club-name slugs (--club=<slug>).
export function slugifyLeagueName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CLUB_SUFFIX_TOKENS = ["fc", "afc", "cf", "ac"];

// Drops club-type suffixes (fc/afc/cf/ac) and standalone numeric tokens
// (e.g. the "1." in "1. FC Köln", the "04" in "Bayer 04 Leverkusen") — both
// verified live to vary between football-data.org and API-Football's naming
// for the same club, and API-Football's search silently returns zero
// results when the query contains either.
export function normalizeClubName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(
      (token) =>
        token && !CLUB_SUFFIX_TOKENS.includes(token) && !/^\d+$/.test(token),
    )
    .join(" ")
    .trim();
}

interface ExistingPlayer {
  name: string;
  position: string;
  age: number | null;
  number: number | null;
  photoUrl: string | null;
  clubId: number;
  isActive: boolean;
}

function needsPlayerUpdate(
  existing: ExistingPlayer,
  player: ApiFootballSquadPlayer,
  clubId: number,
): boolean {
  return (
    existing.name !== player.name ||
    existing.position !== player.position ||
    existing.age !== player.age ||
    existing.number !== player.number ||
    existing.photoUrl !== player.photo ||
    existing.clubId !== clubId ||
    !existing.isActive
  );
}

function playerWriteData(player: ApiFootballSquadPlayer, clubId: number) {
  return {
    name: player.name,
    position: player.position,
    age: player.age,
    number: player.number,
    photoUrl: player.photo,
    clubId,
    isActive: true,
  };
}

@injectable()
export class PrismaFootballSyncService implements FootballSyncService {
  private membershipSyncer: MembershipSyncer;

  constructor(
    @inject("PrismaClient") private prisma: PrismaClient,
    @inject("FootballDataClient") private footballDataClient: FootballDataClient,
    @inject("ApiFootballClient") private apiFootballClient: ApiFootballClient,
  ) {
    this.membershipSyncer = new MembershipSyncer(prisma, footballDataClient);
  }

  async run(options: SyncOptions = {}): Promise<SyncSummary> {
    const leagues = await this.prisma.league.findMany();
    const targetLeagues = options.leagueSlug
      ? leagues.filter(
          (league) => slugifyLeagueName(league.name) === options.leagueSlug,
        )
      : leagues;

    const summaries: LeagueMembershipSummary[] = [];
    const directoryCache = new Map<number, ApiFootballTeam[]>();
    const force = options.force ?? false;
    const dryRun = options.dryRun ?? false;

    for (const league of targetLeagues) {
      const membership = await this.membershipSyncer.sync(league, dryRun);

      if (!membership.failed) {
        const mapping = await this.mapLeagueClubs(
          league,
          directoryCache,
          force,
          dryRun,
        );
        membership.clubsMapped = mapping.mapped;
        membership.unmappedClubs = mapping.unmapped;

        const squads = await this.syncLeagueSquads(
          league,
          force,
          dryRun,
          options.clubSlug,
        );
        membership.playersCreated = squads.playersCreated;
        membership.playersUpdated = squads.playersUpdated;
        membership.playersDeactivated = squads.playersDeactivated;
        membership.clubsSkippedFresh = squads.clubsSkippedFresh;
        membership.clubsSkippedQuota = squads.clubsSkippedQuota;
        membership.failedClubs = squads.failedClubs;
      }

      summaries.push(membership);
    }

    return {
      leagues: summaries,
      requestsUsed: this.apiFootballClient.getRequestsUsed(),
    };
  }

  private async mapLeagueClubs(
    league: SyncTargetLeague,
    directoryCache: Map<number, ApiFootballTeam[]>,
    force: boolean,
    dryRun: boolean,
  ): Promise<{ mapped: number; unmapped: string[] }> {
    const clubs = await this.prisma.club.findMany({
      where: {
        leagueId: league.id,
        isActive: true,
        ...(force ? {} : { apiFootballId: null }),
      },
    });

    let mapped = 0;
    const unmapped: string[] = [];

    for (const club of clubs) {
      const alreadyMapped = club.apiFootballId !== null;
      const nowMapped = await this.resolveClubMapping(
        club,
        league,
        directoryCache,
        dryRun,
      );

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
    directoryCache: Map<number, ApiFootballTeam[]>,
    dryRun: boolean,
  ): Promise<boolean> {
    if (league.apiFootballLeagueId === null) {
      return false;
    }

    const directory = await this.getDirectory(
      league.apiFootballLeagueId,
      directoryCache,
    );

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

  private pickUniqueMatch(
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
    cache: Map<number, ApiFootballTeam[]>,
  ): Promise<ApiFootballTeam[]> {
    const cached = cache.get(apiFootballLeagueId);

    if (cached) {
      return cached;
    }

    if (!this.apiFootballClient.hasQuotaRemaining()) {
      cache.set(apiFootballLeagueId, []);
      return [];
    }

    try {
      const directory = await this.apiFootballClient.getLeagueDirectory(
        apiFootballLeagueId,
        DIRECTORY_SEASON,
      );
      cache.set(apiFootballLeagueId, directory);
      return directory;
    } catch {
      cache.set(apiFootballLeagueId, []);
      return [];
    }
  }

  private async syncLeagueSquads(
    league: SyncTargetLeague,
    force: boolean,
    dryRun: boolean,
    clubSlug: string | undefined,
  ): Promise<{
    playersCreated: number;
    playersUpdated: number;
    playersDeactivated: number;
    clubsSkippedFresh: number;
    clubsSkippedQuota: number;
    failedClubs: FailedClub[];
  }> {
    const allClubs = await this.prisma.club.findMany({
      where: {
        leagueId: league.id,
        isActive: true,
        apiFootballId: { not: null },
      },
    });
    const clubs = clubSlug
      ? allClubs.filter((club) => slugifyLeagueName(club.name) === clubSlug)
      : allClubs;

    let playersCreated = 0;
    let playersUpdated = 0;
    let playersDeactivated = 0;
    let clubsSkippedFresh = 0;
    let clubsSkippedQuota = 0;
    const failedClubs: FailedClub[] = [];

    for (const club of clubs) {
      if (club.apiFootballId === null) {
        continue;
      }

      if (!force && this.isFresh(club.squadLastSyncedAt)) {
        clubsSkippedFresh += 1;
        continue;
      }

      if (!this.apiFootballClient.hasQuotaRemaining()) {
        clubsSkippedQuota += 1;
        continue;
      }

      const result = await this.syncClubSquad(
        {
          id: club.id,
          name: club.name,
          apiFootballId: club.apiFootballId,
          squadLastSyncedAt: club.squadLastSyncedAt,
        },
        dryRun,
      );

      if (result.status === "failed") {
        failedClubs.push({
          clubName: club.name,
          error: result.error ?? "unknown error",
        });
      } else {
        playersCreated += result.playersCreated;
        playersUpdated += result.playersUpdated;
        playersDeactivated += result.playersDeactivated;
      }
    }

    return {
      playersCreated,
      playersUpdated,
      playersDeactivated,
      clubsSkippedFresh,
      clubsSkippedQuota,
      failedClubs,
    };
  }

  private async syncClubSquad(
    club: SquadSyncClub,
    dryRun: boolean,
  ): Promise<{
    status: "synced" | "failed";
    playersCreated: number;
    playersUpdated: number;
    playersDeactivated: number;
    error?: string;
  }> {
    let squad: ApiFootballSquadPlayer[];

    try {
      squad = await this.apiFootballClient.getSquad(club.apiFootballId);
    } catch (error) {
      return this.failedSquadResult(error);
    }

    if (squad.length === 0) {
      return this.failedSquadResult(
        new Error(
          "API-Football returned zero players — refusing to deactivate the whole squad",
        ),
      );
    }

    if (dryRun) {
      return this.diffClubSquad(club, squad);
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        let created = 0;
        let updated = 0;
        const seenExternalIds: number[] = [];

        for (const player of squad) {
          seenExternalIds.push(player.id);

          const existing = await tx.player.findUnique({
            where: { externalApiId: player.id },
          });

          if (!existing) {
            await tx.player.create({
              data: {
                ...playerWriteData(player, club.id),
                externalApiId: player.id,
              },
            });
            created += 1;
            continue;
          }

          if (needsPlayerUpdate(existing, player, club.id)) {
            await tx.player.update({
              where: { id: existing.id },
              data: playerWriteData(player, club.id),
            });
            updated += 1;
          }
        }

        const deactivated = await tx.player.updateMany({
          where: {
            clubId: club.id,
            isActive: true,
            externalApiId: { notIn: seenExternalIds },
          },
          data: { isActive: false },
        });

        await tx.club.update({
          where: { id: club.id },
          data: { squadLastSyncedAt: new Date() },
        });

        return { created, updated, deactivated: deactivated.count };
      });

      return {
        status: "synced",
        playersCreated: result.created,
        playersUpdated: result.updated,
        playersDeactivated: result.deactivated,
      };
    } catch (error) {
      return this.failedSquadResult(error);
    }
  }

  // Mirrors syncClubSquad's real transaction with reads instead of writes,
  // and deliberately never touches squadLastSyncedAt.
  private async diffClubSquad(
    club: SquadSyncClub,
    squad: ApiFootballSquadPlayer[],
  ): Promise<{
    status: "synced";
    playersCreated: number;
    playersUpdated: number;
    playersDeactivated: number;
  }> {
    let created = 0;
    let updated = 0;
    const seenExternalIds: number[] = [];

    for (const player of squad) {
      seenExternalIds.push(player.id);

      const existing = await this.prisma.player.findUnique({
        where: { externalApiId: player.id },
      });

      if (!existing) {
        created += 1;
        continue;
      }

      if (needsPlayerUpdate(existing, player, club.id)) {
        updated += 1;
      }
    }

    const deactivated = await this.prisma.player.count({
      where: {
        clubId: club.id,
        isActive: true,
        externalApiId: { notIn: seenExternalIds },
      },
    });

    return {
      status: "synced",
      playersCreated: created,
      playersUpdated: updated,
      playersDeactivated: deactivated,
    };
  }

  private failedSquadResult(error: unknown): {
    status: "failed";
    playersCreated: number;
    playersUpdated: number;
    playersDeactivated: number;
    error: string;
  } {
    return {
      status: "failed",
      playersCreated: 0,
      playersUpdated: 0,
      playersDeactivated: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  private isFresh(squadLastSyncedAt: Date | null): boolean {
    if (squadLastSyncedAt === null) {
      return false;
    }

    return Date.now() - squadLastSyncedAt.getTime() < FRESHNESS_WINDOW_MS;
  }
}
