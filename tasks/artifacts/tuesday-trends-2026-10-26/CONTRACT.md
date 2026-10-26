# Tuesday Trends — section contract (lane TT, 2026-10-26)

Route: `/social-share/tuesday-trends` (API `GET /api/v1/social-share/tuesday-trends`). Code: `web/lib/socialShare/trends.ts` (calculations), `trendSources.ts` (live loader), `server.ts` (Tuesday branch), `components/SocialShare/SocialShare.tsx` (`TrendCard`). The constants named below live in `trends.ts`. The footer definitions printed on each card are `trendDefinitions` in the same file.

Native sources only. Tuesday never reads `PROJECTIONS_20262027_*`, `PROJECTIONS_20252026_*`, BLSH or `goalie_start_projections`. It covers skaters only: any id whose `players.position` is `G` drops out.

## Shared rules

- **Edition time.** `today` is the New York date of the edition's `generatedAt`.
- **Current skater.** The player has a strength-`all` `rolling_player_game_metrics` row for the edition's season with `game_date` in `[today − 7, today]` (`TREND_MAX_GAME_AGE_DAYS = 7`), not in the future. His latest row's `team_id` must map to an active NHL team.
- **Team.** Always the `team_id` of the player's **latest game**, never a roster or Yahoo team.
- **Previous game.** The player's next-newest row in the window, used only if `season_games_played` is exactly one lower (contiguous). Otherwise it is unknown.
- **L5.** The rolling `*_last5` windows: the player's last 5 games played, as already used by the Monday/Wednesday cards. This is an assumption to confirm in the genuine capture.
- **Freshness.**
  - Rolling metrics: freshness is the writer's, not the row's. The daily pipeline writes each game row once, so an idle skater's latest row keeps an old `updated_at` (found in the TT-2 capture: 55 current skaters were wrongly dropped by a per-row rule). The source is `stale` when its **newest** row update is older than 72 h ("Rolling metrics are stale: last updated ‹date›"). Movers are then blocked too, because team identity needs current rolling rows. The footer's "updated" time is that newest update.
  - Ownership: stale when its latest observation date is before `today − 1` ("Yahoo ownership is stale: last observed ‹date›").
  - Stale sections are not ranked or exported. The reason with its as-of date is shown on the card.
- **Failure.** A failed read becomes a `missing` state, naming the source and the PostgREST code/message, on every section that needs that source. No section ever shows fixture values or zeroes in place of a gap.
- **Privacy.**
  - Only the players a card lists are in the response (≤ 37 per edition).
  - No Yahoo keys, timelines or `updated_at` leave the server.
  - The response is `private, no-store`, and it is served only to a social editor (`requireSocialShareAccess`, unchanged).

## 1. Recent Form — rule `recent-form-v1-early` (replaces "Tuesday form" before release; TJ, TT-3)

| Item | Definition |
|---|---|
| Windows | **Last 5 completed appearances** vs **the preceding 5**, with no overlapping games |
| Values | Recent: `points_total_last5 ÷ 5`. Preceding: `(points_total_last10 − points_total_last5) ÷ 5`. Both are rounded to 0.01, and the change is computed from the rounded values. All three are shown (hero "P/GP LAST 5", detail "Prior 5", small "CHANGE") |
| Why this is game-aligned | The writer's `*_last5/_last10` points windows hold the last N **valid observations**, carried across seasons (`fetchRollingPlayerAverages.ts`, `updateAccumulator`: a null skips its slot). A skater qualifies only when: **season GP ≥ 10**, so all 10 appearances are **this season**; `points_avg_season × season_games_played` is a whole number (within 0.01), so no in-season game lacks points and the 10 observations are the last 10 appearances; and `0 ≤ last5 ≤ last10 ≤ season points` |
| Minimums | All 10 appearances in the current season; last game within 7 days; every input present. A missing or unproven input leaves the player out. It is never counted as zero |
| Lists | UP VS PRIOR 5 (change > 0, largest first) and DOWN VS PRIOR 5 (change < 0); 5 each. Ties: recent P/GP desc, then NHL id. `qualifiers` = skaters who passed every check |
| Copy | Descriptive only. The eyebrow says "Early season · small sample" on the card and in the PNG. It is not BLSH and not a streak, and it makes no sustainability claim |
| Empty | "No qualifiers yet" with the requirement. Download is off for this card only; deployment, rates and movers export independently (E2E) |
| Versioning | The rule id is in the layer (`sections.hot.rule`) and in the footer. A later rule (e.g. L5 vs preceding 10) needs a new id plus an explicit, documented edition rule or a reviewed transition. **Never** switch automatically on a qualifier count, and never mix windows in one ranking |
| Reads | No new statement: `points_total_last10` is added to the existing R1 rolling select |

## 2. Ownership movers

| Item | Definition |
|---|---|
| Source | `yahoo_player_ownership_history` (PK `player_key, ownership_date`) |
| Dates | Latest observation date **D** in the table, and **P** = the latest date ≤ D − 5 (`MOVER_WINDOW_DAYS`). Both are shown on every row and in the footer |
| Value | `ownership_pct` on D and on P, each rounded to 0.1. Shown at the source's precision: Yahoo values are whole percents, so the card shows "+17" and "28% → 45%". One decimal is shown only when a value has decimals |
| Change | `latest − previous` from the rounded values, in **percentage points**. The card says "PCT PTS ROSTERED" (not "PTS", which reads as fantasy points), and the definition reads "pct pts = percentage-point change in Yahoo rostered %". It never says adds or drops; the footer says "not add/drop counts" |
| Missing | A player without a valid observation on D **and** P is not a mover. A missing observation is never 0% |
| Minimum | abs(change) ≥ 1.0 pt (`MIN_MOVER_POINTS`) |
| Identity | `yahoo_nhl_player_map_read` by `player_key` or Yahoo `player_id`. An id that maps to more than one NHL id is dropped. The NHL id must be a current skater (team from the latest game) |
| Lists | RISING / FALLING, 5 each. Ranking happens before the mapping (top 30 each way, `MOVER_CANDIDATES`), then the first 5 that map are kept |

## 3. Deployment

| Item | Definition |
|---|---|
| TOI/GP | All situations `toi_seconds_avg_last5` vs `toi_seconds_avg_season`. EV: the `ev` row's same columns for the latest game. PP: the all row's `pp_toi_seconds_total_last5 ÷ 5` vs `pp_toi_seconds_avg_season`. Shown as L5 / season; unknown shows "—" |
| Delta | L5 − season TOI/GP in seconds (shown as ±m:ss, "TOI/GP VS SEASON") |
| Line | `line_combo_group/slot` → L1–L4 / P1–P3, latest game vs previous contiguous game, same group. Lower slot = promotion (▲), higher = demotion (▼) |
| PP unit per game | **There are only two PP units (TJ, TT-4).** The writer (`update-power-play-combinations/[gameId].ts`) ranks skaters by PP TOI: top 5 → 1, next 5 → 2, everyone else with PP time → 3, so its "unit 3" is incidental PP time, not a unit. A `powerPlayCombinations` row with unit 1 or 2 → **PP1/PP2**. Unit ≥ 3, or the game has PP rows but not the player → **none** ("off PP"). The game has no PP rows → the rolling row's `pp_unit` only when it is 1 or 2, else **unknown** ("PP ?"). "no PP" and "PP3" are never shown |
| PP change | Only when both games are known. Order PP1 < PP2 < off PP. So PP2 → unit 3 is "▼ PP2 → off PP", while unit 3 ↔ off PP is no change |
| Team change | If the previous game's `team_id` differs, there is no line/PP comparison and the row shows "NEW TEAM" |
| Inclusion | Any line or PP change (**even with flat TOI**), or abs(TOI delta) ≥ 60 s (`MIN_DEPLOYMENT_TOI_DELTA_SECONDS`); ≥ 10 season GP |
| Column (TT-3) | **abs(TOI change) ≥ 1:00 → column by the TOI sign** (USAGE UP if more ice), and the hero is the TOI change. The role chips keep their own arrows, e.g. "more ice, lost PP1". **Role-only rows** (abs(TOI change) < 1:00) → column by the role direction (line step + PP step), and the hero is the role ("▲ LINE", "▼ LINE + PP"). **Mixed-direction role-only rows** (line up while PP down, or the reverse) are **left out**. The hero and its column never contradict (Vitest and E2E) |
| Order | Rows with a role change first, then abs(role), then abs(TOI change); 4 per side (`DEPLOYMENT_LIST`) |

## 4. Rate standouts

| Item | Definition |
|---|---|
| Metrics | SOG/60 (`sog_per_60_*`), iCF/60 (`shot_attempts_per_60_*`, all individual attempts), ixG/60 (`ixg_per_60_*`) |
| Shown | L5 rate (large, "L5"), Δ/60 vs season (small, "Δ/60"), season rate and L5 minutes |
| Rounding | SOG and iCF to 0.1, ixG to 0.01; Δ from the rounded values |
| Sample floor | L5 TOI ≥ 50 min (`toi_seconds_total_last5 ≥ 3000`, `MIN_RATE_TOI_SECONDS_LAST5`); ≥ 10 season GP |
| Lists | Δ > 0, largest first, 3 per metric (`RATE_LIST`) |

## Export fidelity

- The preview square carries `data-export-token = ‹snapshot.id›|‹card›|‹selected dates›`. It is checked at click, after fonts, after font embedding, and after the PNG is drawn (`assertToken` in `export.ts`). A mismatch refuses the download: "The preview changed after Download was clicked."
- Monday/Wednesday exports carry no token and are unchanged.
- **Footer source line**, one line in 17 px bold (`.trendSource`):
  - Metric cards: `FHFH rolling metrics · games thru ‹date› · updated ‹date time ET› · not projections`.
  - Movers: `Yahoo rostered % · ‹P› → ‹D› · not adds/drops`.

## TT-4 visual layer (sparklines and accents)

- **Tiles:** each listed player is a tile in Monday's style. The team-colour banner (`TeamBanner`, sm) carries the logo, name, team · position and, on the right, the **absolute** value ("P/GP LAST 5", "TOI/GP L5", "L5 SOG/60", "ROSTERED").
- **Hero:** the big neon number is the **change** ("P/GP VS PRIOR 5", "TOI/GP VS SEASON" or the role hero, "Δ/60 VS SEASON", "PCT PTS ROSTERED"), so the label kinds stay distinct.
- **Accent:** the tile border and glow, the hero, the sparkline and the badge are **green** when the hero is positive, **red** when negative, and neutral when zero or unknown (`toneOf`). The tone always follows the sign of the hero value.
- **Badges:** they use Monday's flame-badge pattern (neon icon on a dark chip) with descriptive words only: RISING/FALLING, MORE ICE/LESS ICE (dropped on deployment ice-time tiles in TT-9), PROMOTED/DEMOTED, ABOVE SEASON. There is no streak or sustainability claim. Deployment chips use Monday's role-chip colours.
- **Sparklines:** inline SVG, rendered into the PNG.
  - **Series:** points per game over the last 10 appearances (Recent Form, divider before the last 5); TOI per game over the last 10 games, dashed season TOI/GP (deployment); the per-game rate over the last 10 games, dashed season rate (rates); daily Yahoo rostered % from P to D (movers).
  - **Data rules:** values are observed only. A gap is drawn as a hollow tick, and nothing is interpolated.
  - **When there is no line:** with no series (not read, failed or inconsistent), the tile shows no line.
  - **Reads:** see READ-PLAN v2.
- **Monday/Wednesday role chips (TT-4 add-on):** `roleChipList` shows PP1 and PP2 chips only. The writer's unit 3 gets no chip, as an unknown unit does. `score.ts` is unchanged: PP3 was already neutral (×1.0).


## TT-5 visual layer

- **Sparkline reads: approved, on by default, with a kill switch (TT-6).** TJ approved READ-PLAN v2's S1/M2 for editor page loads (READ-APPROVAL addendum 2). They run by default; `SOCIAL_SHARE_TUESDAY_SPARKLINES=0` on the server turns them off, giving no extra statement and no sparklines (`sparklineReadsEnabled`, `loadTrendLayer(…, { sparklines })`). No Vercel setting needs to change.
- **Movers sparkline:** Transaction Trends' `OwnershipSparkline` (filled area and line), imported read-only. It is fed `{ date, value }` points for P..D only when every day has an observation. That component joins its line across missing points, so any gap means **no sparkline**, never a line drawn across the gap. It is green for a rise and red for a fall, from the hero sign. Its fill and stroke are also written as SVG presentation attributes, because html-to-image drops class styles on SVG children.
- **Neon logos:** `tasks/artifacts/…/tt5/trace-logo-outlines.mjs` edge-traces each **committed** logo offline into `web/public/teamLogos/outline/X.png`.
  - **Tracing method:** Sobel on alpha and premultiplied RGB, then a threshold, Zhang–Suen thinning, a 3 px disc stroke, and 256 px white on transparent.
  - **Render:** the tile draws the outline tinted green, red or neutral blue by the hero sign. The tint is applied on a canvas and inlined as a data URL, the same pipeline as team logos, and given a neon glow with CSS drop-shadow. The PNG export therefore carries it exactly.
  - **Fallback teams:** `OUTLINE_FALLBACK_TEAMS` in `SocialShare.tsx` = NYR, NYI, WSH, OTT, DET. Their outlines are too dense to read at 56 px, so they use the home-page game-card treatment instead: a cropped full-colour logo over the team's 65° jersey stripes. A missing outline also falls back.

## TT-8 presentation

- **Hot/Cold.** "Recent Form" is renamed **Hot/Cold** (title, graphic name, footer definition). The rule id stays `recent-form-v1-early`, and the "Early season · small sample" label is unchanged. Group eyebrows read "UP VS PRIOR 5" and "DOWN VS PRIOR 5".
- **Vertical group labels:** set in `$font-family-sporty` ("Tomorrow" SemiBold Italic, OFL; `web/public/fonts/social-share/Tomorrow-SemiBoldItalic.ttf`), green or red, with a light glow:
  - Hot/Cold: HOT / COLD.
  - Ownership Movers: RISING / FALLING; eyebrows "ROSTERED % UP" and "ROSTERED % DOWN".
  - Deployment: **MORE ICE / LESS ICE** (TJ, TT-9; it was PROMOTIONS / DEMOTIONS in TT-8). The labels name what decides the column: the TOI sign first (abs(TOI change) ≥ 1:00), with only role-only rows following the line/PP direction. The line and PP chips keep their own arrows, so a tile under MORE ICE can show ▼ P1 → P3. Ice-time tiles carry no badge, because the column label says it; role-only tiles keep a PROMOTED / DEMOTED badge.
  - Rates: no vertical labels.
- **Neon stripes:** the home page's 65° stripe edges (28 · 30/33 · 35/52 · 60 %) are drawn as thin team-colour lines (a 1.5 px core plus a 5 px glow at 32%) over a transparent field. They are plain gradients, with no masks.
- **Outlines v2.5** (`tt8/trace-logo-outlines-v2_5.mjs`, parameters in `tt8/outline-v2_5-params.json`):
  - **Stroke:** a 14 px diameter at 768 px, 1.82% of the logo width, the midpoint between v1 (2.73%) and v2 (0.91%).
  - **Interior edges:** use the Euclidean RGB gradient.
  - **Per-team overrides:** DAL, WPG, MIN, UTA: colour threshold 0.20; SEA: 0.15 with a 24 px minimum stroke.
