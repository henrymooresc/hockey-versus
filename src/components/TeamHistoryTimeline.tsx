"use client";

import { useEffect, useState } from "react";
import { getTeamColors, getTeamDisplayColor } from "@/lib/team-colors";
import type { TeamHistoryResponse, TeamHistoryStint } from "@/app/api/players/[id]/team-history/route";

function formatRange(first: string, last: string): string {
  const f = new Date(first + "T00:00:00");
  const l = new Date(last + "T00:00:00");
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  const a = fmt(f);
  const b = fmt(l);
  return a === b ? a : `${a} – ${b}`;
}

function TeamStintChip({ stint }: { stint: TeamHistoryStint }) {
  const colors = getTeamColors(stint.abbrev);
  return (
    <div
      className="flex items-center gap-1.5 rounded-md border bg-gray-800/60 px-2 py-1"
      style={{ borderColor: colors.primary + "60" }}
      title={stint.name ?? stint.abbrev ?? undefined}
    >
      {stint.logoUrl ? (
        <img src={stint.logoUrl} alt="" className="object-contain shrink-0" style={{ width: 18, height: 18 }} />
      ) : (
        <div className="rounded bg-gray-700 shrink-0" style={{ width: 18, height: 18 }} />
      )}
      <span
        className="text-[11px] font-bold tracking-wide"
        style={{ color: getTeamDisplayColor(stint.abbrev) }}
      >
        {stint.abbrev ?? "?"}
      </span>
      <span className="text-gray-700 text-[10px]">·</span>
      <span className="text-[10px] text-gray-500 whitespace-nowrap">
        {formatRange(stint.firstDate, stint.lastDate)}
      </span>
      <span className="text-gray-700 text-[10px]">·</span>
      <span className="text-[10px] text-gray-500 whitespace-nowrap">
        <span className="font-mono text-gray-300">{stint.gameCount}</span> GP
      </span>
    </div>
  );
}

function PlayerRow({ label, teams }: { label: string; teams: TeamHistoryStint[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="shrink-0 whitespace-nowrap text-right text-[10px] font-bold uppercase tracking-widest text-gray-500" style={{ minWidth: 96 }}>
        {label}
      </div>
      {teams.map((stint, i) => (
        <div key={`${stint.teamId}-${i}`} className="flex items-center gap-2">
          <TeamStintChip stint={stint} />
          {i < teams.length - 1 && (
            <span className="text-gray-600 text-sm">→</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function TeamHistoryTimeline({
  playerId,
  opponentId,
  playerLabel,
  opponentLabel,
}: {
  playerId: number;
  opponentId: number;
  playerLabel: string;
  opponentLabel: string;
}) {
  const [data, setData] = useState<TeamHistoryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/players/${playerId}/team-history?opponentId=${opponentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [playerId, opponentId]);

  if (!data) return null;

  const aIsRequester = data.playerA.id === playerId;
  const requesterTeams = aIsRequester ? data.playerA.teams : data.playerB.teams;
  const opponentTeams = aIsRequester ? data.playerB.teams : data.playerA.teams;

  // Only render when at least one player spans multiple teams during this rivalry.
  if (requesterTeams.length <= 1 && opponentTeams.length <= 1) return null;

  return (
    <div className="mt-3 rounded-lg border border-gray-700/40 bg-gray-900/40 px-3 py-2">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
        Team History
      </div>
      <div className="flex flex-col gap-1.5">
        <PlayerRow label={playerLabel} teams={requesterTeams} />
        <PlayerRow label={opponentLabel} teams={opponentTeams} />
      </div>
    </div>
  );
}
