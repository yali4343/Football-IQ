import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  ApiFootballClient,
  ApiFootballTeam,
} from "../../integrations/apiFootball/ApiFootballClient.js";
import type {
  FootballDataClient,
  FootballDataTeam,
} from "../../integrations/footballData/FootballDataClient.js";
import type { TheSportsDbClient } from "../../integrations/theSportsDb/TheSportsDbClient.js";
import { PrismaFootballSyncService } from "./PrismaFootballSyncService.js";

// PrismaFootballSyncService constructs MembershipSyncer/ClubMapper/
// SquadSyncer itself (deliberately not swappable via the constructor — see
// the "rejected alternatives" in the refactor plan), so there's no seam to
// inject fake collaborators directly. These tests instead exercise the
// orchestrator's own logic — league routing, short-circuiting on a failed
// membership sync, and result aggregation — through minimal Prisma/client
// mocks, without re-testing each collaborator's business rules (already
// fully covered in MembershipSyncer.test.ts/ClubMapper.test.ts/
// SquadSyncer.test.ts).

const premierLeague = {
  id: 1,
  name: "Premier League",
  footballDataId: 2021,
  apiFootballLeagueId: 39,
};
const laLiga = {
  id: 2,
  name: "La Liga",
  footballDataId: 2014,
  apiFootballLeagueId: 140,
};

function createMockPrisma() {
  return {
    league: { findMany: vi.fn() },
    club: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 5 }),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    player: { groupBy: vi.fn().mockResolvedValue([]) },
    area: { upsert: vi.fn() },
    competition: { upsert: vi.fn() },
    coach: { upsert: vi.fn(), deleteMany: vi.fn() },
  };
}

function createMockFootballDataClient(
  teamsByLeague: Record<number, FootballDataTeam[]> = {},
): FootballDataClient {
  return {
    getCompetitionTeams: vi
      .fn()
      .mockImplementation((footballDataId: number) =>
        Promise.resolve(teamsByLeague[footballDataId] ?? []),
      ),
  };
}

function createMockApiFootballClient(options: {
  requestsUsed?: number | null;
  directory?: ApiFootballTeam[];
} = {}): ApiFootballClient {
  return {
    hasQuotaRemaining: () => true,
    getRequestsUsed: () => options.requestsUsed ?? null,
    getLeagueDirectory: vi.fn().mockResolvedValue(options.directory ?? []),
    searchTeam: vi.fn().mockResolvedValue([]),
    getSquad: vi.fn().mockResolvedValue([]),
    getPlayerProfile: vi.fn().mockResolvedValue(null),
  };
}

function createMockTheSportsDbClient(): TheSportsDbClient {
  return {
    isRateLimited: () => false,
    findVenueImageUrl: vi.fn().mockResolvedValue(null),
    findVenueImageUrlByTeamName: vi.fn().mockResolvedValue(null),
  };
}

function service(
  prisma: ReturnType<typeof createMockPrisma>,
  footballDataClient: FootballDataClient,
  apiFootballClient: ApiFootballClient,
  theSportsDbClient: TheSportsDbClient = createMockTheSportsDbClient(),
) {
  return new PrismaFootballSyncService(
    prisma as unknown as PrismaClient,
    footballDataClient,
    apiFootballClient,
    theSportsDbClient,
  );
}

describe("PrismaFootballSyncService (orchestration)", () => {
  it("processes only the league matching leagueSlug", async () => {
    const prisma = createMockPrisma();
    prisma.league.findMany.mockResolvedValue([premierLeague, laLiga]);

    const getCompetitionTeams = vi.fn().mockResolvedValue([]);
    const footballDataClient: FootballDataClient = { getCompetitionTeams };
    const apiFootballClient = createMockApiFootballClient();

    await service(prisma, footballDataClient, apiFootballClient).run({
      leagueSlug: "la-liga",
    });

    expect(getCompetitionTeams).toHaveBeenCalledTimes(1);
    expect(getCompetitionTeams).toHaveBeenCalledWith(2014);
  });

  it("short-circuits mapping and squad sync when membership sync fails", async () => {
    const prisma = createMockPrisma();
    prisma.league.findMany.mockResolvedValue([premierLeague]);

    const footballDataClient = createMockFootballDataClient(); // no teams -> zero-teams guard fails membership
    const getLeagueDirectory = vi.fn();
    const getSquad = vi.fn();
    const apiFootballClient: ApiFootballClient = {
      hasQuotaRemaining: () => true,
      getRequestsUsed: () => null,
      getLeagueDirectory,
      searchTeam: vi.fn(),
      getSquad,
      getPlayerProfile: vi.fn(),
    };

    const summary = await service(
      prisma,
      footballDataClient,
      apiFootballClient,
    ).run();

    expect(getLeagueDirectory).not.toHaveBeenCalled();
    expect(getSquad).not.toHaveBeenCalled();
    expect(summary.leagues[0]).toMatchObject({
      failed: true,
      clubsMapped: 0,
      unmappedClubs: [],
      playersCreated: 0,
    });
  });

  it("aggregates mapping and squad results into the league summary", async () => {
    const prisma = createMockPrisma();
    prisma.league.findMany.mockResolvedValue([premierLeague]);
    // Membership: one new club created.
    const footballDataClient = createMockFootballDataClient({
      2021: [
        {
          id: 42,
          name: "Arsenal",
          venue: "Emirates Stadium",
          tla: "ARS",
          shortName: null,
          crest: null,
          address: null,
          website: null,
          founded: null,
          clubColors: null,
          area: null,
          runningCompetitions: [],
          coach: null,
          lastUpdated: null,
        },
      ],
    });
    // Mapping phase asks for unmapped clubs; give it one club with a code
    // that matches the directory, so it maps successfully.
    prisma.club.findMany.mockImplementation(
      (args: { where?: { apiFootballId?: unknown } }) => {
        if (args?.where?.apiFootballId === null) {
          return Promise.resolve([
            {
              id: 5,
              name: "Arsenal",
              footballDataCode: "ARS",
              apiFootballId: null,
            },
          ]);
        }
        // Squad phase asks for mapped clubs — none yet in this mock's
        // world (mapping's update() call isn't reflected back into this
        // static mock), so squad sync legitimately does nothing here.
        return Promise.resolve([]);
      },
    );
    const apiFootballClient = createMockApiFootballClient({
      requestsUsed: 37,
      directory: [{ id: 42, name: "Arsenal", code: "ARS" }],
    });

    const summary = await service(
      prisma,
      footballDataClient,
      apiFootballClient,
    ).run();

    expect(summary.leagues[0]).toMatchObject({
      clubsCreated: 1,
      clubsMapped: 1,
      unmappedClubs: [],
    });
  });

  it("processes leagues in missing-data priority order, not league.findMany's order", async () => {
    const prisma = createMockPrisma();
    prisma.league.findMany.mockResolvedValue([premierLeague, laLiga]);

    prisma.club.findMany.mockImplementation(
      (args: { where?: { leagueId?: unknown } }) => {
        const leagueIdFilter = args?.where?.leagueId;
        const isCrossLeaguePriorityQuery =
          leagueIdFilter !== null &&
          typeof leagueIdFilter === "object" &&
          "in" in leagueIdFilter;

        if (isCrossLeaguePriorityQuery) {
          // La Liga's club has never had its squad synced; Premier
          // League's has — so La Liga should be processed first even
          // though it sorts second in league.findMany's own order.
          return Promise.resolve([
            { id: 100, leagueId: laLiga.id, squadLastSyncedAt: null },
            { id: 200, leagueId: premierLeague.id, squadLastSyncedAt: new Date() },
          ]);
        }

        // Per-league calls made by MembershipSyncer/ClubMapper/SquadSyncer
        // — no real clubs needed for this test, only processing order.
        return Promise.resolve([]);
      },
    );

    const callOrder: number[] = [];
    const getCompetitionTeams = vi.fn().mockImplementation(
      (footballDataId: number) => {
        callOrder.push(footballDataId);
        return Promise.resolve([]);
      },
    );
    const footballDataClient: FootballDataClient = { getCompetitionTeams };
    const apiFootballClient = createMockApiFootballClient();

    await service(prisma, footballDataClient, apiFootballClient).run();

    expect(callOrder).toEqual([
      laLiga.footballDataId,
      premierLeague.footballDataId,
    ]);
  });

  it("reports requestsUsed from the ApiFootballClient", async () => {
    const prisma = createMockPrisma();
    prisma.league.findMany.mockResolvedValue([premierLeague]);
    const footballDataClient = createMockFootballDataClient();
    const apiFootballClient = createMockApiFootballClient({ requestsUsed: 42 });

    const summary = await service(
      prisma,
      footballDataClient,
      apiFootballClient,
    ).run();

    expect(summary.requestsUsed).toBe(42);
  });
});
