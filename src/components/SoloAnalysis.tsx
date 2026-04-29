"use client";

import { useState, useEffect } from "react";
import type { PlayerSearchResult, MatchupPlayer } from "@/types/versus";
import { UpcomingMatchups } from "./UpcomingMatchups";
import { TeamRivalryLookup } from "./TeamRivalryLookup";
import { PositionGroup } from "./MatchupTable";
import { PositionTabs } from "./PositionTabs";
import { RivalsPanelSkeleton } from "./Skeleton";

export function SoloAnalysis({ player, seasonIds }: { player: PlayerSearchResult; seasonIds: string[] | null }) {
  const [skaterRivals, setSkaterRivals] = useState<MatchupPlayer[] | null>(null);
  const [goalieRivals, setGoalieRivals] = useState<MatchupPlayer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"skaters" | "goalies">("skaters");
  const [minTOI, setMinTOI] = useState(900);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (seasonIds) params.set("seasons", seasonIds.join(","));
    const query = params.toString() ? `?${params}` : "";
    fetch(`/api/players/${player.id}/rivals${query}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to fetch rivals");
        return data;
      })
      .then((data) => {
        setSkaterRivals(data.skaterRivals);
        setGoalieRivals(data.goalieRivals);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [player.id, seasonIds]);

  if (loading) {
    return (
      <div className="mt-8">
        <RivalsPanelSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 rounded-xl border border-red-900/50 bg-red-950/30 px-6 py-4 text-center text-red-400">
        {error}
      </div>
    );
  }

  const allSkaterRivals = skaterRivals ?? [];
  const filteredSkaterRivals = allSkaterRivals.filter((r) => r.toiSharedSeconds >= minTOI);
  const filteredGoalieRivals = (goalieRivals ?? []).filter((r) => r.toiSharedSeconds >= minTOI);

  const hasSkaterData = allSkaterRivals.length > 0;
  const hasGoalieData = goalieRivals && goalieRivals.length > 0;

  if (!hasSkaterData && !hasGoalieData) {
    return (
      <div className="mt-8 text-center text-gray-500">No rivalry data found</div>
    );
  }

  const playerName = `${player.firstName[0]}. ${player.lastName}`;

  return (
    <div className="mt-8">
      <h2 className="mb-8 text-center text-2xl font-bold text-white">
        {player.firstName} {player.lastName}
        <span className="ml-2 text-lg text-gray-500">Analysis</span>
      </h2>
      <div className="flex flex-col" style={{ gap: 64 }}>
        {/* All-Time Rivals */}
        {(hasSkaterData || hasGoalieData) && (
          <div className="rounded-xl border border-gray-700/60 bg-gray-900/90 shadow-lg shadow-black/20" style={{ padding: "28px 32px" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
              <div>
                <h2 className="text-xl font-bold text-blue-400">All-Time Rivals</h2>
                <p className="text-sm text-gray-500">
                  Performance vs opponent players sharing ice time
                </p>
              </div>
              <div className="flex items-center gap-3">
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
              </div>
            </div>
            {activeTab === "skaters" ? (
              <PositionGroup
                label="Skaters"
                matchups={filteredSkaterRivals}
                collapsible
                defaultVisible={10}
                mode={player.position === "C" ? "center" : "skater"}
                playerPosition={player.position}
                playerName={playerName}
                playerId={player.id}
              />
            ) : (
              <PositionGroup
                label="Goalies"
                matchups={filteredGoalieRivals}
                collapsible
                defaultVisible={10}
                mode="goalie"
                playerPosition={player.position}
                playerName={playerName}
                playerId={player.id}
              />
            )}
          </div>
        )}

        {/* Team Rivalry Lookup */}
        <div className="rounded-xl border border-gray-700/60 bg-gray-900/90 shadow-lg shadow-black/20" style={{ padding: "28px 32px" }}>
          <h2 className="text-xl font-bold text-amber-400">Team Rivalry Lookup</h2>
          <p className="text-sm text-gray-500" style={{ marginBottom: 20 }}>
            Pick any team to see {player.firstName} {player.lastName}&apos;s shared-ice history vs its current roster
          </p>
          <TeamRivalryLookup player={player} />
        </div>

        {/* Upcoming Matchups */}
        <div className="rounded-xl border border-gray-700/60 bg-gray-900/90 shadow-lg shadow-black/20" style={{ padding: "28px 32px" }}>
          <h2 className="text-xl font-bold text-emerald-400">Upcoming Matchups</h2>
          <p className="text-sm text-gray-500" style={{ marginBottom: 20 }}>
            Select a game to see historical performance vs projected opponent roster
          </p>
          <UpcomingMatchups player={player} />
        </div>
      </div>
    </div>
  );
}
