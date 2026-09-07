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
  {
    name: "Borussia Dortmund",
    league: "Bundesliga",
    stadium: "Signal Iduna Park",
  },
];

const playersByClub: Record<string, { name: string; position: string }[]> = {
  "Arsenal FC": [
    { name: "David Raya", position: "Goalkeeper" },
    { name: "William Saliba", position: "Defender" },
    { name: "Declan Rice", position: "Midfielder" },
    { name: "Bukayo Saka", position: "Forward" },
  ],
  "FC Liverpool": [
    { name: "Alisson Becker", position: "Goalkeeper" },
    { name: "Virgil van Dijk", position: "Defender" },
    { name: "Ryan Gravenberch", position: "Midfielder" },
    { name: "Alexander Isak", position: "Forward" },
  ],
  "FC Barcelona": [
    { name: "Joan García", position: "Goalkeeper" },
    { name: "Pau Cubarsí", position: "Defender" },
    { name: "Pedri", position: "Midfielder" },
    { name: "Gabriel Jesus", position: "Forward" },
  ],
  "Real Madrid CF": [
    { name: "Thibaut Courtois", position: "Goalkeeper" },
    { name: "Antonio Rüdiger", position: "Defender" },
    { name: "Jude Bellingham", position: "Midfielder" },
    { name: "Kylian Mbappé", position: "Forward" },
  ],
  "FC Inter": [
    { name: "Josep Martínez", position: "Goalkeeper" },
    { name: "Alessandro Bastoni", position: "Defender" },
    { name: "Nicolò Barella", position: "Midfielder" },
    { name: "Lautaro Martínez", position: "Forward" },
  ],
  "AC Milan": [
    { name: "Mike Maignan", position: "Goalkeeper" },
    { name: "Strahinja Pavlović", position: "Defender" },
    { name: "Adrien Rabiot", position: "Midfielder" },
    { name: "Gonçalo Ramos", position: "Forward" },
  ],
  "FC Bayern Munich": [
    { name: "Manuel Neuer", position: "Goalkeeper" },
    { name: "Dayot Upamecano", position: "Defender" },
    { name: "Joshua Kimmich", position: "Midfielder" },
    { name: "Harry Kane", position: "Forward" },
  ],
  "Borussia Dortmund": [
    { name: "Gregor Kobel", position: "Goalkeeper" },
    { name: "Nico Schlotterbeck", position: "Defender" },
    { name: "Felix Nmecha", position: "Midfielder" },
    { name: "Serhou Guirassy", position: "Forward" },
  ],
};

async function seedClubs() {
  const existingCount = await prisma.club.count();

  if (existingCount > 0) {
    console.log(
      `Clubs table already has ${existingCount} rows, skipping seed.`,
    );
    return;
  }

  await prisma.club.createMany({ data: clubs });
  console.log(`Seeded ${clubs.length} clubs.`);
}

async function seedPlayers() {
  const existingCount = await prisma.player.count();

  if (existingCount > 0) {
    console.log(
      `Players table already has ${existingCount} rows, skipping seed.`,
    );
    return;
  }

  const allClubs = await prisma.club.findMany();

  const players = allClubs.flatMap((club) =>
    (playersByClub[club.name] ?? []).map((player) => ({
      ...player,
      clubId: club.id,
    })),
  );

  await prisma.player.createMany({ data: players });
  console.log(`Seeded ${players.length} players.`);
}

async function main() {
  await seedClubs();
  await seedPlayers();
}

await main();
