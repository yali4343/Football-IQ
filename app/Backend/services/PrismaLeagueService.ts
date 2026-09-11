import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { WikipediaClient } from "../integrations/wikipedia/WikipediaClient.js";
import { slugifyLeagueName } from "./football-sync/nameMatching.js";
import { computeLeaguePlayerStats } from "./leagueStats.js";
import { firstNSentences } from "./textExtract.js";
import type { LeagueService, LeagueStats } from "./LeagueService.js";

const DESCRIPTION_SENTENCE_COUNT = 10;

@injectable()
export class PrismaLeagueService implements LeagueService {
  constructor(
    @inject("PrismaClient") private prisma: PrismaClient,
    @inject("WikipediaClient") private wikipediaClient: WikipediaClient,
  ) {}

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

    const [competition, players, description] = await Promise.all([
      this.prisma.competition.findUnique({
        where: { footballDataCompetitionId: league.footballDataId },
      }),
      this.prisma.player.findMany({
        where: {
          isActive: true,
          club: { leagueId: league.id, isActive: true },
        },
        select: {
          age: true,
          nationality: true,
          club: { select: { area: { select: { name: true } } } },
        },
      }),
      this.getDescription(league.name),
    ]);

    return {
      name: league.name,
      slug,
      emblem: competition?.emblem ?? null,
      description,
      ...computeLeaguePlayerStats(players),
    };
  }

  // Never lets a Wikipedia outage or an unresolved title fail the whole
  // request — an empty description degrades gracefully in the modal,
  // mirroring how StadiumImageSyncer treats a failed provider lookup.
  private async getDescription(leagueName: string): Promise<string> {
    try {
      const extract = await this.wikipediaClient.getIntroExtract(leagueName);

      return extract
        ? firstNSentences(extract, DESCRIPTION_SENTENCE_COUNT)
        : "";
    } catch {
      return "";
    }
  }
}
