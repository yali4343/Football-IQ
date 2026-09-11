import { inject, injectable } from "tsyringe";
import type {
  Player as PrismaPlayer,
  Prisma,
  PrismaClient,
} from "../generated/prisma/client.js";
import type { WikipediaClient } from "../integrations/wikipedia/WikipediaClient.js";
import { firstNSentences } from "./textExtract.js";
import type { Club, ClubService, Player } from "./ClubService.js";

const DESCRIPTION_SENTENCE_COUNT = 4;

type ClubWithLeague = Prisma.ClubGetPayload<{
  include: { league: true; area: true; coach: true };
}>;

function toPlayerDto(player: PrismaPlayer): Player {
  return {
    id: player.id,
    name: player.name,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    age: player.age,
    number: player.number,
    nationality: player.nationality,
    dateOfBirth: player.dateOfBirth?.toISOString() ?? null,
    birthPlace: player.birthPlace,
    birthCountry: player.birthCountry,
    height: player.height,
    weight: player.weight,
    photoUrl: player.photoUrl,
    clubId: player.clubId,
  };
}

function toClubDto(club: ClubWithLeague): Club {
  return {
    id: club.id,
    name: club.name,
    league: club.league.name,
    stadium: club.stadium,
    stadiumImageUrl: club.stadiumImageUrl,
    crest: club.crest,
    founded: club.founded,
    clubColors: club.clubColors,
    country: club.area?.name ?? null,
    coach: club.coach
      ? {
          name: club.coach.name,
          dateOfBirth: club.coach.dateOfBirth?.toISOString() ?? null,
          nationality: club.coach.nationality,
          contractStart: club.coach.contractStart?.toISOString() ?? null,
          contractUntil: club.coach.contractUntil?.toISOString() ?? null,
        }
      : null,
  };
}

@injectable()
export class PrismaClubService implements ClubService {
  private selectedClubId: number | null = null;

  constructor(
    @inject("PrismaClient") private prisma: PrismaClient,
    @inject("WikipediaClient") private wikipediaClient: WikipediaClient,
  ) {}

  async getAllClubs(): Promise<Club[]> {
    const clubs = await this.prisma.club.findMany({
      include: { league: true, area: true, coach: true },
    });

    return clubs.map(toClubDto);
  }

  async getClubById(clubId: number): Promise<Club | undefined> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      include: { league: true, area: true, coach: true },
    });

    return club ? toClubDto(club) : undefined;
  }

  async selectClub(clubId: number): Promise<Club | null> {
    const club = await this.getClubById(clubId);

    if (!club) {
      return null;
    }

    this.selectedClubId = clubId;

    return club;
  }

  async getSelectedClub(): Promise<Club | null> {
    if (this.selectedClubId === null) {
      return null;
    }

    return (await this.getClubById(this.selectedClubId)) ?? null;
  }

  async getClubPlayers(clubId: number): Promise<Player[]> {
    const players = await this.prisma.player.findMany({
      where: { clubId, isActive: true },
    });

    return players.map(toPlayerDto);
  }

  // Never lets a Wikipedia outage, an unresolved title, or a missing club
  // fail the request — null degrades gracefully in the UI, mirroring how
  // StadiumImageSyncer treats a failed provider lookup.
  async getClubDescription(clubId: number): Promise<string | null> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
    });

    if (!club) {
      return null;
    }

    try {
      const extract = await this.wikipediaClient.getIntroExtract(club.name);

      return extract
        ? firstNSentences(extract, DESCRIPTION_SENTENCE_COUNT)
        : null;
    } catch {
      return null;
    }
  }
}
