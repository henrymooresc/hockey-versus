import type { VersusSeasonStats, PlayerInfo } from "@/types/versus";
import { formatSecondsToHMS } from "@/lib/time-utils";

type MatchupType = "g_g" | "g_skater" | "c_c" | "skater_skater";

function getMatchupType(posA: string | null, posB: string | null): MatchupType {
  const isG = (p: string | null) => p === "G";
  const isC = (p: string | null) => p === "C";
  if (isG(posA) && isG(posB)) return "g_g";
  if (isG(posA) || isG(posB)) return "g_skater";
  if (isC(posA) && isC(posB)) return "c_c";
  return "skater_skater";
}

function savePct(shotsAgainst: number, goalsAgainst: number): string {
  if (shotsAgainst === 0) return ".000";
  return ((shotsAgainst - goalsAgainst) / shotsAgainst).toFixed(3);
}

function saves(shotsAgainst: number, goalsAgainst: number): number {
  return shotsAgainst - goalsAgainst;
}

// ── Shared header ──────────────────────────────────────────────────────────

function TableHeader({
  stats,
  playerA,
  playerB,
}: {
  stats: VersusSeasonStats;
  playerA: PlayerInfo;
  playerB: PlayerInfo;
}) {
  return (
    <>
      <div className="mb-4 text-center text-sm text-gray-400">
        {stats.gamesShared} games &middot;{" "}
        {formatSecondsToHMS(stats.toiSharedSeconds)} shared ice time
        {stats.sameTeam && (
          <span className="ml-2 rounded-full bg-blue-900 px-2 py-0.5 text-xs text-blue-300">
            Teammates
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 items-center border-b border-gray-700 pb-2 text-sm font-semibold text-gray-300">
        <div className="text-right">{playerA.lastName}</div>
        <div className="text-center text-xs text-gray-500">Stat</div>
        <div className="text-left">{playerB.lastName}</div>
      </div>
    </>
  );
}

// ── Stat row ───────────────────────────────────────────────────────────────

function StatRow({
  label,
  valueA,
  valueB,
  higherIsBetter = true,
  section,
}: {
  label: string;
  valueA: number | string;
  valueB: number | string;
  higherIsBetter?: boolean;
  section?: string;
}) {
  const numA = typeof valueA === "number" ? valueA : parseFloat(valueA as string);
  const numB = typeof valueB === "number" ? valueB : parseFloat(valueB as string);
  const aWins = higherIsBetter ? numA > numB : numA < numB;
  const bWins = higherIsBetter ? numB > numA : numB < numA;
  const colorA = aWins ? "text-green-400" : bWins ? "text-red-400" : "text-gray-300";
  const colorB = bWins ? "text-green-400" : aWins ? "text-red-400" : "text-gray-300";

  return (
    <div className="grid grid-cols-3 items-center border-b border-gray-800 py-2.5">
      <div className={`text-right font-mono text-base ${colorA}`}>{valueA}</div>
      <div className="text-center text-xs text-gray-500">{label}</div>
      <div className={`text-left font-mono text-base ${colorB}`}>{valueB}</div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="col-span-3 pt-3 pb-1">
      <span className="text-xs font-bold uppercase tracking-widest text-blue-400">{label}</span>
    </div>
  );
}

// ── Skater vs Skater ───────────────────────────────────────────────────────

function SkaterTable({
  stats,
  playerA,
  playerB,
  showFaceoffs,
}: {
  stats: VersusSeasonStats;
  playerA: PlayerInfo;
  playerB: PlayerInfo;
  showFaceoffs: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 px-6 py-5">
      <TableHeader stats={stats} playerA={playerA} playerB={playerB} />

      <SectionLabel label="Individual" />
      <StatRow label="Goals" valueA={stats.playerA.individualGoals} valueB={stats.playerB.individualGoals} />
      <StatRow label="Assists" valueA={stats.playerA.individualAssists} valueB={stats.playerB.individualAssists} />
      <StatRow
        label="Points"
        valueA={stats.playerA.individualGoals + stats.playerA.individualAssists}
        valueB={stats.playerB.individualGoals + stats.playerB.individualAssists}
      />

      <SectionLabel label="On-Ice Team" />
      <StatRow label="Goals For" valueA={stats.playerA.goalsFor} valueB={stats.playerB.goalsFor} />
      <StatRow label="Goals Against" valueA={stats.playerA.goalsAgainst} valueB={stats.playerB.goalsAgainst} higherIsBetter={false} />
      <StatRow label="Shots For" valueA={stats.playerA.shotsFor} valueB={stats.playerB.shotsFor} />
      <StatRow label="Shots Against" valueA={stats.playerA.shotsAgainst} valueB={stats.playerB.shotsAgainst} higherIsBetter={false} />

      <SectionLabel label="Physical" />
      <StatRow label="Hits" valueA={stats.playerA.hits} valueB={stats.playerB.hits} />
      <StatRow label="Penalties" valueA={stats.playerA.penalties} valueB={stats.playerB.penalties} higherIsBetter={false} />

      {showFaceoffs && (
        <>
          <SectionLabel label="Faceoffs" />
          <StatRow label="FO Wins" valueA={stats.playerA.faceoffWins} valueB={stats.playerB.faceoffWins} />
          <StatRow
            label="FO Win %"
            valueA={
              stats.playerA.faceoffWins + stats.playerB.faceoffWins > 0
                ? ((stats.playerA.faceoffWins / (stats.playerA.faceoffWins + stats.playerB.faceoffWins)) * 100).toFixed(1) + "%"
                : "—"
            }
            valueB={
              stats.playerA.faceoffWins + stats.playerB.faceoffWins > 0
                ? ((stats.playerB.faceoffWins / (stats.playerA.faceoffWins + stats.playerB.faceoffWins)) * 100).toFixed(1) + "%"
                : "—"
            }
          />
        </>
      )}
    </div>
  );
}

// ── Goalie vs Goalie ───────────────────────────────────────────────────────

function GoalieVsGoalieTable({
  stats,
  playerA,
  playerB,
}: {
  stats: VersusSeasonStats;
  playerA: PlayerInfo;
  playerB: PlayerInfo;
}) {
  const svA = saves(stats.playerA.shotsAgainst, stats.playerA.goalsAgainst);
  const svB = saves(stats.playerB.shotsAgainst, stats.playerB.goalsAgainst);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 px-6 py-5">
      <TableHeader stats={stats} playerA={playerA} playerB={playerB} />

      <SectionLabel label="Save Performance" />
      <StatRow label="Shots Faced" valueA={stats.playerA.shotsAgainst} valueB={stats.playerB.shotsAgainst} />
      <StatRow label="Saves" valueA={svA} valueB={svB} />
      <StatRow label="Goals Against" valueA={stats.playerA.goalsAgainst} valueB={stats.playerB.goalsAgainst} higherIsBetter={false} />
      <StatRow label="Save %" valueA={savePct(stats.playerA.shotsAgainst, stats.playerA.goalsAgainst)} valueB={savePct(stats.playerB.shotsAgainst, stats.playerB.goalsAgainst)} />

      <SectionLabel label="Team Offense" />
      <StatRow label="Team Goals For" valueA={stats.playerA.goalsFor} valueB={stats.playerB.goalsFor} />
      <StatRow label="Team Shots For" valueA={stats.playerA.shotsFor} valueB={stats.playerB.shotsFor} />
    </div>
  );
}

// ── Goalie vs Skater ───────────────────────────────────────────────────────

function GoalieVsSkaterTable({
  stats,
  playerA,
  playerB,
  goalieIsA,
}: {
  stats: VersusSeasonStats;
  playerA: PlayerInfo;
  playerB: PlayerInfo;
  goalieIsA: boolean;
}) {
  const goalieName = goalieIsA ? playerA.lastName : playerB.lastName;
  const skaterName = goalieIsA ? playerB.lastName : playerA.lastName;
  const gStats = goalieIsA ? stats.playerA : stats.playerB;
  const sStats = goalieIsA ? stats.playerB : stats.playerA;

  const sv = saves(gStats.shotsAgainst, gStats.goalsAgainst);
  const svp = savePct(gStats.shotsAgainst, gStats.goalsAgainst);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 px-6 py-5">
      {/* Header */}
      <div className="mb-4 text-center text-sm text-gray-400">
        {stats.gamesShared} games &middot;{" "}
        {formatSecondsToHMS(stats.toiSharedSeconds)} shared ice time
        {stats.sameTeam && (
          <span className="ml-2 rounded-full bg-blue-900 px-2 py-0.5 text-xs text-blue-300">
            Teammates
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Goalie panel */}
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <div className="mb-3 text-center text-sm font-bold uppercase tracking-wider text-blue-400">
            {goalieName}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Shots Faced</span>
              <span className="font-mono text-white">{gStats.shotsAgainst}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Saves</span>
              <span className="font-mono text-white">{sv}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Goals Against</span>
              <span className="font-mono text-white">{gStats.goalsAgainst}</span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-2">
              <span className="text-gray-400">Save %</span>
              <span className="font-mono font-bold text-white">{svp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Team Goals For</span>
              <span className="font-mono text-white">{gStats.goalsFor}</span>
            </div>
          </div>
        </div>

        {/* Skater panel */}
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <div className="mb-3 text-center text-sm font-bold uppercase tracking-wider text-blue-400">
            {skaterName}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Goals</span>
              <span className="font-mono text-white">{sStats.individualGoals}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Assists</span>
              <span className="font-mono text-white">{sStats.individualAssists}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Points</span>
              <span className="font-mono font-bold text-white">
                {sStats.individualGoals + sStats.individualAssists}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-700 pt-2">
              <span className="text-gray-400">Hits</span>
              <span className="font-mono text-white">{sStats.hits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Penalties</span>
              <span className="font-mono text-white">{sStats.penalties}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Shared team context */}
      <div className="mt-4">
        <div className="grid grid-cols-3 items-center border-b border-gray-700 pb-2 text-sm font-semibold text-gray-300">
          <div className="text-right">{goalieIsA ? playerA.lastName : playerB.lastName}</div>
          <div className="text-center text-xs text-gray-500">Team</div>
          <div className="text-left">{goalieIsA ? playerB.lastName : playerA.lastName}</div>
        </div>
        <StatRow label="Goals For" valueA={gStats.goalsFor} valueB={sStats.goalsFor} />
        <StatRow label="Goals Against" valueA={gStats.goalsAgainst} valueB={sStats.goalsAgainst} higherIsBetter={false} />
        <StatRow label="Shots For" valueA={gStats.shotsFor} valueB={sStats.shotsFor} />
        <StatRow label="Shots Against" valueA={gStats.shotsAgainst} valueB={sStats.shotsAgainst} higherIsBetter={false} />
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export function VersusTable({
  stats,
  playerA,
  playerB,
}: {
  stats: VersusSeasonStats;
  playerA: PlayerInfo;
  playerB: PlayerInfo;
}) {
  const matchup = getMatchupType(playerA.position, playerB.position);

  if (matchup === "g_g") {
    return <GoalieVsGoalieTable stats={stats} playerA={playerA} playerB={playerB} />;
  }

  if (matchup === "g_skater") {
    const goalieIsA = playerA.position === "G";
    return <GoalieVsSkaterTable stats={stats} playerA={playerA} playerB={playerB} goalieIsA={goalieIsA} />;
  }

  return (
    <SkaterTable
      stats={stats}
      playerA={playerA}
      playerB={playerB}
      showFaceoffs={matchup === "c_c"}
    />
  );
}
