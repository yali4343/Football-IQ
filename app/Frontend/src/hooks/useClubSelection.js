import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getSelectedClub, selectClub } from "../api/clubsAPI.js";
import { leagueToSlug } from "../leagueSlugs.js";

const SUPPORTED_LEAGUES = [
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
];

export function useClubSelection(clubs, initialLeague = "") {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedLeague, setSelectedLeague] = useState(initialLeague);

  // Keeps the dropdown in sync when the league changes via the URL (a
  // toolbar link, browser back/forward, or a typed-in URL) rather than
  // through selectLeague below — adjusted during render, per React's
  // guidance for state derived from a prop, rather than via an effect
  // (which would cause an extra render after every URL-driven change).
  const [prevInitialLeague, setPrevInitialLeague] = useState(initialLeague);
  if (initialLeague !== prevInitialLeague) {
    setPrevInitialLeague(initialLeague);
    setSelectedLeague(initialLeague);
  }

  const { data: selectedClub = null } = useQuery({
    queryKey: ["selection"],
    queryFn: ({ signal }) => getSelectedClub(signal),
    staleTime: 60_000,
  });

  const {
    mutate: selectClubById,
    isPending: isSelecting,
    error: selectionError,
  } = useMutation({
    mutationFn: selectClub,
    onSuccess: (club) => {
      queryClient.setQueryData(["selection"], club);
    },
  });

  function selectLeague(league) {
    setSelectedLeague(league);
    const slug = leagueToSlug(league);
    navigate(slug ? `/leagues/${slug}` : "/");
  }

  const leagueClubs = selectedLeague
    ? clubs.filter((club) => club.league === selectedLeague)
    : [];

  return {
    selectedLeague,
    selectLeague,
    selectClubById,
    isSelecting,
    selectionError,
    supportedLeagues: SUPPORTED_LEAGUES,
    leagueClubs,
    selectedClub,
  };
}
