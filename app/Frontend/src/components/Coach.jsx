export function Coach({ coach }) {
  if (!coach) {
    return (
      <p className="mt-3 text-sm text-subtle">
        Coach information isn't available for this club.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-body">
      <span className="font-semibold">{coach.name}</span>
      {coach.nationality && <span>Nationality: {coach.nationality}</span>}
      {coach.dateOfBirth && <span>Born: {coach.dateOfBirth.slice(0, 10)}</span>}
      {coach.contractStart && (
        <span>Contract start: {coach.contractStart.slice(0, 10)}</span>
      )}
      {coach.contractUntil && (
        <span>Contract until: {coach.contractUntil.slice(0, 10)}</span>
      )}
    </div>
  );
}
