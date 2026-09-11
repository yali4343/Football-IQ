import { z } from "zod";

const leagueSlugParamsSchema = z.object({
  slug: z.string().min(1),
});

// Plain JSON-Schema (not Zod) — describes the route *response* for
// @fastify/swagger, matching LeagueStats.
const leagueStatsResponseSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    slug: { type: "string" },
    emblem: {
      type: ["string", "null"],
      description:
        "The league's crest, sourced from football-data.org via the already-synced Competition table.",
    },
    description: { type: "string" },
    averageAge: {
      type: ["number", "null"],
      description:
        "Mean age across currently active players at currently active clubs in this league. Null if none of those players have a known age.",
    },
    totalActivePlayers: { type: "integer" },
    playersWithKnownNationality: {
      type: "integer",
      description:
        "How many of totalActivePlayers have a known nationality. Nationality data is sparse in this database — always show this figure alongside foreignPlayerPercentage rather than the percentage alone.",
    },
    foreignPlayerPercentage: {
      type: ["number", "null"],
      description:
        "Percentage of players with a known nationality whose nationality differs from their own club's country. Null if no player in the league has a known nationality.",
    },
  },
  required: [
    "name",
    "slug",
    "emblem",
    "description",
    "averageAge",
    "totalActivePlayers",
    "playersWithKnownNationality",
    "foreignPlayerPercentage",
  ],
};

// Matches AppError's response shape from server.ts's error handler.
const errorResponseSchema = {
  type: "object",
  properties: {
    code: { type: "string" },
    message: { type: "string" },
  },
  required: ["code", "message"],
};

export {
  leagueSlugParamsSchema,
  leagueStatsResponseSchema,
  errorResponseSchema,
};
