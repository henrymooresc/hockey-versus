"use client";

import { useState, useEffect } from "react";
import type { PlayerSearchResult, MatchupPlayer } from "@/types/versus";
import { UpcomingMatchups } from "./UpcomingMatchups";
import { PositionGroup } from "./MatchupTable";

export function SoloAnalysis({ player }: { player: PlayerSearchResult }) {
  const [skaterRivals, setSkaterRivals] = useState<MatchupPlayer[] | null>(null);
  const [goalieRivals, setGoalieRivals] = useState<MatchupPlayer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/players/${player.id}/rivals`)
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
  }, [player.id]);

  if (loading) {
    return (
      <div className="mt-8 text-center text-gray-500">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <p className="mt-2 text-sm">Loading rivalry data...</p>
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

  const hasSkaterData = allSkaterRivals.length > 0;
  const hasGoalieData = goalieRivals && goalieRivals.length > 0;

  if (!hasSkaterData && !hasGoalieData) {
    return (
      <div className="mt-8 text-center text-gray-500">No rivalry data found</div>
    );
  }

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
            <h2 className="text-xl font-bold text-blue-400">All-Time Rivals</h2>
            <p className="text-sm text-gray-500" style={{ marginBottom: 20 }}>
              Performance vs opponent players sharing ice time
            </p>
            <div className="grid grid-cols-2 gap-8 items-start">
              <PositionGroup
                label="Skaters"
                matchups={allSkaterRivals}
                collapsible
                defaultVisible={10}
                mode={player.position === "C" ? "center" : "skater"}
                playerPosition={player.position}
                playerName={`${player.firstName[0]}. ${player.lastName}`}
              />
              <PositionGroup
                label="Goalies"
                matchups={goalieRivals ?? []}
                collapsible
                defaultVisible={10}
                mode="goalie"
                playerPosition={player.position}
                playerName={`${player.firstName[0]}. ${player.lastName}`}
              />
            </div>
          </div>
        )}

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
