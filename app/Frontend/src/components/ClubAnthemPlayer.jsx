import { useState } from "react";

export function ClubAnthemPlayer({ videoId, clubName }) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setIsPlaying((current) => !current)}
        className="inline-flex items-center gap-2 rounded-panel border border-(--hero-info-color) px-3 py-1.5 text-sm font-semibold text-(--hero-heading-color) transition hover:bg-white/10"
      >
        {isPlaying ? "✕ Close the song" : `▶ Play ${clubName}'s fun song`}
      </button>

      {isPlaying && (
        <div className="mt-3 aspect-video w-full max-w-sm overflow-hidden rounded-panel border border-(--hero-info-color)">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title={`${clubName} anthem`}
            className="h-full w-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
