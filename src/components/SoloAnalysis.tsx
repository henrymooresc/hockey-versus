"use client";

import { useState, useEffect, useMemo } from "react";
import type { PlayerSearchResult, MatchupPlayer } from "@/types/versus";
import { UpcomingMatchups } from "./UpcomingMatchups";
import { PositionGroup } from "./MatchupTable";
import { PositionTabs } from "./PositionTabs";
import {
  ToggleGroup,
  SEASON_OPTIONS,
  GAME_TYPE_OPTIONS,
  type SeasonFilter,
  type GameTypeFilter,
} from "./ToggleGroup";
import { RivalsPanelSkeleton } from "./Skeleton";
import { ErrorBoundary } from "./ErrorBoundary";

interface SeasonMeta {
  id: string;
  startDate: string | null;
  endDate: string | null;
}

export function SoloAnalysis({
  player,
}: {
  player: PlayerSearchResult;
}) {
  const [skaterRivals, setSkaterRivals] = useState<MatchupPlayer[] | null>(null);
  const [goalieRivals, setGoalieRivals] = useState<MatchupPlayer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"skaters" | "goalies">("skaters");
  const [minTOI, setMinTOI] = useState(900);
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>("current");
  const [gameTypeFilter, setGameTypeFilter] = useState<GameTypeFilter>("regular");
  const [allSeasons, setAllSeasons] = useState<SeasonMeta[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("");

  useEffect(() => {
    fetch("/api/seasons")
      .then((r) => r.json())
      .then((data) => setAllSeasons(data.seasons ?? []))
      .catch(() => {});
  }, []);

  const seasonIds: string[] | null = useMemo(() => {
    if (seasonFilter === "all" || allSeasons.length === 0) return null;
    return [allSeasons[0].id];
  }, [seasonFilter, allSeasons]);

  useEffect(() => {
    // Wait for the seasons list before firing in "current" mode — otherwise the
    // first fetch goes out without a season filter and can race the filtered one.
    if (seasonFilter === "current" && allSeasons.length === 0) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (seasonIds) params.set("seasons", seasonIds.join(","));
    params.set("gameType", gameTypeFilter);
    fetch(`/api/players/${player.id}/rivals?${params}`, { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to fetch rivals");
        return data;
      })
      .then((data) => {
        setSkaterRivals(data.skaterRivals);
        setGoalieRivals(data.goalieRivals);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [player.id, seasonIds, gameTypeFilter, seasonFilter, allSeasons.length]);

  const allSkaterRivals = skaterRivals ?? [];
  const q = nameQuery.trim().toLowerCase();
  const matchesName = (r: MatchupPlayer) =>
    q === "" ||
    r.firstName.toLowerCase().includes(q) ||
    r.lastName.toLowerCase().includes(q) ||
    `${r.firstName} ${r.lastName}`.toLowerCase().includes(q);
  const matchesTeam = (r: MatchupPlayer) =>
    teamFilter === "" || r.teamAbbrev === teamFilter;
  const filteredSkaterRivals = allSkaterRivals
    .filter((r) => r.toiSharedSeconds >= minTOI)
    .filter(matchesName)
    .filter(matchesTeam);
  const filteredGoalieRivals = (goalieRivals ?? [])
    .filter((r) => r.toiSharedSeconds >= minTOI)
    .filter(matchesName)
    .filter(matchesTeam);

  // Build team list from current rivals (only teams with at least one match)
  const teamOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of [...allSkaterRivals, ...(goalieRivals ?? [])]) {
      if (r.teamAbbrev && !seen.has(r.teamAbbrev)) {
        seen.set(r.teamAbbrev, r.teamName ?? r.teamAbbrev);
      }
    }
    return Array.from(seen.entries())
      .map(([abbrev, name]) => ({ abbrev, name }))
      .sort((a, b) => a.abbrev.localeCompare(b.abbrev));
  }, [allSkaterRivals, goalieRivals]);

  const hasAnyData = !loading && !error && (allSkaterRivals.length > 0 || (goalieRivals?.length ?? 0) > 0);


  return (
    <div className="mt-8">
      <h2 className="mb-8 text-center text-2xl font-bold text-white">
        {player.firstName} {player.lastName}
        <span className="ml-2 text-lg text-gray-500">Analysis</span>
      </h2>
      <div className="flex flex-col" style={{ gap: 64 }}>
        {/* All-Time Rivals */}
        <ErrorBoundary label="All-Time Rivals">
          <div className="rounded-xl border border-gray-700/60 bg-gray-900/90 shadow-lg shadow-black/20" style={{ padding: "28px 32px" }}>
            <div className="flex flex-wrap items-start justify-between gap-3" style={{ marginBottom: 20 }}>
              <div>
                <h2 className="text-xl font-bold text-blue-400">All-Time Rivals</h2>
                <p className="text-sm text-gray-500">
                  Performance vs opponent players sharing ice time
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                    placeholder="Filter by name…"
                    className="w-44 rounded-md border border-gray-700/60 bg-gray-800/60 px-2.5 py-1 pr-7 text-xs text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  {nameQuery && (
                    <button
                      onClick={() => setNameQuery("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-white"
                      title="Clear"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="rounded-md border border-gray-700/60 bg-gray-800/60 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                  title="Filter by team"
                >
                  <option value="">All teams</option>
                  {teamOptions.map((t) => (
                    <option key={t.abbrev} value={t.abbrev}>
                      {t.abbrev} · {t.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="uppercase tracking-wider text-[10px] text-gray-500">Min TOI (sec)</span>
                  <input
                    type="number"
                    min={0}
                    value={minTOI}
                    onChange={(e) => setMinTOI(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-20 rounded-md border border-gray-700/60 bg-gray-800/60 px-2 py-1 text-center text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <PositionTabs
                  active={activeTab}
                  onChange={setActiveTab}
                  skaterCount={filteredSkaterRivals.length}
                  goalieCount={filteredGoalieRivals.length}
                />
                <ToggleGroup
                  options={SEASON_OPTIONS}
                  active={seasonFilter}
                  onChange={setSeasonFilter}
                  label="Season range"
                />
                <ToggleGroup
                  options={GAME_TYPE_OPTIONS}
                  active={gameTypeFilter}
                  onChange={setGameTypeFilter}
                  label="Game type"
                />
              </div>
            </div>
            {loading ? (
              <RivalsPanelSkeleton />
            ) : error ? (
              <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-6 py-4 text-center text-red-400">
                {error}
              </div>
            ) : !hasAnyData ? (
              <div className="rounded-xl border border-dashed border-gray-700/60 bg-gray-900/30 px-6 py-10 text-center text-sm text-gray-500">
                No rivalry data for this filter combination
              </div>
            ) : activeTab === "skaters" ? (
              <PositionGroup
                label="Skaters"
                matchups={filteredSkaterRivals}
                collapsible
                defaultVisible={10}
                mode={player.position === "C" ? "center" : "skater"}
                playerPosition={player.position}
                player={player}
                playerId={player.id}
                showSmallSampleMark={seasonFilter === "all"}
              />
            ) : (
              <PositionGroup
                label="Goalies"
                matchups={filteredGoalieRivals}
                collapsible
                defaultVisible={10}
                mode="goalie"
                playerPosition={player.position}
                player={player}
                playerId={player.id}
                showSmallSampleMark={seasonFilter === "all"}
              />
            )}
          </div>
        </ErrorBoundary>

        {/* Upcoming Matchups */}
        <ErrorBoundary label="Upcoming Matchups">
          <div className="rounded-xl border border-gray-700/60 bg-gray-900/90 shadow-lg shadow-black/20" style={{ padding: "28px 32px" }}>
            <h2 className="text-xl font-bold text-emerald-400">Upcoming Matchups</h2>
            <p className="text-sm text-gray-500" style={{ marginBottom: 20 }}>
              Select a game to see historical performance vs projected opponent roster
            </p>
            <UpcomingMatchups player={player} />
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
}
