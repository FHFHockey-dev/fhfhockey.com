# Player page charts: normalization options

**Status:** proposal only, nothing beyond the unit split has been built. **Date:** 2026-10-20. **Author:** Claude (player-page session).

TJ's direction: "Split by unit, counts on one chart, percentages on another. TOI needs to be normalized... maybe league percentiles... percentiles for points in a single game on a single day might not be a good measure. We need to figure it out."

## What is already built (uncommitted)

The Trends and Advanced charts now draw one labelled panel per unit, each with its own axis:

| Panel | Stats | Axis |
|---|---|---|
| Counts | P, G, A, SOG, hits, blocks, ... | per game |
| Rates | per-60 stats, GAA, PDO | per 60 / per game |
| Percentages | SH%, FO%, CF%, xGF%, SV%, ... | fixed 0–100% |
| Time on ice | TOI, PP TOI | minutes, mm:ss ticks and tooltips |

Missing values are gaps, never 0, including the 5-game rolling average.

- Before: `chart-normalization/before-shared-axis-trends-1440.png` (live page) and `before-shared-axis-raw.png` (McDavid, 5 stats). TOI in seconds (about 1,400) flattens every other line to zero.
- After: `after-split-trends-1440.png`, `after-split-trends-375.png`, `after-split-advanced-1440.png`.

The split solves the "TOI deflates everything" problem without changing any values. The options below go further: they put stats with different units on **one** comparable scale, so you can ask "was this an above-normal night across the board?"

## Prototype method

- Player: Connor McDavid, 2026-27, 7 appearances (Sep 29–Oct 17).
- Stats: P, G, A, SOG, TOI.
- Data was read only, with a few bounded selects through the public client: `wgo_skater_stats` (his game log) and `wgo_skater_stats_per_game` (season 2026-27, forwards with GP ≥ 3, 416 players).
- The charts were rendered offline with matplotlib from the same computed series. They are throwaway renders, not app code.

## Option (a): index to the player's own season average (= 100)

`value / player's season mean × 100`. `option-a-index-to-season-average.png`

- **Pros**
  - Easiest to read: 100 is normal for him, 150 is 50% above.
  - Unit-free: TOI sits near 100 and no longer dominates.
  - Needs only the game log already on the page; no new queries or tables.
  - Cheap to compute on the client and simple to explain in a tooltip ("142% of his season average").
- **Cons**
  - Low-count stats swing wildly: goals move 0 ↔ 233 on single goals.
  - The baseline moves as the season grows. Early-season indexes rest on few games.
  - It says nothing about how good the player is, only how a night compares with his own normal.
- **Data needed:** the player's game log. Exists today.
- **Missing or zero values**
  - A missing value is a gap.
  - A season mean of 0 (e.g. no goals yet) makes the index undefined, so the line is hidden with a note "no baseline yet".
  - A 0 on a normal night plots as 0 (a real 0, not missing).
  - Zero-game windows have no baseline, so nothing is drawn.

## Option (b): z-score against the player's own season

`(value − season mean) / season standard deviation`. `option-b-zscore-own-season.png`

- **Pros**
  - Volatility-adjusted: "1.5σ above normal" means the same for goals and TOI.
  - Separates real outliers from routine noise better than (a).
- **Cons**
  - "σ" means nothing to most fantasy players, so it needs explaining.
  - The standard deviation is unreliable with few games (n < 8–10). Early-season lines jump.
  - A constant stat (sd = 0) is undefined.
  - Like (a), it is relative to the player, not the league.
- **Data needed:** the player's game log. Exists today.
- **Missing or zero values**
  - A missing value is a gap.
  - With fewer than 2 values, or sd = 0, there is no line, shown as "not enough games".
  - A 0 is a real value and lands below the mean.

## Option (c): league percentile per stat over a sensible pool

The percentile of the player's **5-game rolling average** against forwards' season per-game averages (GP ≥ 3), split by position. `option-c-league-percentile-rolling5.png`

- **Pros**
  - Answers "how good is this", which is the fantasy question.
  - A scale everyone understands (0–100).
  - Position pools make D and F comparable.
- **Cons**
  - **It saturates for elite players.** McDavid's P, A and TOI sit at about the 100th percentile all season, so the chart shows almost nothing of his ups and downs. The prototype shows this clearly.
  - The window and the pool are a mismatch: a 5-game rolling average swings more than season averages, so it overstates extremes, as the early-season 13th → 99th jump in goals shows.
  - It needs a league pool, and doing it properly costs data work.
- **TJ's caveat (single-game percentiles):** addressed by never ranking a single game.
  - Rank a rolling window (5 or 10 games) against the **same kind of window** across the league. For example, compare each forward's 5-game rolling averages over the same dates, not against season averages.
  - Require a minimum sample (≥ 5 games in the window, ≥ N players in the pool).
  - Use position-specific pools; optionally weight by TOI.
- **Data needed**
  - Season per-game pool: exists today (`wgo_skater_stats_per_game`, which the radar already reads).
  - A like-for-like rolling-window pool does **not** exist. It would need a nightly precompute from `wgo_skater_stats` into a small percentile table (per position, stat, window and date). Computing it on the client is too heavy.
- **Missing or zero values**
  - Windows with fewer than the minimum games are gaps.
  - Players below the pool's minimum GP are excluded from the pool.
  - Ties are ranked at the midpoint.
  - Ingestion gaps (like 2026-10-15) shrink the window instead of counting as 0s.

## Recommendation

1. **Keep the unit split as the default view** (built). It shows true values with honest axes.
2. **Add option (a) as a toggle, "Relative to season average".**
   - Index the **5-game rolling average**, not single games, which tames the 0 ↔ 233 swings.
   - Require ≥ 5 games before drawing, and show TOI and counts on one 100-based axis.
   - The data exists today, so it is a small client-side change with no new queries and is easy to explain.
3. **Treat (c) as a later, separate data task.**
   - Use a nightly precomputed percentile table of rolling-window averages per position.
   - Show it only when the pool and window minimums are met.
   - Accept that elite players will sit near the top. That makes it best for "how good" labels and badges, not for trend lines.
4. **Skip (b)** for the public page. It is good for analysis, but it needs too much explanation for the audience.

**Decisions for TJ**
- Ship (a) as a toggle?
- Rolling window: 5 or 10 games?
- Should (c) go on the data backlog as a precompute task?
