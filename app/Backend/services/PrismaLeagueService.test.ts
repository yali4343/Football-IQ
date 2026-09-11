import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/client.js";
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

function service(prisma: ReturnType<typeof createMockPrisma>) {
  return new PrismaLeagueService(prisma as unknown as PrismaClient);
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

  it("combines the competition emblem, description, and player stats", async () => {
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

    const result = await service(prisma).getLeagueStatsBySlug("la-liga");

    expect(result).toMatchObject({
      name: "La Liga",
      slug: "la-liga",
      emblem: "https://crests.football-data.org/laliga.png",
      averageAge: 27,
      totalActivePlayers: 2,
      playersWithKnownNationality: 2,
      foreignPlayerPercentage: 50,
    });
    expect(result?.description).toMatch(/Spain/);
  });

  it("returns a null emblem when the league has no synced competition row", async () => {
    const prisma = createMockPrisma({
      leagues: [{ id: 1, name: "La Liga", footballDataId: 2014 }],
      competition: null,
    });

    const result = await service(prisma).getLeagueStatsBySlug("la-liga");

    expect(result?.emblem).toBeNull();
  });
});
