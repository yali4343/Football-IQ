import "dotenv/config";
import "reflect-metadata";
import { container } from "../container.js";

import type { Logger } from "../logging/index.js";
import type { FootballSyncService } from "../services/index.js";

interface SyncArgs {
  leagueSlug?: string;
  force?: boolean;
}

function parseArgs(argv: string[]): SyncArgs {
  const args: SyncArgs = {};

  for (const arg of argv) {
    if (arg.startsWith("--league=")) {
      args.leagueSlug = arg.slice("--league=".length);
    } else if (arg === "--force") {
      args.force = true;
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

  logger.log("Football data sync — league membership summary:");

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
      `  ${league.leagueName}: created ${league.clubsCreated}, updated ${league.clubsUpdated}, deactivated ${league.clubsDeactivated}, mapped ${league.clubsMapped}`,
    );

    if (league.unmappedClubs.length > 0) {
      logger.log(`    unmapped: ${league.unmappedClubs.join(", ")}`);
    }
  }

  process.exit(hasFailure ? 1 : 0);
}

await main();
