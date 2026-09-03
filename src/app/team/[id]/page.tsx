import Link from "next/link";
import { TeamRoster } from "@/components/TeamRoster";

export const metadata = {
  title: "Team Roster — Bar Down Data",
  description: "An NHL team's roster with ice time, games played and rate stats.",
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teamId = parseInt(id, 10);

  if (isNaN(teamId)) {
    return (
      <div className="flex flex-col items-center gap-4 pt-16">
        <p className="text-lg text-gray-400">That is not a team id.</p>
        <Link href="/teams" className="text-blue-400 hover:underline">
          Back to all teams
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-8">
      <Link href="/teams" className="text-sm text-gray-500 transition-colors hover:text-gray-300">
        ← All teams
      </Link>
      <TeamRoster teamId={teamId} />
    </div>
  );
}
