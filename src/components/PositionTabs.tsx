"use client";

export function PositionTabs({
  active,
  onChange,
  skaterCount,
  goalieCount,
}: {
  active: "skaters" | "goalies";
  onChange: (tab: "skaters" | "goalies") => void;
  skaterCount: number;
  goalieCount: number;
}) {
  return (
    <div className="flex rounded-lg border border-gray-700/60 bg-gray-800/60 p-0.5">
      <button
        onClick={() => onChange("skaters")}
        className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
          active === "skaters"
            ? "bg-blue-600 text-white shadow-sm"
            : "text-gray-400 hover:text-gray-200"
        }`}
      >
        Skaters
        <span className={`ml-1.5 text-xs ${active === "skaters" ? "text-blue-200" : "text-gray-600"}`}>
          {skaterCount}
        </span>
      </button>
      <button
        onClick={() => onChange("goalies")}
        className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
          active === "goalies"
            ? "bg-blue-600 text-white shadow-sm"
            : "text-gray-400 hover:text-gray-200"
        }`}
      >
        Goalies
        <span className={`ml-1.5 text-xs ${active === "goalies" ? "text-blue-200" : "text-gray-600"}`}>
          {goalieCount}
        </span>
      </button>
    </div>
  );
}
