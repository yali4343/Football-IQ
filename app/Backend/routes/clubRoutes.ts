import type { FastifyInstance, FastifyReply } from "fastify";

import AppError from "../errors/AppError.js";
import {
  clubIdParamsSchema,
  clubSelectionBodySchema,
} from "../schemas/clubSchemas.js";
import type { ClubService } from "../services/index.js";

interface ClubRoutesOptions {
  clubService: ClubService;
}

const HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
};

function parseClubIdOrThrow(params: unknown): number {
  const validationResult = clubIdParamsSchema.safeParse(params);

  if (!validationResult.success) {
    throw new AppError(
      "Validation failed",
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      "VALIDATION_ERROR",
    );
  }

  return validationResult.data.id;
}

function parseClubSelectionOrThrow(body: unknown) {
  const validationResult = clubSelectionBodySchema.safeParse(body);

  if (!validationResult.success) {
    throw new AppError(
      "Validation failed",
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      "VALIDATION_ERROR",
    );
  }

  return validationResult.data;
}

function assertClubFound(club: unknown): void {
  if (!club) {
    throw new AppError(
      "Club not found",
      HTTP_STATUS.NOT_FOUND,
      "CLUB_NOT_FOUND",
    );
  }
}

function sendClubOrNotFound(club: unknown, reply: FastifyReply) {
  assertClubFound(club);

  return reply.code(HTTP_STATUS.OK).send(club);
}

async function clubRoutes(fastify: FastifyInstance, options: ClubRoutesOptions) {
  const { clubService } = options;

  fastify.get(
    "/",
    {
      schema: {
        summary: "Get all clubs",
        description: "Returns all currently supported football clubs",
        tags: ["Clubs"],
      },
    },
    async (request, reply) => {
      const clubs = await clubService.getAllClubs();

      return reply.code(HTTP_STATUS.OK).send(clubs);
    },
  );

  fastify.get(
    "/selection",
    {
      schema: {
        summary: "Get the selected club",
        description: "Returns the currently selected football club, if any",
        tags: ["Clubs"],
      },
    },
    async (request, reply) => {
      const club = await clubService.getSelectedClub();

      return reply.code(HTTP_STATUS.OK).send(club);
    },
  );

  fastify.patch(
    "/selection",
    {
      schema: {
        summary: "Select a club",
        description: "Saves the currently selected football club",
        tags: ["Clubs"],
      },
    },
    async (request, reply) => {
      const { clubId } = parseClubSelectionOrThrow(request.body);

      const club = await clubService.selectClub(clubId);

      return sendClubOrNotFound(club, reply);
    },
  );

  fastify.get(
    "/:id",
    {
      schema: {
        summary: "Get club by ID",
        description: "Returns one supported football club",
        tags: ["Clubs"],
      },
    },
    async (request, reply) => {
      const clubId = parseClubIdOrThrow(request.params);

      const club = await clubService.getClubById(clubId);

      return sendClubOrNotFound(club, reply);
    },
  );

  fastify.get(
    "/:id/players",
    {
      schema: {
        summary: "Get club players",
        description: "Returns the squad for one supported football club",
        tags: ["Clubs"],
      },
    },
    async (request, reply) => {
      const clubId = parseClubIdOrThrow(request.params);

      const club = await clubService.getClubById(clubId);

      assertClubFound(club);

      const players = await clubService.getClubPlayers(clubId);

      return reply.code(HTTP_STATUS.OK).send(players);
    },
  );
}

export default clubRoutes;
