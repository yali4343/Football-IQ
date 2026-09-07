import "dotenv/config";
import { prisma } from "../db/prismaClient.js";

const clubs = [
  { name: "Arsenal FC", league: "Premier League", stadium: "Emirates Stadium" },
  { name: "FC Liverpool", league: "Premier League", stadium: "Anfield" },
  { name: "FC Barcelona", league: "La Liga", stadium: "Camp Nou" },
  { name: "Real Madrid CF", league: "La Liga", stadium: "Santiago Bernabéu" },
  { name: "FC Inter", league: "Serie A", stadium: "San Siro" },
  { name: "AC Milan", league: "Serie A", stadium: "San Siro" },
  { name: "FC Bayern Munich", league: "Bundesliga", stadium: "Allianz Arena" },
  { name: "Borussia Dortmund", league: "Bundesliga", stadium: "Signal Iduna Park" },
];

async function main() {
  const existingCount = await prisma.club.count();

  if (existingCount > 0) {
    console.log(`Clubs table already has ${existingCount} rows, skipping seed.`);
    return;
  }

  await prisma.club.createMany({ data: clubs });
  console.log(`Seeded ${clubs.length} clubs.`);
}

await main();
