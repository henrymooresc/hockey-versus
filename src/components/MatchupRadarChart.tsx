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
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
        Stat Comparison
      </div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="72%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "#9CA3AF" }}
              formatter={(_value, name, item) => {
                const raw = name === playerName ? item.payload.mineRaw : item.payload.oppRaw;
                return [raw, name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, color: "#9CA3AF", paddingTop: 4 }}
              iconSize={10}
            />
            <Radar
              name={playerName}
              dataKey="mine"
              stroke="#60A5FA"
              fill="#60A5FA"
              fillOpacity={0.35}
            />
            <Radar
              name={opponentName}
              dataKey="opp"
              stroke="#F87171"
              fill="#F87171"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type { RadarCategory };
