# Plan: "Low Owned, High Opportunity" card (ticket 15 D, plan only, no code)

## What the card says

> Players under 50% rostered who are already getting top-six or top-pair minutes **and** first-unit power-play time, ranked by their last five games.

It answers "who is being used like a fantasy starter but is still widely available?". It is the opportunity-first counterpart to the pickups card, which is schedule-first.

## Who qualifies

| Rule | Value | Source (existing, read-only) |
| --- | --- | --- |
| Rostered | under 50%, in two bands: **25–49%** and **under 25%** | `yahoo_players.percent_ownership` (already read; Yahoo-global, not league FAs) |
| Even-strength role | forwards **L1 or L2**; defence **P1** (see open question 2) | `rolling_player_game_metrics.line_combo_slot` + `line_combo_group`, latest strength-`all` row. Read since ticket 15, normalised by `normalizeEvDeploymentBucket` |
| Power play | **PP1** | `rolling_player_game_metrics.pp_unit` → `normalizePpDeploymentBucket` |
| Recency | latest row within 14 days (`RECENT_MAX_AGE_DAYS`) | as above |
| Sample | min 5 season GP (`MIN_SKATER_GAMES`) | WGO season totals (already read) |
| Team | any team with games in the selected dates; top-10 Week Score first, wider pool fills | schedule edition (already built) |
| Goalies | **excluded**: line and PP roles don't apply | — |

## Ranking

- **By:** the ticket-15 card score (`lib/socialShare/score.ts`), i.e. L5 fantasy points per game × opportunity. Everyone here is L1/L2 + PP1, so the multiplier mostly separates players by TOI.
- **Tiebreak:** season points per game, then Week Score rank, then NHL id. Never alphabetical.
- **Rows:** 2 bands × F and D. Suggested 5 forwards + 3 defence per band (16 tiles). Lists that come up short show "Only N qualify", with no fill from players who don't qualify.

## Layout (1080 × 1080, same kit)

- **Header:** the shared header. Eyebrow "{Day} · Low owned, high opportunity"; title **"HIGH OPPORTUNITY"**.
- **Body:** two band columns (25–49% | under 25%). Each column has list rows like the tier list: team-colour band, logo, name, rostered % with its band chip, the **L1 / PP1 role chips** (ticket 15 neon), L5 line with relative TOI, and the score.
- **Footer:** the qualifying rule, the score formula (`SCORE_FORMULA`), sources and as-of, and the watermark.

## Data and server work (when approved)

- **No new tables or reads.** It reuses the player layer and the ticket-15 L5/role read.
- **The real constraint is the pool.** Roles exist only for players in the bounded L5 ranking pool (`rankingPool`, at most `RANK_POOL_MAX` = 132 players), which is chosen by season rate. A low-owned L1/PP1 player with a weak season rate could miss the pool.
  - **Option A (recommended):** add this card's own pool slice to `rankingPool`: the top N per band by season rate among skaters with `gamesPlayed ≥ 5`. N = 8 per band × F/D adds at most 32 players (RANK_POOL_MAX 164, about 2,300 recent rows, paged at 1,000).
  - **Option B:** a role-first read, i.e. one more bounded `rolling_player_game_metrics` select filtered server-side to `line_combo_slot ≤ 2` and `pp_unit = 1` on the latest game date. This is a new read shape, so it needs approval and a limit.
- **Trim:** extend `trimEditionPlayers` so the card's shown players are kept, and raise `TRIMMED_PLAYERS_MAX` by 32 (to 98). Document it as the tier list was.
- **Cache, freshness and private/no-store rules:** unchanged. A failed recent read makes the card say "Opportunity data unavailable", never "no qualifying players".

## Tests to write

1. **Qualifier:** an L1+PP1 player at 30% qualifies. An L3+PP1, an L1+PP2, an L1 with no PP, and a 55%-rostered player do not.
2. **Bands:** a player at exactly 25% sits in 25–49%; at 24.9% in under 25%.
3. **Order:** score order, the season-rate tiebreak, never alphabetical. Include TJ's Vilardi/Iafallo fixture.
4. **Server:** pool and trim keep only shown players, stay within the cap, and leak no hidden player. Also cover a failed recent read and a stale layer.
5. **E2E:** the card renders the DOM order the library returns, with role chips and geometry inside the square, and a pinned PNG.

## Open questions for TJ

1. Bands: 25–49% and under 25% here vs the pickups' 30/20 split. Keep these two? (Recommended: yes, as asked.)
2. Defence: P1 + PP1 only, or also P2 + PP1? (Recommended: P1 + PP1. PP1 defencemen are rare, so lists will be short.)
3. Pool: Option A (bounded, no new read shape) or Option B (role-first read)? (Recommended: A.)
