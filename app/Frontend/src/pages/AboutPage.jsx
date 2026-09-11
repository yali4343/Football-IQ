const GITHUB_URL = "https://github.com/yali4343/Football-IQ";

export function AboutPage() {
  return (
    <main className="dashboard-shell">
      <div className="dashboard-frame max-w-3xl">
        <p className="eyebrow">About</p>
        <h1 className="font-display text-5xl leading-none text-body md:text-6xl">
          About Football-IQ
        </h1>
        <p className="mt-6 text-sm leading-6 text-body">
          Football-IQ is a full-stack football dashboard: pick a league,
          pick a club, and see its current squad, stadium, and details in
          one place. It's also a continuous learning project — the codebase
          is deliberately built and extended the way a production
          application would be, one real feature at a time.
        </p>
        <p className="mt-4 text-sm leading-6 text-body">
          Club, competition, and squad data is synced from football-data.org
          and API-Football, and stadium photography from TheSportsDB, kept
          up to date by a scheduled sync job.
        </p>
        <p className="mt-4 text-sm leading-6 text-body">
          The source is on{" "}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="font-semibold text-body underline underline-offset-2 hover:text-muted"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </main>
  );
}
