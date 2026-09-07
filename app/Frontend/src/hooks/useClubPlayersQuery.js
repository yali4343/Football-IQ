import { useQuery } from "@tanstack/react-query";
import { getClubPlayers } from "../api/clubsAPI.js";

export function useClubPlayersQuery(clubId) {
  const { data, isPending, error } = useQuery({
    queryKey: ["clubPlayers", clubId],
    queryFn: ({ signal }) => getClubPlayers(clubId, signal),
    enabled: Boolean(clubId),
    staleTime: 60_000,
  });

  return {
    players: data ?? [],
    isLoading: isPending,
    error,
  };
}
