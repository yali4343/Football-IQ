import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { WikipediaClient } from "../integrations/wikipedia/WikipediaClient.js";
import { PrismaLeagueService } from "./PrismaLeagueService.js";

function createMockPrisma({
  leagues = [],
  competition = null,
  players = [],
}: {
  leagues?: unknown[];
  competition?: unknown;
  players?: unknown[];
}) {
  return {
    league: {
      findMany: vi.fn().mockResolvedValue(leagues),
    },
    competition: {
      findUnique: vi.fn().mockResolvedValue(competition),
    },
    player: {
      findMany: vi.fn().mockResolvedValue(players),
    },
  };
}

function createMockWikipediaClient(
  extract: string | null = null,
): WikipediaClient {
  return {
    getIntroExtract: vi.fn().mockResolvedValue(extract),
  };
}

function service(
  prisma: ReturnType<typeof createMockPrisma>,
  wikipediaClient: WikipediaClient = createMockWikipediaClient(),
) {
  return new PrismaLeagueService(
    prisma as unknown as PrismaClient,
    wikipediaClient,
  );
}

describe("PrismaLeagueService", () => {
  it("returns undefined when no league matches the slug", async () => {
    const prisma = createMockPrisma({
      leagues: [{ id: 1, name: "La Liga", footballDataId: 2014 }],
    });

    const result = await service(prisma).getLeagueStatsBySlug("bundesliga");

    expect(result).toBeUndefined();
  });

  it("resolves the league by its slugified name", async () => {
    const prisma = createMockPrisma({
      leagues: [
        { id: 1, name: "La Liga", footballDataId: 2014 },
        { id: 2, name: "Premier League", footballDataId: 2021 },
      ],
    });

    await service(prisma).getLeagueStatsBySlug("premier-league");

    expect(prisma.competition.findUnique).toHaveBeenCalledWith({
      where: { footballDataCompetitionId: 2021 },
    });
    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: { isActive: true, club: { leagueId: 2, isActive: true } },
      select: {
        age: true,
        nationality: true,
        club: { select: { area: { select: { name: true } } } },
      },
    });
  });

  it("combines the competition emblem, a Wikipedia description, and player stats", async () => {
    const prisma = createMockPrisma({
      leagues: [{ id: 1, name: "La Liga", footballDataId: 2014 }],
      competition: { emblem: "https://crests.football-data.org/laliga.png" },
      players: [
        { age: 24, nationality: "Spain", club: { area: { name: "Spain" } } },
        {
          age: 30,
          nationality: "Argentina",
          club: { area: { name: "Spain" } },
        },
      ],
    });
    const wikipediaClient = createMockWikipediaClient(
      "La Liga is Spain's top division. It is contested by 20 clubs.",
    );

    const result = await service(prisma, wikipediaClient).getLeagueStatsBySlug(
      "la-liga",
    );

    expect(wikipediaClient.getIntroExtract).toHaveBeenCalledWith("La Liga");
    expect(result).toMatchObject({
      name: "La Liga",
      slug: "la-liga",
      emblem: "https://crests.football-data.org/laliga.png",
      description: "La Liga is Spain's top division. It is contested by 20 clubs.",
      averageAge: 27,
      totalActivePlayers: 2,
      playersWithKnownNationality: 2,
      foreignPlayerPercentage: 50,
    });
  });

  it("returns a null emblem when the league has no synced competition row", async () => {
    const prisma = createMockPrisma({
      leagues: [{ id: 1, name: "La Liga", footballDataId: 2014 }],
      competition: null,
    });

    const result = await service(prisma).getLeagueStatsBySlug("la-liga");

    expect(result?.emblem).toBeNull();
  });

  it("returns an empty description when Wikipedia has no matching article", async () => {
    const prisma = createMockPrisma({
      leagues: [{ id: 1, name: "La Liga", footballDataId: 2014 }],
    });
    const wikipediaClient = createMockWikipediaClient(null);

    const result = await service(prisma, wikipediaClient).getLeagueStatsBySlug(
      "la-liga",
    );

    expect(result?.description).toBe("");
  });

  it("returns an empty description rather than failing when Wikipedia errors", async () => {
    const prisma = createMockPrisma({
      leagues: [{ id: 1, name: "La Liga", footballDataId: 2014 }],
    });
    const wikipediaClient: WikipediaClient = {
      getIntroExtract: vi.fn().mockRejectedValue(new Error("network error")),
    };

    const result = await service(prisma, wikipediaClient).getLeagueStatsBySlug(
      "la-liga",
    );

    expect(result?.description).toBe("");
  });
});
