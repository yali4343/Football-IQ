import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ApiFootballClient } from "../../integrations/apiFootball/ApiFootballClient.js";
import type { FootballDataClient } from "../../integrations/footballData/FootballDataClient.js";
import type { TheSportsDbClient } from "../../integrations/theSportsDb/TheSportsDbClient.js";
import { ClubMapper } from "./ClubMapper.js";
import type {
  FootballSyncService,
  LeagueMembershipSummary,
  SyncOptions,
  SyncSummary,
} from "./FootballSyncService.js";
import { sortLeaguesByMissingWork } from "./leaguePriority.js";
import { MembershipSyncer } from "./MembershipSyncer.js";
import { slugifyLeagueName } from "./nameMatching.js";
import { PlayerProfileSyncer } from "./PlayerProfileSyncer.js";
import { SquadSyncer } from "./SquadSyncer.js";
import { StadiumImageSyncer } from "./StadiumImageSyncer.js";

@injectable()
export class PrismaFootballSyncService implements FootballSyncService {
  private membershipSyncer: MembershipSyncer;
  private clubMapper: ClubMapper;
  private stadiumImageSyncer: StadiumImageSyncer;
  private squadSyncer: SquadSyncer;
  private playerProfileSyncer: PlayerProfileSyncer;

  constructor(
    @inject("PrismaClient") private prisma: PrismaClient,
    @inject("FootballDataClient") private footballDataClient: FootballDataClient,
    @inject("ApiFootballClient") private apiFootballClient: ApiFootballClient,
    @inject("TheSportsDbClient") private theSportsDbClient: TheSportsDbClient,
  ) {
    this.membershipSyncer = new MembershipSyncer(prisma, footballDataClient);
    this.clubMapper = new ClubMapper(prisma, apiFootballClient);
    this.stadiumImageSyncer = new StadiumImageSyncer(prisma, theSportsDbClient);
    this.squadSyncer = new SquadSyncer(prisma, apiFootballClient);
    this.playerProfileSyncer = new PlayerProfileSyncer(prisma, apiFootballClient);
  }

  async run(options: SyncOptions = {}): Promise<SyncSummary> {
    const leagues = await this.prisma.league.findMany();
    const targetLeagues = options.leagueSlug
      ? leagues.filter(
          (league) => slugifyLeagueName(league.name) === options.leagueSlug,
        )
      : leagues;

    const orderedLeagues = await this.orderByMissingWork(targetLeagues);

    const summaries: LeagueMembershipSummary[] = [];
    const force = options.force ?? false;
    const dryRun = options.dryRun ?? false;

    for (const league of orderedLeagues) {
      const membership = await this.membershipSyncer.sync(league, dryRun);

      if (!membership.failed) {
        const mapping = await this.clubMapper.mapLeagueClubs(
          league,
          force,
          dryRun,
        );
        membership.clubsMapped = mapping.mapped;
        membership.unmappedClubs = mapping.unmapped;

        const stadiumImages = await this.stadiumImageSyncer.syncLeague(
          league,
          force,
          dryRun,
          options.clubSlug,
        );
        membership.stadiumImagesUpdated = stadiumImages.updated;
        membership.clubsWithoutStadiumImage =
          stadiumImages.clubsWithoutStadiumImage;
        membership.stadiumImagesSkippedRateLimited =
          stadiumImages.skippedRateLimited;

        const squads = await this.squadSyncer.syncLeague(
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

        if (!dryRun) {
          const profiles = await this.playerProfileSyncer.syncLeague(
            league,
            force,
            options.clubSlug,
          );
          membership.profilesUpdated = profiles.profilesUpdated;
          membership.profilesSkippedQuota = profiles.profilesSkippedQuota;
          membership.profilesFailed = profiles.profilesFailed;
        }
      }

      summaries.push(membership);
    }

    return {
      leagues: summaries,
      requestsUsed: this.apiFootballClient.getRequestsUsed(),
    };
  }

  // Reorders leagues so the shared API-Football quota is spent on whichever
  // ones currently have the most missing data first (never-synced clubs,
  // then clubs with the most incomplete player profiles). Recomputed from
  // live DB state on every call — a league that's fully backfilled scores 0
  // and naturally rotates to the back on the next run.
  private async orderByMissingWork<League extends { id: number }>(
    leagues: League[],
  ): Promise<League[]> {
    if (leagues.length <= 1) {
      return leagues;
    }

    const clubs = await this.prisma.club.findMany({
      where: {
        leagueId: { in: leagues.map((league) => league.id) },
        isActive: true,
        apiFootballId: { not: null },
      },
      select: { id: true, leagueId: true, squadLastSyncedAt: true },
    });

    const missingProfileCounts = await this.prisma.player.groupBy({
      by: ["clubId"],
      where: {
        clubId: { in: clubs.map((club) => club.id) },
        isActive: true,
        dateOfBirth: null,
      },
      _count: { _all: true },
    });

    return sortLeaguesByMissingWork(
      leagues,
      clubs,
      missingProfileCounts.map((entry) => ({
        clubId: entry.clubId,
        count: entry._count._all,
      })),
    );
  }
}
