import { RecentGames } from "@/components/RecentGames";

export const metadata = {
  title: "Recent Games — Bar Down Data",
  description: "Browse recent NHL games and view per-pair breakdowns.",
};

export default function GamesPage() {
  return (
    <div className="flex flex-col gap-8 pt-10 pb-16">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-100 md:text-4xl">
          Recent <span className="text-amber-400">Games</span>
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Pick a game to see how each pair of players matched up
        </p>
      </div>
      <RecentGames />
    </div>
  );
}
