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

## 1. Hot / cold — "Tuesday form" (interim; separate from BLSH)

| Item | Definition |
|---|---|
| L5 value (shown large, "P/GP L5") | `points_total_last5 ÷ 5`, rounded to 0.01 |
| Prior baseline | `(points_avg_season × season_games_played − points_total_last5) ÷ (season_games_played − 5)`, i.e. season P/GP **excluding** the L5 games; rounded to 0.01 |
| Delta (shown small, "VS PRIOR") | `L5 − prior` from the rounded values |
| Minimums | ≥ 10 prior GP (`MIN_PRIOR_GAMES`, so 15+ season GP); last game within 7 days |
| Lists | HOT: delta > 0, largest first; COLD: delta < 0, most negative first; 5 each (`TREND_LIST`). Ties: L5 desc, NHL id asc |

## 2. Ownership movers

| Item | Definition |
|---|---|
| Source | `yahoo_player_ownership_history` (PK `player_key, ownership_date`) |
| Dates | Latest observation date **D** in the table, and **P** = the latest date ≤ D − 5 (`MOVER_WINDOW_DAYS`). Both are shown on every row and in the footer |
| Value | `ownership_pct` on D and on P, each rounded to 0.1 |
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
| PP unit per game | `powerPlayCombinations` row (gameId, playerId) → its unit. If the game has PP rows but not the player → **none** ("off PP"). If the game has no PP rows → the rolling row's `pp_unit` if positive, else **unknown** ("PP ?"). "no PP" is never shown |
| PP change | Only when both games are known. Unit order PP1 < PP2 < PP3 < none |
| Team change | If the previous game's `team_id` differs, there is no line/PP comparison and the row shows "NEW TEAM" |
| Inclusion | Any line or PP change (**even with flat TOI**), or abs(TOI delta) ≥ 60 s (`MIN_DEPLOYMENT_TOI_DELTA_SECONDS`); ≥ 10 season GP |
| Direction | role = line step + PP step. role > 0 → USAGE UP, role < 0 → USAGE DOWN; role 0 → by TOI sign |
| Order | Changed role first, then abs(role), then abs(TOI delta); 4 per side (`DEPLOYMENT_LIST`) |

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
