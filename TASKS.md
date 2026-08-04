# Feature Backlog

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

## Infrastructure
- [ ] Rework stat ingestion and computation to support initial bulk loads and then daily progressive updates during the season

## Discovery
- [ ] SEO metadata — og:image, per-player/comparison page titles and descriptions

## New Features
- [x] Team rivalry lookup — search by team and list all players on that team (similar to upcoming matchup section)
- [x] Rivalry score leaderboard — top rivalries across the league
- [ ] Per-game rivalry history expanded view / modal
- [x] Playoff game stats toggle
- [x] Post-game breakdown page — for a single game, show how each pair of players interacted (shared TOI, head-to-head stats), compare those numbers to their season/all-time averages and prior history, and show the game's rivalry score plus how it shifted each pair's running average
- [x] Team history flowchart on rivalry pairs — when two players have faced each other while on multiple different teams (e.g. Player B was traded mid-rivalry), show a team-logo timeline for each player tracing the teams they played for during their shared games. Helps surface long-running rivalries that span trades.
