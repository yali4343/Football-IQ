export function Spinner({ className = "" }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-muted align-[-3px] ${className}`}
      aria-hidden="true"
    />
  );
}
