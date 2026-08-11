"use client";

import type { RivalGameHistory } from "@/types/versus";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";

function formatSeason(seasonId: string): string {
  // "20232024" → "'23–'24"
  const start = seasonId.slice(2, 4);
  const end = seasonId.slice(6, 8);
  return `'${start}–'${end}`;
}

export function RivalryTrendChart({ history }: { history: RivalGameHistory[] }) {
  if (history.length === 0) return null;

  const avg = history.reduce((sum, g) => sum + g.rivalryScore, 0) / history.length;

  const data = history.map((g) => ({
    ...g,
    toiMinutes: Math.round((Number(g.toiSharedSeconds ?? 0) / 60) * 10) / 10,
  }));

  // Find the index of the first game in each season for divider lines
  const seasonDividers: { index: number; seasonId: string }[] = [];
  let prevSeason = "";
  data.forEach((g, i) => {
    if (g.seasonId !== prevSeason) {
      seasonDividers.push({ index: i, seasonId: g.seasonId });
      prevSeason = g.seasonId;
    }
  });

  return (
    <div className="mt-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
        Rivalry Score by Game
      </div>
      <div style={{ width: "100%", height: 120 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "var(--color-gray-500)" }}
              axisLine={{ stroke: "var(--color-gray-700)" }}
              tickLine={false}
              interval={history.length > 10 ? Math.floor(history.length / 6) : 0}
            />
            <YAxis
              yAxisId="rivalry"
              tick={{ fontSize: 9, fill: "var(--color-gray-500)" }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <YAxis
              yAxisId="toi"
              orientation="right"
              tick={{ fontSize: 9, fill: "var(--color-gray-500)" }}
              axisLine={false}
              tickLine={false}
              width={28}
              tickFormatter={(v) => `${v}m`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-gray-800)",
                border: "1px solid var(--color-gray-700)",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "var(--color-gray-500)" }}
              formatter={(value, name) =>
                name === "rivalryScore"
                  ? [Number(value).toFixed(1), "Rivalry"]
                  : [`${Number(value).toFixed(1)}m`, "TOI"]
              }
            />
            <Legend
              content={() => (
                <div style={{ display: "flex", gap: 12, justifyContent: "center", paddingTop: 2 }}>
                  {([
                    { label: "Rivalry", color: "var(--color-blue-400)", dashed: false },
                    { label: "TOI", color: "var(--color-emerald-400)", dashed: true },
                    { label: `Avg Rivalry (${avg.toFixed(1)})`, color: "var(--color-red-400)", dashed: true },
                  ] as const).map(({ label, color, dashed }) => (
                    <span key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "var(--color-gray-500)" }}>
                      <svg width="12" height="10">
                        <line x1="0" y1="5" x2="12" y2="5" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "4 2" : undefined} />
                      </svg>
                      {label}
                    </span>
                  ))}
                </div>
              )}
            />
            {seasonDividers.map(({ index, seasonId }) => (
              <ReferenceLine
                key={seasonId}
                yAxisId="rivalry"
                x={data[index].label}
                stroke="var(--color-gray-600)"
                strokeDasharray="3 3"
                label={{ value: formatSeason(seasonId), position: "insideTopLeft", fontSize: 8, fill: "var(--color-gray-500)" }}
              />
            ))}
            <ReferenceLine
              yAxisId="rivalry"
              y={avg}
              stroke="var(--color-red-400)"
              strokeDasharray="4 3"
            />
            <Line
              yAxisId="rivalry"
              type="monotone"
              dataKey="rivalryScore"
              stroke="var(--color-blue-400)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-blue-400)" }}
              activeDot={{ r: 5, fill: "var(--color-blue-500)" }}
            />
            <Line
              yAxisId="toi"
              type="monotone"
              dataKey="toiMinutes"
              stroke="var(--color-emerald-400)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-emerald-400)" }}
              activeDot={{ r: 5, fill: "var(--color-emerald-400)" }}
              strokeDasharray="5 3"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
