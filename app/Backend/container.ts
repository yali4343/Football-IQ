import { Lifecycle, container } from "tsyringe";
import { prisma } from "./db/prismaClient.js";
import { AppLogger } from "./logging/index.js";
import { PrismaClubService } from "./services/index.js";

import type { AppConfig } from "./config/appConfig.types.js";
import type { ClubService } from "./services/index.js";
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

export { container };
