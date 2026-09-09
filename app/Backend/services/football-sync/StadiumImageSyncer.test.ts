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
  imageByVenue: Record<string, string | null | Error>,
  isRateLimited: () => boolean = () => false,
  imageByTeamName: Record<string, string | null | Error> = {},
): TheSportsDbClient {
  return {
    isRateLimited,
    findVenueImageUrl: vi.fn().mockImplementation((venueName: string) => {
      const result = imageByVenue[venueName];
      if (result instanceof Error) {
        return Promise.reject(result);
      }
      return Promise.resolve(result ?? null);
    }),
    findVenueImageUrlByTeamName: vi
      .fn()
      .mockImplementation((teamName: string) => {
        const result = imageByTeamName[teamName];
        if (result instanceof Error) {
          return Promise.reject(result);
        }
        return Promise.resolve(result ?? null);
      }),
  };
}

const club: ClubFixture = { id: 10, name: "Leeds United", stadium: "Elland Road" };

describe("StadiumImageSyncer", () => {
  it("persists the image when the venue matches", async () => {
    const prisma = createMockPrisma([club]);
    const client = theSportsDbClient({
      "Elland Road": "https://example.com/elland-road.jpg",
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

  it("records a club without failing the sync when there is no matching venue", async () => {
    const prisma = createMockPrisma([club]);
    const client = theSportsDbClient({ "Elland Road": null });

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
      "Elland Road": new Error("TheSportsDB request failed"),
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

  it("falls back to a team-name lookup when the venue name doesn't match", async () => {
    const barca: ClubFixture = {
      id: 20,
      name: "FC Barcelona",
      stadium: "Camp Nou",
    };
    const prisma = createMockPrisma([barca]);
    const client = theSportsDbClient(
      { "Camp Nou": null },
      () => false,
      { "FC Barcelona": "https://example.com/spotify-camp-nou.jpg" },
    );

    const result = await syncer(prisma, client).syncLeague(
      league,
      false,
      false,
      undefined,
    );

    expect(client.findVenueImageUrl).toHaveBeenCalledWith("Camp Nou");
    expect(client.findVenueImageUrlByTeamName).toHaveBeenCalledWith(
      "FC Barcelona",
    );
    expect(prisma.club.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { stadiumImageUrl: "https://example.com/spotify-camp-nou.jpg" },
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
      "Elland Road": "https://example.com/elland-road.jpg",
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
    const client = theSportsDbClient(
      { "Elland Road": null },
      () => rateLimited,
    );
    client.findVenueImageUrl = vi.fn().mockImplementation(() => {
      rateLimited = true;
      return Promise.resolve(null);
    });

    const result = await syncer(prisma, client).syncLeague(
      league,
      false,
      false,
      undefined,
    );

    expect(client.findVenueImageUrl).toHaveBeenCalledTimes(1);
    expect(client.findVenueImageUrlByTeamName).not.toHaveBeenCalled();
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

    expect(client.findVenueImageUrl).toHaveBeenCalledTimes(1);
    expect(client.findVenueImageUrl).toHaveBeenCalledWith("Elland Road");
    expect(result.clubsWithoutStadiumImage).toEqual(["Leeds United"]);
  });
});
