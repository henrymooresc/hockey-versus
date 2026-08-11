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
- [x] **Clear the 32 lint warnings and tighten CI** — done 2026-08-11. `npm run lint` is now `eslint . --max-warnings 0`, so a single warning fails CI. The `react-hooks/set-state-in-effect` override is gone from `eslint.config.mjs`, and the rule is back at its default of error.
    - **8 `react-hooks/set-state-in-effect`.** Seven were the same shape: reset state, then fetch, in one effect. `src/hooks/useFetchedData.ts` replaces all seven. It stores the result with the url it came from and derives `loading` as `stored.url !== url`, which is already true on the render that changes the url. Passing `null` holds a request back, which is how the panels wait for the season list. It also owns the `AbortController`, so that logic stopped being copied into each panel.
    - The eighth was `TeamGroup` in `PlayerSearch`, syncing an `open` flag from a prop. The caller now keys the component on that prop, so React remounts it and the `useState` initialiser picks the new default up. This also fixed a real bug: a group the user collapsed stayed collapsed when filtering resumed.
    - `src/hooks/useKeyedState.ts` covers the selections that reset with a request — the open tab, the expanded row, the chosen pair. **The obvious fix, adjusting state during render, is not available here: `react-hooks/set-state-in-render` is an error in this config.** So the reset happens by derivation instead. The stored value carries its key, and a new key stops matching.
    - **2 `react-hooks/exhaustive-deps`.** The note here was wrong about both. The real ones were an unmemoised `allSkaterRivals` in `SoloAnalysis` feeding a `useMemo`, and a missing `selectedGame` in `UpcomingMatchups`. Both went away with the `useFetchedData` conversion.
    - **22 `@next/next/no-img-element`.** `src/components/RemoteImage.tsx` now wraps every NHL headshot and team logo, and carries the single `eslint-disable`. **The rule stays enabled**, so a new raw `<img>` anywhere else still fails. Each of the 22 call sites now passes its intrinsic `width` and `height`, and the images lazy-load and decode async, which is what the rule protects.
    - It is a plain `<img>` on purpose. Team logos are SVG, which the Next optimizer refuses without `dangerouslyAllowSVG` and would not improve. Headshots render between 12px and 160px, and on Vercel each distinct size is a billed transformation — the leaderboard alone shows 100 per view.

## Public Launch — Deploy

The app queries `shifts` and `game_events` live, so a public deploy needs the
whole database, not just the derived tables.

Measured 2026-08-10, after the 88-game backfill. All 10 seasons are complete:

- On-disk size is **2077MB**. `shifts` 977MB, `versus_stats` 662MB,
  `game_events` 421MB.
- The hot indexes total about **460MB**: `idx_versus_pair_season` 180MB,
  `idx_shifts_player_game` 83MB, `idx_shifts_game_player` 78MB,
  `idx_events_game_time` 73MB, `idx_versus_player_b` 37MB.
- `pg_dump -Fc` of the whole database is **153MB** and takes **26 seconds**.

Ask the host for 2GB of database RAM and 10GB of disk. Less RAM than the hot
index set makes every `shifts` route read from disk.

**The 152MB dump replaces the re-ingest.** A restore moves the data in minutes.
A fresh ingest costs many hours of NHL API calls and can hit new gaps. Use
`pg_dump`/`pg_restore` and keep the ingest scripts for daily updates only.

### Blocks the deploy

- [x] **Choose the host shape** — decided 2026-08-10. The app goes on Vercel and
  the database on Neon. Vercel needs no build config for Next 16, and its CDN
  honors cache headers with no extra service. That matters here, because every
  page is a client shell that fetches from `/api`. The rejected option was one
  container host (Railway, Render, Fly) for both. It gives a simpler pool and a
  home for the daily ingest, but it costs a `Dockerfile` and still wants a CDN.
- [x] **Configure the database client** — `src/db/index.ts` passed no options,
  so it ran a pool of 10 with prepared statements on. Every serverless instance
  opened its own pool. It now sets `prepare: false`, which the Neon pooled
  endpoint requires, plus `max: 5` and `idle_timeout: 20`. TLS comes from
  `sslmode` in `DATABASE_URL`, so local development keeps working.
- [x] **Use the direct Neon endpoint for the scripts** — all five scripts now
  call `createScriptDb()` in `scripts/lib/db.ts`, which prefers
  `DIRECT_DATABASE_URL` and falls back to `DATABASE_URL`. That replaced the
  same five-line client block repeated in every script.
- [ ] **Load the data.** Run `drizzle-kit migrate` against the empty Neon
  database to create the schema, then `pg_restore --data-only --disable-triggers`
  the 152MB dump. Run `ANALYZE` after the restore. The planner needs fresh
  statistics, and `team-history` picks a bad plan without them.
- [x] **Finish the 88 games** — done 2026-08-10, before the dump. See Data
  Correctness below.
- [x] **Add the deploy config** — `vercel.json` pins the functions to `iad1`.
  **Change that region if you provision Neon anywhere but AWS us-east-1.** A
  mismatch adds cross-region latency to every query, and several routes run
  more than one. `package.json` also declares `engines.node` as `24.x`, which
  matches CI.
- [ ] **Set `DATABASE_URL` in Vercel** to the pooled Neon endpoint, for all
  three environments. Add `DIRECT_DATABASE_URL` as a separate secret for the
  ingestion workflow.

### Needed at launch

- [x] **Cache the API responses** — `src/lib/api-cache.ts` holds two policies
  and a `cachedJson()` helper. `DERIVED` is `s-maxage=3600` with a 24-hour
  `stale-while-revalidate`, for anything only the scripts change. `SCHEDULE` is
  `s-maxage=300` with a 1-hour window, for recent games, upcoming games and
  standings. All 11 routes carry one of the two, verified against a production
  build. Error responses carry none, so the CDN cannot pin a failure.
    - `max-age=0` binds browsers, so a reload after a recompute shows new
      numbers. Only the shared CDN cache holds the longer window.
    - The breakdown route uses `DERIVED` rather than an immutable policy. A game
      is only immutable once final, and the route does not check that. One hour
      already removes almost all database load, so the edge case is not worth
      the extra state.
- [x] **Shrink `public/logo.png`** — 2,002,695 bytes to 29,860, a 98.5% cut. It
  was 1240x403 and is now 620x202, which still covers the 180px header at 3x.
  The favicon moved to `src/app/icon.png`, the App Router convention, which
  crops the emblem to 512x512 and gets a hashed URL. Before this, `layout.tsx`
  pointed `icons` at `/logo.png` and every visitor downloaded the full 2MB.
    - The header `Image` now declares 180x59 rather than 180x180. It never
      rendered square: Tailwind preflight sets `height: auto` on every img, so
      it always drew at the source aspect ratio. The old numbers only gave Next
      a wrong ratio to reserve space with.
- [x] **Add `revalidate` to the schedule fetch** in
  `/api/players/[id]/upcoming` — 300 seconds, matching the window the route
  advertises. It hit the NHL API on every request before.
- [ ] See Discovery below for SEO metadata, `robots.txt`, `sitemap.xml` and
  analytics.

### Needed before the 2026-27 season starts

The last game in the database is 2026-06-14, so no games arrive until October.
The site can go live with static data before then.

- [ ] Daily ingestion. See Infrastructure below. A scheduled GitHub Actions
  workflow can run the scripts with `DATABASE_URL` as a secret, which keeps
  ingestion independent of the app host.

## Data Correctness

- [x] Fix the missed-game bug in both ingestion scripts. They compared a game date against the wall-clock time of the last run, so a game that was not final on its first scan was skipped forever. Both now resume from a per-game `players_scanned` flag. Recovered 88 games: the 6 regular-season games of 2026-04-16 and all 82 playoffs of 2025-26.
- [x] Repair the schema drift that stopped ingestion entirely. `seasons.last_games_ingested_at` and `last_players_scanned_at` were declared in `schema.ts` but never existed in the database, so both scripts crashed on their first query. Removed rather than added, since they were the broken mechanism.
- [x] ~~Backfill the missing games~~ — reopened as the item below. The reason given here was that a fresh host gets a full re-ingest. The deploy now restores a `pg_dump` instead, so the gap travels to the host unless it is closed locally.
- [x] **Run `ingest:shifts`, `ingest:events` and then `compute:versus` for the 88 recovered games** — done 2026-08-10. All 88 were in season 20252026: the 6 regular-season games of 2026-04-16 and all 82 playoffs. Added 73,434 shifts and 26,340 events, with no HTML fallbacks and no warnings. `compute:versus` then recomputed the whole season: 289,202 pair-season records, `player_season_totals` at 14,023 rows, and `leaderboard_entries` at 13,200 rows across 11 season scopes and 2 pair kinds. Every progress flag in all 10 seasons is now true, so the database is complete and ready to dump.
- [x] Remove the `versus_stats.rivalry_score` column. No route read it, and `compute-versus` wrote a skater score for goalie pairs. Freed 37MB.
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

- [x] **Weight penalties by severity in the rivalry score.** `versus_stats` stores penalty *minutes* rather than a count, and `CATEGORY_WEIGHTS.penaltyMinutes` is 2 per minute. A 2-minute minor still contributes 4, exactly as the old per-penalty weight did, so ordinary pairs are unchanged. A 5-minute fight contributes 10 and a 10-minute misconduct 20. The skater prior is 5.67.
    - Attribution stays direct: a penalty counts for a pair only when one player committed it and the *other drew it*. Sharing the ice is not enough.
    - Verified against the raw events: 63,522 pairs carry penalty minutes, against 63,765 distinct pairs in `game_events`, and the top pair matches at 54 minutes. 88 of the top 200 skater pairs now carry penalty minutes, averaging 1.8 and peaking at 14.
    - **Pure enforcers still do not reach the board, and that is the formula working as designed.** Schenn and Foligno lead all pairs at 54 penalty minutes, but over only 16 shared games. Penalties are one of six categories, and the 10-game prior regresses a short history toward the mean. Reaching rank 200 needs roughly 289 weighted volume; their penalties supply 108, and enforcers do not generate the points, shots and faceoffs that make up the rest.
- [ ] **Watch for this trap after any `versus_stats` migration.** Migration `0007` created the penalty columns with `DEFAULT 0` and `0008` dropped the old counts, but `compute:versus` defaults to the current season only. Nine of ten seasons sat at zero until a full recompute, and a first pass at measuring the impact was done against that empty data. Always run every season: `npm run compute:versus -- --seasons <id>` in a loop, one season at a time to bound memory.

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
- [ ] Rework stat ingestion and computation to support initial bulk loads and then daily progressive updates during the season. **The bulk-load half is now solved by the `pg_dump` restore in Public Launch.** Only the daily half remains, and it is due before October 2026.
- [ ] Stream the upserts in `scripts/compute-versus.ts` — the script holds every pair in memory before it writes. A full 10-season recompute builds ~2.6M objects. This blocks running a recompute from a small scheduled runner, so fix it with the daily-update work above. A daily delta of about 10 games does not hit the limit.
- [x] Add an `AbortController` to the player search fetch in `src/components/PlayerSearch.tsx`. All three fetching components now cancel superseded requests.
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

Measured 2026-08-07. Total went from 3433MB to 1875MB, a 45% cut, while
gaining 13 queryable columns.

- [x] Replace `game_events.details_json` with typed columns. The blob cost 643MB, and most of that was the key names stored again on every one of 3.4M rows. Nothing read it.
- [x] Drop the serial primary keys on `shifts`, `game_events` and `versus_stats` — 400MB of index that no foreign key referenced. Each table has a natural unique key.
- [x] Drop `idx_shifts_game_period` (342MB) and `idx_events_type` (24MB). Neither was scanned while exercising every route.
- [x] Add `idx_shifts_player_game` (81MB) for team-history. This is the only index added back, and it took the total from 1812MB to 1912MB.
- [x] Drop `shifts.shift_number` — written by ingestion, never read.
- [x] Add `uq_game_events_game_event`, declared in the schema but never applied. Without it `onConflictDoNothing` had nothing to conflict against, and a re-run of `ingest-events` had already inserted 492 duplicate events. Those are deleted and `compute:versus` has been re-run.
- [ ] ~~Query shifts and events from the NHL API instead of storing them~~ — investigated and rejected. Latency is fine for one game (about 160ms for both endpoints in parallel), but only the post-game breakdown reads a single game. `rival-history` needs up to 40 games and `team-history` needs many more, so the tables have to stay. It would have cost 150ms and a hard dependency on NHL uptime to save nothing.
