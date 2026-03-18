import { PlayerSearch } from "@/components/PlayerSearch";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center gap-12 pt-16">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight">
          Hockey <span className="text-blue-400">Versus</span>
        </h1>
        <p className="mt-4 text-lg text-gray-400">
          Compare how NHL players perform when sharing the ice
        </p>
      </div>

      <PlayerSearch />

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Select two players to see their head-to-head statistics</p>
        <p>Covering the last 10 NHL seasons</p>
      </div>
    </div>
  );
}
