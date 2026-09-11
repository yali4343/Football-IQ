import { useState } from "react";
import { useClubsQuery } from "./hooks/useClubsQuery.js";
import { useClubSelection } from "./hooks/useClubSelection.js";
import { useClubPlayersQuery } from "./hooks/useClubPlayersQuery.js";
import { useClubVisualTheme } from "./hooks/useClubVisualTheme.js";
import { StatusMessage } from "./components/StatusMessage.jsx";
import { PreviewBlock } from "./components/PreviewBlock.jsx";
import { Spinner } from "./components/Spinner.jsx";
import { PositionGroup } from "./components/PositionGroup.jsx";
import { ClubCrest } from "./components/ClubCrest.jsx";
import { PlayerProfileModal } from "./components/PlayerProfileModal.jsx";
import { ClubAnthemPlayer } from "./components/ClubAnthemPlayer.jsx";
import { Footer } from "./components/Footer.jsx";
import { getClubAnthemVideoId } from "./clubAnthems.js";

function DashboardStatusScreen({ busy = false, children }) {
  return (
    <main className="dashboard-shell" aria-busy={busy || undefined}>
      <div className="dashboard-frame">{children}</div>
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

  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const anthemVideoId = selectedClub
    ? getClubAnthemVideoId(selectedClub.id)
    : null;

  const dashboardStyle = useClubVisualTheme(selectedClub);

  const heroStyle = selectedClub?.stadiumImageUrl
    ? {
        backgroundImage: `linear-gradient(rgba(12, 16, 14, 0.55), rgba(12, 16, 14, 0.55)), url("${selectedClub.stadiumImageUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        "--hero-heading-color": "#f5f7f4",
        "--hero-info-color": "#e4e8e2",
      }
    : undefined;

  if (isLoading) {
    return (
      <>
        <DashboardStatusScreen busy>
          <StatusMessage>
            <Spinner className="mr-2" />
            Loading clubs...
          </StatusMessage>
        </DashboardStatusScreen>
        <Footer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <DashboardStatusScreen>
          <StatusMessage tone="error">
            Failed to load clubs: {error.message}
          </StatusMessage>
        </DashboardStatusScreen>
        <Footer />
      </>
    );
  }

  const page = (
    <main className="dashboard-shell" style={dashboardStyle}>
      <div className="dashboard-frame">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
          <section
            className="selected-stage"
            aria-labelledby="selected-club-heading"
            style={heroStyle}
          >
            {!selectedClub?.stadiumImageUrl && (
              <div className="stadium-lines" aria-hidden="true" />
            )}
            <div className="relative flex min-h-92 flex-col justify-between gap-10 p-6 sm:p-9">
              <div className="flex items-start justify-between gap-5">
                <div />
                {selectedClub && (
                  <ClubCrest club={selectedClub} key={selectedClub.id} />
                )}
              </div>

              <div>
                <h2
                  id="selected-club-heading"
                  className="font-display max-w-3xl text-6xl leading-[0.86] text-(--hero-heading-color) md:text-7xl lg:text-8xl"
                >
                  {selectedClub?.name ?? "Choose your club"}
                </h2>
                {selectedClub ? (
                  <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-(--hero-info-color)">
                    <span>League: {selectedClub.league}</span>
                    <span>Stadium: {selectedClub.stadium}</span>
                    {selectedClub.founded != null && (
                      <span>Founded: {selectedClub.founded}</span>
                    )}
                    {selectedClub.country && (
                      <span>Country: {selectedClub.country}</span>
                    )}
                    {selectedClub.clubColors && (
                      <span>Colors: {selectedClub.clubColors}</span>
                    )}
                    {selectedClub.coach?.name && (
                      <span>Coach: {selectedClub.coach.name}</span>
                    )}
                  </div>
                ) : (
                  <p className="mt-6 max-w-md text-sm leading-6 text-muted">
                    Your club details will appear here after you make a
                    selection.
                  </p>
                )}
                {anthemVideoId && (
                  <ClubAnthemPlayer
                    videoId={anthemVideoId}
                    clubName={selectedClub.name}
                  />
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

        <PreviewBlock
          title="Squad"
          description={
            selectedClub ? `${selectedClub.name}'s current squad:` : ""
          }
          disabled={!selectedClub}
        >
          {selectedClub &&
            (isLoadingPlayers ? (
              <p className="mt-3 flex items-center text-sm text-subtle">
                <Spinner className="mr-2" />
                Loading squad...
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                <PositionGroup
                  title="Goalkeepers"
                  players={players.filter((p) => p.position === "Goalkeeper")}
                  onSelectPlayer={setSelectedPlayer}
                />
                <PositionGroup
                  title="Defenders"
                  players={players.filter((p) => p.position === "Defender")}
                  onSelectPlayer={setSelectedPlayer}
                />
                <PositionGroup
                  title="Midfielders"
                  players={players.filter((p) => p.position === "Midfielder")}
                  onSelectPlayer={setSelectedPlayer}
                />
                <PositionGroup
                  title="Attackers"
                  players={players.filter((p) => p.position === "Attacker")}
                  onSelectPlayer={setSelectedPlayer}
                />
              </div>
            ))}
        </PreviewBlock>
      </div>

      <PlayerProfileModal
        player={selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
      />
    </main>
  );

  return (
    <>
      {page}
      <Footer />
    </>
  );
}

export default App;
