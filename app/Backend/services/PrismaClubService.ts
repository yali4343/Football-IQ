import { inject, injectable } from "tsyringe";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { Club, ClubService } from "./ClubService.js";

@injectable()
export class PrismaClubService implements ClubService {
  private selectedClubId: number | null = null;

  constructor(@inject("PrismaClient") private prisma: PrismaClient) {}

  async getAllClubs(): Promise<Club[]> {
    return this.prisma.club.findMany();
  }

  async getClubById(clubId: number): Promise<Club | undefined> {
    const club = await this.prisma.club.findUnique({ where: { id: clubId } });

    return club ?? undefined;
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
}
