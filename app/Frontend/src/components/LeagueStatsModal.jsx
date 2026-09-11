import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLeagueStats } from "../api/leaguesAPI.js";
import { Spinner } from "./Spinner.jsx";
import { StatusMessage } from "./StatusMessage.jsx";

function formatForeignPercentage(stats) {
  if (stats.foreignPlayerPercentage === null) {
    return "Not enough nationality data yet";
  }

  return `${stats.foreignPlayerPercentage}%`;
}

export function LeagueStatsModal({ leagueSlug, onClose }) {
  const open = leagueSlug !== null;

  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["leagueStats", leagueSlug],
    queryFn: ({ signal }) => getLeagueStats(leagueSlug, signal),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="league-stats-heading"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-panel border border-border bg-surface p-6"
      >
        <div className="flex items-start justify-between gap-4">
          {isLoading ? (
            <p className="flex items-center text-sm text-subtle">
              <Spinner className="mr-2" />
              Loading league statistics...
            </p>
          ) : error ? (
            <StatusMessage tone="error">
              Failed to load league statistics: {error.message}
            </StatusMessage>
          ) : (
            <div className="flex items-center gap-4">
              {stats.emblem && (
                <img
                  src={stats.emblem}
                  alt=""
                  aria-hidden="true"
                  className="h-14 w-14 object-contain"
                />
              )}
              <h3
                id="league-stats-heading"
                className="font-display text-2xl leading-none text-ink"
              >
                {stats.name}
              </h3>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-subtle hover:text-body"
          >
            ✕
          </button>
        </div>

        {stats && (
          <>
            <p className="mt-4 text-sm leading-6 text-body">
              {stats.description}
            </p>

            <dl className="mt-6 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-subtle">Average age</dt>
                <dd className="text-body">
                  {stats.averageAge !== null
                    ? `${stats.averageAge} years`
                    : "Not enough age data yet"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-subtle">Foreign players</dt>
                <dd className="text-right text-body">
                  {formatForeignPercentage(stats)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </div>
  );
}
