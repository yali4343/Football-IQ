import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getLeagueStats } from "../api/leaguesAPI.js";
import { Spinner } from "../components/Spinner.jsx";
import { StatusMessage } from "../components/StatusMessage.jsx";
import { LeagueStatistics } from "../components/LeagueStatistics.jsx";

export function LeagueInfoPage() {
  const { leagueSlug } = useParams();

  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["leagueStats", leagueSlug],
    queryFn: ({ signal }) => getLeagueStats(leagueSlug, signal),
    staleTime: 60_000,
  });

  return (
    <main className="dashboard-shell">
      <div className="dashboard-frame max-w-3xl">
        <Link
          to="/"
          className="text-sm font-semibold text-subtle transition-colors hover:text-body"
        >
          ← Back to dashboard
        </Link>

        {isLoading ? (
          <p className="mt-6 flex items-center text-sm text-subtle">
            <Spinner className="mr-2" />
            Loading league information...
          </p>
        ) : error ? (
          <StatusMessage tone="error">
            Failed to load league information: {error.message}
          </StatusMessage>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-4">
              {stats.emblem && (
                <img
                  src={stats.emblem}
                  alt=""
                  aria-hidden="true"
                  className="h-16 w-16 object-contain"
                />
              )}
              <h1 className="font-display text-5xl leading-none text-body md:text-6xl">
                {stats.name}
              </h1>
            </div>

            <p className="mt-6 text-sm leading-6 text-body">
              {stats.description}
            </p>

            <LeagueStatistics stats={stats} />
          </>
        )}
      </div>
    </main>
  );
}
