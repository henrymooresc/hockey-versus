"use client";

/**
 * A row of mutually exclusive buttons, styled to match `PositionTabs`.
 *
 * The All-Time Rivals panel and the Upcoming Matchups panel each keep their
 * own season and game-type state, so both render one of these.
 */
export function ToggleGroup<T extends string>({
  options,
  active,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="flex rounded-lg border border-gray-700/60 bg-gray-800/60 p-0.5" aria-label={label}>
      {options.map(({ value, label: optionLabel }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          aria-pressed={active === value}
          className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
            active === value
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {optionLabel}
        </button>
      ))}
    </div>
  );
}

export const SEASON_OPTIONS = [
  { value: "current", label: "Current Season" },
  { value: "all", label: "Last 10 Seasons" },
] as const;

export const GAME_TYPE_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "playoffs", label: "Playoffs" },
  { value: "both", label: "Both" },
] as const;

export type SeasonFilter = (typeof SEASON_OPTIONS)[number]["value"];
export type GameTypeFilter = (typeof GAME_TYPE_OPTIONS)[number]["value"];
