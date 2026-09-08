import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ApiFootballClient } from "../../integrations/apiFootball/ApiFootballClient.js";
import type { FootballDataClient } from "../../integrations/footballData/FootballDataClient.js";
import { ClubMapper } from "./ClubMapper.js";
import type {
  FootballSyncService,
  LeagueMembershipSummary,
  SyncOptions,
  SyncSummary,
} from "./FootballSyncService.js";
import { MembershipSyncer } from "./MembershipSyncer.js";
import { slugifyLeagueName } from "./nameMatching.js";
import { SquadSyncer } from "./SquadSyncer.js";

@injectable()
export class PrismaFootballSyncService implements FootballSyncService {
  private membershipSyncer: MembershipSyncer;
  private clubMapper: ClubMapper;
  private squadSyncer: SquadSyncer;

  constructor(
    @inject("PrismaClient") private prisma: PrismaClient,
    @inject("FootballDataClient") private footballDataClient: FootballDataClient,
    @inject("ApiFootballClient") private apiFootballClient: ApiFootballClient,
  ) {
    this.membershipSyncer = new MembershipSyncer(prisma, footballDataClient);
    this.clubMapper = new ClubMapper(prisma, apiFootballClient);
    this.squadSyncer = new SquadSyncer(prisma, apiFootballClient);
  }

  async run(options: SyncOptions = {}): Promise<SyncSummary> {
    const leagues = await this.prisma.league.findMany();
    const targetLeagues = options.leagueSlug
      ? leagues.filter(
          (league) => slugifyLeagueName(league.name) === options.leagueSlug,
        )
      : leagues;

    const summaries: LeagueMembershipSummary[] = [];
    const force = options.force ?? false;
    const dryRun = options.dryRun ?? false;

    for (const league of targetLeagues) {
      const membership = await this.membershipSyncer.sync(league, dryRun);

      if (!membership.failed) {
        const mapping = await this.clubMapper.mapLeagueClubs(
          league,
          force,
          dryRun,
        );
        membership.clubsMapped = mapping.mapped;
        membership.unmappedClubs = mapping.unmapped;

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
      }

      summaries.push(membership);
    }

    return {
      leagues: summaries,
      requestsUsed: this.apiFootballClient.getRequestsUsed(),
    };
  }
}
