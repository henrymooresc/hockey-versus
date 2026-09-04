"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { TeamSummary } from "@/app/api/teams/route";
import { useFetchedData } from "@/hooks/useFetchedData";
import { CONFERENCES, abbrevToDivision } from "@/lib/divisions";
import { getTeamDisplayColor } from "@/lib/team-colors";
import { RemoteImage } from "./RemoteImage";
import { Skeleton } from "./Skeleton";

function TeamCard({ team }: { team: TeamSummary }) {
  return (
    <Link
      href={`/team/${team.id}`}
      className="group flex items-center gap-3 rounded-xl border border-gray-700/60 bg-gray-800/60 px-4 py-3 transition-all duration-150 hover:border-gray-500 hover:bg-gray-700/60 active:scale-[0.99]"
    >
      {team.logoUrl ? (
        <span
          className="flex shrink-0 items-center justify-center rounded"
          style={{ width: 40, height: 40, background: "rgba(255,255,255,0.12)" }}
        >
          <RemoteImage src={team.logoUrl} alt="" width={32} height={32} className="object-contain" />
        </span>
      ) : (
        <div className="h-10 w-10 shrink-0 rounded bg-gray-700" />
      )}
      <div className="min-w-0">
        <div className="truncate font-semibold text-gray-100">{team.name}</div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-semibold" style={{ color: getTeamDisplayColor(team.abbrev) }}>
            {team.abbrev}
          </span>
          <span>{team.rosterSize} players</span>
        </div>
      </div>
    </Link>
  );
}

function DivisionBlock({ division, teams }: { division: string; teams: TeamSummary[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400">{division}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {teams.map((t) => (
          <TeamCard key={t.id} team={t} />
        ))}
      </div>
    </div>
  );
}

export function TeamGrid() {
  const { data, loading } = useFetchedData<{ teams?: TeamSummary[] }>("/api/teams");
  const teams = useMemo(() => data?.teams ?? [], [data]);

  const byDivision = useMemo(() => {
    const map = new Map<string, TeamSummary[]>();
    for (const t of teams) {
      const div = abbrevToDivision(t.abbrev);
      if (!map.has(div)) map.set(div, []);
      map.get(div)!.push(t);
    }
    return map;
  }, [teams]);

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton width={110} height={12} />
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, j) => (
                <Skeleton key={j} height={64} rounded="lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (teams.length === 0) {
    return <p className="text-center text-gray-500">No teams found.</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      {Object.entries(CONFERENCES).map(([conference, divisions]) => (
        <section key={conference} className="flex flex-col gap-6">
          <h2 className="border-b border-gray-700/60 pb-2 text-lg font-bold uppercase tracking-wider text-gray-300">
            {conference}
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            {divisions.map((division) => (
              <DivisionBlock
                key={division}
                division={division}
                teams={byDivision.get(division) ?? []}
              />
            ))}
          </div>
        </section>
      ))}
      {/* Only rendered when an abbreviation is missing from `DIVISIONS`, which
          is how a relocated or renamed club surfaces rather than vanishing. */}
      {(byDivision.get("Other")?.length ?? 0) > 0 && (
        <DivisionBlock division="Other" teams={byDivision.get("Other")!} />
      )}
    </div>
  );
}
