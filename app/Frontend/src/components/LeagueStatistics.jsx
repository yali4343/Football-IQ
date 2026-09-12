function formatForeignPercentage(stats) {
  if (stats.foreignPlayerPercentage === null) {
    return "not enough nationality data yet";
  }

  return `${stats.foreignPlayerPercentage}%`;
}

export function LeagueStatistics({ stats }) {
  return (
    <div className="mx-auto mt-10 w-fit max-w-sm rounded-panel border border-border bg-surface px-6 py-5 text-center">
      <h2 className="font-display text-lg leading-none text-body">
        League Statistics
      </h2>

      <dl className="mt-4 space-y-1.5 text-sm">
        <div>
          <dt className="inline text-subtle">Average age in the league: </dt>{" "}
          <dd className="inline font-semibold text-body">
            {stats.averageAge !== null
              ? `${stats.averageAge} years old`
              : "not known yet"}
          </dd>
        </div>
        <div>
          <dt className="inline text-subtle">
            Percentage of foreign players in the league:{" "}
          </dt>{" "}
          <dd className="inline font-semibold text-body">
            {formatForeignPercentage(stats)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
