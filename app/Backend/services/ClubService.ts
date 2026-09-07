export interface Club {
  id: number;
  name: string;
  league: string;
  stadium: string;
}

export interface Player {
  id: number;
  name: string;
  position: string;
  clubId: number;
}

export interface ClubService {
  getAllClubs(): Promise<Club[]>;
  getClubById(clubId: number): Promise<Club | undefined>;
  selectClub(clubId: number): Promise<Club | null>;
  getSelectedClub(): Promise<Club | null>;
  getClubPlayers(clubId: number): Promise<Player[]>;
}
