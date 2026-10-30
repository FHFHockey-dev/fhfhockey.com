# C7 independent review — SS1-19 install (SS1-17 recent-form fix + meta captions, SS1-18 streaks, low-year week fix)

**Verdict: accepted with limits.**
- **What holds:**
  - the recent-form fix: grain caps, per-source isolation and reason logging;
  - the caption removals, against SS1's list;
  - the streak rules, which match TJ's spec exactly (0 mismatches against my independent oracle in 20,000 cases);
  - year 0000–0999 handling, which no longer crashes the URL or the week input;
  - the access and auth files, which are untouched.
- **The limits:**
  - the production recent-form failure's root cause is still unconfirmed; it is now logged;
  - three specialist and baseline inputs are dormant or assumed;
  - one stale alt-text line (pre-existing).

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git, no live reads, and no server. Tests ran under the outbound network-deny preload, using a scratch copy of the archived luna guard. The heavy lock was held by another session's C3d typecheck, so I neither took nor touched it; this suite is light (Vitest only). Evidence is in `r17-evidence/ss1-19/`.

## Pins and scope

- **Hashes:** `HASHES-19.txt` is **15/15 OK**. The 15 SS1 paths are 13 modified plus `streak.ts` and `streak.test.ts` added, exactly the receipt's table.
- **Other dirty paths belong to other lanes:** WiGO, C3d `forge-served-forecast-snapshot*`, and `next-env.d.ts`. Leave them out of the SS1 commit.
- **Access and auth untouched:** `SocialShareAccessGate.tsx` + test, `access.ts` + test, the page and API `[format]`, and `AuthProviderContext/index.tsx` + test are all **clean against HEAD `80425a4a9`**.
  - The gate's last change is release #380 (`b3f9a7e25`); its test now has 15 cases, up from 10 at my SS1-16 check. That change isn't SS1's.

## 1. Recent-form fix (SS1-17)

| Item | Evidence | Result |
| --- | --- | --- |
| **Grain caps** | `RECENT_LIMITS.{skater,goalie}RowsPerPlayer = lookbackDays + 1 = 22`. I verified the primary keys in the schema baseline: `rolling_player_game_metrics_pkey (player_id, game_date, strength_state)` and `wgo_goalie_stats_pkey (goalie_id, date)`. With strength fixed to `all`, that is ≤ 1 row per player per date, so ≤ 22 dates over a 21-day lookback. The old cap of 14 per player could genuinely trip. An over-limit read still fails closed. | Holds |
| **Per-source isolation** | `Promise.allSettled`, and each source returns `null` independently. **My R1:** a goalie `57014` timeout leaves 1 skater row and goalies `null`; a skater `42703` leaves 1 goalie row. `attachRecent` gives `recentState` `partial` with `recentUnavailable` naming only the failed side. "No game in the last two weeks" appears only when that source answered. | Holds |
| **Reason logging** | `console.warn("[social-share] <source> unavailable: <code> <message≤200>")`. **R1:** the logs contain the code and message only, and neither id from the request. No rows or values. | Holds |
| **Root cause** | SS1's 3 TJ-approved read-only selects didn't reproduce the failure. The logging should name the cause after deploy. | **Limit L1** |

## 2. Meta-caption removals

- **Removed:** every string in RECEIPT-17's removal table is gone from the rendered card markup (grep of `SocialShare.tsx`). The 3 remaining matches ("one night per team", "best Week Score first", "fold in the next pair") are **alt text**, which SS1 kept deliberately for screen readers.
- **Kept:** limitation and source disclosures: "Not projections", "No odds or projections", "Add/drop counts…", the Yahoo as-of, "alphabetical order" on untrusted editions, the bands and "Under 50% rostered", the Wider pool legend, the score formula and OPP DEF.
- **Nothing honesty-critical lost.** The removed lines describe ordering or selection, and the visible marks (WIDER POOL, tier bars, the formula) still define themselves.
- **Note:** dropping "· {floor}+ games left" from Easiest hides that card's eligibility floor from the image. It is TJ's call, and the alt text still states it.

## 3. Streak rules against TJ's spec

| Spec source | Rule | Code (`streak.ts`) |
| --- | --- | --- |
| CLAUDE-065 | Hot: points in ≥ 4 of the last 5 GP; ≥ 0.85 P/GP; PP TOI ≥ +35% vs the pre-L5 average | Same |
| CLAUDE-065 | Specialists: > 2 HIT/GP, > 2 BLK/GP, > 2.5 SOG/GP, > 0.5 PPP/GP | Same; strict; Specialists card only |
| CLAUDE-065 + RECEIPT-18 pop-up | TOI rise "10–15%" → **15%** | `toiRise 0.15`, inclusive |
| RECEIPT-18 pop-up | Cold **mirrored**: ≤ 1 of 5; ≤ 0.25 P/GP; TOI ≤ −15%; PP TOI ≤ −35% | Same |
| Ledger line 988 (orchestrator-relayed pop-up) | Goalies: hot = QS ≥ 4/5 or SV% ≥ .930; cold = QS ≤ 1/5 or SV% ≤ .870 | Same; the comment now says "confirmed by TJ 2026-10-25" |

- **S1, independent oracle** (written from the words above, not from the code's branches): **20,000** boundary-weighted skater and goalie cases across the pickup, specialist and tier contexts give **0 mismatches**, with 7,999 hot, 3,449 cold and 8,552 none.
  - Run 1 is kept (`ss1t19-run1.*`). It showed 216 mismatches that were **my oracle's** floating-point error (`1150/1000 − 1 = 0.1499…`). The code's inclusive comparison with a 1e-9 tolerance is the correct reading of "≥ 15%".
- **Precedence and missing data:** hot beats cold. Fewer than 5 games shows no icon, and missing data never fires a rule.
- **Per-game points, "4 of 5" (P1):**
  - six provably consecutive rows (season GP steps by 1) give `pointGames = 4` on my fixture;
  - a GP gap, a null cumulative, or only 5 rows give **null**, never a guess;
  - pre-L5 baselines exclude the L5 games: TOI (1000×20 − 5500)/15 = 966.67 and PP TOI (80×20 − 500)/15 = 73.33, matching exactly.
  - `goals_total_all` and `assists_total_all` are used because `points_total_all` was dropped (2026-10-21). SS1's `tsc` caught that, and it is correct.

## 4. Year 0000–0999

- **Fixes:**
  - `calendarWeekStart` throws a clean "Invalid as-of timestamp." for non-`YYYY` local dates;
  - `isCalendarDate` now requires `[1-9]\d{3}`;
  - `safeWeekStart` catches the error on the URL path and the week input.
- **My M3:** `?week=` values `0000-01-01`, `0001-01-01` and `0999-12-31`, plus the earlier impossible dates, give **no throw** and the default-week request.
- **Owner tests:**
  - the week input ignores 0000/0999/0099-02-30 and makes no request;
  - `1000-01-07` snaps to `1000-01-06`;
  - `calendarWeekStart` boundaries hold for 0000–0999 and 1000–9999.
- This **closes my SS1-16 residual.**

## Tests

**192/192 pass** (`ss1t19.json`).
- SS1's **175**, reproduced:
  - SocialShare 19, AccessGate 15, access 24, editionFetch 15;
  - matchups 9, mondayGrid 9, playerSources 7, players 13;
  - schedule 34, score 4, streak 9, teamRates 3, tiers 8, trends 6.
- Mine: `ss1T19.test.ts` (S1, P1, R1) and `ss1T19ui.test.tsx` (M1, M2, 11 × M3, M4).
- My older SS1-15 node controls weren't rerun: their page-size expectations assumed the previous cap of 14 per player, which SS1-17 changed by design.

**E2E and pins:** not rerun (no server). SS1 reports 30/30, and its 22 pins are byte-identical to ticket 18.

## Limits and findings

| # | To | Item |
| --- | --- | --- |
| **L1** | Orchestrator / Codex | The production "Recent form unavailable" root cause is **still unconfirmed**. After deploy, one read-only look at the runtime logs for `[social-share] … unavailable:` names it. Until then the fix is containment (isolation plus honest partial states), not a confirmed cure. |
| **L2** | TJ (info) | Live `hits_avg_last5` and `blocks_avg_last5` are null, so the HIT/GP and BLK/GP streak rules and the L5 specialist stats are **dormant** (season fallback). |
| **L3** | TJ / Codex | The TOI and PP TOI baselines assume `*_avg_season` on the latest row is the season-to-date mean *including* that game. If not, the pre-L5 baseline is slightly off. |
| **O1** | TJ (info) | The mirrored cold rule "≤ 0.25 P/GP" (1 point in 5) has no positional baseline, so many depth defencemen will show COLD. This is per TJ's choice; flagged only so it isn't a surprise. |
| **O2** | SS1 (info) | CLAUDE-065 says that without a per-game source the 4-of-5 rule is "disclosed as unavailable". When per-game points can't be proven, the rule simply doesn't fire; nothing on the card says so. A footnote is optional. |
| **F1** | SS1 (low, pre-existing since SS1-15) | The tier-list **alt text** (`SocialShare.tsx:478`) still says "ranked by points per game, goalies by quality-start percent". The tier list has ranked by L5 score × opportunity since SS1-15, and the same text is in HEAD. It should say L5 score. |
