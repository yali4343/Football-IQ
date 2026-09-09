import { useState } from "react";
import { getClubInitials } from "../clubVisuals.js";

export function ClubCrest({ club }) {
  const [hasError, setHasError] = useState(false);
  const showCrest = Boolean(club.crest) && !hasError;

  return (
    <div className="club-mark" aria-hidden="true">
      {showCrest ? (
        <img
          src={club.crest}
          alt=""
          className="h-full w-full object-contain p-2"
          onError={() => setHasError(true)}
        />
      ) : (
        getClubInitials(club.name)
      )}
    </div>
  );
}
