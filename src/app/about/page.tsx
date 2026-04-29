export const metadata = {
  title: "About — Bar Down Data",
  description: "How Hockey Versus measures rivalries between NHL players.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl pt-10 pb-20">
      <h1 className="text-4xl font-extrabold tracking-tight text-white">
        About <span className="text-[#a62639]">Hockey Versus</span>
      </h1>
      <p className="mt-3 text-lg text-gray-400">
        Compare how NHL players perform when sharing the ice.
      </p>

      <section className="mt-10 rounded-xl border border-gray-700/60 bg-gray-900/90 p-6 shadow-lg shadow-black/20">
        <h2 className="text-xl font-bold text-blue-400">What is &ldquo;shared ice&rdquo;?</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          For every NHL game over the last 10 seasons, we line up each player&apos;s shifts
          second-by-second and record what happened — goals, assists, shots, hits,
          blocks, penalties, faceoffs — only when both players were on the ice at the
          same time. Stats and standings are pulled from the public NHL API and
          re-aggregated locally.
        </p>
      </section>

      <section id="rivalry-score" className="mt-6 scroll-mt-24 rounded-xl border border-gray-700/60 bg-gray-900/90 p-6 shadow-lg shadow-black/20">
        <h2 className="text-xl font-bold text-amber-400">Rivalry Score</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          Rivalry Score is a single number that captures how meaningful and contested
          a matchup is between two players. It rewards three things:
        </p>
        <ul className="mt-3 list-disc pl-6 text-sm leading-relaxed text-gray-300 space-y-1.5">
          <li>
            <span className="font-semibold text-white">Volume</span> — total shared ice
            time and games together. A pair with hours of head-to-head ice will always
            score higher than a pair with a handful of shifts.
          </li>
          <li>
            <span className="font-semibold text-white">Activity</span> — how much
            actually happens between them. Goals and points carry the most weight,
            then penalties, hits, blocks, faceoffs, and shots.
          </li>
          <li>
            <span className="font-semibold text-white">Balance</span> — how evenly
            those events are split between the two players. A back-and-forth
            matchup scores higher than a one-sided one.
          </li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          The score is unbounded. In practice, anything north of <span className="font-mono text-blue-300">15</span>{" "}
          marks a serious league-wide rivalry; double-digit scores are rare outside
          of frequent divisional opponents. For goalies, shots faced and goals
          allowed replace the skater stat mix, so the same scale applies.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-gray-700/60 bg-gray-900/90 p-6 shadow-lg shadow-black/20">
        <h2 className="text-xl font-bold text-emerald-400">Reading the views</h2>
        <ul className="mt-3 list-disc pl-6 text-sm leading-relaxed text-gray-300 space-y-1.5">
          <li>
            <span className="font-semibold text-white">All-Time Rivals</span> — every
            opponent the selected player has shared meaningful ice time with, sorted
            by Rivalry Score.
          </li>
          <li>
            <span className="font-semibold text-white">Team Rivalry Lookup</span> —
            pick any team to see a TOI-weighted summary of the player&apos;s shared-ice
            history against that team&apos;s current roster.
          </li>
          <li>
            <span className="font-semibold text-white">Upcoming Matchups</span> — the
            next three scheduled games, with historical performance vs each opponent&apos;s
            projected roster.
          </li>
        </ul>
      </section>
    </div>
  );
}
