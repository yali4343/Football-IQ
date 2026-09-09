import { useState } from "react";
import { getClubInitials } from "../clubVisuals.js";

export function PlayerAvatar({
  player,
  className = "h-16 w-16",
  textClassName = "text-lg",
}) {
  const [hasPhotoError, setHasPhotoError] = useState(false);
  const showPhoto = Boolean(player.photoUrl) && !hasPhotoError;

  if (showPhoto) {
    return (
      <img
        src={player.photoUrl}
        alt={player.name}
        className={`shrink-0 rounded-full object-cover ${className}`}
        onError={() => setHasPhotoError(true)}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-extrabold ${className} ${textClassName}`}
      style={{
        backgroundColor: "var(--club-secondary)",
        color: "var(--club-ink)",
      }}
      aria-hidden="true"
    >
      {getClubInitials(player.name)}
    </div>
  );
}
