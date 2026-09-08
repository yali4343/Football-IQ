import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  FootballDataClient,
  FootballDataTeam,
} from "../integrations/footballData/FootballDataClient.js";
import { PrismaFootballSyncService } from "./PrismaFootballSyncService.js";

const premierLeague = { id: 1, name: "Premier League", footballDataId: 2021 };
const laLiga = { id: 2, name: "La Liga", footballDataId: 2014 };

function createMockPrisma() {
  return {
    league: { findMany: vi.fn() },
    club: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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

function service(
  prisma: ReturnType<typeof createMockPrisma>,
  client: FootballDataClient,
) {
  return new PrismaFootballSyncService(
    prisma as unknown as PrismaClient,
    client,
  );
}

describe("PrismaFootballSyncService", () => {
  it("creates a new club", async () => {
    const prisma = createMockPrisma();
    prisma.league.findMany.mockResolvedValue([premierLeague]);
    prisma.club.findUnique.mockResolvedValue(null);

    const client = createMockClient([
      { id: 42, name: "Arsenal", venue: "Emirates Stadium", tla: "ARS" },
    ]);

    const summary = await service(prisma, client).run();

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
    expect(summary.leagues[0]).toMatchObject({
      clubsCreated: 1,
      clubsUpdated: 0,
      clubsDeactivated: 0,
      failed: false,
    });
  });

  it("updates an existing club when name or stadium changes", async () => {
    const prisma = createMockPrisma();
    prisma.league.findMany.mockResolvedValue([premierLeague]);
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

    const summary = await service(prisma, client).run();

    expect(prisma.club.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: {
        name: "Arsenal",
        stadium: "Emirates Stadium",
        footballDataCode: "ARS",
        isActive: true,
      },
    });
    expect(summary.leagues[0]).toMatchObject({
      clubsCreated: 0,
      clubsUpdated: 1,
    });
  });

  it("reactivates a club that reappears in the response", async () => {
    const prisma = createMockPrisma();
    prisma.league.findMany.mockResolvedValue([premierLeague]);
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

    const summary = await service(prisma, client).run();

    expect(prisma.club.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: {
        name: "Arsenal",
        stadium: "Emirates Stadium",
        footballDataCode: "ARS",
        isActive: true,
      },
    });
    expect(summary.leagues[0].clubsUpdated).toBe(1);
  });

  it("deactivates clubs absent from the response", async () => {
    const prisma = createMockPrisma();
    prisma.league.findMany.mockResolvedValue([premierLeague]);
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

    const summary = await service(prisma, client).run();

    expect(prisma.club.updateMany).toHaveBeenCalledWith({
      where: {
        leagueId: 1,
        isActive: true,
        footballDataId: { notIn: [999, 42] },
      },
      data: { isActive: false },
    });
    expect(summary.leagues[0].clubsDeactivated).toBe(1);
  });

  it("reports a failed league fetch and leaves existing clubs untouched", async () => {
    const prisma = createMockPrisma();
    prisma.league.findMany.mockResolvedValue([premierLeague]);

    const client = createMockClient(new Error("network error"));

    const summary = await service(prisma, client).run();

    expect(prisma.club.findUnique).not.toHaveBeenCalled();
    expect(prisma.club.create).not.toHaveBeenCalled();
    expect(prisma.club.update).not.toHaveBeenCalled();
    expect(prisma.club.updateMany).not.toHaveBeenCalled();
    expect(summary.leagues[0]).toMatchObject({
      failed: true,
      error: "network error",
    });
  });

  it("does not deactivate the league when the API returns zero teams", async () => {
    const prisma = createMockPrisma();
    prisma.league.findMany.mockResolvedValue([premierLeague]);

    const client = createMockClient([]);

    const summary = await service(prisma, client).run();

    expect(prisma.club.updateMany).not.toHaveBeenCalled();
    expect(summary.leagues[0].failed).toBe(true);
  });

  it("running twice with unchanged data makes no further writes", async () => {
    const prisma = createMockPrisma();
    prisma.league.findMany.mockResolvedValue([premierLeague]);
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
    const target = service(prisma, client);

    await target.run();
    await target.run();

    expect(prisma.club.create).not.toHaveBeenCalled();
    expect(prisma.club.update).not.toHaveBeenCalled();
  });

  it("targets a single league via leagueSlug", async () => {
    const prisma = createMockPrisma();
    prisma.league.findMany.mockResolvedValue([premierLeague, laLiga]);
    prisma.club.findUnique.mockResolvedValue(null);

    const getCompetitionTeams = vi.fn().mockResolvedValue([
      { id: 1, name: "Test Club", venue: null, tla: "TST" },
    ]);
    const client: FootballDataClient = { getCompetitionTeams };

    await service(prisma, client).run({ leagueSlug: "la-liga" });

    expect(getCompetitionTeams).toHaveBeenCalledTimes(1);
    expect(getCompetitionTeams).toHaveBeenCalledWith(2014);
  });
});
