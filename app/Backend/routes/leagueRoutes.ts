import type { FastifyInstance } from "fastify";

import AppError from "../errors/AppError.js";
import {
  leagueSlugParamsSchema,
  leagueStatsResponseSchema,
  errorResponseSchema,
} from "../schemas/leagueSchemas.js";
import type { LeagueService } from "../services/index.js";

interface LeagueRoutesOptions {
  leagueService: LeagueService;
}

const HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
};

function parseLeagueSlugOrThrow(params: unknown): string {
  const validationResult = leagueSlugParamsSchema.safeParse(params);

  if (!validationResult.success) {
    throw new AppError(
      "Validation failed",
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      "VALIDATION_ERROR",
    );
  }

  return validationResult.data.slug;
}

async function leagueRoutes(
  fastify: FastifyInstance,
  options: LeagueRoutesOptions,
) {
  const { leagueService } = options;

  fastify.get(
    "/:slug",
    {
      schema: {
        summary: "Get league statistics",
        description:
          "Returns one supported league's emblem, description, and player statistics (average age and percentage of foreign players) computed from currently synced club and player data",
        tags: ["Leagues"],
        response: {
          [HTTP_STATUS.OK]: leagueStatsResponseSchema,
          [HTTP_STATUS.NOT_FOUND]: errorResponseSchema,
          [HTTP_STATUS.UNPROCESSABLE_ENTITY]: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const slug = parseLeagueSlugOrThrow(request.params);

      const stats = await leagueService.getLeagueStatsBySlug(slug);

      if (!stats) {
        throw new AppError(
          "League not found",
          HTTP_STATUS.NOT_FOUND,
          "LEAGUE_NOT_FOUND",
        );
      }

      return reply.code(HTTP_STATUS.OK).send(stats);
    },
  );
}

export default leagueRoutes;
