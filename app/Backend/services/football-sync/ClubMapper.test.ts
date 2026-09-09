import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  ApiFootballClient,
  ApiFootballTeam,
} from "../../integrations/apiFootball/ApiFootballClient.js";
import { ClubMapper } from "./ClubMapper.js";
import type { SyncTargetLeague } from "./types.js";

const league: SyncTargetLeague = {
  id: 1,
  name: "Bundesliga",
  footballDataId: 2002,
  apiFootballLeagueId: 78,
};

function createMockPrisma(mappableClubs: unknown[]) {
  return {
    club: {
      findMany: vi.fn().mockResolvedValue(mappableClubs),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
}

function mapper(
  prisma: ReturnType<typeof createMockPrisma>,
  apiFootballClient: ApiFootballClient,
) {
  return new ClubMapper(prisma as unknown as PrismaClient, apiFootballClient);
}

function alwaysAvailableClient(
  directory: ApiFootballTeam[],
  searchResults: ApiFootballTeam[] = [],
): ApiFootballClient {
  return {
    hasQuotaRemaining: () => true,
    getRequestsUsed: () => null,
    getLeagueDirectory: vi.fn().mockResolvedValue(directory),
    searchTeam: vi.fn().mockResolvedValue(searchResults),
    getSquad: () => Promise.reject(new Error("not used")),
    getPlayerProfile: () => Promise.reject(new Error("not used")),
  };
}

describe("ClubMapper", () => {
  it("maps by exact 3-letter code", async () => {
    const club = {
      id: 5,
      name: "Arsenal FC",
      footballDataCode: "ARS",
      apiFootballId: null,
    };
    const prisma = createMockPrisma([club]);
    const client = alwaysAvailableClient([
      { id: 42, name: "Arsenal", code: "ARS" },
    ]);

    const result = await mapper(prisma, client).mapLeagueClubs(
      league,
      false,
      false,
    );

    expect(prisma.club.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { apiFootballId: 42 },
    });
    expect(result).toMatchObject({ mapped: 1, unmapped: [] });
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

    const result = await mapper(prisma, client).mapLeagueClubs(
      league,
      false,
      false,
    );

    expect(prisma.club.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { apiFootballId: 42 },
    });
    expect(result.mapped).toBe(1);
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

    const result = await mapper(prisma, client).mapLeagueClubs(
      league,
      false,
      false,
    );

    expect(prisma.club.update).not.toHaveBeenCalled();
    expect(prisma.club.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ mapped: 0, unmapped: ["Arsenal FC"] });
  });

  it("never re-queries already-mapped clubs unless --force", async () => {
    const prisma = createMockPrisma([]);
    const client = alwaysAvailableClient([]);

    await mapper(prisma, client).mapLeagueClubs(league, false, false);

    expect(prisma.club.findMany).toHaveBeenCalledWith({
      where: { leagueId: 1, isActive: true, apiFootballId: null },
    });
  });

  it("includes already-mapped clubs in the lookup when --force is passed", async () => {
    const prisma = createMockPrisma([]);
    const client = alwaysAvailableClient([]);

    await mapper(prisma, client).mapLeagueClubs(league, true, false);

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
      getRequestsUsed: () => 100,
      getLeagueDirectory,
      searchTeam,
      getSquad: () => Promise.reject(new Error("not used")),
      getPlayerProfile: () => Promise.reject(new Error("not used")),
    };

    const result = await mapper(prisma, client).mapLeagueClubs(
      league,
      false,
      false,
    );

    expect(getLeagueDirectory).not.toHaveBeenCalled();
    expect(searchTeam).not.toHaveBeenCalled();
    expect(result.unmapped).toEqual(["Arsenal FC"]);
  });

  it("--dry-run performs reads but issues zero writes", async () => {
    const club = {
      id: 5,
      name: "Arsenal FC",
      footballDataCode: "ARS",
      apiFootballId: null,
    };
    const prisma = createMockPrisma([club]);
    const client = alwaysAvailableClient([
      { id: 42, name: "Arsenal", code: "ARS" },
    ]);

    const result = await mapper(prisma, client).mapLeagueClubs(
      league,
      false,
      true,
    );

    expect(prisma.club.update).not.toHaveBeenCalled();
    expect(result.mapped).toBe(1);
  });
});
