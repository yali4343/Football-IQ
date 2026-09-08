export function StatusMessage({ children, tone = "neutral" }) {
  const toneClasses = {
    neutral: "border-border bg-white/60 text-[#52605a]",
    success: "border-[#9bc7aa] bg-[#edf8ef] text-[#24613b]",
    error: "border-[#e4aaa5] bg-[#fff0ef] text-[#8b2e2b]",
  };

  return (
    <p
      className={`rounded-r-panel border-l-2 px-3 py-2 text-sm ${toneClasses[tone]}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      {children}
    </p>
  );
}
