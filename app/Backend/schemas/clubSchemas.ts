import { z } from "zod";

const clubIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const clubSelectionBodySchema = z.object({
  clubId: z.coerce.number().int().positive(),
});

// Plain JSON-Schema (not Zod) — these describe route *responses* for
// @fastify/swagger, matching the DTOs actually returned by ClubService.
const clubResponseSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    league: { type: "string" },
    stadium: { type: ["string", "null"] },
  },
  required: ["id", "name", "league", "stadium"],
};

const nullableClubResponseSchema = {
  type: ["object", "null"],
  properties: clubResponseSchema.properties,
};

const clubsResponseSchema = {
  type: "array",
  items: clubResponseSchema,
};

const playerResponseSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    position: { type: "string" },
    age: { type: ["integer", "null"] },
    number: { type: ["integer", "null"] },
    nationality: { type: ["string", "null"] },
    photoUrl: { type: ["string", "null"] },
    externalApiId: { type: "integer" },
    isActive: { type: "boolean" },
    clubId: { type: "integer" },
  },
  required: ["id", "name", "position", "externalApiId", "isActive", "clubId"],
};

const playersResponseSchema = {
  type: "array",
  items: playerResponseSchema,
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
  clubIdParamsSchema,
  clubSelectionBodySchema,
  clubResponseSchema,
  nullableClubResponseSchema,
  clubsResponseSchema,
  playerResponseSchema,
  playersResponseSchema,
  errorResponseSchema,
};
