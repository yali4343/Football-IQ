import { z } from "zod";

const clubIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const clubSelectionBodySchema = z.object({
  clubId: z.coerce.number().int().positive(),
});

// Plain JSON-Schema (not Zod) — these describe route *responses* for
// @fastify/swagger, matching the DTOs actually returned by ClubService.
const clubCoachResponseSchema = {
  type: ["object", "null"],
  properties: {
    name: { type: ["string", "null"] },
    dateOfBirth: { type: ["string", "null"] },
    nationality: { type: ["string", "null"] },
    contractStart: { type: ["string", "null"] },
    contractUntil: { type: ["string", "null"] },
  },
};

const clubResponseSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    league: { type: "string" },
    stadium: { type: ["string", "null"] },
    crest: { type: ["string", "null"] },
    founded: { type: ["integer", "null"] },
    clubColors: { type: ["string", "null"] },
    country: { type: ["string", "null"] },
    coach: clubCoachResponseSchema,
  },
  required: [
    "id",
    "name",
    "league",
    "stadium",
    "crest",
    "founded",
    "clubColors",
    "country",
    "coach",
  ],
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
    firstName: { type: ["string", "null"] },
    lastName: { type: ["string", "null"] },
    position: { type: "string" },
    age: { type: ["integer", "null"] },
    number: { type: ["integer", "null"] },
    nationality: { type: ["string", "null"] },
    dateOfBirth: { type: ["string", "null"] },
    birthPlace: { type: ["string", "null"] },
    birthCountry: { type: ["string", "null"] },
    height: { type: ["string", "null"] },
    weight: { type: ["string", "null"] },
    photoUrl: { type: ["string", "null"] },
    clubId: { type: "integer" },
  },
  required: ["id", "name", "position", "clubId"],
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
