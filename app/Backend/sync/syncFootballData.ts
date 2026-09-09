import "dotenv/config";
import "reflect-metadata";
import { container } from "../container.js";

import type { Logger } from "../logging/index.js";
import type { FootballSyncService } from "../services/index.js";

interface SyncArgs {
  leagueSlug?: string;
  clubSlug?: string;
  force?: boolean;
  dryRun?: boolean;
}

function parseArgs(argv: string[]): SyncArgs {
  const args: SyncArgs = {};

  for (const arg of argv) {
    if (arg.startsWith("--league=")) {
      args.leagueSlug = arg.slice("--league=".length);
    } else if (arg.startsWith("--club=")) {
      args.clubSlug = arg.slice("--club=".length);
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const logger = container.resolve<Logger>("Logger");
  const syncService = container.resolve<FootballSyncService>(
    "FootballSyncService",
  );

  const summary = await syncService.run(args);

  let hasFailure = summary.leagues.length === 0;

  logger.log(
    `Football data sync summary${args.dryRun ? " (dry run — nothing written)" : ""}:`,
  );

  if (summary.leagues.length === 0) {
    logger.log(
      `  No leagues matched${args.leagueSlug ? ` --league=${args.leagueSlug}` : ""}.`,
    );
  }

  for (const league of summary.leagues) {
    if (league.failed) {
      hasFailure = true;
      logger.log(`  ${league.leagueName}: FAILED — ${league.error}`);
      continue;
    }

    logger.log(
      `  ${league.leagueName}: clubs created ${league.clubsCreated}, updated ${league.clubsUpdated}, deactivated ${league.clubsDeactivated}, mapped ${league.clubsMapped}`,
    );
    logger.log(
      `    players created ${league.playersCreated}, updated ${league.playersUpdated}, deactivated ${league.playersDeactivated}`,
    );
    logger.log(
      `    clubs skipped: ${league.clubsSkippedFresh} fresh, ${league.clubsSkippedQuota} quota`,
    );
    logger.log(
      `    profiles updated ${league.profilesUpdated}, skipped (quota) ${league.profilesSkippedQuota}, failed ${league.profilesFailed}`,
    );

    if (league.unmappedClubs.length > 0) {
      logger.log(`    unmapped: ${league.unmappedClubs.join(", ")}`);
    }

    logger.log(
      `    stadium images updated ${league.stadiumImagesUpdated}, skipped (rate limited) ${league.stadiumImagesSkippedRateLimited}`,
    );

    if (league.clubsWithoutStadiumImage.length > 0) {
      logger.log(
        `    no stadium image: ${league.clubsWithoutStadiumImage.join(", ")}`,
      );
    }

    if (league.failedClubs.length > 0) {
      hasFailure = true;
      for (const failedClub of league.failedClubs) {
        logger.log(`    FAILED club ${failedClub.clubName}: ${failedClub.error}`);
      }
    }
  }

  logger.log(
    `API-Football requests used: ${summary.requestsUsed ?? "unknown"} / 100`,
  );

  process.exit(hasFailure ? 1 : 0);
}

await main();
