import { useClubsQuery } from "./hooks/useClubsQuery.js";
import { useClubSelection } from "./hooks/useClubSelection.js";
import { useClubPlayersQuery } from "./hooks/useClubPlayersQuery.js";
import { useClubVisualTheme } from "./hooks/useClubVisualTheme.js";
import { getClubInitials } from "./clubVisuals.js";
import { StatusMessage } from "./components/StatusMessage.jsx";
import { PreviewBlock } from "./components/PreviewBlock.jsx";
import { Spinner } from "./components/Spinner.jsx";

const dashboardTitle = "Personalized Football Team Dashboard";

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/footballIQ-logo.png"
        alt=""
        className="h-9 w-9 rounded-panel object-cover sm:h-10 sm:w-10"
      />
      <span className="font-display text-lg leading-none text-ink sm:text-xl">
        Football IQ
      </span>
    </div>
  );
}

function DashboardStatusScreen({ busy = false, children }) {
  return (
    <main className="dashboard-shell" aria-busy={busy || undefined}>
      <div className="dashboard-frame">
        <header className="flex items-start justify-between gap-6 border-b border-border-strong pb-6">
          <p className="eyebrow">Matchday dashboard</p>
          <BrandMark />
        </header>
        <h1 className="mt-8 font-display text-5xl leading-none text-ink md:text-6xl lg:text-7xl">
          {dashboardTitle}
        </h1>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

function App() {
  const { clubs, isLoading, error } = useClubsQuery();

  const {
    selectedLeague,
    selectLeague,
    selectClubById,
    isSelecting,
    selectionError,
    supportedLeagues,
    leagueClubs,
    selectedClub,
  } = useClubSelection(clubs);

  const { players, isLoading: isLoadingPlayers } = useClubPlayersQuery(
    selectedClub?.id,
  );

  const dashboardStyle = useClubVisualTheme(selectedClub);

  if (isLoading) {
    return (
      <DashboardStatusScreen busy>
        <StatusMessage>
          <Spinner className="mr-2" />
          Loading clubs...
        </StatusMessage>
      </DashboardStatusScreen>
    );
  }

  if (error) {
    return (
      <DashboardStatusScreen>
        <StatusMessage tone="error">
          Failed to load clubs: {error.message}
        </StatusMessage>
      </DashboardStatusScreen>
    );
  }

  return (
    <main className="dashboard-shell" style={dashboardStyle}>
      <div className="dashboard-frame">
        <header className="flex items-start justify-between gap-6 border-b border-border-strong pb-6">
          <div>
            <p className="eyebrow">Matchday dashboard</p>
            <h1 className="font-display mt-1 text-lg leading-none text-ink sm:text-xl">
              {dashboardTitle}
            </h1>
          </div>
          <BrandMark />
        </header>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
          <section
            className="selected-stage"
            aria-labelledby="selected-club-heading"
          >
            <div className="stadium-lines" aria-hidden="true" />
            <div className="relative flex min-h-92 flex-col justify-between gap-10 p-6 sm:p-9">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p
                    className="max-w-xs text-sm leading-6 text-muted"
                    aria-live="polite"
                  >
                    {selectedClub
                      ? `${selectedClub.name} is selected.`
                      : "No club selected yet."}
                  </p>
                </div>
                {selectedClub && (
                  <div className="club-mark" aria-hidden="true">
                    {getClubInitials(selectedClub.name)}
                  </div>
                )}
              </div>

              <div>
                <h2
                  id="selected-club-heading"
                  className="font-display max-w-3xl text-6xl leading-[0.86] text-(--club-ink) md:text-7xl lg:text-8xl"
                >
                  {selectedClub?.name ?? "Choose your club"}
                </h2>
                {selectedClub ? (
                  <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                    <span>{selectedClub.league}</span>
                    <span>{selectedClub.stadium}</span>
                  </div>
                ) : (
                  <p className="mt-6 max-w-md text-sm leading-6 text-muted">
                    Your club details and accent will appear here after you make
                    a selection.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section
            className="selector-panel"
            aria-labelledby="club-selector-heading"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="club-selector-heading"
                  className="font-display text-3xl leading-none"
                >
                  Choose your club
                </h2>
              </div>
            </div>

            {clubs.length === 0 ? (
              <p className="mt-8 text-sm leading-6 text-subtle">
                No clubs are available yet. Check back once club data has been
                synced.
              </p>
            ) : (
              <>
                <label
                  className="mt-8 block text-sm font-semibold text-body"
                  htmlFor="league-select"
                >
                  League
                </label>
                <select
                  id="league-select"
                  className="club-select mt-2"
                  value={selectedLeague}
                  onChange={(event) => selectLeague(event.target.value)}
                >
                  <option value="">Select a league</option>

                  {supportedLeagues.map((league) => (
                    <option key={league} value={league}>
                      {league}
                    </option>
                  ))}
                </select>

                <label
                  className="mt-5 block text-sm font-semibold text-body"
                  htmlFor="club-select"
                >
                  Club
                </label>
                <select
                  id="club-select"
                  className="club-select mt-2"
                  aria-describedby={
                    !selectedLeague ? "club-select-help" : undefined
                  }
                  disabled={
                    !selectedLeague || leagueClubs.length === 0 || isSelecting
                  }
                  value={
                    leagueClubs.some((club) => club.id === selectedClub?.id)
                      ? selectedClub.id
                      : ""
                  }
                  onChange={(event) => {
                    const value = event.target.value;

                    if (value !== "") {
                      selectClubById(Number(value));
                    }
                  }}
                >
                  <option value="">Select a club</option>

                  {leagueClubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
                {!selectedLeague && (
                  <p
                    id="club-select-help"
                    className="mt-2 text-sm leading-6 text-subtle"
                  >
                    Select a league first.
                  </p>
                )}
                {selectionError && (
                  <StatusMessage tone="error">
                    Failed to save your selection: {selectionError.message}
                  </StatusMessage>
                )}
              </>
            )}
          </section>
        </div>

        <section className="mt-16" aria-labelledby="preview-heading">
          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <PreviewBlock
              title="Upcoming Matches"
              description="Fixture information will appear here when match data is available."
              className="min-h-56"
            />
            <PreviewBlock
              title="League Position"
              description="Standings data is coming soon."
              className="min-h-56"
            />
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <PreviewBlock
              title="Recent Results"
              description="Recent match results will appear here in a future release."
            />
            <PreviewBlock
              title="Team Form"
              description="Form data will be available when the dashboard connects to match results."
            />
          </div>

          <PreviewBlock
            title="Club Overview"
            description={
              selectedClub
                ? `${selectedClub.name}'s current squad.`
                : "More club information is coming soon. This will include squad details, club history, and more."
            }
            className="mt-5 min-h-40"
          >
            {selectedClub &&
              (isLoadingPlayers ? (
                <p className="mt-3 flex items-center text-sm text-subtle">
                  <Spinner className="mr-2" />
                  Loading squad...
                </p>
              ) : (
                <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-body sm:grid-cols-4">
                  {players.map((player) => (
                    <li key={player.id}>
                      <span className="font-semibold">{player.name}</span>
                      <span className="block text-xs text-subtle">
                        {player.position}
                      </span>
                    </li>
                  ))}
                </ul>
              ))}
          </PreviewBlock>
        </section>
      </div>
    </main>
  );
}

export default App;
