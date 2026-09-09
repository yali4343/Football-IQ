import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  ApiFootballClient,
  ApiFootballPlayerProfile,
} from "../../integrations/apiFootball/ApiFootballClient.js";
import { PlayerProfileSyncer } from "./PlayerProfileSyncer.js";
import type { SyncTargetLeague } from "./types.js";

const league: SyncTargetLeague = {
  id: 1,
  name: "Bundesliga",
  footballDataId: 2002,
  apiFootballLeagueId: 78,
};

interface ClubFixture {
  id: number;
  name: string;
  apiFootballId: number;
}

function createMockPrisma(
  clubs: ClubFixture[],
  players: Array<{ id: number; externalApiId: number }>,
) {
  return {
    club: {
      findMany: vi.fn().mockResolvedValue(clubs),
    },
    player: {
      findMany: vi.fn().mockResolvedValue(players),
      update: vi.fn(),
    },
  };
}

function syncer(
  prisma: ReturnType<typeof createMockPrisma>,
  apiFootballClient: ApiFootballClient,
) {
  return new PlayerProfileSyncer(
    prisma as unknown as PrismaClient,
    apiFootballClient,
  );
}

function apiFootballClient(
  profileById: Record<number, ApiFootballPlayerProfile | null | Error>,
  hasQuotaRemaining = () => true,
): ApiFootballClient {
  return {
    hasQuotaRemaining,
    getRequestsUsed: () => null,
    getLeagueDirectory: () => Promise.reject(new Error("not used")),
    searchTeam: () => Promise.reject(new Error("not used")),
    getSquad: () => Promise.reject(new Error("not used")),
    getPlayerProfile: vi.fn().mockImplementation((playerId: number) => {
      const result = profileById[playerId];
      if (result instanceof Error) {
        return Promise.reject(result);
      }
      return Promise.resolve(result ?? null);
    }),
  };
}

const club: ClubFixture = { id: 10, name: "Bayern Munich", apiFootballId: 5 };

describe("PlayerProfileSyncer", () => {
  it("fetches and persists profile fields for players missing a birth date", async () => {
    const prisma = createMockPrisma(
      [club],
      [{ id: 1, externalApiId: 100 }],
    );
    const profile: ApiFootballPlayerProfile = {
      id: 100,
      name: "A. Player",
      firstname: "Alex",
      lastname: "Player",
      birthDate: "1995-05-10",
      birthPlace: "Munich",
      birthCountry: "Germany",
      nationality: "Germany",
      height: "180 cm",
      weight: "75 kg",
      photo: "https://example.com/100.png",
    };
    const client = apiFootballClient({ 100: profile });

    const result = await syncer(prisma, client).syncLeague(
      league,
      false,
      undefined,
    );

    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: { clubId: { in: [10] }, isActive: true, dateOfBirth: null },
      select: { id: true, externalApiId: true },
    });
    expect(prisma.player.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        firstName: "Alex",
        lastName: "Player",
        dateOfBirth: new Date("1995-05-10"),
        birthPlace: "Munich",
        birthCountry: "Germany",
        nationality: "Germany",
        height: "180 cm",
        weight: "75 kg",
      },
    });
    expect(result).toEqual({
      profilesUpdated: 1,
      profilesSkippedQuota: 0,
      profilesFailed: 0,
    });
  });

  it("queries all active players (not just missing ones) when forced", async () => {
    const prisma = createMockPrisma([club], []);
    const client = apiFootballClient({});

    await syncer(prisma, client).syncLeague(league, true, undefined);

    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: { clubId: { in: [10] }, isActive: true },
      select: { id: true, externalApiId: true },
    });
  });

  it("stops issuing requests once the quota guard trips", async () => {
    const prisma = createMockPrisma(
      [club],
      [
        { id: 1, externalApiId: 100 },
        { id: 2, externalApiId: 101 },
      ],
    );
    const client = apiFootballClient({}, () => false);

    const result = await syncer(prisma, client).syncLeague(
      league,
      false,
      undefined,
    );

    expect(client.getPlayerProfile).not.toHaveBeenCalled();
    expect(result).toEqual({
      profilesUpdated: 0,
      profilesSkippedQuota: 2,
      profilesFailed: 0,
    });
  });

  it("counts a failed lookup without aborting the remaining players", async () => {
    const prisma = createMockPrisma(
      [club],
      [
        { id: 1, externalApiId: 100 },
        { id: 2, externalApiId: 101 },
      ],
    );
    const profile: ApiFootballPlayerProfile = {
      id: 101,
      name: "B. Player",
      firstname: "Ben",
      lastname: "Player",
      birthDate: null,
      birthPlace: null,
      birthCountry: null,
      nationality: null,
      height: null,
      weight: null,
      photo: null,
    };
    const client = apiFootballClient({
      100: new Error("API-Football request failed"),
      101: profile,
    });

    const result = await syncer(prisma, client).syncLeague(
      league,
      false,
      undefined,
    );

    expect(result).toEqual({
      profilesUpdated: 1,
      profilesSkippedQuota: 0,
      profilesFailed: 1,
    });
  });

  it("filters to the matching club when clubSlug is given", async () => {
    const otherClub: ClubFixture = {
      id: 11,
      name: "Borussia Dortmund",
      apiFootballId: 6,
    };
    const prisma = createMockPrisma([club, otherClub], []);
    const client = apiFootballClient({});

    await syncer(prisma, client).syncLeague(league, false, "bayern-munich");

    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: { clubId: { in: [10] }, isActive: true, dateOfBirth: null },
      select: { id: true, externalApiId: true },
    });
  });

  it("skips the player lookup entirely when no clubs match", async () => {
    const prisma = createMockPrisma([], []);
    const client = apiFootballClient({});

    const result = await syncer(prisma, client).syncLeague(
      league,
      false,
      undefined,
    );

    expect(prisma.player.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      profilesUpdated: 0,
      profilesSkippedQuota: 0,
      profilesFailed: 0,
    });
  });
});
