"use client";

import { useState, useEffect } from "react";
import type { PlayerSearchResult } from "@/types/versus";
import type { VersusSeasonStats, PlayerInfo, VersusResult } from "@/types/versus";
import { VersusTable } from "./VersusTable";

export function HeadToHeadComparison({
  playerA,
  playerB,
}: {
  playerA: PlayerSearchResult;
  playerB: PlayerSearchResult;
}) {
  const [data, setData] = useState<VersusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/versus?playerA=${playerA.id}&playerB=${playerB.id}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to fetch comparison");
        return json;
      })
      .then((result) => setData(result))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [playerA.id, playerB.id]);

  if (loading) {
    return (
      <div className="mt-8 text-center text-gray-500">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <p className="mt-2 text-sm">Loading head-to-head data...</p>
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

  if (!data || data.seasons.length === 0) {
    return (
      <div className="mt-8 text-center text-gray-500">
        No shared ice time data found for these players.
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-10">
      {/* Hero */}
      <div className="flex items-center justify-center gap-6 md:gap-12">
        <div className="flex flex-col items-center gap-2">
          {playerA.headshotUrl ? (
            <img
              src={playerA.headshotUrl}
              alt=""
              className="h-24 w-24 rounded-full border-4 border-gray-700 object-cover"
            />
          ) : (
            <div className="h-24 w-24 rounded-full border-4 border-gray-700 bg-gray-800" />
          )}
          <div className="text-center">
            <div className="text-sm text-gray-400">{playerA.firstName}</div>
            <div className="text-xl font-extrabold text-white">{playerA.lastName}</div>
            <div className="text-xs text-gray-500">
              {playerA.teamAbbrev ?? ""} · {playerA.position ?? ""}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-4xl font-black text-[#a62639] drop-shadow-[0_0_12px_rgba(166,38,57,0.3)]">
            VS
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-600">
            {data.totals.gamesShared} game{data.totals.gamesShared !== 1 ? "s" : ""}
          </span>
          {!data.totals.sameTeam && (
            <div className="mt-2 flex items-center gap-3">
              <span className={`text-2xl font-black ${data.totals.winsA > data.totals.winsB ? "text-green-400" : data.totals.winsA < data.totals.winsB ? "text-red-400" : "text-gray-300"}`}>
                {data.totals.winsA}
              </span>
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-600">W</span>
              <span className={`text-2xl font-black ${data.totals.winsB > data.totals.winsA ? "text-green-400" : data.totals.winsB < data.totals.winsA ? "text-red-400" : "text-gray-300"}`}>
                {data.totals.winsB}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          {playerB.headshotUrl ? (
            <img
              src={playerB.headshotUrl}
              alt=""
              className="h-24 w-24 rounded-full border-4 border-gray-700 object-cover"
            />
          ) : (
            <div className="h-24 w-24 rounded-full border-4 border-gray-700 bg-gray-800" />
          )}
          <div className="text-center">
            <div className="text-sm text-gray-400">{playerB.firstName}</div>
            <div className="text-xl font-extrabold text-white">{playerB.lastName}</div>
            <div className="text-xs text-gray-500">
              {playerB.teamAbbrev ?? ""} · {playerB.position ?? ""}
            </div>
          </div>
        </div>
      </div>

      {/* All Seasons Combined */}
      <div>
        <h2 className="mb-4 text-center text-xl font-bold tracking-tight text-gray-200">
          All Seasons Combined
        </h2>
        <VersusTable
          stats={data.totals}
          playerA={data.playerA}
          playerB={data.playerB}
        />
      </div>

      {/* Per-season breakdown */}
      {data.seasons.length > 1 && (
        <div className="w-full">
          <h2 className="mb-6 text-center text-xl font-bold tracking-tight text-gray-200">
            By Season
          </h2>
          <div className="flex flex-col gap-8">
            {data.seasons.map((s) => (
              <div key={s.seasonId}>
                <h3 className="mb-3 text-center text-base font-semibold text-gray-400">
                  {s.seasonId.slice(0, 4)}–{s.seasonId.slice(4)}
                </h3>
                <VersusTable
                  stats={s}
                  playerA={data.playerA}
                  playerB={data.playerB}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
