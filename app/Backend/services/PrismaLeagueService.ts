import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../generated/prisma/client.js";
import { slugifyLeagueName } from "./football-sync/nameMatching.js";
import { LEAGUE_DESCRIPTIONS } from "./leagueDescriptions.js";
import { computeLeaguePlayerStats } from "./leagueStats.js";
import type { LeagueService, LeagueStats } from "./LeagueService.js";

@injectable()
export class PrismaLeagueService implements LeagueService {
  constructor(@inject("PrismaClient") private prisma: PrismaClient) {}

  async getLeagueStatsBySlug(
    slug: string,
  ): Promise<LeagueStats | undefined> {
    const leagues = await this.prisma.league.findMany();
    const league = leagues.find(
      (candidate) => slugifyLeagueName(candidate.name) === slug,
    );

    if (!league) {
      return undefined;
    }

    const competition = await this.prisma.competition.findUnique({
      where: { footballDataCompetitionId: league.footballDataId },
    });

    const players = await this.prisma.player.findMany({
      where: {
        isActive: true,
        club: { leagueId: league.id, isActive: true },
      },
      select: {
        age: true,
        nationality: true,
        club: { select: { area: { select: { name: true } } } },
      },
    });

    return {
      name: league.name,
      slug,
      emblem: competition?.emblem ?? null,
      description: LEAGUE_DESCRIPTIONS[league.name] ?? "",
      ...computeLeaguePlayerStats(players),
    };
  }
}
