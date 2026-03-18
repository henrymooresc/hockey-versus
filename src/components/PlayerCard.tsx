import type { PlayerInfo } from "@/types/versus";

export function PlayerCard({ player }: { player: PlayerInfo }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {player.headshotUrl && (
        <img
          src={player.headshotUrl}
          alt={`${player.firstName} ${player.lastName}`}
          className="h-24 w-24 rounded-full border-2 border-gray-700"
        />
      )}
      <div className="text-center">
        <div className="text-xl font-bold">
          {player.firstName} {player.lastName}
        </div>
        <div className="text-sm text-gray-400">
          {player.teamAbbrev && `${player.teamAbbrev} · `}
          {player.position}
          {player.sweaterNumber && ` · #${player.sweaterNumber}`}
        </div>
      </div>
    </div>
  );
}
