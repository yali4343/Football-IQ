import "reflect-metadata";
import Fastify from "fastify";
import AppError from "./errors/AppError.js";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import cors from "@fastify/cors";
import clubRoutes from "./routes/clubRoutes.js";
import { container } from "./container.js";
import type { ClubService } from "./services/index.js";

const fastify = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  },
});

const clubService = container.resolve<ClubService>("ClubService");

fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  request.log.error(error);

  return reply.code(500).send({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
  });
});

fastify.setNotFoundHandler((request, reply) => {
  return reply.code(404).send({
    code: "ROUTE_NOT_FOUND",
    message: "Route not found",
  });
});

fastify.register(swagger, {
  openapi: {
    info: {
      title: "Personalized Football Team Dashboard API",
      description: "REST API for the personalized football team dashboard",
      version: "1.0.0",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
  },
});

await fastify.register(cors, {
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
});

await fastify.register(swaggerUi, {
  routePrefix: "documentation",
});

// fastify.addHook("onRequest", async (request) => {
//   console.log("onRequest:", request.method, request.url);
// });

// fastify.addHook("preHandler", async (request) => {
//   console.log("preHandler:", request.method, request.url);
// });

fastify.register(clubRoutes, {
  prefix: "/clubs",
  clubService,
});

const port = process.env.PORT || 3000;

await fastify.listen({
  port: Number(port),
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Shutting down server...`);

  try {
    await fastify.close();
    console.log("Server closed");
    process.exit(0);
  } catch (error) {
    fastify.log.error(error as Error);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
