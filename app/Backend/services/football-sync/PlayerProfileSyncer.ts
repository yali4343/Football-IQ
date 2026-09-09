import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ApiFootballClient } from "../../integrations/apiFootball/ApiFootballClient.js";
import { slugifyLeagueName } from "./nameMatching.js";
import type { SyncTargetLeague } from "./types.js";

// API-Football's free plan only allows season=2022-2024 on /players
// (verified live: 2026 is rejected with "Free plans do not have access to
// this season, try from 2022 to 2024."). The bio fields this syncer reads
// are fixed facts about the player, not season-versioned data, so querying
// with this season doesn't mean the persisted values represent 2024 —
// it's just the season value the endpoint requires to respond at all.
const PLAYER_PROFILE_SEASON = 2024;

interface ProfileTargetPlayer {
  id: number;
  externalApiId: number;
}

// Backfills full profile data (name parts, birth date/place/country,
// nationality, height, weight) onto Player rows already created by
// SquadSyncer. Only ever writes the fields it owns — it never touches
// name/position/age/number/photoUrl/isActive, which stay SquadSyncer's
// responsibility.
export class PlayerProfileSyncer {
  constructor(
    private prisma: PrismaClient,
    private apiFootballClient: ApiFootballClient,
  ) {}

  async syncLeague(
    league: SyncTargetLeague,
    force: boolean,
    clubSlug: string | undefined,
  ): Promise<{
    profilesUpdated: number;
    profilesSkippedQuota: number;
    profilesFailed: number;
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

    if (clubs.length === 0) {
      return { profilesUpdated: 0, profilesSkippedQuota: 0, profilesFailed: 0 };
    }

    const players = await this.prisma.player.findMany({
      where: {
        clubId: { in: clubs.map((club) => club.id) },
        isActive: true,
        ...(force ? {} : { dateOfBirth: null }),
      },
      select: { id: true, externalApiId: true },
    });

    let profilesUpdated = 0;
    let profilesSkippedQuota = 0;
    let profilesFailed = 0;

    for (const player of players) {
      if (!this.apiFootballClient.hasQuotaRemaining()) {
        profilesSkippedQuota += 1;
        continue;
      }

      const updated = await this.syncPlayerProfile(player);

      if (updated) {
        profilesUpdated += 1;
      } else {
        profilesFailed += 1;
      }
    }

    return { profilesUpdated, profilesSkippedQuota, profilesFailed };
  }

  private async syncPlayerProfile(
    player: ProfileTargetPlayer,
  ): Promise<boolean> {
    try {
      const profile = await this.apiFootballClient.getPlayerProfile(
        player.externalApiId,
        PLAYER_PROFILE_SEASON,
      );

      if (!profile) {
        return false;
      }

      await this.prisma.player.update({
        where: { id: player.id },
        data: {
          firstName: profile.firstname,
          lastName: profile.lastname,
          dateOfBirth: profile.birthDate ? new Date(profile.birthDate) : null,
          birthPlace: profile.birthPlace,
          birthCountry: profile.birthCountry,
          nationality: profile.nationality,
          height: profile.height,
          weight: profile.weight,
        },
      });

      return true;
    } catch {
      return false;
    }
  }
}
