import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  FootballDataClient,
  FootballDataCompetition,
  FootballDataTeam,
} from "../../integrations/footballData/FootballDataClient.js";
import type { LeagueMembershipSummary } from "./FootballSyncService.js";
import type { SyncTargetLeague } from "./types.js";

// Syncs a league's club list from football-data.org: creates/updates/
// reactivates Club rows (including profile fields, area, running
// competitions, and coach), deactivates clubs no longer returned, and
// guards against a zero-team response wiping the whole league.
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
          const areaId = await this.upsertArea(team.area);
          const club = await this.prisma.club.create({
            data: {
              name: team.name,
              shortName: team.shortName,
              stadium: team.venue,
              crest: team.crest,
              address: team.address,
              website: team.website,
              founded: team.founded,
              clubColors: team.clubColors,
              lastUpdated: this.toDate(team.lastUpdated),
              footballDataId: team.id,
              footballDataCode: team.tla,
              leagueId: league.id,
              areaId,
              isActive: true,
            },
          });
          await this.syncCompetitions(club.id, team.runningCompetitions);
          await this.syncCoach(club.id, team.coach);
        }
        clubsCreated += 1;
        continue;
      }

      const needsUpdate =
        existing.name !== team.name ||
        existing.shortName !== team.shortName ||
        existing.stadium !== team.venue ||
        existing.crest !== team.crest ||
        existing.address !== team.address ||
        existing.website !== team.website ||
        existing.founded !== team.founded ||
        existing.clubColors !== team.clubColors ||
        existing.footballDataCode !== team.tla ||
        !existing.isActive ||
        this.lastUpdatedChanged(existing.lastUpdated, team.lastUpdated);

      if (needsUpdate) {
        if (!dryRun) {
          const areaId = await this.upsertArea(team.area);
          await this.prisma.club.update({
            where: { id: existing.id },
            data: {
              name: team.name,
              shortName: team.shortName,
              stadium: team.venue,
              crest: team.crest,
              address: team.address,
              website: team.website,
              founded: team.founded,
              clubColors: team.clubColors,
              lastUpdated: this.toDate(team.lastUpdated),
              footballDataCode: team.tla,
              areaId,
              isActive: true,
            },
          });
          await this.syncCompetitions(existing.id, team.runningCompetitions);
          await this.syncCoach(existing.id, team.coach);
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
      stadiumImagesUpdated: 0,
      clubsWithoutStadiumImage: [],
      playersCreated: 0,
      playersUpdated: 0,
      playersDeactivated: 0,
      clubsSkippedFresh: 0,
      clubsSkippedQuota: 0,
      failedClubs: [],
      profilesUpdated: 0,
      profilesSkippedQuota: 0,
      profilesFailed: 0,
      failed: false,
    };
  }

  private async upsertArea(
    area: FootballDataTeam["area"],
  ): Promise<number | null> {
    if (!area) {
      return null;
    }

    const row = await this.prisma.area.upsert({
      where: { footballDataAreaId: area.id },
      create: {
        footballDataAreaId: area.id,
        name: area.name,
        code: area.code,
        flag: area.flag,
      },
      update: {
        name: area.name,
        code: area.code,
        flag: area.flag,
      },
    });

    return row.id;
  }

  private async syncCompetitions(
    clubId: number,
    competitions: FootballDataCompetition[],
  ): Promise<void> {
    const competitionIds = await Promise.all(
      competitions.map((competition) => this.upsertCompetition(competition)),
    );

    await this.prisma.club.update({
      where: { id: clubId },
      data: {
        competitions: {
          set: competitionIds.map((id) => ({ id })),
        },
      },
    });
  }

  private async upsertCompetition(
    competition: FootballDataCompetition,
  ): Promise<number> {
    const row = await this.prisma.competition.upsert({
      where: { footballDataCompetitionId: competition.id },
      create: {
        footballDataCompetitionId: competition.id,
        name: competition.name,
        code: competition.code,
        type: competition.type,
        emblem: competition.emblem,
      },
      update: {
        name: competition.name,
        code: competition.code,
        type: competition.type,
        emblem: competition.emblem,
      },
    });

    return row.id;
  }

  private async syncCoach(
    clubId: number,
    coach: FootballDataTeam["coach"],
  ): Promise<void> {
    if (!coach) {
      await this.prisma.coach.deleteMany({ where: { clubId } });
      return;
    }

    await this.prisma.coach.upsert({
      where: { clubId },
      create: {
        footballDataCoachId: coach.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        name: coach.name,
        dateOfBirth: this.toDate(coach.dateOfBirth),
        nationality: coach.nationality,
        contractStart: this.toDate(coach.contractStart),
        contractUntil: this.toDate(coach.contractUntil),
        clubId,
      },
      update: {
        footballDataCoachId: coach.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        name: coach.name,
        dateOfBirth: this.toDate(coach.dateOfBirth),
        nationality: coach.nationality,
        contractStart: this.toDate(coach.contractStart),
        contractUntil: this.toDate(coach.contractUntil),
      },
    });
  }

  private toDate(value: string | null): Date | null {
    return value ? new Date(value) : null;
  }

  private lastUpdatedChanged(
    existing: Date | null,
    incoming: string | null,
  ): boolean {
    const incomingDate = this.toDate(incoming);

    if (existing === null || incomingDate === null) {
      return existing !== null || incomingDate !== null;
    }

    return existing.getTime() !== incomingDate.getTime();
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
      stadiumImagesUpdated: 0,
      clubsWithoutStadiumImage: [],
      playersCreated: 0,
      playersUpdated: 0,
      playersDeactivated: 0,
      clubsSkippedFresh: 0,
      clubsSkippedQuota: 0,
      failedClubs: [],
      profilesUpdated: 0,
      profilesSkippedQuota: 0,
      profilesFailed: 0,
      failed: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
