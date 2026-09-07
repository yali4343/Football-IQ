export function PreviewBlock({ title, description, className = "", children }) {
  return (
    <section
      className={`relative overflow-hidden border border-[#d8ded8] bg-[#fffefa] p-5 sm:p-6 ${className}`}
      aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}
    >
      <div className="absolute right-0 top-0 h-16 w-16 border-b border-l border-[#d8ded8] bg-[#f1f4ef]" />
      <div className="relative flex h-full min-h-32 flex-col justify-between gap-8">
        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.12em] text-[#6d7972]">
            Preview
          </p>
          <h3
            id={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}
            className="font-display text-2xl leading-none text-[#17201d]"
          >
            {title}
          </h3>
        </div>
        <div>
          <p className="max-w-sm text-sm leading-6 text-[#68736f]">
            {description}
          </p>
          {children}
        </div>
      </div>
    </section>
  );
}
