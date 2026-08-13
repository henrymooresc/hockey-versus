# Backlog

Live at **[hockey-versus.vercel.app](https://hockey-versus.vercel.app)** — Vercel
for the app, Neon for the database, restored and verified 2026-08-11.

Completed work is not listed here. Git history and the code comments carry it.
What stays is open work, decisions worth not re-litigating, and traps that have
already cost time once.

---

## Before October 2026 — the season restarts

Nothing new enters the database until then, so the site is correct today. The
moment games resume, the daily ingestion has to work. **It does not yet.**

`.github/workflows/ingest.yml` had four defects, all fixed on 2026-08-11:

- `ingest:seasons` was missing, so no new game was ever discovered and every
  run reported success having done nothing.
- `ingest:players` ran last, so `ingest-shifts.ts:107` would drop a debuting
  player's shifts through its `knownPlayerIds` filter.
- The "were there games yesterday?" gate could skip the whole job. It is gone.
  Every script already resumes from the per-game progress flags, so an
  unconditional run is self-healing.
- Only `DATABASE_URL` was passed, so bulk writes went through the pooler.

`npm run check:ingestion` now runs as the last step and fails the job when a
game that has been played is still missing shifts or events. A game counts as
played only when it has a score and its date has passed — `ingest:seasons`
inserts the whole schedule, so future games sit with both flags false and are
not a fault.

### Still to do

- [x] **`DIRECT_DATABASE_URL` and `DATABASE_URL` are repository secrets** — added
  2026-08-12.
- [x] **The workflow runs green by hand against Neon** — four runs on 2026-08-12,
  including all ten seasons recomputed in three batches. `check:ingestion` passed
  on each.
- [x] **Cron enabled** — 2026-08-12, 15:00 UTC daily, after the replay below
  proved the ingest path and not just the compute path.
- [ ] **Watch for GitHub disabling the schedule.** Scheduled workflows are turned
  off automatically after 60 days without repository activity. The season does
  not restart until October, so a quiet September could silence the job exactly
  when it starts to matter. Check the Actions tab in early October, or push
  anything at all before then.

**Neon and local hold identical data as of 2026-08-12.** All ten season digests
over `versus_stats` match, row counts included — the first time since the
restore. That closes a mismatch that took three separate causes to explain: a
`to_jsonb` digest that compared column order rather than values, orphan rows no
recompute could reach, and a games query with no `ORDER BY` feeding an
order-sensitive accumulation.

**How to test without waiting for October.** A played game can be replayed, so
the pipeline can be exercised out of season. **Clearing the progress flags alone
does not test anything useful** — the rows stay, every insert uses
`onConflictDoNothing`, and the counts read the same afterwards whether the NHL
fetch returned real data or nothing at all. Delete the data too:

```sql
DELETE FROM game_events WHERE game_id = 2025030416;
DELETE FROM shifts WHERE game_id = 2025030416;
UPDATE games SET shifts_ingested=false, events_ingested=false WHERE id=2025030416;
```

Then run the workflow **with the seasons box blank**, which is what the cron
sends and what exercises `getCurrentSeasonId()`. The "Ingest shifts" step should
report one game needing ingestion; if it reports none, the flags did not clear.

Run against Neon on 2026-08-12 with game 2025030416, the Cup Final game 4. The
846 shifts and 281 events came back, and the 2025-26 `versus_stats` digest was
unchanged at `d9d22e7f…` over 288,795 rows — so the pipeline refetched, rewrote
and recomputed to a byte-identical result. Ingest happens before compute inside
a run, so a replay self-heals in a single pass.

### A second game's shifts arrived under one game id

Found 2026-08-12, while checking whether a mid-season trade could be reversed.
`shiftcharts?cayenneExp=gameId=2025020565` returns game **2024020565** as well —
SJS at VGK, 2024-12-27 — relabelled with the id that was asked for. The two
share the six-digit game number `020565` and differ only in the season prefix.
Confirmed by a 618-of-618 exact match on (player, period, start, end), and by
the rosters being right for 2024-25: Granlund on SJS, Hague on VGK.

It is upstream, it is still live, and nothing in this repo caused it. It is also
a single bad record rather than a pattern: 16 other 2025-26 games sampled from
the same endpoint, including the neighbouring ids `020564` and `020566`, all
return exactly two teams. One game in 13,187 is affected, 618 shift rows in
10.2M. `game_events` is clean — it comes from a different endpoint, and no game
anywhere has an event for a team that did not play in it.

Every row looked individually valid — real players, real teams, real times — so
nothing rejected it. Only the pairing was nonsense. `compute:versus` went on to
build 330 rivalries between players who were never on the ice together, and to
inflate 924 real ones. The same response also carried the real game's own rows
twice; `onConflictDoNothing` had been absorbing that silently all along.

- [x] **Guard on the way in.** `ingest:shifts` drops shifts whose team did not
  play in the game and reports the count. `check:ingestion` fails when such a
  row is already in the table, so a repeat cannot pass silently.
- [x] **Deleted the 618 stray rows, locally and on Neon** — 2026-08-12:

    ```sql
    DELETE FROM shifts s USING games g
    WHERE g.id = s.game_id
      AND s.team_id IS DISTINCT FROM g.home_team_id
      AND s.team_id IS DISTINCT FROM g.away_team_id;
    ```

  Game 2025020565 is back to two teams, 753 shifts and 38 players.
- [x] **Recomputed 2025-26** — the orphan delete cleared the fabricated rows
  without further help: 407 of them, against the 330 that had been measured. The
  measurement counted pairs sharing no other game; the extra 77 shared a game
  elsewhere but only ever shared *ice* in this one.
    - Visible impact before the repair was small but real: 15 cleared the
      900-second rivals threshold, topping out at 1,285 seconds, clustered on
      goalies because they accumulate the most shared ice — Luukkonen and Allen
      against half of San Jose and Vegas.

Related:

- [x] **Stream the upserts in `scripts/compute-versus.ts`** — done 2026-08-11.
  It now partitions the games by season and game type, then computes and writes
  one partition at a time. The accumulator key already carried both, so a pair
  never merged across a boundary; flushing there writes exactly the rows one
  big pass wrote, while peak memory drops from every season at once to the
  largest single partition.
- [ ] **Decide what happens to the CDN cache after an ingest.** Derived data is
  cached for an hour, so new results appear up to an hour late. Probably fine;
  the alternative is a purge step at the end of the workflow.
- [x] **`versus_stats` held rows a recompute no longer produced** — fixed
  2026-08-12. The upsert refreshed rows it produced but could not notice one it
  had stopped producing, so those rows survived every recompute. A 3-season run
  found 830 in 2023-24 and 799 in 2024-25, all single-game pairs, against none
  in the season computed most recently.
    - `compute:versus` now stamps every row it writes with one timestamp taken
      at the start of the run, then deletes rows in that partition older than
      it. The column previously took `defaultNow()` from the database clock on
      insert and `new Date()` from the process clock on update, so a comparison
      would have straddled two clocks.
    - The delete only runs after a partition has written rows. Without that
      guard a partition that produced nothing would erase the season instead of
      leaving it alone.
    - Cleared 1,629 rows locally. Verified by digesting the expected survivors
      before the run and matching them after: 287,234 rows in 2023-24 and
      284,379 in 2024-25, both digests identical, nothing stale left, and
      2025-26 untouched.
- [x] **Cleared the same rows on Neon** — done 2026-08-12 by recomputing all ten
  seasons from the workflow, in three batches to stay inside the 60-minute job
  timeout. The same run carried the ordering fix to every season.
    - Run it from the workflow rather than a laptop. `compute:versus` reads two
      seasons of shifts and events, which is slow and costly to pull across the
      network from outside the host's region.

---

## Live-site gaps

The site is public and has no operational safety net.

- [ ] **Confirm Neon backups.** The database is the product. Re-ingesting 10
  seasons costs hours of NHL API calls, and the local copy is the only other
  copy. Check what point-in-time recovery the plan actually gives.
- [ ] **Nothing reports errors.** A route returning 500 in production is
  invisible. Routes log to `console.error`, which reaches Vercel logs and no
  further.
- [ ] **Confirm the Neon region matches `vercel.json`.** It pins functions to
  `iad1`. If Neon sits outside AWS us-east-1, every query pays cross-region
  latency and several routes make more than one.
- [ ] Add an analytics tool to measure real page speed.

## Discovery

- [ ] SEO metadata — `og:image`, per-player titles and descriptions.
- [ ] `robots.txt` and `sitemap.xml`.

---

## Scoring

The two below are about the goalie board. Figures measured 2026-08-11 from
`leaderboard_entries`, all-time regular season.

- [ ] **Decide whether the two boards should share a scale.** Skater scores run
  about twice goalie scores at every rank. The cause is the balance term, not
  volume: for a goalie pair `1 - |goals - saves| / shots` reduces exactly to
  `2 x shooting percentage`, which real hockey caps near 0.20, while skater
  categories are near-symmetric and approach 1.0. Split boards make this
  cosmetic, so fix it only if the two ever need to merge.
- [ ] **Consider spreading the goalie board out.** Its top 50 spans 8.13 to 9.78,
  a 20% range, against 14.26 to 19.62 for skaters. That compression lets **14**
  small samples into the goalie top 50, where the skater board admits **none**.

## Using the extracted event fields

`game_events` carries the useful parts of the NHL play-by-play `details` object
as typed columns. Nothing scores on them yet.

- [ ] **Attribute shots to the goalie who actually faced them.** The goalie score
  infers the matchup from shared ice time. `goalie_in_net_id` states it directly
  and covers 1,128,095 of 1,136,064 shots and goals. `src/lib/versus-engine.ts`
  builds goalie pairs from shift overlap; use the column instead. This mainly
  changes empty-net and pulled-goalie situations, so expect small movements
  rather than a rewrite. Re-run `compute:versus` and re-check the goalie board.
- [ ] **Shot quality from `shot_type` and coordinates.** `shot_type` gives wrist,
  slap, snap, tip-in. `x_coord`/`y_coord` span -100..100 and -42..42, so distance
  and angle are simple arithmetic, and `zone_code` gives O, D or N. Uses: shot
  maps on the expanded cards, danger-zone weighting, zone-start context.
- [ ] **Game state from the running score.** `home_score`/`away_score` sit on
  goals and `home_sog`/`away_sog` on shots, so any event can be placed in a close
  game or a blowout. A hit at 5-0 means less than a hit at 3-3, and the score
  cannot currently tell them apart.
- [ ] **`reason` on missed and blocked shots** — wide-of-net, hit-crossbar.
  Useful for separating near misses from wild ones.

---

## UI

- [ ] **Improve the post-game breakdown** — per-pair visualisations (radar,
  shared-TOI sparkline) and a tighter layout.
- [ ] **Per-game rivalry history** — expanded view or modal.
- [ ] **The rivals table degrades badly below about 1000px.** Nine stat columns
  plus a name do not fit, so the name column collapses to about 70px and
  ellipsises. Shrinking further will not help; the fix is dropping columns at a
  breakpoint.

## Refactor

- [ ] **Condense duplicated UI.** Player headers and stat rows are still
  repeated. Already consolidated: `ToggleGroup`, `SmallSampleMark`, `BioPlayer`,
  `computePairRivalryScore`, `RemoteImage`, `useFetchedData`, `useKeyedState`,
  `api-cache`, `playoff-series`.
- [ ] **Tests cover pure functions only** — 79 of them, over scoring, time,
  the versus engine and playoff series. No route has a test, so a broken query
  or a wrong response shape only shows up in the browser.
- [ ] **The scoring formula is explained in three places** — `rivalry-score.ts`,
  the About page and the README. Change a weight and all three need editing.

---

## Decided — do not redo

- **Faceoffs are deliberately not scored as volume.** Removed 2026-08-12. Only a
  centre takes draws, so counting them paid one position for turning up: they
  were 34.9% of the weighted volume of an opposing centre pair against 0.2% for
  a pair with no centre, and the all-time board came out 189 centre-against-
  centre pairs in its top 200 from a pool 9.0% C-C. Reducing the weight does not
  work — at 0.25 it was still 59 of 200 — because the term scales with
  opportunity rather than contest. They remain in the balance multiplier, which
  reads the win split and is already a rate. Do not add them back to
  `weightedVolume` without re-reading `rivalry-score.ts`.
- **Do not fix a positional bias with a positional correction.** The score
  describes an interaction between two players, not a player, so a rule aimed at
  centres needs a companion rule for every other pairing. Fix the category that
  measures opportunity instead of contest.
- **`versus_stats` keys on the relationship, not just the pair.** A pair traded
  apart mid-season plays some games together and some against each other, and
  one row cannot hold both — the totals mix and `sameTeam` can only describe one
  of them. Before the split, Crosby v Guentzel was rank 1 all-time claiming 51
  opponent games when 50 of them were on the same line. Splitting cost 16,867
  rows, 0.65%. It also settles the traded-away-and-back case, which no ordering
  rule could: taking the most recent game hid the pair, taking the first only
  moved which half was wrong.
- **Do not query shifts and events from the NHL API instead of storing them.**
  Investigated and rejected. Latency is fine for one game, about 160ms for both
  endpoints in parallel, but only the post-game breakdown reads a single game.
  `rival-history` needs up to 40 games and `team-history` many more. It would
  have cost 150ms and a hard dependency on NHL uptime to save nothing.
- **Do not re-ingest to populate a host.** `pg_dump -Fc` is about 150MB and takes
  under 30 seconds; a restore moves 10 seasons in minutes. The procedure, and
  the `--disable-triggers` trap that fails on Neon, are in the README.
- **`RemoteImage` is a plain `<img>` on purpose.** Team logos are SVG, which the
  Next optimizer refuses without `dangerouslyAllowSVG` and would not improve, and
  headshots are small enough that a per-size transformation costs more than it
  saves. It holds the only `no-img-element` exception; the rule stays on
  everywhere else.
- **Light is the default theme regardless of the operating system preference.**
  The logo wordmark is dark navy and cannot be read on a dark page.
- **Four moderate npm advisories remain**, all in the
  `esbuild -> @esbuild-kit -> drizzle-kit` chain. Dev-only, nothing ships, and
  clearing them needs a `drizzle-kit` downgrade. Production audit is clean.

## Traps

- **`compute:versus` defaults to the current season only.** After any
  `versus_stats` migration, nine of ten seasons keep stale or zero values until a
  full recompute, and any measurement taken meanwhile is wrong. This has already
  caused one bad analysis. Run every season explicitly:
  `npm run compute:versus -- --seasons <id>` in a loop, one at a time to bound
  memory.
- **`ANALYZE` after any restore or bulk load.** Without fresh statistics the
  planner picks a bad plan for `team-history`, and which pairs are slow flips
  between runs.
- **Re-derive the priors whenever a category weight changes.**
  `npm run derive:priors`, then paste the pooled means into `rivalry-score.ts`.
  A prior that no longer matches the weights pulls every pair toward a mean the
  formula cannot produce, which favours small samples — the exact bias the
  regression exists to remove, running backwards. Removing faceoffs moved it
  from 5.67 to 5.36, and the one test that failed was the small-sample
  regression test catching the mismatch.
- **Any digest over `versus_stats` must sort by `same_team` too.** A pair can
  hold two rows since the relationship split, so
  `ORDER BY player_a_id, player_b_id, game_type` is no longer a total order and
  the digest comes out non-deterministic — which reads exactly like a data
  mismatch between local and Neon. Three separate causes have already been
  chased down that road; do not add a fourth.
- **Shared ice per game stopped being a contamination signal after the split.**
  It was a good proxy while team-mate and opponent games shared a row: anything
  over 600 seconds a game meant linemates mislabelled as opponents. Mixing is
  now impossible by construction, so a high figure just means the two are
  matched against each other often, which is what the board should select for.
  The board averages 604 against a pool average of 318.
