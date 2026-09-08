import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  ApiFootballClient,
  ApiFootballSquadPlayer,
} from "../../integrations/apiFootball/ApiFootballClient.js";
import type { FootballDataClient } from "../../integrations/footballData/FootballDataClient.js";
import { PrismaFootballSyncService } from "./PrismaFootballSyncService.js";

const league = {
  id: 1,
  name: "Bundesliga",
  footballDataId: 2002,
  apiFootballLeagueId: 78,
};

// Membership sync always runs first; give it one team that exactly matches
// an existing club so it's a no-op and squad sync is what's under test.
function createMockFootballDataClient(): FootballDataClient {
  return {
    getCompetitionTeams: vi.fn().mockResolvedValue([
      { id: 999, name: "Some Club", venue: null, tla: "SC" },
    ]),
  };
}

interface ClubFixture {
  id: number;
  name: string;
  apiFootballId: number;
  squadLastSyncedAt: Date | null;
}

function createMockPrisma(
  squadSyncClubs: ClubFixture[],
  existingPlayers: Record<number, unknown> = {},
) {
  const txPlayer = {
    findUnique: vi.fn().mockImplementation(
      ({ where }: { where: { externalApiId: number } }) =>
        Promise.resolve(existingPlayers[where.externalApiId] ?? null),
    ),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  const club = {
    findUnique: vi.fn().mockResolvedValue({
      id: 900,
      name: "Some Club",
      stadium: null,
      footballDataId: 999,
      footballDataCode: "SC",
      isActive: true,
    }),
    findMany: vi.fn().mockImplementation((args: { where?: { apiFootballId?: unknown } }) => {
      // mapLeagueClubs asks for unmapped clubs (apiFootballId: null) —
      // nothing to map here, every fixture is already mapped.
      if (args?.where && "apiFootballId" in args.where && args.where.apiFootballId === null) {
        return Promise.resolve([]);
      }
      return Promise.resolve(squadSyncClubs);
    }),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
  };
  const player = {
    findUnique: txPlayer.findUnique,
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
  };

  return {
    league: { findMany: vi.fn().mockResolvedValue([league]) },
    club,
    player,
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({ player: txPlayer, club }),
    ),
    txPlayer,
  };
}

function apiFootballClient(
  squadByTeam: Record<number, ApiFootballSquadPlayer[] | Error>,
  hasQuotaRemaining = () => true,
): ApiFootballClient {
  return {
    hasQuotaRemaining,
    getRequestsUsed: () => null,
    getLeagueDirectory: vi.fn().mockResolvedValue([]),
    searchTeam: vi.fn().mockResolvedValue([]),
    getSquad: vi.fn().mockImplementation((teamId: number) => {
      const result = squadByTeam[teamId];
      if (result instanceof Error) {
        return Promise.reject(result);
      }
      return Promise.resolve(result ?? []);
    }),
  };
}

function service(
  prisma: ReturnType<typeof createMockPrisma>,
  client: ApiFootballClient,
) {
  return new PrismaFootballSyncService(
    prisma as unknown as PrismaClient,
    createMockFootballDataClient(),
    client,
  );
}

const musiala: ApiFootballSquadPlayer = {
  id: 501,
  name: "Jamal Musiala",
  age: 21,
  number: 42,
  position: "Midfielder",
  photo: "https://example.com/501.png",
};

describe("PrismaFootballSyncService squad sync", () => {
  it("creates a new player", async () => {
    const club: ClubFixture = {
      id: 900,
      name: "Some Club",
      apiFootballId: 157,
      squadLastSyncedAt: null,
    };
    const prisma = createMockPrisma([club]);
    const client = apiFootballClient({ 157: [musiala] });

    const summary = await service(prisma, client).run();

    expect(prisma.txPlayer.create).toHaveBeenCalledWith({
      data: {
        name: "Jamal Musiala",
        position: "Midfielder",
        age: 21,
        number: 42,
        photoUrl: "https://example.com/501.png",
        clubId: 900,
        isActive: true,
        externalApiId: 501,
      },
    });
    expect(summary.leagues[0]).toMatchObject({
      playersCreated: 1,
      playersUpdated: 0,
      playersDeactivated: 0,
    });
  });

  it("updates an existing player's changed fields", async () => {
    const club: ClubFixture = {
      id: 900,
      name: "Some Club",
      apiFootballId: 157,
      squadLastSyncedAt: null,
    };
    const prisma = createMockPrisma([club], {
      501: {
        id: 1,
        name: "Jamal Musiala",
        position: "Midfielder",
        age: 20, // stale — real value is 21
        number: 42,
        photoUrl: "https://example.com/501.png",
        clubId: 900,
        isActive: true,
      },
    });
    const client = apiFootballClient({ 157: [musiala] });

    const summary = await service(prisma, client).run();

    expect(prisma.txPlayer.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        name: "Jamal Musiala",
        position: "Midfielder",
        age: 21,
        number: 42,
        photoUrl: "https://example.com/501.png",
        clubId: 900,
        isActive: true,
      },
    });
    expect(summary.leagues[0].playersUpdated).toBe(1);
  });

  it("deactivates players absent from the new squad", async () => {
    const club: ClubFixture = {
      id: 900,
      name: "Some Club",
      apiFootballId: 157,
      squadLastSyncedAt: null,
    };
    const prisma = createMockPrisma([club]);
    prisma.txPlayer.updateMany.mockResolvedValue({ count: 3 });
    const client = apiFootballClient({ 157: [musiala] });

    const summary = await service(prisma, client).run();

    expect(prisma.txPlayer.updateMany).toHaveBeenCalledWith({
      where: { clubId: 900, isActive: true, externalApiId: { notIn: [501] } },
      data: { isActive: false },
    });
    expect(summary.leagues[0].playersDeactivated).toBe(3);
  });

  it("moves a transferred player to the new club without duplicating", async () => {
    const club: ClubFixture = {
      id: 900,
      name: "Some Club",
      apiFootballId: 157,
      squadLastSyncedAt: null,
    };
    const prisma = createMockPrisma([club], {
      501: {
        id: 1,
        name: "Jamal Musiala",
        position: "Midfielder",
        age: 21,
        number: 42,
        photoUrl: "https://example.com/501.png",
        clubId: 111, // still on the old club
        isActive: true,
      },
    });
    const client = apiFootballClient({ 157: [musiala] });

    const summary = await service(prisma, client).run();

    expect(prisma.txPlayer.create).not.toHaveBeenCalled();
    expect(prisma.txPlayer.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ clubId: 900 }),
    });
    expect(summary.leagues[0].playersUpdated).toBe(1);
  });

  it("one club's failure doesn't stop the rest, and is reported", async () => {
    const clubA: ClubFixture = {
      id: 900,
      name: "Club A",
      apiFootballId: 157,
      squadLastSyncedAt: null,
    };
    const clubB: ClubFixture = {
      id: 901,
      name: "Club B",
      apiFootballId: 158,
      squadLastSyncedAt: null,
    };
    const prisma = createMockPrisma([clubA, clubB]);
    const client = apiFootballClient({
      157: new Error("network error"),
      158: [musiala],
    });

    const summary = await service(prisma, client).run();

    expect(summary.leagues[0].failedClubs).toEqual([
      { clubName: "Club A", error: "network error" },
    ]);
    expect(summary.leagues[0].playersCreated).toBe(1);
  });

  it("updates squadLastSyncedAt only on success", async () => {
    const club: ClubFixture = {
      id: 900,
      name: "Some Club",
      apiFootballId: 157,
      squadLastSyncedAt: null,
    };
    const prisma = createMockPrisma([club]);
    const client = apiFootballClient({ 157: [musiala] });

    await service(prisma, client).run();

    expect(prisma.club.update).toHaveBeenCalledWith({
      where: { id: 900 },
      data: { squadLastSyncedAt: expect.any(Date) },
    });
  });

  it("does not touch squadLastSyncedAt when the squad fetch fails", async () => {
    const club: ClubFixture = {
      id: 900,
      name: "Some Club",
      apiFootballId: 157,
      squadLastSyncedAt: null,
    };
    const prisma = createMockPrisma([club]);
    const client = apiFootballClient({ 157: new Error("boom") });

    await service(prisma, client).run();

    expect(prisma.club.update).not.toHaveBeenCalled();
  });

  it("a fresh club causes zero ApiFootballClient.getSquad calls unless --force", async () => {
    const club: ClubFixture = {
      id: 900,
      name: "Some Club",
      apiFootballId: 157,
      squadLastSyncedAt: new Date(), // synced just now
    };
    const prisma = createMockPrisma([club]);
    const client = apiFootballClient({ 157: [musiala] });

    const summary = await service(prisma, client).run();

    expect(client.getSquad).not.toHaveBeenCalled();
    expect(summary.leagues[0].clubsSkippedFresh).toBe(1);

    await service(prisma, client).run({ force: true });

    expect(client.getSquad).toHaveBeenCalledWith(157);
  });

  it("--dry-run performs reads but issues zero writes", async () => {
    const club: ClubFixture = {
      id: 900,
      name: "Some Club",
      apiFootballId: 157,
      squadLastSyncedAt: null,
    };
    const prisma = createMockPrisma([club]);
    const client = apiFootballClient({ 157: [musiala] });

    const summary = await service(prisma, client).run({ dryRun: true });

    expect(client.getSquad).toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.player.create).not.toHaveBeenCalled();
    expect(prisma.player.update).not.toHaveBeenCalled();
    expect(prisma.player.updateMany).not.toHaveBeenCalled();
    expect(prisma.club.update).not.toHaveBeenCalled();
    expect(summary.leagues[0].playersCreated).toBe(1);
  });

  it("the quota guard skips remaining clubs cleanly and reports them", async () => {
    const clubA: ClubFixture = {
      id: 900,
      name: "Club A",
      apiFootballId: 157,
      squadLastSyncedAt: null,
    };
    const clubB: ClubFixture = {
      id: 901,
      name: "Club B",
      apiFootballId: 158,
      squadLastSyncedAt: null,
    };
    const prisma = createMockPrisma([clubA, clubB]);
    const client = apiFootballClient(
      { 157: [musiala], 158: [musiala] },
      () => false,
    );

    const summary = await service(prisma, client).run();

    expect(client.getSquad).not.toHaveBeenCalled();
    expect(summary.leagues[0]).toMatchObject({
      clubsSkippedQuota: 2,
      failedClubs: [],
    });
  });
});
