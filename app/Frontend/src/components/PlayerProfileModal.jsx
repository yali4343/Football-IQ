import { useEffect } from "react";
import { PlayerAvatar } from "./PlayerAvatar.jsx";

function formatBirth(player) {
  const datePart = player.dateOfBirth
    ? new Date(player.dateOfBirth).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const placePart = [player.birthPlace, player.birthCountry]
    .filter(Boolean)
    .join(", ");

  if (datePart && placePart) {
    return `${datePart} in ${placePart}`;
  }

  return datePart ?? placePart ?? null;
}

export function PlayerProfileModal({ player, onClose }) {
  useEffect(() => {
    if (!player) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [player, onClose]);

  if (!player) {
    return null;
  }

  const fullName = [player.firstName, player.lastName]
    .filter(Boolean)
    .join(" ");
  const birth = formatBirth(player);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-profile-heading"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-panel border border-border bg-surface p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <PlayerAvatar
              player={player}
              className="h-24 w-24"
              textClassName="text-3xl"
            />
            <div>
              <h3
                id="player-profile-heading"
                className="font-display text-2xl leading-none text-ink"
              >
                {player.name}
              </h3>
              {fullName && fullName !== player.name && (
                <p className="mt-1 text-sm text-subtle">{fullName}</p>
              )}
              <p className="mt-1 text-sm text-muted">{player.position}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-subtle hover:text-body"
          >
            ✕
          </button>
        </div>

        <dl className="mt-6 space-y-2 text-sm">
          {birth && (
            <div className="flex justify-between gap-4">
              <dt className="text-subtle">Born</dt>
              <dd className="text-body">{birth}</dd>
            </div>
          )}
          {player.nationality && (
            <div className="flex justify-between gap-4">
              <dt className="text-subtle">Nationality</dt>
              <dd className="text-body">{player.nationality}</dd>
            </div>
          )}
          {player.height && (
            <div className="flex justify-between gap-4">
              <dt className="text-subtle">Height</dt>
              <dd className="text-body">{player.height} cm</dd>
            </div>
          )}
          {player.weight && (
            <div className="flex justify-between gap-4">
              <dt className="text-subtle">Weight</dt>
              <dd className="text-body">{player.weight} kg</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
