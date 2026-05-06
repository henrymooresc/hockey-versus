"use client";

import { useState, useEffect } from "react";
import type { PlayerSearchResult, MatchupPlayer } from "@/types/versus";
import { Skeleton } from "./Skeleton";
import { TeamMatchupSummary } from "./TeamMatchupSummary";
import { useStandings } from "@/hooks/useStandings";

interface Team {
  id: number;
  abbrev: string;
  name: string;
  logoUrl: string | null;
}

const DIVISIONS: Record<string, string[]> = {
  Atlantic:     ["BOS", "BUF", "DET", "FLA", "MTL", "OTT", "TBL", "TOR"],
  Metropolitan: ["CAR", "CBJ", "NJD", "NYI", "NYR", "PHI", "PIT", "WSH"],
  Central:      ["CHI", "COL", "DAL", "MIN", "NSH", "STL", "UTA", "WPG"],
  Pacific:      ["ANA", "CGY", "EDM", "LAK", "SJS", "SEA", "VAN", "VGK"],
};

function abbrevToDivision(abbrev: string): string {
  for (const [division, abbrevs] of Object.entries(DIVISIONS)) {
    if (abbrevs.includes(abbrev)) return division;
  }
  return "Other";
}

function TeamPicker({
  teams,
  selected,
  onSelect,
  excludeTeamId,
}: {
  teams: Team[];
  selected: Team | null;
  onSelect: (team: Team) => void;
  excludeTeamId: number | null;
}) {
  const divisions = ["Atlantic", "Metropolitan", "Central", "Pacific"] as const;
  const grouped = divisions.map((div) => ({
    div,
    teams: teams
      .filter((t) => abbrevToDivision(t.abbrev) === div && t.id !== excludeTeamId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {grouped.map(({ div, teams: teamsInDiv }) => (
        <div key={div}>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-400">{div}</div>
          <div className="grid grid-cols-4 gap-1.5">
            {teamsInDiv.map((team) => {
              const isSelected = selected?.id === team.id;
              return (
                <button
                  key={team.id}
                  onClick={() => onSelect(team)}
                  title={team.name}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border p-1.5 transition-all duration-150 ${
                    isSelected
                      ? "border-blue-500 bg-blue-950/40 shadow shadow-blue-500/10"
                      : "border-gray-700/50 bg-gray-800/40 hover:bg-gray-800 hover:border-gray-600"
                  }`}
                >
                  {team.logoUrl ? (
                    <img src={team.logoUrl} alt={team.abbrev} className="h-7 w-7 object-contain" />
                  ) : (
                    <div className="h-7 w-7" />
                  )}
                  <span className="text-[10px] font-semibold text-gray-300">{team.abbrev}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TeamRivalryLookup({
  player,
  gameType = "regular",
}: {
  player: PlayerSearchResult;
  gameType?: "regular" | "playoffs" | "both";
}) {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [matchups, setMatchups] = useState<MatchupPlayer[]>([]);
  const [loadingMatchups, setLoadingMatchups] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const standings = useStandings();

  useEffect(() => {
    fetch("/api/teams")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to fetch teams");
        return data;
      })
      .then((data) => {
        const byAbbrev = new Map<string, Team>();
        for (const t of (data.teams ?? []) as Team[]) {
          const existing = byAbbrev.get(t.abbrev);
          // Prefer entries with a logo (skips defunct/stub team rows)
          if (!existing || (!existing.logoUrl && t.logoUrl)) byAbbrev.set(t.abbrev, t);
        }
        setTeams(Array.from(byAbbrev.values()));
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setSelectedTeam(null);
    setMatchups([]);
  }, [player.id]);

  useEffect(() => {
    if (!selectedTeam) return;
    setLoadingMatchups(true);
    setMatchups([]);
    fetch(`/api/players/${player.id}/matchup?teamId=${selectedTeam.id}&gameType=${gameType}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to fetch matchups");
        return data;
      })
      .then((data) => setMatchups(data.matchups))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMatchups(false));
  }, [player.id, selectedTeam?.id, gameType]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-6 py-4 text-center text-red-400">
        {error}
      </div>
    );
  }

  const playerTeamId = teams?.find((t) => t.abbrev === player.teamAbbrev)?.id ?? null;

  // Skater rivals only — averaging skater stats with goalie stats would be misleading.
  const skaterRivals = matchups.filter(
    (m) => m.position !== "G"
  );

  return (
    <div>
      {teams === null ? (
        <Skeleton height={120} rounded="lg" />
      ) : (
        <TeamPicker
          teams={teams}
          selected={selectedTeam}
          onSelect={setSelectedTeam}
          excludeTeamId={playerTeamId}
        />
      )}

      {selectedTeam && (
        <div style={{ marginTop: 28 }} className={`transition-opacity duration-200 ${loadingMatchups ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
          {loadingMatchups ? (
            <Skeleton height={280} rounded="lg" />
          ) : (
            <TeamMatchupSummary
              player={player}
              team={selectedTeam}
              matchups={skaterRivals}
              standings={standings.get(selectedTeam.abbrev) ?? null}
            />
          )}
        </div>
      )}
    </div>
  );
}
