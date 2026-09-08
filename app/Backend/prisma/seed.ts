import "dotenv/config";
import { prisma } from "../db/prismaClient.js";

const leagues = [
  { name: "Premier League", footballDataId: 2021, apiFootballLeagueId: 39 },
  { name: "La Liga", footballDataId: 2014, apiFootballLeagueId: 140 },
  { name: "Serie A", footballDataId: 2019, apiFootballLeagueId: 135 },
  { name: "Bundesliga", footballDataId: 2002, apiFootballLeagueId: 78 },
];

async function seedLeagues() {
  const existingCount = await prisma.league.count();

  if (existingCount > 0) {
    console.log(
      `Leagues table already has ${existingCount} rows, skipping seed.`,
    );
    return;
  }

  await prisma.league.createMany({ data: leagues });
  console.log(`Seeded ${leagues.length} leagues.`);
}

async function main() {
  await seedLeagues();
}

await main();
