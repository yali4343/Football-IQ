import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { FootballDataClient } from "../integrations/footballData/FootballDataClient.js";
import type {
  FootballSyncService,
  LeagueMembershipSummary,
  SyncSummary,
} from "./FootballSyncService.js";

interface SyncTargetLeague {
  id: number;
  name: string;
  footballDataId: number;
}

export function slugifyLeagueName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

@injectable()
export class PrismaFootballSyncService implements FootballSyncService {
  constructor(
    @inject("PrismaClient") private prisma: PrismaClient,
    @inject("FootballDataClient") private footballDataClient: FootballDataClient,
  ) {}

  async run(options: { leagueSlug?: string } = {}): Promise<SyncSummary> {
    const leagues = await this.prisma.league.findMany();
    const targetLeagues = options.leagueSlug
      ? leagues.filter(
          (league) => slugifyLeagueName(league.name) === options.leagueSlug,
        )
      : leagues;

    const summaries: LeagueMembershipSummary[] = [];

    for (const league of targetLeagues) {
      summaries.push(await this.syncLeagueMembership(league));
    }

    return { leagues: summaries };
  }

  private async syncLeagueMembership(
    league: SyncTargetLeague,
  ): Promise<LeagueMembershipSummary> {
    let teams;

    try {
      teams = await this.footballDataClient.getCompetitionTeams(
        league.footballDataId,
      );
    } catch (error) {
      return this.failedSummary(league.name, error);
    }

    if (teams.length === 0) {
      return this.failedSummary(
        league.name,
        new Error(
          "football-data.org returned zero teams — refusing to deactivate the whole league",
        ),
      );
    }

    let clubsCreated = 0;
    let clubsUpdated = 0;
    const seenFootballDataIds: number[] = [];

    for (const team of teams) {
      seenFootballDataIds.push(team.id);

      const existing = await this.prisma.club.findUnique({
        where: { footballDataId: team.id },
      });

      if (!existing) {
        await this.prisma.club.create({
          data: {
            name: team.name,
            stadium: team.venue,
            footballDataId: team.id,
            leagueId: league.id,
            isActive: true,
          },
        });
        clubsCreated += 1;
        continue;
      }

      const needsUpdate =
        existing.name !== team.name ||
        existing.stadium !== team.venue ||
        !existing.isActive;

      if (needsUpdate) {
        await this.prisma.club.update({
          where: { id: existing.id },
          data: {
            name: team.name,
            stadium: team.venue,
            isActive: true,
          },
        });
        clubsUpdated += 1;
      }
    }

    const deactivated = await this.prisma.club.updateMany({
      where: {
        leagueId: league.id,
        isActive: true,
        footballDataId: { notIn: seenFootballDataIds },
      },
      data: { isActive: false },
    });

    return {
      leagueName: league.name,
      clubsCreated,
      clubsUpdated,
      clubsDeactivated: deactivated.count,
      failed: false,
    };
  }

  private failedSummary(
    leagueName: string,
    error: unknown,
  ): LeagueMembershipSummary {
    return {
      leagueName,
      clubsCreated: 0,
      clubsUpdated: 0,
      clubsDeactivated: 0,
      failed: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
