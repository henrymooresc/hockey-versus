"use client";

import type { MatchupPlayer, StandingsEntry } from "@/types/versus";
import { getTeamColors, getTeamDisplayColor } from "@/lib/team-colors";

function positionColor(pos: string | null | undefined): string {
  switch (pos) {
    case "C": return "text-amber-400";
    case "L": return "text-cyan-400";
    case "R": return "text-violet-400";
    case "D": return "text-blue-400";
    default:  return "text-gray-400";
  }
}

function computeAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export function PlayerBioCard({
  matchup,
  standings,
}: {
  matchup: MatchupPlayer;
  standings: StandingsEntry | null;
}) {
  const teamColors = getTeamColors(matchup.teamAbbrev);
  const age = computeAge(matchup.birthDate);

  return (
    <div
      className="rounded-lg border bg-gray-800/60 p-3"
      style={{ borderColor: teamColors.primary + "60" }}
    >
      <div className="flex items-center gap-3">
        {matchup.headshotUrl ? (
          <img
            src={matchup.headshotUrl}
            alt={`${matchup.firstName} ${matchup.lastName}`}
            className="rounded-lg object-cover shrink-0"
            style={{
              width: 64,
              height: 64,
              minWidth: 64,
              maxWidth: 64,
              boxShadow: `0 0 12px ${teamColors.primary}30`,
              border: `2px solid ${teamColors.primary}80`,
            }}
          />
        ) : (
          <div
            className="rounded-lg bg-gray-700"
            style={{ width: 64, height: 64, border: `2px solid ${teamColors.primary}80` }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">
            {matchup.firstName} {matchup.lastName}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {matchup.sweaterNumber && (
              <span className="text-xs text-gray-400">#{matchup.sweaterNumber}</span>
            )}
            {matchup.position && (
              <span className={`text-xs ${positionColor(matchup.position)}`}>
                {matchup.position}
              </span>
            )}
          </div>
          {age !== null && (
            <div className="text-[10px] text-gray-500 mt-0.5">Age {age}</div>
          )}
        </div>
      </div>

      {standings && (
        <div
          className="mt-2 flex items-center gap-3 rounded px-2 py-1 text-[10px]"
          style={{ backgroundColor: teamColors.primary + "15", borderLeft: `3px solid ${teamColors.primary}` }}
        >
          <span
            className="flex shrink-0 items-center gap-1"
            title={matchup.teamName ?? matchup.teamAbbrev ?? undefined}
          >
            {matchup.teamLogoUrl && (
              <span className="flex items-center justify-center rounded" style={{ width: 18, height: 18, background: "rgba(255,255,255,0.12)" }}>
                <img src={matchup.teamLogoUrl} alt="" className="object-contain" style={{ width: 14, height: 14 }} />
              </span>
            )}
            {matchup.teamAbbrev && (
              <span className="text-xs font-semibold" style={{ color: getTeamDisplayColor(matchup.teamAbbrev) }}>
                {matchup.teamAbbrev}
              </span>
            )}
          </span>
          <span className="flex flex-1 items-center justify-between">
            <span className="text-gray-400">
              <span className="font-bold text-white">{standings.points}</span> pts
            </span>
            <span className="text-gray-400">
              {standings.wins}-{standings.losses}-{standings.otLosses}
            </span>
            <span className="text-gray-400">
              L10: <span className="text-gray-300">{standings.l10Record}</span>
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
