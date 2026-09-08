import type { PrismaClient } from "../../generated/prisma/client.js";
import type { FootballDataClient } from "../../integrations/footballData/FootballDataClient.js";
import type { LeagueMembershipSummary } from "./FootballSyncService.js";
import type { SyncTargetLeague } from "./types.js";

// Syncs a league's club list from football-data.org: creates/updates/
// reactivates Club rows, deactivates clubs no longer returned, and guards
// against a zero-team response wiping the whole league.
export class MembershipSyncer {
  constructor(
    private prisma: PrismaClient,
    private footballDataClient: FootballDataClient,
  ) {}

  async sync(
    league: SyncTargetLeague,
    dryRun: boolean,
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
        if (!dryRun) {
          await this.prisma.club.create({
            data: {
              name: team.name,
              stadium: team.venue,
              footballDataId: team.id,
              footballDataCode: team.tla,
              leagueId: league.id,
              isActive: true,
            },
          });
        }
        clubsCreated += 1;
        continue;
      }

      const needsUpdate =
        existing.name !== team.name ||
        existing.stadium !== team.venue ||
        existing.footballDataCode !== team.tla ||
        !existing.isActive;

      if (needsUpdate) {
        if (!dryRun) {
          await this.prisma.club.update({
            where: { id: existing.id },
            data: {
              name: team.name,
              stadium: team.venue,
              footballDataCode: team.tla,
              isActive: true,
            },
          });
        }
        clubsUpdated += 1;
      }
    }

    const deactivateWhere = {
      leagueId: league.id,
      isActive: true,
      footballDataId: { notIn: seenFootballDataIds },
    };
    const clubsDeactivated = dryRun
      ? await this.prisma.club.count({ where: deactivateWhere })
      : (
          await this.prisma.club.updateMany({
            where: deactivateWhere,
            data: { isActive: false },
          })
        ).count;

    return {
      leagueName: league.name,
      clubsCreated,
      clubsUpdated,
      clubsDeactivated,
      clubsMapped: 0,
      unmappedClubs: [],
      playersCreated: 0,
      playersUpdated: 0,
      playersDeactivated: 0,
      clubsSkippedFresh: 0,
      clubsSkippedQuota: 0,
      failedClubs: [],
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
      clubsMapped: 0,
      unmappedClubs: [],
      playersCreated: 0,
      playersUpdated: 0,
      playersDeactivated: 0,
      clubsSkippedFresh: 0,
      clubsSkippedQuota: 0,
      failedClubs: [],
      failed: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
