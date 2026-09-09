import { PlayerAvatar } from "./PlayerAvatar.jsx";

export function PlayerCard({ player, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(player)}
      className="flex items-center gap-3 rounded-panel border border-border bg-surface p-3 text-left transition hover:border-border-strong"
    >
      <PlayerAvatar player={player} />

      <div className="min-w-0">
        <p className="truncate font-semibold text-body">{player.name}</p>
        {player.age != null && (
          <p className="text-xs text-subtle">Age: {player.age}</p>
        )}
      </div>
    </button>
  );
}
