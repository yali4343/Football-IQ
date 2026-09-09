import { inject, injectable } from "tsyringe";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type { Club, ClubService, Player } from "./ClubService.js";

type ClubWithLeague = Prisma.ClubGetPayload<{
  include: { league: true; area: true };
}>;

function toClubDto(club: ClubWithLeague): Club {
  return {
    id: club.id,
    name: club.name,
    league: club.league.name,
    stadium: club.stadium,
    crest: club.crest,
    founded: club.founded,
    clubColors: club.clubColors,
    country: club.area?.name ?? null,
  };
}

@injectable()
export class PrismaClubService implements ClubService {
  private selectedClubId: number | null = null;

  constructor(@inject("PrismaClient") private prisma: PrismaClient) {}

  async getAllClubs(): Promise<Club[]> {
    const clubs = await this.prisma.club.findMany({
      include: { league: true, area: true },
    });

    return clubs.map(toClubDto);
  }

  async getClubById(clubId: number): Promise<Club | undefined> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      include: { league: true, area: true },
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
    return this.prisma.player.findMany({
      where: { clubId, isActive: true },
    });
  }
}
