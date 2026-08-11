export const metadata = {
  title: "About — Bar Down Data",
  description: "How Hockey Versus measures rivalries between NHL players.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl pt-10 pb-20">
      <h1 className="text-4xl font-extrabold tracking-tight text-gray-100">
        About <span className="text-[var(--color-brand-red)]">Hockey Versus</span>
      </h1>
      <p className="mt-3 text-lg text-gray-400">
        Compare how NHL players perform when sharing the ice.
      </p>

      <section className="mt-10 rounded-xl border border-gray-700/60 bg-gray-900/90 p-6 shadow-lg shadow-black/20">
        <h2 className="text-xl font-bold text-blue-400">What is &ldquo;shared ice&rdquo;?</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          For every NHL game over the last 10 seasons, we line up each player&apos;s
          shifts second-by-second and record what happened — goals, assists, shots,
          hits, blocks, penalties, faceoffs — only while both players were on the ice
          together. That is about 13,000 games and 10 million shifts.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          Events are attributed to a pair, not merely to the ice. A hit, a faceoff or
          a penalty counts only when one of the two players was on each side of it.
          Sharing the ice with someone while they hit a third player does not count.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          Everything comes from the public NHL API and is aggregated ahead of time,
          so the site reads precomputed pair totals rather than recalculating them
          on each visit.
        </p>
      </section>

      <section id="rivalry-score" className="mt-6 scroll-mt-24 rounded-xl border border-gray-700/60 bg-gray-900/90 p-6 shadow-lg shadow-black/20">
        <h2 className="text-xl font-bold text-amber-400">Rivalry Score</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          Rivalry Score measures how much happens between two players{" "}
          <span className="font-semibold text-gray-100">per shared game</span>, not how
          much has happened in total. A long career together does not raise the score
          on its own. It is built from three parts:
        </p>
        <ul className="mt-3 list-disc pl-6 text-sm leading-relaxed text-gray-300 space-y-1.5">
          <li>
            <span className="font-semibold text-gray-100">Activity</span> — a weighted
            count of what the two players did to each other, divided by the games they
            shared. A point counts 5, a hit 3, a minute of penalty 2, a block 2, a
            faceoff win 1.5, and a shot 1. Penalties count by minutes served, so a
            2-minute minor contributes 4 and a 5-minute fight 10.
          </li>
          <li>
            <span className="font-semibold text-gray-100">Balance</span> — how evenly
            those events split between the two. An even matchup scores higher than a
            one-sided one. This scales the result between 0.5 and 1.0, so balance can
            halve a score but never erase it.
          </li>
          <li>
            <span className="font-semibold text-gray-100">Sample size</span> — every pair
            is credited with 10 games of league-average play before its own record
            takes over. Two players who met twice in a wild game would otherwise
            outrank a decade-long rivalry on noise alone.
          </li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          A score marked with an asterisk{" "}
          <span className="font-mono text-amber-300">*</span> comes from fewer than 10
          shared games, so the league average is still doing much of the work.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-gray-700/60 bg-gray-900/90 p-6 shadow-lg shadow-black/20">
        <h2 className="text-xl font-bold text-purple-400">Two boards, two scales</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          Skater pairs and shooter-versus-goalie pairs are ranked separately, because
          the two contests do not share a scale.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          A goalie matchup is scored from the shooter&apos;s side: a goal counts 8, an
          assist 4, and a shot 1, with balance measured as goals against saves. Because
          a shooter converts only a small share of their shots, that balance term stays
          low by nature, and goalie scores land near half of skater ones.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          For scale, among the top all-time regular-season pairs, skater scores run
          from about <span className="font-mono text-blue-300">12</span> to{" "}
          <span className="font-mono text-blue-300">19.6</span>, and goalie scores from
          about <span className="font-mono text-blue-300">7.4</span> to{" "}
          <span className="font-mono text-blue-300">9.8</span>. Compare a score against
          its own board, never across the two.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-gray-700/60 bg-gray-900/90 p-6 shadow-lg shadow-black/20">
        <h2 className="text-xl font-bold text-emerald-400">Reading the views</h2>
        <ul className="mt-3 list-disc pl-6 text-sm leading-relaxed text-gray-300 space-y-1.5">
          <li>
            <span className="font-semibold text-gray-100">All-Time Rivals</span> — every
            opponent the selected player has shared ice with, sorted by Rivalry Score.
            Filter by name or team, set a minimum shared ice time, and switch between
            skater and goalie opponents.
          </li>
          <li>
            <span className="font-semibold text-gray-100">Upcoming Matchups</span> — the
            games on the player&apos;s current schedule, each showing their history
            against that opponent&apos;s roster.
          </li>
          <li>
            <span className="font-semibold text-gray-100">Leaderboard</span> — the highest
            scoring pairs in the league, on separate skater and goalie boards.
          </li>
          <li>
            <span className="font-semibold text-gray-100">Games</span> — recent games,
            grouped into playoff series. Open any game to see how each pair matched up
            in it, and how that compares to their usual meetings.
          </li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          The first three can be scoped to the current season or all 10, and to
          regular season, playoffs, or both.
        </p>
      </section>
    </div>
  );
}
