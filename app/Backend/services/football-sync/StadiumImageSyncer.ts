import type { PrismaClient } from "../../generated/prisma/client.js";
import type { TheSportsDbClient } from "../../integrations/theSportsDb/TheSportsDbClient.js";
import { slugifyLeagueName } from "./nameMatching.js";
import type { SyncTargetLeague } from "./types.js";

interface StadiumImageClub {
  id: number;
  name: string;
  stadium: string | null;
}

// Enriches each club with a stadium photo from TheSportsDB, matched by the
// existing stadium name. Mirrors ClubMapper's role for a third provider:
// skip clubs that already have an image unless --force, and never fail the
// whole sync on a missing venue/image or a provider error — a lookup that
// comes back empty or throws is recorded, not raised further.
export class StadiumImageSyncer {
  constructor(
    private prisma: PrismaClient,
    private theSportsDbClient: TheSportsDbClient,
  ) {}

  async syncLeague(
    league: SyncTargetLeague,
    force: boolean,
    dryRun: boolean,
    clubSlug: string | undefined,
  ): Promise<{ updated: number; clubsWithoutStadiumImage: string[] }> {
    const allClubs = await this.prisma.club.findMany({
      where: {
        leagueId: league.id,
        isActive: true,
        stadium: { not: null },
        ...(force ? {} : { stadiumImageUrl: null }),
      },
    });
    const clubs = clubSlug
      ? allClubs.filter((club) => slugifyLeagueName(club.name) === clubSlug)
      : allClubs;

    let updated = 0;
    const clubsWithoutStadiumImage: string[] = [];

    for (const club of clubs) {
      const imageUrl = await this.findImage(club);

      if (imageUrl) {
        if (!dryRun) {
          await this.prisma.club.update({
            where: { id: club.id },
            data: { stadiumImageUrl: imageUrl },
          });
        }
        updated += 1;
      } else {
        clubsWithoutStadiumImage.push(club.name);
      }
    }

    return { updated, clubsWithoutStadiumImage };
  }

  private async findImage(club: StadiumImageClub): Promise<string | null> {
    if (!club.stadium) {
      return null;
    }

    try {
      return await this.theSportsDbClient.findVenueImageUrl(club.stadium);
    } catch {
      return null;
    }
  }
}
