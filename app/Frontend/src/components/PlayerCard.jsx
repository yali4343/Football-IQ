import { useState } from "react";
import { getClubInitials } from "../clubVisuals.js";

export function PlayerCard({ player }) {
  const [hasPhotoError, setHasPhotoError] = useState(false);
  const showPhoto = Boolean(player.photoUrl) && !hasPhotoError;

  return (
    <div className="flex items-center gap-3 rounded-panel border border-border bg-surface p-3">
      {showPhoto ? (
        <img
          src={player.photoUrl}
          alt={player.name}
          className="h-16 w-16 shrink-0 rounded-full object-cover"
          onError={() => setHasPhotoError(true)}
        />
      ) : (
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-display text-lg font-extrabold"
          style={{
            backgroundColor: "var(--club-secondary)",
            color: "var(--club-ink)",
          }}
          aria-hidden="true"
        >
          {getClubInitials(player.name)}
        </div>
      )}

      <div className="min-w-0">
        <p className="truncate font-semibold text-body">{player.name}</p>
        {player.age != null && (
          <p className="text-xs text-subtle">Age: {player.age}</p>
        )}
      </div>
    </div>
  );
}
