# Feature Backlog

## UI Enhancements
- [x] Season toggle — switch between current/last season and last 10 seasons on all views
- [x] Show player team name and logo on all-time rivals player cards
- [x] Add TOI and games played to stat detail cards
- [x] Better loading states (skeletons) across all views
- [x] Add error boundaries for graceful degradation on component failures

## Data & Explanation
- [x] Rivalry score tooltip/explanation — don't fully surface the formula and weighting to users
- [x] Create some kind of visualization on the expanded detail cards for how players match up (radar chart, skater-vs-skater)

## Infrastructure
- [ ] Rework stat ingestion and computation to support initial bulk loads and then daily progressive updates during the season

## Discovery
- [ ] SEO metadata — og:image, per-player/comparison page titles and descriptions

## New Features
- [x] Team rivalry lookup — search by team and list all players on that team (similar to upcoming matchup section)
- [x] Rivalry score leaderboard — top rivalries across the league
- [ ] Per-game rivalry history expanded view / modal
- [ ] Playoff game stats toggle
- [x] Post-game breakdown page — for a single game, show how each pair of players interacted (shared TOI, head-to-head stats), compare those numbers to their season/all-time averages and prior history, and show the game's rivalry score plus how it shifted each pair's running average
- [x] Team history flowchart on rivalry pairs — when two players have faced each other while on multiple different teams (e.g. Player B was traded mid-rivalry), show a team-logo timeline for each player tracing the teams they played for during their shared games. Helps surface long-running rivalries that span trades.
