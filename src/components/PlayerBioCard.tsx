"use client";

import type { MatchupPlayer, StandingsEntry } from "@/types/versus";
import { getTeamColors } from "@/lib/team-colors";

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
            {matchup.teamLogoUrl && (
              <img src={matchup.teamLogoUrl} alt="" className="object-contain" style={{ width: 16, height: 16, maxWidth: 16, maxHeight: 16 }} />
            )}
            <span className="text-xs" style={{ color: teamColors.primary }}>
              {matchup.teamAbbrev}
            </span>
            {matchup.sweaterNumber && (
              <span className="text-xs text-gray-400">#{matchup.sweaterNumber}</span>
            )}
            {matchup.position && (
              <span className={`text-xs ${matchup.position === "D" ? "text-blue-400" : "text-gray-400"}`}>
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
          className="mt-2 flex items-center justify-between rounded px-2 py-1 text-[10px]"
          style={{ backgroundColor: teamColors.primary + "15", borderLeft: `3px solid ${teamColors.primary}` }}
        >
          <span className="text-gray-400">
            <span className="font-bold text-white">{standings.points}</span> pts
          </span>
          <span className="text-gray-400">
            {standings.wins}-{standings.losses}-{standings.otLosses}
          </span>
          <span className="text-gray-400">
            L10: <span className="text-gray-300">{standings.l10Record}</span>
          </span>
        </div>
      )}
    </div>
  );
}
