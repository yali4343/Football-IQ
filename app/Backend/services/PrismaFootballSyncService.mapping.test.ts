import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  ApiFootballClient,
  ApiFootballTeam,
} from "../integrations/apiFootball/ApiFootballClient.js";
import type { FootballDataClient } from "../integrations/footballData/FootballDataClient.js";
import { PrismaFootballSyncService } from "./PrismaFootballSyncService.js";

const league = {
  id: 1,
  name: "Bundesliga",
  footballDataId: 2002,
  apiFootballLeagueId: 78,
};

// Membership sync always runs before mapping; give it one team that exactly
// matches the existing club fixture below so it's a no-op and mapping is
// what's actually under test.
function createMockFootballDataClient(): FootballDataClient {
  return {
    getCompetitionTeams: vi.fn().mockResolvedValue([
      { id: 999, name: "Some Club", venue: null, tla: "SC" },
    ]),
  };
}

function createMockPrisma(mappableClubs: unknown[]) {
  return {
    league: { findMany: vi.fn().mockResolvedValue([league]) },
    club: {
      findUnique: vi.fn().mockResolvedValue({
        id: 100,
        name: "Some Club",
        stadium: null,
        footballDataId: 999,
        footballDataCode: "SC",
        isActive: true,
      }),
      findMany: vi.fn().mockResolvedValue(mappableClubs),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function service(
  prisma: ReturnType<typeof createMockPrisma>,
  apiFootballClient: ApiFootballClient,
) {
  return new PrismaFootballSyncService(
    prisma as unknown as PrismaClient,
    createMockFootballDataClient(),
    apiFootballClient,
  );
}

function alwaysAvailableClient(
  directory: ApiFootballTeam[],
  searchResults: ApiFootballTeam[] = [],
): ApiFootballClient {
  return {
    hasQuotaRemaining: () => true,
    getLeagueDirectory: vi.fn().mockResolvedValue(directory),
    searchTeam: vi.fn().mockResolvedValue(searchResults),
  };
}

describe("PrismaFootballSyncService mapping", () => {
  it("maps by exact 3-letter code", async () => {
    const club = { id: 5, name: "Arsenal FC", footballDataCode: "ARS", apiFootballId: null };
    const prisma = createMockPrisma([club]);
    const client = alwaysAvailableClient([
      { id: 42, name: "Arsenal", code: "ARS" },
    ]);

    const summary = await service(prisma, client).run();

    expect(prisma.club.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { apiFootballId: 42 },
    });
    expect(summary.leagues[0]).toMatchObject({
      clubsMapped: 1,
      unmappedClubs: [],
    });
  });

  it("falls back to normalized-name match when the code doesn't match", async () => {
    const club = {
      id: 5,
      name: "Arsenal FC",
      footballDataCode: "XXX",
      apiFootballId: null,
    };
    const prisma = createMockPrisma([club]);
    const client = alwaysAvailableClient([
      { id: 42, name: "Arsenal", code: "DIFFERENT" },
    ]);

    const summary = await service(prisma, client).run();

    expect(prisma.club.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { apiFootballId: 42 },
    });
    expect(summary.leagues[0].clubsMapped).toBe(1);
  });

  it("reports ambiguous candidates as unmapped without creating a duplicate club", async () => {
    const club = {
      id: 5,
      name: "Arsenal FC",
      footballDataCode: "ARS",
      apiFootballId: null,
    };
    const prisma = createMockPrisma([club]);
    // Two directory entries share both the code and the normalized name
    // (e.g. a reserve/duplicate listing), and the search fallback is
    // equally ambiguous — no unique match should ever be picked.
    const ambiguous: ApiFootballTeam[] = [
      { id: 42, name: "Arsenal", code: "ARS" },
      { id: 43, name: "Arsenal", code: "ARS" },
    ];
    const client = alwaysAvailableClient(ambiguous, ambiguous);

    const summary = await service(prisma, client).run();

    expect(prisma.club.update).not.toHaveBeenCalled();
    expect(prisma.club.create).not.toHaveBeenCalled();
    expect(summary.leagues[0]).toMatchObject({
      clubsMapped: 0,
      unmappedClubs: ["Arsenal FC"],
    });
  });

  it("never re-queries already-mapped clubs unless --force", async () => {
    const prisma = createMockPrisma([]);
    const client = alwaysAvailableClient([]);

    await service(prisma, client).run();

    expect(prisma.club.findMany).toHaveBeenCalledWith({
      where: { leagueId: 1, isActive: true, apiFootballId: null },
    });
  });

  it("includes already-mapped clubs in the lookup when --force is passed", async () => {
    const prisma = createMockPrisma([]);
    const client = alwaysAvailableClient([]);

    await service(prisma, client).run({ force: true });

    expect(prisma.club.findMany).toHaveBeenCalledWith({
      where: { leagueId: 1, isActive: true },
    });
  });

  it("stops issuing ApiFootballClient calls once the quota guard trips", async () => {
    const club = {
      id: 5,
      name: "Arsenal FC",
      footballDataCode: "ARS",
      apiFootballId: null,
    };
    const prisma = createMockPrisma([club]);
    const getLeagueDirectory = vi.fn().mockResolvedValue([]);
    const searchTeam = vi.fn().mockResolvedValue([]);
    const client: ApiFootballClient = {
      hasQuotaRemaining: () => false,
      getLeagueDirectory,
      searchTeam,
    };

    const summary = await service(prisma, client).run();

    expect(getLeagueDirectory).not.toHaveBeenCalled();
    expect(searchTeam).not.toHaveBeenCalled();
    expect(summary.leagues[0].unmappedClubs).toEqual(["Arsenal FC"]);
  });
});
