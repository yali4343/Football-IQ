export function PreviewBlock({ title, description, className = "", children }) {
  return (
    <section
      className={`relative overflow-hidden border border-border bg-surface p-5 sm:p-6 ${className}`}
      aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}
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
            {description}
          </p>
          {children}
        </div>
      </div>
    </section>
  );
}
