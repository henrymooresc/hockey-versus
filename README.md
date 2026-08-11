# Hockey Versus

Compare how NHL players perform when they share the ice. Covers the last 10 NHL
seasons.

Live at **[hockey-versus.vercel.app](https://hockey-versus.vercel.app)**.

For every game, the ingestion lines up each player's shifts second by second,
then reads the play-by-play to record what happened while any two players were
on the ice together. A Rivalry Score ranks the result.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, Recharts
- **Database:** PostgreSQL 16 + Drizzle ORM
- **Language:** TypeScript
- **Tests:** Vitest
- **Hosting:** Vercel for the app, Neon for the database

## Data Sources

Three NHL endpoints, all unauthenticated:

| Host | Supplies |
|---|---|
| `api-web.nhle.com` | schedule, standings, boxscores, play-by-play, player bios |
| `api.nhle.com` | shift charts |
| `www.nhl.com` | HTML shift reports, the fallback when a shift chart is empty |

## Scale

Measured 2026-08-11.

| Table | Rows |
|---|---|
| shifts | 10,219,171 |
| game_events | 3,455,059 |
| versus_stats | 2,636,595 |
| games | 13,187 |
| players | 2,299 |

About 1.9GB restored. Four routes read `shifts` and `game_events` at request
time, so a deploy needs the whole database, not only the derived tables.

## Setup

```bash
npm install
cp .env.example .env
npx drizzle-kit migrate
```

### Connection strings

A local database needs only `DATABASE_URL`.

A hosted database has two endpoints, and the two halves of the project use
different ones:

- `DATABASE_URL` — the **pooled** endpoint, used by the site.
  `src/db/index.ts` sets `prepare: false`, which PgBouncer in transaction mode
  requires, plus a small pool because each serverless instance opens its own.
- `DIRECT_DATABASE_URL` — the **direct** endpoint, used by the scripts and by
  drizzle-kit. They run long bulk writes and DDL, and gain from prepared
  statements. Both fall back to `DATABASE_URL` when it is not set.

## Data Ingestion

Run in order. Each script takes `--seasons 20252026,20242025`, and defaults to
the current season only:

```bash
npm run ingest:seasons   # games & teams
npm run ingest:players   # player info
npm run ingest:shifts    # shift chart data
npm run ingest:events    # play-by-play events
npm run compute:versus   # head-to-head stats + derived tables
```

Each script resumes from a per-game flag on the `games` row, so a re-run picks
up only what did not finish.

`compute:versus` also rebuilds the two tables the site reads directly:

- `player_season_totals` — games played per player, per season. The player
  search reads it instead of scanning 10M shift rows.
- `leaderboard_entries` — the ranked leaderboard for each season scope and
  game type.

Run `compute:versus` after every ingestion. The site serves stale rankings
until you do.

## Moving the database

Do not re-ingest to populate a new host. It costs hours of NHL API calls. Dump
and restore instead — the whole database compresses to about 150MB and dumps in
under 30 seconds:

```bash
pg_dump -Fc --no-owner --no-privileges "$DATABASE_URL" -f hv.dump
```

Restore into an **empty** database with one plain command. The dump already
carries the schema, every index, and the drizzle migration ledger, so
`drizzle-kit migrate` beforehand is unnecessary:

```bash
pg_restore --no-owner --no-privileges -j 4 -d "$DIRECT_DATABASE_URL" hv.dump
```

Run `ANALYZE` afterwards. Without fresh statistics the planner picks a bad plan
for `team-history`.

Do not pass `--disable-triggers`. It needs superuser, which managed hosts do
not grant, and a plain restore does not need it.

## Caching

Every page is a client shell that fetches from `/api`, so without cache headers
each view reaches Postgres. `src/lib/api-cache.ts` holds two policies, and
every route carries one:

- **`DERIVED`** — one hour, with a 24-hour `stale-while-revalidate`. For
  anything only the scripts change.
- **`SCHEDULE`** — five minutes. For recent games, upcoming games and standings.

Error responses carry no policy, so a CDN cannot pin a failure.

Vercel's CDN consumes `s-maxage` and strips it before the response reaches the
browser. To confirm caching works, watch `x-vercel-cache` go from `MISS` to
`HIT` rather than looking for the directive.

## Development

```bash
npm run dev
```

## Checks

CI runs all four on every push to `main` and `dev`. Lint fails on a single
warning:

```bash
npm run lint      # eslint . --max-warnings 0
npx tsc --noEmit
npm test          # 65 tests over the pure scoring and time helpers
npm run build
```

The build needs a `DATABASE_URL`, because `next build` imports every route
module and `src/db` throws without one. No query runs, so a placeholder is
enough.

## Notes

- **Images.** NHL headshots and team logos go through
  `src/components/RemoteImage.tsx`, a plain `<img>` rather than `next/image`.
  Team logos are SVG, which the Next optimizer refuses without
  `dangerouslyAllowSVG` and would not improve, and headshots are small enough
  that a per-size transformation costs more than it saves. That component holds
  the only `@next/next/no-img-element` exception; the rule stays on everywhere
  else.
- **Data fetching.** Panels use `src/hooks/useFetchedData.ts`, which stores a
  result with the url it came from and derives `loading` during render. It also
  aborts a superseded request. `useKeyedState.ts` resets a selection when the
  request behind it changes.
