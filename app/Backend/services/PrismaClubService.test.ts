import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { WikipediaClient } from "../integrations/wikipedia/WikipediaClient.js";
import { PrismaClubService } from "./PrismaClubService.js";

function createMockPrisma(club: unknown = null) {
  return {
    club: {
      findUnique: vi.fn().mockResolvedValue(club),
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
  return new PrismaClubService(
    prisma as unknown as PrismaClient,
    wikipediaClient,
  );
}

describe("PrismaClubService.getClubDescription", () => {
  it("returns null when the club doesn't exist", async () => {
    const prisma = createMockPrisma(null);

    const result = await service(prisma).getClubDescription(999);

    expect(result).toBeNull();
  });

  it("looks up the club's Wikipedia article by its stored name", async () => {
    const prisma = createMockPrisma({ id: 5, name: "Arsenal FC" });
    const wikipediaClient = createMockWikipediaClient(
      "Arsenal is a football club in London. They play in the Premier League.",
    );

    const result = await service(prisma, wikipediaClient).getClubDescription(
      5,
    );

    expect(wikipediaClient.getIntroExtract).toHaveBeenCalledWith(
      "Arsenal FC",
    );
    expect(result).toBe(
      "Arsenal is a football club in London. They play in the Premier League.",
    );
  });

  it("returns null when Wikipedia has no matching article", async () => {
    const prisma = createMockPrisma({ id: 5, name: "Arsenal FC" });
    const wikipediaClient = createMockWikipediaClient(null);

    const result = await service(prisma, wikipediaClient).getClubDescription(
      5,
    );

    expect(result).toBeNull();
  });

  it("returns null rather than failing when Wikipedia errors", async () => {
    const prisma = createMockPrisma({ id: 5, name: "Arsenal FC" });
    const wikipediaClient: WikipediaClient = {
      getIntroExtract: vi.fn().mockRejectedValue(new Error("network error")),
    };

    const result = await service(prisma, wikipediaClient).getClubDescription(
      5,
    );

    expect(result).toBeNull();
  });
});
