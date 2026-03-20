"use client";

import { useState, useEffect } from "react";
import type { PlayerSearchResult, RivalEntry, StatRivals } from "@/types/versus";
import { formatSecondsToHMS } from "@/lib/time-utils";

function RivalRow({
  rival,
  playerName,
  isTop,
}: {
  rival: RivalEntry;
  playerName: string;
  isTop: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-700/50 bg-gray-800/60 px-4 py-3 transition-colors duration-150 hover:bg-gray-800">
      {rival.headshotUrl ? (
        <img
          src={rival.headshotUrl}
          alt=""
          className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-600"
        />
      ) : (
        <div className="h-10 w-10 rounded-full bg-gray-600" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">
          {rival.firstName} {rival.lastName}
        </div>
        <div className="text-xs text-gray-500">
          {rival.teamAbbrev ?? "—"} &middot; {rival.gamesShared}G &middot; {formatSecondsToHMS(rival.toiSharedSeconds)} TOI
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-2 text-sm font-mono">
          <span className={isTop ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
            {rival.value}
          </span>
          <span className="text-gray-600">v</span>
          <span className="text-gray-400">{rival.opponentValue}</span>
        </div>
        <div className="text-xs text-gray-600">
          {playerName} v opp
        </div>
      </div>
    </div>
  );
}

function StatSection({
  stat,
  playerName,
}: {
  stat: StatRivals;
  playerName: string;
}) {
  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-900/90 p-5 shadow-lg shadow-black/20">
      <h3 className="mb-4 text-center text-sm font-bold uppercase tracking-widest text-blue-400">
        {stat.label}
      </h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top 3 — player dominated */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-green-400">
              Dominates
            </span>
            <span className="text-xs text-gray-600">Best matchups</span>
          </div>
          <div className="flex flex-col gap-2">
            {stat.top.length > 0 ? (
              stat.top.map((rival) => (
                <RivalRow
                  key={rival.playerId}
                  rival={rival}
                  playerName={playerName}
                  isTop={true}
                />
              ))
            ) : (
              <div className="text-sm text-gray-600 px-4 py-3">No data</div>
            )}
          </div>
        </div>

        {/* Bottom 3 — player was dominated */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
              Dominated By
            </span>
            <span className="text-xs text-gray-600">Worst matchups</span>
          </div>
          <div className="flex flex-col gap-2">
            {stat.bottom.length > 0 ? (
              stat.bottom.map((rival) => (
                <RivalRow
                  key={rival.playerId}
                  rival={rival}
                  playerName={playerName}
                  isTop={false}
                />
              ))
            ) : (
              <div className="text-sm text-gray-600 px-4 py-3">No data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SoloAnalysis({ player }: { player: PlayerSearchResult }) {
  const [rivals, setRivals] = useState<StatRivals[] | null>(null);
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
      .then((data) => setRivals(data.rivals))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [player.id]);

  const playerName = player.lastName;

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

  if (!rivals || rivals.length === 0) {
    return (
      <div className="mt-8 text-center text-gray-500">No rivalry data found</div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="mb-6 text-center text-2xl font-bold text-white">
        {player.firstName} {player.lastName}
        <span className="ml-2 text-lg text-gray-500">Rivalry Breakdown</span>
      </h2>
      <div className="flex flex-col gap-6">
        {rivals.map((stat) => (
          <StatSection key={stat.label} stat={stat} playerName={playerName} />
        ))}
      </div>
    </div>
  );
}
