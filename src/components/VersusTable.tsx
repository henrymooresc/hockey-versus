import type { VersusSeasonStats, PlayerInfo } from "@/types/versus";
import { formatSecondsToHMS } from "@/lib/time-utils";

interface VersusTableProps {
  stats: VersusSeasonStats;
  playerA: PlayerInfo;
  playerB: PlayerInfo;
}

function StatRow({
  label,
  valueA,
  valueB,
}: {
  label: string;
  valueA: number | string;
  valueB: number | string;
}) {
  const numA = typeof valueA === "number" ? valueA : 0;
  const numB = typeof valueB === "number" ? valueB : 0;
  const colorA = numA > numB ? "text-green-400" : numA < numB ? "text-red-400" : "";
  const colorB = numB > numA ? "text-green-400" : numB < numA ? "text-red-400" : "";

  return (
    <div className="grid grid-cols-3 items-center border-b border-gray-800 py-2">
      <div className={`text-right font-mono ${colorA}`}>{valueA}</div>
      <div className="text-center text-sm text-gray-400">{label}</div>
      <div className={`text-left font-mono ${colorB}`}>{valueB}</div>
    </div>
  );
}

export function VersusTable({ stats, playerA, playerB }: VersusTableProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 text-center">
        <div className="text-sm text-gray-400">
          {stats.gamesShared} games &middot;{" "}
          {formatSecondsToHMS(stats.toiSharedSeconds)} shared ice time
        </div>
      </div>

      <div className="grid grid-cols-3 items-center border-b border-gray-700 pb-2 text-sm font-semibold text-gray-400">
        <div className="text-right">{playerA.lastName}</div>
        <div className="text-center">Stat</div>
        <div className="text-left">{playerB.lastName}</div>
      </div>

      <StatRow
        label="Goals"
        valueA={stats.playerA.individualGoals}
        valueB={stats.playerB.individualGoals}
      />
      <StatRow
        label="Assists"
        valueA={stats.playerA.individualAssists}
        valueB={stats.playerB.individualAssists}
      />
      <StatRow
        label="Points"
        valueA={stats.playerA.individualGoals + stats.playerA.individualAssists}
        valueB={stats.playerB.individualGoals + stats.playerB.individualAssists}
      />
      <StatRow
        label="Team GF"
        valueA={stats.playerA.goalsFor}
        valueB={stats.playerB.goalsFor}
      />
      <StatRow
        label="Team GA"
        valueA={stats.playerA.goalsAgainst}
        valueB={stats.playerB.goalsAgainst}
      />
      <StatRow
        label="Team SF"
        valueA={stats.playerA.shotsFor}
        valueB={stats.playerB.shotsFor}
      />
      <StatRow
        label="Team SA"
        valueA={stats.playerA.shotsAgainst}
        valueB={stats.playerB.shotsAgainst}
      />
      <StatRow
        label="Hits"
        valueA={stats.playerA.hits}
        valueB={stats.playerB.hits}
      />
      <StatRow
        label="PIM"
        valueA={stats.playerA.penalties}
        valueB={stats.playerB.penalties}
      />
      <StatRow
        label="FO Wins"
        valueA={stats.playerA.faceoffWins}
        valueB={stats.playerB.faceoffWins}
      />
    </div>
  );
}
