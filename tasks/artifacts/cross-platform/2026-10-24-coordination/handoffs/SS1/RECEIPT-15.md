# SS1 ticket 15 receipt: reset fix, L5 ranking with roles, neon role chips, low-owned card plan

- Lane: SS1 (Claude), ticket 15, same lease. I left these read-only security files untouched:
  - AuthProviderContext + its test;
  - access.ts + its test;
  - SocialShareAccessGate + its test;
  - the page and API auth lines.
- **Base:** the SS1-14 state. All 6 previously untouched files that I edited match Codex's latest candidate pins. That includes `SocialShare.test.tsx` (`e9b2e6e3…`, Codex's returned version), which I rebuilt by reversing my edits; the hash matched.
- **Delta:** **`SS1-15.patch`** `bc07718b4703490dd8bb616c15744ce7ecb246fc446b585eb16a8d77893a8ae5`. It touches 16 files (2 new), +429/−84. Hashes are in `HASHES-15.txt`.
  - Verified in scratch: the base + SS1-15 equals all 16 working files (16/16).
- **Fixtures and mocks only; no live request.** The Node deny log (`t15/node-network.jsonl`) has 1 entry, npm's registry check. The browser blocked every non-local host, and the sign-in is the fictional `.invalid` fixture from SS1-14. TJ will refresh his own view to confirm.
- No Git, no GIT_DIR. **The :3110 slot is released:** 0 listeners at 2026-10-24T23:08:13Z.

## A. The "page resets" fix

**Cause (verified in code, reproduced in e2e):**
- When the tab becomes visible again, Supabase re-announces the session (`SIGNED_IN`).
- AuthProvider re-reads the role with `isRoleLoading` true.
- SocialShareAccessGate then swaps the studio for "Checking share studio access…", which **unmounts** `SocialShare`, so the week, days, card and edition were lost.
- The cause is not edition expiry, and not a refetch by the studio itself.

**SS1-side fix (`SocialShare.tsx`):**
- **Selection in the URL:** `?week=YYYY-MM-DD&dates=a,b,…&card=…`, via a shallow `router.replace` (no reload, no server render). It is shareable, and a reload or remount restores it. Values are validated: the week is snapped to its Monday, days must fall inside that week, and the card must be a known value for the format.
- **The edition is kept in memory, per signed-in user** (keyed by user id, format and week).
  - A remount restores it at once, with **no refetch and no blank**, while it is still current (`expiresAt` in the future). An expired or blocked edition is never reused; it reloads normally.
  - Memory only: nothing goes into browser storage, and other users' entries are dropped on mount.
- A manual refresh still never blanks the card. It keeps the current edition while loading, as before.

**Boundary request** (gate and provider are read-only for me): `BOUNDARY-REQUEST-15-GATE.md`.
- Keep `children` mounted while a same-user role re-check is pending (gate), or don't flag it as loading (provider).
- Revoked or failed role reads still close the workspace, and account switches still remount.

## B. Ranking on every player card: pickups, specialists, tier list ("streaming options")

**Score** (`lib/socialShare/score.ts`): **L5 fantasy points per game × opportunity.**
- **Fantasy values:** `fantasyPointsConfig.ts` defaults, read-only. G 3, A 2, PPP 1, SOG 0.2, HIT 0.2, BLK 0.25; goalies W 4, SV 0.2, GA −1, SO 3. The goalie read now includes `shutouts`.
- **Opportunity multiplier** = 1 + line/pair + PP + relative TOI. **These values are tunable** and live in the `OPPORTUNITY` constant:
  - L1 +15%, L2 +10%, L3 +5%, L4 0;
  - D P1 +10%, P2 +5%, P3 0;
  - PP1 +10%, PP2 +5%, none or PP3 0;
  - ±2% per minute of L5 TOI against a 16:00 (F) or 20:00 (D) baseline, capped at ±10%;
  - goalies stay at 1.
- **Specialists:** the category's L5 per game × the same opportunity multiplier.
- **Ties:** the season rate (PTS/GP; goalies QS% then SV%; specialists season per-GP), then Week Score rank, rostered % and NHL id. **The alphabetical tiebreak is removed.** Players with no recent games sort after scored ones, by season rate.
- **TJ's case** (unit test): Vilardi (1G 2A, 8 SOG, 1 PPP, 18:20) scores 2.01 and Iafallo (2G 1A, 10 SOG, 0 PPP, 14:29) 1.94, even with no line data. Raw L5 points favour Iafallo, 10.0 vs 9.6. With L1+PP1 vs L3/no PP the gap widens.

**Line and PP source:** no new table. The roles come from the existing read-only `rolling_player_game_metrics` read already used for L5: `line_combo_slot`, `line_combo_group`, `pp_unit` and `toi_seconds_avg_season`.
- They are normalised by the site's own `normalizeEvDeploymentBucket` / `normalizePpDeploymentBucket` (`lib/rankings/skaterDeploymentAggregation.ts`).
- The read is server-filtered by season, strength `all`, player ids and lookback, and is bounded and fail-closed.

**Bounded ranking pool (server):** ranking needs L5 rows, and reading them for every candidate would be unbounded. So:
1. Each list takes its top **6** by season rate, and each tier its row share **+5**. Together that is at most `RANK_POOL_MAX` = **132** players.
2. One L5 read covers that pool.
3. The pool is ranked by score and trimmed to the shown players.
- Pool players who aren't shown never leave the server. The exposure cap stays `TRIMMED_PLAYERS_MAX` = 66.
- Tier counts still come from the full layer, so "+N more" is exact.
- `bounded()` now pages at no more than 1,000 rows (the API's response cap) with the same exact-count check, so a 132-player read (~1,300 rows) is complete rather than truncated.
- **Limitation:** a player outside a list's season-rate top 6 can't reach the card even with a great L5. The pool depth is a tunable constant.

**On the cards:**
- The big stat is now the **L5 SCORE** (pickups) or **{CAT}/GP L5** (specialists). The tier rows' right column shows **SCORE**. Each falls back to the season rate when there are no recent games.
- The L5 line shows **relative TOI** against the player's season average, e.g. `18:20 +1:05`.
- The full formula is printed in each player card's footer and is built from the same constants. A test checks it states the config values.
- Alt text describes the new ranking.

## C. Neon role chips

- **Chips:** L1/L2/L3/L4 are green/yellow/orange/red; P1/P2/P3 green/yellow/red; PP1/PP2/NO PP green/yellow/red.
- **Style:** brand neon. A solid 1.5px outline and the text in the role colour, a translucent fill of the same colour over a dark backing, and a soft glow. Brand colours: `$success-color`, `$warning-color`, `$color-orange`, and `#ff5c5c` (the existing count-tier red).
- **Placement:** on pickup and specialist tiles beside the stat, and in tier rows after "TEAM · POS" (smaller). Skaters only, and only when deployment data exists.
- **Layout change:** tier rows are now 35px instead of 36px, so the widened card still fits with the formula line.

## D. Plan only

`LOW-OWNED-HIGH-OPPORTUNITY-PLAN.md`: qualifiers, bands (25–49%, under 25%), L1–L2 + PP1, ranking, layout, the pool constraint with options, tests, and 3 open questions. No code.

## Tests

- **Unit (Vitest)** `lib/socialShare/` + `components/SocialShare/`: **141/141** (`t15/vitest.log`).
  - `score.test.ts` (new, 4): **the Vilardi/Iafallo case**, with and without roles; the default fantasy values for skaters and goalies; the printed formula matching the config; the opportunity multiplier and caps; unscored players sorted last and season-rate ties, never alphabetical.
  - `schedule.test.ts`: the recent read covers only the bounded pool (≤ 132), and every shown player is in it. New: a fourth-by-season-rate player with the best L5 leads its list after the pool re-rank, carrying its L2 role and season TOI.
  - `tiers.test.ts` (+1): each tier's skaters are in score order, scored before unscored.
  - `SocialShare.test.tsx` (+2): **URL restore** (week, days and card drive the first request) and a **remount restoring the edition with no second API call**; the selection is written to the URL with a shallow replace.
  - `players.test.ts` / `playerSources.test.ts`: recent rows carry roles and shutouts; pages are capped at 1,000 rows.
- **E2E** `e2e/social-share.spec.ts`: **28/28**.
  - **New #28:** select days and the tier card, then fire the tab-return event. The role re-check happens (fictional role reads go up), and the week, days, card and edition remain with **no new edition request**. A reload restores the same selection from the URL.
  - Pickups now also assert the L5 SCORE, the printed formula and the role chips; specialists assert the L5 stat and their formula.

## Pinned PNGs (all 22 asserted; repeated identically, `t15/run-a` vs `t15/run-b`, and in the final pinned run)

| Set | Status |
| --- | --- |
| Grid, Easiest, Streaming (Monday and Wednesday); Tuesday 4 | **unchanged** (10) |
| Pickups ×3, Specialists, Tiers ×2, Monday and Wednesday | **new** (12), by design: score, chips, formula, relative TOI, shorter L5 line. E.g. Monday pickups 30–49 `ddd483ac…`, specialists `7ef95132…`, tiers `18e6808c…` / `f7d382f8…` |

The full values are in `t15/pinned-env.txt` and `t15/evidence/*.sha256`.

## Checks run

- Vitest 141/141. Playwright (mocked) 28/28 with 22 pins, on my isolated :3110 server (`PLAYWRIGHT_ISOLATED_NEXT=1`) under the deny preload and the fictional `.invalid` Supabase host.
- **CSS pure check:** PURE OK (`t15/css-pure-check.log`). **ESLint** on the 15 touched TS/TSX files: exit 0.
- **Full `tsc --noEmit`** (8 GB heap, heavy lock): only the 2 pre-existing Luna errors (`t15/tsc.log`).
- **Not run:** any live request, build or deploy.

## Not covered or open

- **Live data quality:** live `line_combo_slot` / `pp_unit` coverage and the real Vilardi/Iafallo outcome, which depends on their live L5 rows. TJ's refresh is the check.
- **Weights and pool depth:** the opportunity weights and the pool depth are my proposal; TJ may want them changed.
- **The gate itself:** fixing it at the source needs the boundary request above. Until then, the studio's restore covers it.
