import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  ApiFootballClient,
  ApiFootballSquadPlayer,
} from "../../integrations/apiFootball/ApiFootballClient.js";
import type { FailedClub } from "./FootballSyncService.js";
import { slugifyLeagueName } from "./nameMatching.js";
import type { SyncTargetLeague } from "./types.js";

interface SquadSyncClub {
  id: number;
  name: string;
  apiFootballId: number;
  squadLastSyncedAt: Date | null;
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

const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;

// Prisma's 5000ms default has been too tight for a full-squad sync against
// a remote DB: the per-row updates plus the deactivate/stamp calls that
// remain inside the transaction can still add up under normal latency.
const TRANSACTION_OPTIONS = { timeout: 15000, maxWait: 10000 };

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

// Syncs each mapped club's current squad from API-Football into Player
// rows: freshness/quota skip logic, a per-club transaction (create/update/
// deactivate/transfer), and squadLastSyncedAt stamped only on success.
export class SquadSyncer {
  constructor(
    private prisma: PrismaClient,
    private apiFootballClient: ApiFootballClient,
  ) {}

  async syncLeague(
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
      // Never-synced clubs (null) first — Prisma/Postgres default asc is
      // NULLS LAST, which would push the most valuable clubs to the back.
      orderBy: { squadLastSyncedAt: { sort: "asc", nulls: "first" } },
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

  // One batched read for the whole squad instead of a findUnique per
  // player — keeps the interactive transaction's round-trip count (and
  // therefore its wall-clock duration) independent of squad size.
  private async fetchExistingByExternalId(
    squad: ApiFootballSquadPlayer[],
  ): Promise<Map<number, ExistingPlayer & { id: number }>> {
    const existing = await this.prisma.player.findMany({
      where: { externalApiId: { in: squad.map((player) => player.id) } },
    });

    return new Map(existing.map((player) => [player.externalApiId, player]));
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

    const existingByExternalId = await this.fetchExistingByExternalId(squad);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        let updated = 0;
        const seenExternalIds: number[] = [];
        const toCreate: (ReturnType<typeof playerWriteData> & {
          externalApiId: number;
        })[] = [];

        for (const player of squad) {
          seenExternalIds.push(player.id);

          const existing = existingByExternalId.get(player.id);

          if (!existing) {
            toCreate.push({
              ...playerWriteData(player, club.id),
              externalApiId: player.id,
            });
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

        if (toCreate.length > 0) {
          await tx.player.createMany({ data: toCreate });
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

        return {
          created: toCreate.length,
          updated,
          deactivated: deactivated.count,
        };
      }, TRANSACTION_OPTIONS);

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
    const existingByExternalId = await this.fetchExistingByExternalId(squad);

    let created = 0;
    let updated = 0;
    const seenExternalIds: number[] = [];

    for (const player of squad) {
      seenExternalIds.push(player.id);

      const existing = existingByExternalId.get(player.id);

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
