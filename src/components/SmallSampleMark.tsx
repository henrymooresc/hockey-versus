"use client";

import { isSmallSample, PRIOR_GAMES } from "@/lib/rivalry-score";

/**
 * A quiet footnote mark on rivalry scores built from few shared games.
 *
 * Those scores sit close to the league average by design, because the pair has
 * not played enough for its own record to mean much. The mark explains why a
 * short history ranks where it does.
 *
 * Renders nothing for a long history, or for a pair with no shared games.
 */
export function SmallSampleMark({ gamesShared }: { gamesShared: number }) {
  if (gamesShared <= 0 || !isSmallSample(gamesShared)) return null;

  return (
    <span
      className="ml-0.5 cursor-help align-super text-[9px] leading-none text-gray-500"
      title={`Small sample: ${gamesShared} shared ${
        gamesShared === 1 ? "game" : "games"
      }. Scores below ${PRIOR_GAMES} games sit near the league average until the pair plays more.`}
    >
      *
    </span>
  );
}
