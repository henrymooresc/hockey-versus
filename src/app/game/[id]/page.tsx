import { GameBreakdown } from "@/components/GameBreakdown";

export const metadata = {
  title: "Game Breakdown — Bar Down Data",
  description: "Per-pair head-to-head breakdown for a single NHL game.",
};

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gameId = parseInt(id, 10);

  if (isNaN(gameId)) {
    return (
      <div className="mx-auto max-w-2xl pt-20 text-center text-red-300">
        Invalid game ID
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-8 pb-16">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Post-Game <span className="text-amber-400">Breakdown</span>
        </h1>
      </div>
      <GameBreakdown gameId={gameId} />
    </div>
  );
}
