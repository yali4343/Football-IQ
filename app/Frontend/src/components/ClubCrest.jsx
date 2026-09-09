import { useState } from "react";
import { getClubInitials } from "../clubVisuals.js";

export function ClubCrest({ club }) {
  const [hasError, setHasError] = useState(false);
  const showCrest = Boolean(club.crest) && !hasError;

  if (showCrest) {
    return (
      <img
        src={club.crest}
        alt={club.name}
        className="h-28 w-28 object-contain"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className="club-mark" aria-hidden="true">
      {getClubInitials(club.name)}
    </div>
  );
}
