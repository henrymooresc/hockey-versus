import { TeamGrid } from "@/components/TeamGrid";
import { TeamRivalryBoard } from "@/components/TeamRivalryBoard";

export const metadata = {
  title: "Teams — Bar Down Data",
  description: "Every NHL team, with rosters and per-player ice time and rate stats.",
};

export default function TeamsPage() {
  return (
    <div className="flex flex-col gap-8 pt-10">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-100 md:text-5xl">
          NHL <span className="text-amber-400">Teams</span>
        </h1>
        <p className="mt-3 text-lg text-gray-400">
          Pick a club to see its roster, ice time and rate stats
        </p>
      </div>
      <TeamRivalryBoard limit={15} />
      <hr className="border-gray-700/60" />
      <TeamGrid />
    </div>
  );
}
