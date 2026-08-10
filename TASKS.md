# Feature Backlog

## Blockers — Rough Draft (local)

Do these in order. Each item stops the site from feeling finished.

- [x] Fix `/api/players/search` speed — added the `player_season_totals` table, filled by `compute:versus`. Both `minGames` and `onRoster` now read it instead of scanning 10.1M `shifts` rows. Endpoint went from 3.0-3.5s to 9-18ms, with identical results.
- [x] Fix `drizzle.config.ts` — it read `process.env.DATABASE_URL` without loading `.env`, so every drizzle-kit database command ran with `url: undefined`.
- [x] Repair the migration ledger — squashed the 7 migrations into `0000_baseline.sql` and recorded it as applied. `drizzle-kit migrate` and `drizzle-kit check` both run clean now.
- [x] Fix `/api/leaderboard` speed — added the `leaderboard_entries` table, filled by `compute:versus` for 11 season scopes x 3 game types. Endpoint went from 3.5s to 7ms.
- [x] Commit `drizzle/meta/` — removed the `.gitignore` rule that excluded it.
- [x] Fix `npm run lint` — installed ESLint 9 and `eslint-config-next` 16, added `eslint.config.mjs`, and pointed the script at `eslint .`. `eslint-config-next` ships flat config, so no `FlatCompat` shim is needed.
- [x] Add the lint step to `.github/workflows/ci.yml`. It fails on errors only, since 32 warnings are known debt.
- [x] Build in CI. It ran lint, types and tests but never built, so a build-only break would have reached deploy. The build needs a placeholder `DATABASE_URL` because `next build` imports every route module; no query runs, so no secret is needed.
- [ ] Clear the 32 lint warnings, then tighten CI to `eslint . --max-warnings 0`:
    - 22 `@next/next/no-img-element`. Every NHL headshot and team logo is a plain `<img>`. Switching to `next/image` needs sizing work on each one.
    - 8 `react-hooks/set-state-in-effect`. Each data panel resets state and fetches inside one effect, which costs an extra render. Fixing it means restructuring fetching in eight components, so the rule is set to `warn` rather than silenced.
    - 2 `react-hooks/exhaustive-deps`. Both are deliberate: `SoloAnalysis` depends on `allSeasons.length` rather than the array, and `UpcomingMatchups` on `selectedGame?.opponentTeamId` rather than the whole game.

## Deferred — Public Launch

Hosting is on hold. The app queries `shifts` and `game_events` live, so a public
deploy needs the whole database, not just the derived tables. That is now
**1.9GB**, down from 3.4GB, which widens the choice of host.

- [ ] Choose a database host and load the data.
- [ ] Deploy the Next.js app and point `DATABASE_URL` at the hosted database.

## Data Correctness

- [x] Fix the missed-game bug in both ingestion scripts. They compared a game date against the wall-clock time of the last run, so a game that was not final on its first scan was skipped forever. Both now resume from a per-game `players_scanned` flag. Recovered 88 games: the 6 regular-season games of 2026-04-16 and all 82 playoffs of 2025-26.
- [x] Repair the schema drift that stopped ingestion entirely. `seasons.last_games_ingested_at` and `last_players_scanned_at` were declared in `schema.ts` but never existed in the database, so both scripts crashed on their first query. Removed rather than added, since they were the broken mechanism.
- [x] ~~Backfill the missing games~~ — not needed. The local database is a pre-launch test copy. A fresh host gets a full re-ingest instead.
- [ ] Run `ingest:shifts`, `ingest:events` and `compute:versus` for the 88 recovered games, or leave them until the re-ingest. They stay invisible to the site until then, because every query requires both progress flags.
- [ ] Remove the `versus_stats.rivalry_score` column — no API route reads it, and `compute-versus.ts:413` writes a skater score for goalie pairs. Every route recomputes the score from the raw sums.
- [x] Correct small samples in the rankings — skater pairs now regress toward the league mean (5.65 weighted volume per game) with a 10-game prior. Pairs with 1-3 shared games scored twice the league mean before, which was noise. A `*` marks any score built on fewer than 10 shared games.
- [x] Pass the season filter to `/api/players/[id]/matchup` — the route ignored `seasons`, so Upcoming Matchups always showed all-time data.
- [x] Split the leaderboard into a skater board and a shooter-versus-goalie board. The two formulas measure different contests, so one combined board buried every skater pair.
- [x] Move the goalie score back to per-game and regress it, and delete `GOALIE_VOLUME_SCALE`. Goalie scores no longer grow with career length, and the hand-tuned `1/6` constant is gone.
- [ ] Decide whether the two boards should share a scale — skater scores run about twice goalie scores at every rank. The cause is the balance term, not the volume term. For a goalie pair, `1 - |goals - saves| / shots` reduces exactly to `2 x shooting percentage`, which real hockey caps near 0.20. Skater categories are near-symmetric and approach 1.0. Split boards make this cosmetic, so fix it only if the two ever need to merge.
- [ ] Consider spreading the goalie board out — its top 50 spans 8.13 to 9.78, a 20% range, against 14.26 to 19.61 for skaters. That compression lets 14 small samples reach the top 50, where the skater board admits none.

## Using the extracted event fields

`game_events` now carries the useful parts of the NHL play-by-play `details`
object as typed columns. Nothing scores on them yet. Each item below says what
to change and what to watch for.

- [ ] **Weight penalties by severity in the rivalry score.** `computeSkaterRivalryScore` counts every penalty the same, so a fight and a 2-minute hooking are equal. `penalty_minutes` holds 2, 4, 5, 10 or 15, and `penalty_desc_key` names the infraction — there are 5,830 fights across the 10 seasons, which is the strongest rivalry signal in the data.
    - Where: `scripts/compute-versus.ts` aggregates penalties into `penaltiesByA`/`penaltiesByB`. Add a parallel weighted sum, for example minutes rather than a count, and use it in `CATEGORY_WEIGHTS.penalties`.
    - Watch for: the league mean per game is measured at 5.65 for skaters and 5.47 for goalies, and both are hard-coded in `rivalry-score.ts` as regression priors. Changing what a penalty contributes shifts those means, so re-derive them with the SQL in the `PRIOR_VOLUME_PER_GAME` comment and re-run `compute:versus`.

- [ ] **Attribute shots to the goalie who actually faced them.** The goalie score currently infers the matchup from shared ice time. `goalie_in_net_id` states it directly and covers 1,128,095 of 1,136,064 shots and goals.
    - Where: `src/lib/versus-engine.ts` builds goalie pairs from shift overlap. Use the column instead, and the pairing becomes exact rather than inferred.
    - Watch for: this mainly changes empty-net and pulled-goalie situations, where a goalie is off the ice but the old logic still paired them. Expect small score movements, not a rewrite. Re-run `compute:versus` and re-check the goalie board.

- [ ] **Shot quality from `shot_type` and coordinates.** `shot_type` gives wrist, slap, snap, tip-in and so on. `x_coord`/`y_coord` span -100..100 and -42..42, so distance and angle from the net are simple arithmetic, and `zone_code` gives O, D or N.
    - Uses: shot maps and heat maps on the expanded detail cards, a danger-zone weighting for shots in the rivalry score, or zone-start context.

- [ ] **Game state from the running score.** `home_score`/`away_score` sit on goals and `home_sog`/`away_sog` on shots, so any event can be placed in a close game or a blowout. A hit at 5-0 means less than a hit at 3-3, and the score currently cannot tell them apart.

- [ ] **`reason` on missed and blocked shots** — wide-of-net, hit-crossbar, and so on. Useful for separating near misses from wild ones.

## Infrastructure

- [x] Speed up `/api/players/[id]/team-history` — 700-900ms down to 12-15ms, with byte-identical output. Two changes: a covering index `idx_shifts_player_game` on `(player_id, game_id, team_id)`, since every other index on `shifts` leads with `game_id`; and splitting one joined statement into three small queries.
    - The split matters more than the index. As one statement the planner estimated the shared-games set at 1.6M rows when the real answer is about 20, and sized every join for that, including a merge join against the whole `games` table. The estimate cannot be fixed from the query: it comes from not knowing how many distinct games one player appears in. Extended statistics on `(player_id, game_id)` were tried and made it worse.
    - The old shape was also unstable. Which pairs were fast flipped between `ANALYZE` runs, because the plan choice hinged on that bad estimate.
- [ ] Rework stat ingestion and computation to support initial bulk loads and then daily progressive updates during the season
- [ ] Stream the upserts in `scripts/compute-versus.ts` — the script holds every pair in memory before it writes. A full 10-season recompute builds ~2.6M objects.
- [ ] Add an `AbortController` to the player search fetch in `src/components/PlayerSearch.tsx:241` — slow responses can overwrite newer ones. `SoloAnalysis` and `UpcomingMatchups` already do this; the homepage search still does not.
- [x] Add a `try/catch` to `/api/players/search` — done during the speed rewrite.
- [x] Delete the stray `C:/Program Files/Git/home/...` directory in the repo root. A Windows path leaked into a `mkdir` call. It held no files and git never tracked it.

## UI Enhancements
- [x] Season toggle — switch between current/last season and last 10 seasons on all views
- [x] Show player team name and logo on all-time rivals player cards
- [x] Add TOI and games played to stat detail cards
- [x] Better loading states (skeletons) across all views
- [x] Add error boundaries for graceful degradation on component failures
- [x] Remove head-to-head pages/functionality; replace with a player-search filter inside the All-Time Rivals section
- [x] Remove the Team Rivalry Lookup panel; replace with a team filter inside the All-Time Rivals section
- [x] Fix "Show More" buttons so they expand the list inline instead of shrinking the panel into a scroll container
- [x] Make leaderboard cards clickable to open an expanded view (same shape as the All-Time Rivals expanded detail card)
- [x] Show both players in the expanded bio card. It profiled only the opponent, so the player you started from disappeared.
- [ ] Improve post-game breakdown — add per-pair visualizations (e.g. radar, shared-TOI sparkline) and tighten up the layout

## Refactor
- [ ] Condense codebase — find reused code (player headers, stat rows, etc.) and consolidate into shared components/utilities. Partly done: `ToggleGroup` now covers the season and game-type toggles in both panels, `SmallSampleMark` the `*` on scores, `BioPlayer` the shared player shape, and `computePairRivalryScore` the skater/goalie dispatch that used to live in three places. Player headers and stat rows are still duplicated.

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

## Database size

Measured 2026-08-07. Total went from 3433MB to 1912MB, a 44% cut, while
gaining 13 queryable columns.

- [x] Replace `game_events.details_json` with typed columns. The blob cost 643MB, and most of that was the key names stored again on every one of 3.4M rows. Nothing read it.
- [x] Drop the serial primary keys on `shifts`, `game_events` and `versus_stats` — 400MB of index that no foreign key referenced. Each table has a natural unique key.
- [x] Drop `idx_shifts_game_period` (342MB) and `idx_events_type` (24MB). Neither was scanned while exercising every route.
- [x] Add `idx_shifts_player_game` (81MB) for team-history. This is the only index added back, and it took the total from 1812MB to 1912MB.
- [x] Drop `shifts.shift_number` — written by ingestion, never read.
- [x] Add `uq_game_events_game_event`, declared in the schema but never applied. Without it `onConflictDoNothing` had nothing to conflict against, and a re-run of `ingest-events` had already inserted 492 duplicate events. Those are deleted and `compute:versus` has been re-run.
- [ ] ~~Query shifts and events from the NHL API instead of storing them~~ — investigated and rejected. Latency is fine for one game (about 160ms for both endpoints in parallel), but only the post-game breakdown reads a single game. `rival-history` needs up to 40 games and `team-history` needs many more, so the tables have to stay. It would have cost 150ms and a hard dependency on NHL uptime to save nothing.
