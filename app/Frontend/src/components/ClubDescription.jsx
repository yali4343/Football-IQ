import { useQuery } from "@tanstack/react-query";
import { getClubDescription } from "../api/clubsAPI.js";
import { Spinner } from "./Spinner.jsx";

export function ClubDescription({ clubId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["clubDescription", clubId],
    queryFn: ({ signal }) => getClubDescription(clubId, signal),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <p className="mt-4 flex items-center text-sm text-subtle">
        <Spinner className="mr-2" />
        Loading club description...
      </p>
    );
  }

  if (!data?.description) {
    return null;
  }

  return (
    <p className="mt-4 text-sm leading-6 text-body">{data.description}</p>
  );
}
