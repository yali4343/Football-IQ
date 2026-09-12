# Football-IQ

A full-stack football dashboard for exploring club, squad, and league data across four major European leagues — Premier League, La Liga, Serie A, and Bundesliga.

Pick a league, pick a club, and see its current squad, stadium, coach, and background in one place. Football-IQ is also a continuous learning project: the codebase is deliberately built and extended the way a production application would be, one real feature at a time, rather than through disposable exercises.

**Live demo:** https://football-iq-frontend.onrender.com _(backend runs on Render's free tier and spins down when idle, so the first request after inactivity can take a few seconds)_

## Features

- **League browser** — view a league's emblem, description, and computed statistics (average squad age, percentage of foreign players) derived from currently synced data.
- **Club dashboard** — select a club and view its crest, stadium (with photography), address, founding year, and colors.
- **Squad explorer** — browse a club's full player list grouped by position, with per-player profile detail (age, nationality, height/weight, birthplace).
- **Coach info** — current head coach details where available.
- **Club descriptions** — short editorial summaries sourced from Wikipedia.
- **Club anthems** — plays each club's anthem where available.
- **Scheduled data sync** — club, competition, squad, and stadium data is kept up to date from external football data providers rather than entered by hand.

## Tech stack

**Backend** — `app/Backend`
- [Fastify](https://fastify.dev/) REST API, TypeScript
- [Prisma ORM](https://www.prisma.io/) 7 with a PostgreSQL driver adapter
- [Zod](https://zod.dev/) request/response validation
- [tsyringe](https://github.com/microsoft/tsyringe) for dependency injection
- `@fastify/swagger` + `@fastify/swagger-ui` for OpenAPI documentation
- [Vitest](https://vitest.dev/) for unit tests, [oxlint](https://oxc.rs/docs/guide/usage/linter.html) for linting

**Frontend** — `app/Frontend`
- React 19 with React Router
- [TanStack Query](https://tanstack.com/query/latest) for server state
- Vite build tooling, Tailwind CSS 4

**Data sources**
- [football-data.org](https://www.football-data.org/) and [API-Football](https://www.api-football.com/) for competitions, clubs, coaches, and squads
- [TheSportsDB](https://www.thesportsdb.com/) for stadium photography
- Wikipedia for club descriptions

**Persistence & deployment**
- PostgreSQL
- Deployed on [Render](https://render.com/) (`render.yaml`): a Node web service for the backend, a static site for the frontend

## Architecture

The backend follows a layered service architecture:

```
routes/        Fastify route handlers — HTTP concerns, schema-validated request/response
  ↓
services/      Business logic (ClubService, LeagueService, FootballSyncService, ...)
  ↓
integrations/  Typed HTTP clients for each external data provider
  ↓
db/            Prisma client
```

Route handlers and services depend on interfaces (`ClubService`, `LeagueService`, `FootballSyncService`), wired at startup through a `tsyringe` container (`container.ts`), keeping the route layer decoupled from the Prisma-backed implementations.

Data flows in from external providers through a one-way sync pipeline (`services/football-sync/`): a `FootballSyncService` orchestrates dedicated syncers per concern (clubs, squads, player profiles, stadium images), which normalize third-party payloads into the local Prisma schema. Most reads are served entirely from the local database; the one exception is `GET /clubs/:id/description`, which calls the Wikipedia API on demand and degrades gracefully to `null` if it fails, rather than failing the request.

## API

The backend exposes a REST API under two resources, `/clubs` and `/leagues`. Full interactive documentation — generated from the same Zod schemas that validate requests — is served at `/documentation` when the backend is running (e.g. `http://localhost:3000/documentation`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/clubs` | List all supported clubs |
| `GET` | `/clubs/selection` | Get the currently selected club |
| `PATCH` | `/clubs/selection` | Select a club |
| `GET` | `/clubs/:id` | Get a club by ID |
| `GET` | `/clubs/:id/players` | Get a club's squad |
| `GET` | `/clubs/:id/description` | Get a club's Wikipedia-sourced description |
| `GET` | `/leagues/:slug` | Get a league's emblem, description, and computed statistics |

## Getting started

### Prerequisites

- Node.js 24+
- A PostgreSQL database
- API keys for [football-data.org](https://www.football-data.org/client/register), [API-Football](https://www.api-football.com/), and [TheSportsDB](https://www.thesportsdb.com/)

### Backend

```bash
cd app/Backend
npm install
```

Create a `.env` file with:

```
DATABASE_URL=postgresql://...
API_FOOTBALL_KEY=...
FOOTBALL_DATA_API_KEY=...
THESPORTSDB_API_KEY=...
```

Run migrations and seed the base league data:

```bash
npx prisma migrate dev
npm run db:seed
```

Sync clubs, squads, and stadium data from the external providers:

```bash
npm run sync:football-data
```

Start the API:

```bash
npm run dev
```

The API listens on `http://localhost:3000`; Swagger UI is available at `http://localhost:3000/documentation`.

### Frontend

```bash
cd app/Frontend
npm install
npm run dev
```

The app runs on `http://localhost:5173` and expects the backend at `http://localhost:3000` (configurable via `VITE_API_BASE_URL`).

## Testing & linting

```bash
# Backend
cd app/Backend
npm test     # Vitest unit tests
npm run lint # oxlint

# Frontend
cd app/Frontend
npm run lint # oxlint
```

## Deployment

`render.yaml` defines a Render Blueprint with two services: a Node web service for the Fastify backend (running Prisma migrations on deploy) and a static site for the Vite-built frontend.

## Project status

Football-IQ is under active, incremental development as part of a structured backend/frontend learning roadmap (see `ProgramGoal.md`). Current focus is production-quality data modeling and performance (PostgreSQL schema design, indexing, query optimization); authentication, containerization, CI/CD, and distributed-systems topics are planned for later phases and are not yet implemented.

## License

No license file is currently published for this repository.
