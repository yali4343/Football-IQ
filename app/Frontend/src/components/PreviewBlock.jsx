const DISABLED_MESSAGE = "Select a club to view this.";

export function PreviewBlock({
  title,
  description,
  className = "",
  children,
  disabled = false,
}) {
  return (
    <section
      className={`relative overflow-hidden border border-border bg-surface p-5 sm:p-6 ${
        disabled ? "opacity-50" : ""
      } ${className}`}
      aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}
      aria-disabled={disabled || undefined}
    >
      <div className="relative flex h-full min-h-32 flex-col justify-between gap-8">
        <div>
          <h3
            id={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}
            className="font-display text-2xl leading-none text-ink"
          >
            {title}
          </h3>
        </div>
        <div>
          <p className="max-w-sm text-sm leading-6 text-subtle">
            {disabled ? DISABLED_MESSAGE : description}
          </p>
          {!disabled && children}
        </div>
      </div>
    </section>
  );
}
