# Hockey Versus

Compare how NHL players perform when sharing the ice. Covers the last 10 NHL seasons.

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS
- **Database:** PostgreSQL + Drizzle ORM
- **Data Source:** NHL APIs (`web-api.nhle.com`, `api.nhle.com`)
- **Language:** TypeScript

## Setup

```bash
npm install
cp .env.example .env   # set DATABASE_URL
npx drizzle-kit migrate
```

A local database needs only `DATABASE_URL`.

A hosted database has two endpoints, and the two halves of the project use
different ones:

- `DATABASE_URL` — the **pooled** endpoint. The site uses it. `src/db/index.ts`
  sets `prepare: false`, which PgBouncer in transaction mode requires.
- `DIRECT_DATABASE_URL` — the **direct** endpoint. The scripts below use it.
  They run long bulk writes and gain from prepared statements. They fall back
  to `DATABASE_URL` when it is not set.

## Data Ingestion

Run in order:

```bash
npm run ingest:seasons   # games & teams
npm run ingest:players   # player info
npm run ingest:shifts    # shift chart data
npm run ingest:events    # play-by-play events
npm run compute:versus   # head-to-head stats + derived tables
```

`compute:versus` also rebuilds the two tables that the site reads directly:

- `player_season_totals` — games played per player, per season. The player
  search reads it instead of scanning 10M shift rows.
- `leaderboard_entries` — the ranked leaderboard for each season scope and
  game type.

Run `compute:versus` after every ingestion. The site serves stale rankings
until you do.

## Development

```bash
npm run dev
```
