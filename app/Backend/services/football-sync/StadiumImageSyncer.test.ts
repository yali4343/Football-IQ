import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { TheSportsDbClient } from "../../integrations/theSportsDb/TheSportsDbClient.js";
import { StadiumImageSyncer } from "./StadiumImageSyncer.js";
import type { SyncTargetLeague } from "./types.js";

const league: SyncTargetLeague = {
  id: 1,
  name: "Premier League",
  footballDataId: 2021,
  apiFootballLeagueId: 39,
};

interface ClubFixture {
  id: number;
  name: string;
  stadium: string | null;
}

function createMockPrisma(clubs: ClubFixture[]) {
  return {
    club: {
      findMany: vi.fn().mockResolvedValue(clubs),
      update: vi.fn(),
    },
  };
}

function syncer(
  prisma: ReturnType<typeof createMockPrisma>,
  theSportsDbClient: TheSportsDbClient,
) {
  return new StadiumImageSyncer(
    prisma as unknown as PrismaClient,
    theSportsDbClient,
  );
}

function theSportsDbClient(
  imageByTeamName: Record<string, string | null | Error>,
  isRateLimited: () => boolean = () => false,
  imageByVenue: Record<string, string | null | Error> = {},
): TheSportsDbClient {
  return {
    isRateLimited,
    findVenueImageUrlByTeamName: vi
      .fn()
      .mockImplementation((teamName: string) => {
        const result = imageByTeamName[teamName];
        if (result instanceof Error) {
          return Promise.reject(result);
        }
        return Promise.resolve(result ?? null);
      }),
    findVenueImageUrl: vi.fn().mockImplementation((venueName: string) => {
      const result = imageByVenue[venueName];
      if (result instanceof Error) {
        return Promise.reject(result);
      }
      return Promise.resolve(result ?? null);
    }),
  };
}

const club: ClubFixture = { id: 10, name: "Leeds United", stadium: "Elland Road" };

describe("StadiumImageSyncer", () => {
  it("persists the image found via the club's own team record", async () => {
    const prisma = createMockPrisma([club]);
    const client = theSportsDbClient({
      "leeds united": "https://example.com/elland-road.jpg",
    });

    const result = await syncer(prisma, client).syncLeague(
      league,
      false,
      false,
      undefined,
    );

    expect(prisma.club.findMany).toHaveBeenCalledWith({
      where: {
        leagueId: 1,
        isActive: true,
        stadium: { not: null },
        stadiumImageUrl: null,
      },
    });
    expect(client.findVenueImageUrlByTeamName).toHaveBeenCalledWith(
      "leeds united",
    );
    expect(client.findVenueImageUrl).not.toHaveBeenCalled();
    expect(prisma.club.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { stadiumImageUrl: "https://example.com/elland-road.jpg" },
    });
    expect(result).toEqual({
      updated: 1,
      clubsWithoutStadiumImage: [],
      skippedRateLimited: 0,
    });
  });

  it("records a club without failing the sync when neither lookup matches", async () => {
    const prisma = createMockPrisma([club]);
    const client = theSportsDbClient(
      { "leeds united": null },
      () => false,
      { "Elland Road": null },
    );

    const result = await syncer(prisma, client).syncLeague(
      league,
      false,
      false,
      undefined,
    );

    expect(prisma.club.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      updated: 0,
      clubsWithoutStadiumImage: ["Leeds United"],
      skippedRateLimited: 0,
    });
  });

  it("treats a provider error the same as no match, without throwing", async () => {
    const prisma = createMockPrisma([club]);
    const client = theSportsDbClient({
      "leeds united": new Error("TheSportsDB request failed"),
    });

    const result = await syncer(prisma, client).syncLeague(
      league,
      false,
      false,
      undefined,
    );

    expect(result).toEqual({
      updated: 0,
      clubsWithoutStadiumImage: ["Leeds United"],
      skippedRateLimited: 0,
    });
  });

  it("falls back to a venue-name search when TheSportsDB has no team record for the club", async () => {
    const nonLeagueClub: ClubFixture = {
      id: 20,
      name: "Some Ground FC",
      stadium: "Some Ground",
    };
    const prisma = createMockPrisma([nonLeagueClub]);
    const client = theSportsDbClient(
      { "some ground": null },
      () => false,
      { "Some Ground": "https://example.com/some-ground.jpg" },
    );

    const result = await syncer(prisma, client).syncLeague(
      league,
      false,
      false,
      undefined,
    );

    expect(client.findVenueImageUrlByTeamName).toHaveBeenCalledWith(
      "some ground",
    );
    expect(client.findVenueImageUrl).toHaveBeenCalledWith("Some Ground");
    expect(prisma.club.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { stadiumImageUrl: "https://example.com/some-ground.jpg" },
    });
    expect(result).toEqual({
      updated: 1,
      clubsWithoutStadiumImage: [],
      skippedRateLimited: 0,
    });
  });

  it("does not write when dryRun is true", async () => {
    const prisma = createMockPrisma([club]);
    const client = theSportsDbClient({
      "leeds united": "https://example.com/elland-road.jpg",
    });

    const result = await syncer(prisma, client).syncLeague(
      league,
      false,
      true,
      undefined,
    );

    expect(prisma.club.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      updated: 1,
      clubsWithoutStadiumImage: [],
      skippedRateLimited: 0,
    });
  });

  it("stops calling the provider once rate-limited, without marking remaining clubs as missing", async () => {
    const secondClub: ClubFixture = {
      id: 11,
      name: "Arsenal FC",
      stadium: "Emirates Stadium",
    };
    const thirdClub: ClubFixture = {
      id: 12,
      name: "Chelsea FC",
      stadium: "Stamford Bridge",
    };
    const prisma = createMockPrisma([club, secondClub, thirdClub]);
    let rateLimited = false;
    const client = theSportsDbClient({}, () => rateLimited);
    client.findVenueImageUrlByTeamName = vi.fn().mockImplementation(() => {
      rateLimited = true;
      return Promise.resolve(null);
    });

    const result = await syncer(prisma, client).syncLeague(
      league,
      false,
      false,
      undefined,
    );

    expect(client.findVenueImageUrlByTeamName).toHaveBeenCalledTimes(1);
    expect(client.findVenueImageUrl).not.toHaveBeenCalled();
    expect(result).toEqual({
      updated: 0,
      clubsWithoutStadiumImage: [],
      skippedRateLimited: 3,
    });
  });

  it("queries every active club (not just missing ones) when forced", async () => {
    const prisma = createMockPrisma([]);
    const client = theSportsDbClient({});

    await syncer(prisma, client).syncLeague(league, true, false, undefined);

    expect(prisma.club.findMany).toHaveBeenCalledWith({
      where: { leagueId: 1, isActive: true, stadium: { not: null } },
    });
  });

  it("filters to the matching club when clubSlug is given", async () => {
    const otherClub: ClubFixture = {
      id: 11,
      name: "Arsenal FC",
      stadium: "Emirates Stadium",
    };
    const prisma = createMockPrisma([club, otherClub]);
    const client = theSportsDbClient({});

    const result = await syncer(prisma, client).syncLeague(
      league,
      false,
      false,
      "leeds-united",
    );

    expect(client.findVenueImageUrlByTeamName).toHaveBeenCalledTimes(1);
    expect(client.findVenueImageUrlByTeamName).toHaveBeenCalledWith(
      "leeds united",
    );
    expect(result.clubsWithoutStadiumImage).toEqual(["Leeds United"]);
  });
});
