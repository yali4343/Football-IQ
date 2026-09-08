import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  FootballDataClient,
  FootballDataTeam,
} from "../../integrations/footballData/FootballDataClient.js";
import { MembershipSyncer } from "./MembershipSyncer.js";
import type { SyncTargetLeague } from "./types.js";

const premierLeague: SyncTargetLeague = {
  id: 1,
  name: "Premier League",
  footballDataId: 2021,
  apiFootballLeagueId: null,
};

function createMockPrisma() {
  return {
    club: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

function createMockClient(
  result: FootballDataTeam[] | Error,
): FootballDataClient {
  return {
    getCompetitionTeams: vi.fn().mockImplementation(async () => {
      if (result instanceof Error) {
        throw result;
      }

      return result;
    }),
  };
}

function syncer(
  prisma: ReturnType<typeof createMockPrisma>,
  client: FootballDataClient,
) {
  return new MembershipSyncer(prisma as unknown as PrismaClient, client);
}

describe("MembershipSyncer", () => {
  it("creates a new club", async () => {
    const prisma = createMockPrisma();
    prisma.club.findUnique.mockResolvedValue(null);

    const client = createMockClient([
      { id: 42, name: "Arsenal", venue: "Emirates Stadium", tla: "ARS" },
    ]);

    const summary = await syncer(prisma, client).sync(premierLeague, false);

    expect(prisma.club.create).toHaveBeenCalledWith({
      data: {
        name: "Arsenal",
        stadium: "Emirates Stadium",
        footballDataId: 42,
        footballDataCode: "ARS",
        leagueId: 1,
        isActive: true,
      },
    });
    expect(summary).toMatchObject({
      clubsCreated: 1,
      clubsUpdated: 0,
      clubsDeactivated: 0,
      failed: false,
    });
  });

  it("updates an existing club when name or stadium changes", async () => {
    const prisma = createMockPrisma();
    prisma.club.findUnique.mockResolvedValue({
      id: 5,
      name: "Arsenal FC",
      stadium: "Old Stadium Name",
      footballDataId: 42,
      footballDataCode: "ARS",
      isActive: true,
    });

    const client = createMockClient([
      { id: 42, name: "Arsenal", venue: "Emirates Stadium", tla: "ARS" },
    ]);

    const summary = await syncer(prisma, client).sync(premierLeague, false);

    expect(prisma.club.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: {
        name: "Arsenal",
        stadium: "Emirates Stadium",
        footballDataCode: "ARS",
        isActive: true,
      },
    });
    expect(summary).toMatchObject({ clubsCreated: 0, clubsUpdated: 1 });
  });

  it("reactivates a club that reappears in the response", async () => {
    const prisma = createMockPrisma();
    prisma.club.findUnique.mockResolvedValue({
      id: 5,
      name: "Arsenal",
      stadium: "Emirates Stadium",
      footballDataId: 42,
      footballDataCode: "ARS",
      isActive: false,
    });

    const client = createMockClient([
      { id: 42, name: "Arsenal", venue: "Emirates Stadium", tla: "ARS" },
    ]);

    const summary = await syncer(prisma, client).sync(premierLeague, false);

    expect(prisma.club.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: {
        name: "Arsenal",
        stadium: "Emirates Stadium",
        footballDataCode: "ARS",
        isActive: true,
      },
    });
    expect(summary.clubsUpdated).toBe(1);
  });

  it("deactivates clubs absent from the response", async () => {
    const prisma = createMockPrisma();
    prisma.club.findUnique.mockResolvedValue({
      id: 5,
      name: "Some Other Club",
      stadium: null,
      footballDataId: 999,
      footballDataCode: "SOC",
      isActive: true,
    });
    prisma.club.updateMany.mockResolvedValue({ count: 1 });

    const client = createMockClient([
      { id: 999, name: "Some Other Club", venue: null, tla: "SOC" },
      { id: 42, name: "Arsenal", venue: "Emirates Stadium", tla: "ARS" },
    ]);

    const summary = await syncer(prisma, client).sync(premierLeague, false);

    expect(prisma.club.updateMany).toHaveBeenCalledWith({
      where: {
        leagueId: 1,
        isActive: true,
        footballDataId: { notIn: [999, 42] },
      },
      data: { isActive: false },
    });
    expect(summary.clubsDeactivated).toBe(1);
  });

  it("reports a failed league fetch and leaves existing clubs untouched", async () => {
    const prisma = createMockPrisma();
    const client = createMockClient(new Error("network error"));

    const summary = await syncer(prisma, client).sync(premierLeague, false);

    expect(prisma.club.findUnique).not.toHaveBeenCalled();
    expect(prisma.club.create).not.toHaveBeenCalled();
    expect(prisma.club.update).not.toHaveBeenCalled();
    expect(prisma.club.updateMany).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ failed: true, error: "network error" });
  });

  it("does not deactivate the league when the API returns zero teams", async () => {
    const prisma = createMockPrisma();
    const client = createMockClient([]);

    const summary = await syncer(prisma, client).sync(premierLeague, false);

    expect(prisma.club.updateMany).not.toHaveBeenCalled();
    expect(summary.failed).toBe(true);
  });

  it("running twice with unchanged data makes no further writes", async () => {
    const prisma = createMockPrisma();
    prisma.club.findUnique.mockResolvedValue({
      id: 5,
      name: "Arsenal",
      stadium: "Emirates Stadium",
      footballDataId: 42,
      footballDataCode: "ARS",
      isActive: true,
    });

    const client = createMockClient([
      { id: 42, name: "Arsenal", venue: "Emirates Stadium", tla: "ARS" },
    ]);
    const target = syncer(prisma, client);

    await target.sync(premierLeague, false);
    await target.sync(premierLeague, false);

    expect(prisma.club.create).not.toHaveBeenCalled();
    expect(prisma.club.update).not.toHaveBeenCalled();
  });

  it("--dry-run performs reads but issues zero writes", async () => {
    const prisma = createMockPrisma();
    prisma.club.findUnique.mockResolvedValue(null);
    prisma.club.count.mockResolvedValue(0);

    const client = createMockClient([
      { id: 42, name: "Arsenal", venue: "Emirates Stadium", tla: "ARS" },
    ]);

    const summary = await syncer(prisma, client).sync(premierLeague, true);

    expect(prisma.club.create).not.toHaveBeenCalled();
    expect(prisma.club.update).not.toHaveBeenCalled();
    expect(prisma.club.updateMany).not.toHaveBeenCalled();
    expect(summary.clubsCreated).toBe(1);
  });
});
