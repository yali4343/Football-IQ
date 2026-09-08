import { Lifecycle, container } from "tsyringe";
import { prisma } from "./db/prismaClient.js";
import { HttpFootballDataClient } from "./integrations/footballData/HttpFootballDataClient.js";
import { AppLogger } from "./logging/index.js";
import { PrismaClubService, PrismaFootballSyncService } from "./services/index.js";

import type { AppConfig } from "./config/appConfig.types.js";
import type { FootballDataClient } from "./integrations/footballData/FootballDataClient.js";
import type { ClubService, FootballSyncService } from "./services/index.js";
import type { PrismaClient } from "./generated/prisma/client.js";

const appConfig: AppConfig = {
  environment: "development",
  applicationName: "Fastify Learning API",
};

container.register(
  "Logger",
  {
    useClass: AppLogger,
  },
  {
    lifecycle: Lifecycle.Singleton,
  },
);

container.register<AppConfig>("AppConfig", {
  useValue: appConfig,
});

container.register("StartupMessage", {
  useFactory: () => {
    return `Application started at ${new Date().toISOString()}`;
  },
});

container.register<PrismaClient>("PrismaClient", {
  useValue: prisma,
});

container.register<ClubService>(
  "ClubService",
  {
    useClass: PrismaClubService,
  },
  {
    lifecycle: Lifecycle.Singleton,
  },
);

container.register<FootballDataClient>(
  "FootballDataClient",
  {
    useClass: HttpFootballDataClient,
  },
  {
    lifecycle: Lifecycle.Singleton,
  },
);

container.register<FootballSyncService>(
  "FootballSyncService",
  {
    useClass: PrismaFootballSyncService,
  },
  {
    lifecycle: Lifecycle.Singleton,
  },
);

export { container };
