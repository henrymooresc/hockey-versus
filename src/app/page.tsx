import { PlayerSearch } from "@/components/PlayerSearch";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-10 pt-10">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight md:text-6xl">
          Hockey <span className="text-[var(--color-brand-red)]">Versus</span>
        </h1>
        <p className="mt-4 text-xl text-gray-400">
          Compare how NHL players perform when sharing the ice
        </p>
        <p className="mt-2 text-base text-gray-600">Covering the last 10 NHL seasons</p>
      </div>

      <PlayerSearch />
    </div>
  );
}
