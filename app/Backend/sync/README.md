# Syncing football data

How to pull fresh club, squad, and player data from the upstream APIs
(football-data.org, API-Football, TheSportsDB) into the local database.

## Quick start

```bash
cd app/Backend
npm run sync:football-data
```

This builds the TypeScript project and runs `dist/sync/syncFootballData.js`,
which syncs every league in the `League` table (currently Premier League,
La Liga, Serie A, Bundesliga — see `prisma/seed.ts`).

## Prerequisites

Three API keys must be set in `app/Backend/.env` (see `requireApiKey` calls
in `integrations/*/Http*Client.ts`):

- `FOOTBALL_DATA_API_KEY` — club membership per league
- `API_FOOTBALL_KEY` — club mapping, squads, player profiles
- `THESPORTSDB_API_KEY` — stadium images

`DATABASE_URL` must also point at a running Postgres instance with
migrations applied (`npx prisma migrate deploy`).

## What "syncing" actually does

`FootballSyncService.run()` (`services/football-sync/PrismaFootballSyncService.ts`)
walks each targeted league through, in order:

1. **MembershipSyncer** — which clubs currently belong to the league
   (create/update/deactivate rows).
2. **ClubMapper** — maps clubs to their API-Football team ID.
3. **StadiumImageSyncer** — stadium image URLs (TheSportsDB).
4. **SquadSyncer** — current squad per club (API-Football).
5. **PlayerProfileSyncer** — per-player profile detail (skipped in `--dry-run`).

Each syncer independently skips work that's still "fresh" (see
`FRESHNESS_WINDOW_MS` in `SquadSyncer.ts`, currently 24h) so an everyday
run only re-fetches what's actually stale, unless `--force` is passed.

## Command-line options

`syncFootballData.ts` accepts:

| Flag | Effect |
|---|---|
| `--league=<slug>` | Only sync one league, e.g. `--league=premier-league` |
| `--club=<slug>` | Within that league, only sync one club |
| `--force` | Ignore freshness checks; re-fetch everything |
| `--dry-run` | Log what would change; skip writes and player-profile calls |

League slugs are derived from `League.name` via `slugifyLeagueName`
(lowercased, non-alphanumerics → `-`): `premier-league`, `la-liga`,
`serie-a`, `bundesliga`.

Examples:

```bash
# Sync everything (normal daily run)
npm run sync:football-data

# Sync just one league
npm run sync:football-data -- --league=premier-league

# See what a full re-sync would touch without writing anything
npm run sync:football-data -- --dry-run --force
```

The run ends by printing a per-league summary (clubs/players
created/updated/deactivated, unmapped clubs, missing stadium images,
failed clubs) and the API-Football request count against its **100
requests/day** free-tier quota. A non-zero exit code means at least one
league or club failed — check that output (or logs, if scheduled) when
diagnosing a failed run.

## Running it every day

### GitHub Actions (recommended — runs even when your computer is off)

`.github/workflows/daily-football-sync.yml` runs `npm run sync:football-data`
once a day (06:00 UTC) against the same `DATABASE_URL` and API keys the
deployed backend uses, supplied as repository secrets rather than committed
to the repo:

- `DATABASE_URL`
- `API_FOOTBALL_KEY`
- `FOOTBALL_DATA_API_KEY`
- `THESPORTSDB_API_KEY`

Add them under the repo's **Settings → Secrets and variables → Actions**.
A failed run shows up as a red X in the **Actions** tab (and GitHub's
default email/UI alerting on failed scheduled workflows) with no extra setup
needed. To trigger a run on demand — e.g. to test after adding secrets —
use the **Run workflow** button on the workflow's Actions page
(`workflow_dispatch`).

### Running it manually (local testing / fallback)

The sync is also a plain CLI script, so it can still be run directly from
any machine — useful for local testing or as a fallback if you'd rather
schedule it yourself outside GitHub Actions.

### Windows (Task Scheduler)

```powershell
schtasks /Create /SC DAILY /ST 06:00 /TN "FootballIQ-DailySync" ^
  /TR "cmd /c cd /d C:\Users\User\Desktop\Football-IQ\app\Backend && npm run sync:football-data >> sync.log 2>&1"
```

Adjust `/ST` for the time you want it to run. Check `Task Scheduler Library`
to confirm it's registered, and `sync.log` for output.

### Cron (Linux/macOS host or WSL)

```cron
0 6 * * * cd /path/to/Football-IQ/app/Backend && npm run sync:football-data >> sync.log 2>&1
```

### Why once a day is enough

API-Football's free tier caps out at 100 requests/day and ~10/minute
(`MIN_DELAY_MS` / `DEFAULT_SAFETY_MARGIN` in `HttpApiFootballClient.ts`).
Combined with the 24h freshness window, running more than once a day
mostly burns quota re-checking data that hasn't changed — once daily
(e.g. early morning) is the practical cadence until squads or stadium
data are known to change intraday.

## Troubleshooting

- **`FAILED — <ENV_VAR> is not set`**: the corresponding API key is
  missing from `.env`.
- **`clubs skipped: N quota`** / **`profiles skipped (quota)`**: the
  API-Football daily quota safety margin was hit mid-run; the rest
  completes on the next scheduled run.
- **`unmapped: <club names>`**: `ClubMapper` couldn't match a club to an
  API-Football team by name — needs a manual mapping fix, not a re-run.
