import type { PlayerInfo } from "@/types/versus";
import { RemoteImage } from "./RemoteImage";

export function PlayerCard({ player }: { player: PlayerInfo }) {
  return (
    <div className="group flex flex-col items-center gap-4 min-w-0">
      <div className="relative">
        {player.headshotUrl ? (
          <RemoteImage
            src={player.headshotUrl}
            alt={`${player.firstName} ${player.lastName}`}
            width={160}
            height={160}
            eager
            className="h-40 w-40 rounded-full border-4 border-gray-700 object-cover transition-all duration-300 group-hover:border-blue-500/50 group-hover:shadow-lg group-hover:shadow-blue-500/10"
          />
        ) : (
          <div className="h-40 w-40 rounded-full border-4 border-gray-700 bg-gray-800 transition-all duration-300 group-hover:border-blue-500/50" />
        )}
        {player.teamLogoUrl && (
          <RemoteImage
            src={player.teamLogoUrl}
            alt={player.teamAbbrev ?? ""}
            width={40}
            height={40}
            className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full border-2 border-gray-900 bg-gray-900 object-contain p-1 transition-transform duration-300 group-hover:scale-110"
          />
        )}
      </div>
      <div className="text-center">
        <div className="text-sm font-medium text-gray-400">{player.firstName}</div>
        <div className="text-3xl font-extrabold tracking-tight text-white">
          {player.lastName}
        </div>
        <div className="mt-1 flex items-center justify-center gap-2 text-sm text-gray-400">
          {player.teamAbbrev && <span>{player.teamAbbrev}</span>}
          {player.teamAbbrev && player.position && <span className="text-gray-600">·</span>}
          {player.position && <span>{player.position}</span>}
          {player.sweaterNumber && (
            <>
              <span className="text-gray-600">·</span>
              <span>#{player.sweaterNumber}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
