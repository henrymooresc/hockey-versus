"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface RadarCategory {
  key: string;
  label: string;
  mine: number;
  opp: number;
  higherIsBetter?: boolean;
}

export function MatchupRadarChart({
  categories,
  playerName,
  opponentName,
}: {
  categories: RadarCategory[];
  playerName: string;
  opponentName: string;
}) {
  const data = categories.map((c) => {
    const mine = c.mine;
    const opp = c.opp;
    const max = Math.max(mine, opp);

    // For "lower is better" stats (e.g. penalties), invert so the larger ring = better.
    const inv = c.higherIsBetter === false;
    const normMine = max === 0 ? 0 : (inv ? max - mine : mine) / max * 100;
    const normOpp = max === 0 ? 0 : (inv ? max - opp : opp) / max * 100;

    return {
      category: c.label,
      mine: Math.max(0, Math.round(normMine)),
      opp: Math.max(0, Math.round(normOpp)),
      mineRaw: mine,
      oppRaw: opp,
    };
  });

  return (
    <div className="mt-2">
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="72%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
            <PolarGrid stroke="var(--color-gray-700)" />
            <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: "var(--color-gray-500)" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-gray-800)",
                border: "1px solid var(--color-gray-700)",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "var(--color-gray-500)" }}
              formatter={(_value, name, item) => {
                const raw = name === playerName ? item.payload.mineRaw : item.payload.oppRaw;
                return [raw, name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, color: "var(--color-gray-500)", paddingTop: 4 }}
              iconSize={10}
            />
            <Radar
              name={playerName}
              dataKey="mine"
              stroke="var(--color-blue-400)"
              fill="var(--color-blue-400)"
              fillOpacity={0.35}
            />
            <Radar
              name={opponentName}
              dataKey="opp"
              stroke="var(--color-red-400)"
              fill="var(--color-red-400)"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type { RadarCategory };
