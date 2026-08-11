import { Leaderboard } from "@/components/Leaderboard";

export const metadata = {
  title: "Rivalry Leaderboard — Bar Down Data",
  description: "Top NHL player rivalries by Rivalry Score across the league.",
};

export default function LeaderboardPage() {
  return (
    <div className="flex flex-col gap-8 pt-10">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-100 md:text-5xl">
          Rivalry <span className="text-amber-400">Leaderboard</span>
        </h1>
        <p className="mt-3 text-lg text-gray-400">
          The most contested matchups in the NHL by Rivalry Score
        </p>
      </div>
      <Leaderboard />
    </div>
  );
}
