export interface ClubCoach {
  name: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  contractStart: string | null;
  contractUntil: string | null;
}

export interface Club {
  id: number;
  name: string;
  league: string;
  stadium: string | null;
  crest: string | null;
  founded: number | null;
  clubColors: string | null;
  country: string | null;
  coach: ClubCoach | null;
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
