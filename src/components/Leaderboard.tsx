"use client";

import { useState, useEffect } from "react";
import { formatSecondsToHMS } from "@/lib/time-utils";
import { getTeamColors, getTeamDisplayColor } from "@/lib/team-colors";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";
import { Skeleton } from "./Skeleton";

interface SeasonMeta { id: string; startDate: string | null; endDate: string | null; }

function PlayerSide({ player, align }: { player: LeaderboardEntry["playerA"]; align: "left" | "right" }) {
  const colors = getTeamColors(player.teamAbbrev);
  return (
    <div className={`flex items-center gap-2 min-w-0 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {player.headshotUrl ? (
        <img
          src={player.headshotUrl}
          alt=""
          className="rounded-full object-cover shrink-0"
          style={{ width: 36, height: 36, border: `2px solid ${colors.primary}80` }}
        />
      ) : (
        <div className="rounded-full bg-gray-700 shrink-0" style={{ width: 36, height: 36 }} />
      )}
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white truncate">
          {player.firstName} {player.lastName}
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] text-gray-500 ${align === "right" ? "justify-end" : ""}`}>
          {player.teamLogoUrl && (
            <img src={player.teamLogoUrl} alt="" className="object-contain" style={{ width: 12, height: 12 }} />
          )}
          <span style={{ color: getTeamDisplayColor(player.teamAbbrev) }} className="font-semibold">
            {player.teamAbbrev ?? "—"}
          </span>
          <span className="text-gray-600">·</span>
          <span>{player.position ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  return (
    <div
      className="grid items-center gap-3 rounded-lg border border-gray-700/40 bg-gray-800/40 hover:bg-gray-800 transition-colors"
      style={{ gridTemplateColumns: "36px 1fr 80px 1fr 70px 60px 80px", padding: "10px 14px" }}
    >
      <div className="text-center font-mono text-sm font-bold text-gray-500">{rank}</div>
      <PlayerSide player={entry.playerA} align="right" />
      <div className="text-center text-[10px] uppercase tracking-widest text-gray-600">vs</div>
      <PlayerSide player={entry.playerB} align="left" />
      <div className="text-right font-mono text-sm font-bold text-amber-400">{entry.rivalryScore.toFixed(2)}</div>
      <div className="text-right font-mono text-xs text-gray-400">{entry.gamesShared}</div>
      <div className="text-right font-mono text-xs text-gray-400">{formatSecondsToHMS(entry.toiSharedSeconds)}</div>
    </div>
  );
}

function HeaderRow() {
  return (
    <div
      className="grid items-center gap-3 px-3.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500"
      style={{ gridTemplateColumns: "36px 1fr 80px 1fr 70px 60px 80px" }}
    >
      <div className="text-center">#</div>
      <div />
      <div />
      <div />
      <div className="text-right">RIV</div>
      <div className="text-right">GP</div>
      <div className="text-right">TOI</div>
    </div>
  );
}

type SeasonFilter = "current" | "all";

export function Leaderboard() {
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>("all");
  const [allSeasons, setAllSeasons] = useState<SeasonMeta[]>([]);
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/seasons").then((r) => r.json()).then((d) => setAllSeasons(d.seasons ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setEntries(null);
    setError(null);
    const params = new URLSearchParams({ limit: "50" });
    if (seasonFilter === "current" && allSeasons.length > 0) {
      params.set("seasons", allSeasons[0].id);
    } else if (seasonFilter === "current") {
      return;
    }
    fetch(`/api/leaderboard?${params}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to load leaderboard");
        return data;
      })
      .then((data) => setEntries(data.leaderboard))
      .catch((err) => setError(err.message));
  }, [seasonFilter, allSeasons]);

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800/60 p-1">
          <button
            onClick={() => setSeasonFilter("current")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
              seasonFilter === "current" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Current Season
          </button>
          <button
            onClick={() => setSeasonFilter("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
              seasonFilter === "all" ? "bg-blue-600 text-white shadow" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Last 10 Seasons
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-6 py-4 text-center text-red-400">{error}</div>
      ) : entries === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton width={200} height={10} className="ml-3 mb-1" />
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} height={56} rounded="lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center text-gray-500">No data available</div>
      ) : (
        <>
          <HeaderRow />
          <div className="flex flex-col gap-2">
            {entries.map((entry, i) => (
              <LeaderboardRow
                key={`${entry.playerA.id}-${entry.playerB.id}`}
                entry={entry}
                rank={i + 1}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
