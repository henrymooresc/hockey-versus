"use client";

import type { BioPlayer, StandingsEntry } from "@/types/versus";
import { getTeamColors, getTeamDisplayColor } from "@/lib/team-colors";
import { formatSecondsToHMS } from "@/lib/time-utils";
import { SmallSampleMark } from "./SmallSampleMark";
import { RemoteImage } from "./RemoteImage";

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

/** One player's headshot, name, number, position and age. */
function PlayerIdentity({ player, align }: { player: BioPlayer; align: "left" | "right" }) {
  const teamColors = getTeamColors(player.teamAbbrev);
  const age = computeAge(player.birthDate);
  const isRight = align === "right";

  return (
    <div className={`flex min-w-0 items-center gap-3 ${isRight ? "flex-row-reverse text-right" : ""}`}>
      {player.headshotUrl ? (
        <RemoteImage
          src={player.headshotUrl}
          alt={`${player.firstName} ${player.lastName}`}
          width={64}
          height={64}
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
          className="rounded-lg bg-gray-700 shrink-0"
          style={{ width: 64, height: 64, border: `2px solid ${teamColors.primary}80` }}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-bold text-gray-100">
          {player.firstName} {player.lastName}
        </div>
        <div className={`mt-0.5 flex items-center gap-2 ${isRight ? "justify-end" : ""}`}>
          {player.sweaterNumber && (
            <span className="text-sm text-gray-400">#{player.sweaterNumber}</span>
          )}
          {player.position && (
            <span className={`text-sm ${positionColor(player.position)}`}>{player.position}</span>
          )}
        </div>
        {age !== null && <div className="mt-0.5 text-xs text-gray-500">Age {age}</div>}
      </div>
    </div>
  );
}

/** One player's team and current standings, or a note that they have no team. */
function TeamStrip({
  player,
  standings,
  align,
}: {
  player: BioPlayer;
  standings: StandingsEntry | null;
  align: "left" | "right";
}) {
  const teamColors = getTeamColors(player.teamAbbrev);
  const isRight = align === "right";
  const border = isRight
    ? { borderRight: `3px solid ${teamColors.primary}` }
    : { borderLeft: `3px solid ${teamColors.primary}` };

  if (!standings) {
    return (
      <div
        className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${isRight ? "flex-row-reverse" : ""}`}
        style={{
          backgroundColor: "rgba(255,255,255,0.04)",
          ...(isRight
            ? { borderRight: "3px solid rgba(156,163,175,0.5)" }
            : { borderLeft: "3px solid rgba(156,163,175,0.5)" }),
        }}
      >
        <span
          className="flex shrink-0 items-center justify-center rounded text-[13px] font-bold text-gray-500"
          style={{
            width: 18,
            height: 18,
            background: "rgba(255,255,255,0.04)",
            border: "1px dashed rgba(156,163,175,0.35)",
          }}
          title="Not on an active roster"
        >
          ?
        </span>
        <span className="italic text-gray-500">Not on an active roster</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 rounded px-2 py-1 text-xs ${isRight ? "flex-row-reverse" : ""}`}
      style={{ backgroundColor: teamColors.primary + "15", ...border }}
    >
      <span
        className="flex shrink-0 items-center gap-1"
        title={player.teamName ?? player.teamAbbrev ?? undefined}
      >
        {player.teamLogoUrl && (
          <span
            className="flex items-center justify-center rounded"
            style={{ width: 18, height: 18, background: "rgba(255,255,255,0.12)" }}
          >
            <RemoteImage src={player.teamLogoUrl} alt="" width={14} height={14} className="object-contain" />
          </span>
        )}
        {player.teamAbbrev && (
          <span
            className="text-sm font-semibold"
            style={{ color: getTeamDisplayColor(player.teamAbbrev) }}
          >
            {player.teamAbbrev}
          </span>
        )}
      </span>
      <span className={`flex flex-1 items-center justify-between ${isRight ? "flex-row-reverse" : ""}`}>
        <span className="text-gray-400">
          <span className="font-bold text-gray-100">{standings.points}</span> pts
        </span>
        <span className="text-gray-400">
          {standings.wins}-{standings.losses}-{standings.otLosses}
        </span>
        <span className="text-gray-400">
          L10: <span className="text-gray-300">{standings.l10Record}</span>
        </span>
      </span>
    </div>
  );
}

/**
 * Header of an expanded matchup: both players, with the shared rivalry figures
 * between them.
 *
 * The rivalry score belongs to the pair rather than to either player, so it
 * sits in the middle. `player` goes on the left and `opponent` on the right,
 * matching the stat comparison columns below.
 */
export function PlayerBioCard({
  player,
  opponent,
  rivalryScore,
  gamesShared,
  toiSharedSeconds,
  standings,
  showSmallSampleMark = true,
}: {
  player: BioPlayer;
  opponent: BioPlayer;
  rivalryScore: number;
  gamesShared: number;
  toiSharedSeconds: number;
  standings: Map<string, StandingsEntry>;
  /** False on a single-season view, where every pair is a short history. */
  showSmallSampleMark?: boolean;
}) {
  const teamColors = getTeamColors(opponent.teamAbbrev);
  const lookup = (p: BioPlayer) => (p.teamAbbrev ? standings.get(p.teamAbbrev) ?? null : null);

  return (
    <div
      className="rounded-lg border bg-gray-800/60 p-3"
      style={{ borderColor: teamColors.primary + "60" }}
    >
      <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
        <PlayerIdentity player={player} align="left" />

        <div className="shrink-0 text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Rivalry Score
            <a
              href="/about#rivalry-score"
              title="What is Rivalry Score?"
              className="ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-gray-600 align-middle text-[10px] font-bold text-gray-400 transition-colors hover:border-blue-400 hover:text-blue-400"
            >
              i
            </a>
          </div>
          <div
            className={`font-mono text-lg font-bold ${
              rivalryScore > 0 ? "text-green-400" : rivalryScore < 0 ? "text-red-400" : "text-gray-400"
            }`}
          >
            {rivalryScore.toFixed(2)}
            {showSmallSampleMark && <SmallSampleMark gamesShared={gamesShared} />}
          </div>
          <div className="text-xs text-gray-500">
            <span className="font-mono text-gray-300">{gamesShared}</span> GP
            <span className="mx-1 text-gray-600">·</span>
            <span className="font-mono text-gray-300">{formatSecondsToHMS(toiSharedSeconds)}</span>
          </div>
        </div>

        <PlayerIdentity player={opponent} align="right" />
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <TeamStrip player={player} standings={lookup(player)} align="left" />
        <TeamStrip player={opponent} standings={lookup(opponent)} align="right" />
      </div>
    </div>
  );
}
