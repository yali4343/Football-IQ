import type { PrismaClient } from "../../generated/prisma/client.js";
import type { TheSportsDbClient } from "../../integrations/theSportsDb/TheSportsDbClient.js";
import { normalizeClubName, slugifyLeagueName } from "./nameMatching.js";
import type { SyncTargetLeague } from "./types.js";

interface StadiumImageClub {
  id: number;
  name: string;
  stadium: string | null;
}

// Enriches each club with a stadium photo from TheSportsDB, matched by the
// existing stadium name, falling back to a team-name lookup when the venue
// name itself doesn't match (outdated names, missing sponsor prefixes —
// verified live: "Camp Nou" misses directly but resolves via Barcelona's
// own team record). Mirrors ClubMapper's role for a third provider: skip
// clubs that already have an image unless --force, and never fail the
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
  ): Promise<{
    updated: number;
    clubsWithoutStadiumImage: string[];
    skippedRateLimited: number;
  }> {
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
    let skippedRateLimited = 0;
    const clubsWithoutStadiumImage: string[] = [];

    for (const club of clubs) {
      if (this.theSportsDbClient.isRateLimited()) {
        // Once blocked, every further request this run would fail the same
        // way — skip outright rather than waiting out the throttle on a
        // doomed request. A later run (still targeting stadiumImageUrl:
        // null clubs) naturally retries these.
        skippedRateLimited += 1;
        continue;
      }

      const imageUrl = await this.findImage(club);

      if (imageUrl) {
        if (!dryRun) {
          await this.prisma.club.update({
            where: { id: club.id },
            data: { stadiumImageUrl: imageUrl },
          });
        }
        updated += 1;
      } else if (this.theSportsDbClient.isRateLimited()) {
        // This club's own request is what tripped the limit — don't count
        // it as a confirmed miss.
        skippedRateLimited += 1;
      } else {
        clubsWithoutStadiumImage.push(club.name);
      }
    }

    return { updated, clubsWithoutStadiumImage, skippedRateLimited };
  }

  private async findImage(club: StadiumImageClub): Promise<string | null> {
    if (!club.stadium) {
      return null;
    }

    const byVenueName = await this.tryLookup(() =>
      this.theSportsDbClient.findVenueImageUrl(club.stadium as string),
    );

    if (byVenueName || this.theSportsDbClient.isRateLimited()) {
      return byVenueName;
    }

    // Strip club-type descriptors (FC/AFC/CF/etc.) before searching by
    // name — verified live: "FC Barcelona"/"Hull City AFC"/"FC Schalke 04"
    // all miss or match the wrong (non-soccer) team on TheSportsDB, while
    // the normalized "Barcelona"/"Hull City"/"Schalke" match correctly.
    return this.tryLookup(() =>
      this.theSportsDbClient.findVenueImageUrlByTeamName(
        normalizeClubName(club.name),
      ),
    );
  }

  private async tryLookup(
    lookup: () => Promise<string | null>,
  ): Promise<string | null> {
    try {
      return await lookup();
    } catch {
      return null;
    }
  }
}
