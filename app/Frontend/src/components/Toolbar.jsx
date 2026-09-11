import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { leagueToSlug } from "../leagueSlugs.js";

const LEAGUES = ["Premier League", "La Liga", "Serie A", "Bundesliga"];

function ChevronIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LeaguesInfoMenu({ onSelectLeague }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-bold text-body transition-colors hover:text-muted"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Leagues Info
        <ChevronIcon className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Leagues Info"
          className="absolute right-0 z-10 mt-2 w-44 rounded-(--radius-panel) border border-border bg-(--color-surface) py-1 shadow-lg"
        >
          {LEAGUES.map((league) => (
            <button
              key={league}
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2 text-left text-sm text-body hover:bg-(--color-border) hover:text-body"
              onClick={() => {
                setOpen(false);
                onSelectLeague(leagueToSlug(league));
              }}
            >
              {league}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Toolbar({ onSelectLeague }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-[78rem] items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-bold leading-none text-body">
            Choose your club
          </span>
        </Link>

        <nav className="flex items-center gap-6" aria-label="Main">
          <Link
            to="/about"
            className="text-sm font-bold text-body transition-colors hover:text-muted"
          >
            About this site
          </Link>
          <LeaguesInfoMenu onSelectLeague={onSelectLeague} />
        </nav>
      </div>
    </header>
  );
}
