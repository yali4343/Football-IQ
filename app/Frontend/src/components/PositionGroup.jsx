import { PlayerCard } from "./PlayerCard.jsx";

export function PositionGroup({ title, players, onSelectPlayer }) {
  if (players.length === 0) {
    return null;
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-subtle uppercase tracking-wide">
        {title}
      </h4>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            onSelect={onSelectPlayer}
          />
        ))}
      </div>
    </div>
  );
}
