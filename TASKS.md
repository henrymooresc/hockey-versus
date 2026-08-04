# Feature Backlog

## Blockers — Rough Draft (local)

Do these in order. Each item stops the site from feeling finished.

- [x] Fix `/api/players/search` speed — added the `player_season_totals` table, filled by `compute:versus`. Both `minGames` and `onRoster` now read it instead of scanning 10.1M `shifts` rows. Endpoint went from 3.0-3.5s to 9-18ms, with identical results.
- [x] Fix `drizzle.config.ts` — it read `process.env.DATABASE_URL` without loading `.env`, so every drizzle-kit database command ran with `url: undefined`.
- [x] Repair the migration ledger — squashed the 7 migrations into `0000_baseline.sql` and recorded it as applied. `drizzle-kit migrate` and `drizzle-kit check` both run clean now.
- [x] Fix `/api/leaderboard` speed — added the `leaderboard_entries` table, filled by `compute:versus` for 11 season scopes x 3 game types. Endpoint went from 3.5s to 7ms.
- [x] Commit `drizzle/meta/` — removed the `.gitignore` rule that excluded it.
- [ ] Fix `npm run lint` — `next lint` no longer exists in Next 16, and ESLint is not installed. Install `eslint` + `eslint-config-next`, add `eslint.config.mjs`, and change the script to `eslint .`.
- [ ] Add the lint step to `.github/workflows/ci.yml` — CI runs only `tsc` and `vitest` today.

## Deferred — Public Launch

Hosting is on hold. The app queries `shifts` and `game_events` live, so a public
deploy needs the full 3.4GB database, not just the derived tables.

- [ ] Choose a database host and load the data.
- [ ] Deploy the Next.js app and point `DATABASE_URL` at the hosted database.

## Data Correctness

- [ ] Fix the missed-game bug in `scripts/ingest-seasons.ts:111` — the cutoff compares `game.gameDate` against `lastGamesIngestedAt`, a wall-clock timestamp. Games that finish after their first scan are skipped forever. This is why the 2025-26 playoffs are absent.
- [x] ~~Backfill the missing games~~ — not needed. The local database is a pre-launch test copy. A fresh host gets a full re-ingest instead.
- [ ] Remove the `versus_stats.rivalry_score` column — no API route reads it, and `compute-versus.ts:235` writes a skater score for goalie pairs. Every route recomputes the score from the raw sums.
- [ ] Add a minimum sample size to the All-Time Rivals list — a 2-game, 25-minute sample currently outranks a 10-year rivalry. The leaderboard uses a 1800-second floor; the rivals list has none.
- [ ] Pass the season filter to `/api/players/[id]/matchup` — the route ignores `seasons`, so Upcoming Matchups always shows all-time data while the toggle says otherwise.

## Infrastructure

- [ ] Rework stat ingestion and computation to support initial bulk loads and then daily progressive updates during the season
- [ ] Stream the upserts in `scripts/compute-versus.ts` — the script holds every pair in memory before it writes. A full 10-season recompute builds ~2.6M objects.
- [ ] Add an `AbortController` to the player search fetch in `src/components/PlayerSearch.tsx:240` — slow responses can overwrite newer ones.
- [ ] Add a `try/catch` to `/api/players/search` — it is the only route without one.
- [ ] Delete the stray `C:/Program Files/Git/home/...` directory in the repo root. A Windows path leaked into a `mkdir` call.

## UI Enhancements
- [x] Season toggle — switch between current/last season and last 10 seasons on all views
- [x] Show player team name and logo on all-time rivals player cards
- [x] Add TOI and games played to stat detail cards
- [x] Better loading states (skeletons) across all views
- [x] Add error boundaries for graceful degradation on component failures
- [x] Remove head-to-head pages/functionality; replace with a player-search filter inside the All-Time Rivals section
- [x] Remove the Team Rivalry Lookup panel; replace with a team filter inside the All-Time Rivals section
- [x] Fix "Show More" buttons so they expand the list inline instead of shrinking the panel into a scroll container
- [ ] Make leaderboard cards clickable to open an expanded view (same shape as the All-Time Rivals expanded detail card)
- [ ] Improve post-game breakdown — add per-pair visualizations (e.g. radar, shared-TOI sparkline) and tighten up the layout

## Refactor
- [ ] Condense codebase — find reused code (player headers, stat rows, toggle groups, etc.) and consolidate into shared components/utilities

## Data & Explanation
- [x] Rivalry score tooltip/explanation — don't fully surface the formula and weighting to users
- [x] Create some kind of visualization on the expanded detail cards for how players match up (radar chart, skater-vs-skater)
- [x] Investigate why rivalry scores don't match between the All-Time Rivals list and the leaderboard for the same pair (likely caused by different aggregation paths — leaderboard uses raw versus_stats sums, rivals uses the matchup-mapper computed score; reconcile so they always agree)

## Discovery
- [ ] SEO metadata — og:image, per-player/comparison page titles and descriptions
- [ ] Add `robots.txt` and `sitemap.xml`
- [ ] Add an analytics tool to measure real page speed after launch

## New Features
- [x] Team rivalry lookup — search by team and list all players on that team (similar to upcoming matchup section)
- [x] Rivalry score leaderboard — top rivalries across the league
- [ ] Per-game rivalry history expanded view / modal
- [x] Playoff game stats toggle
- [x] Post-game breakdown page — for a single game, show how each pair of players interacted (shared TOI, head-to-head stats), compare those numbers to their season/all-time averages and prior history, and show the game's rivalry score plus how it shifted each pair's running average
- [x] Team history flowchart on rivalry pairs — when two players have faced each other while on multiple different teams (e.g. Player B was traded mid-rivalry), show a team-logo timeline for each player tracing the teams they played for during their shared games. Helps surface long-running rivalries that span trades.
