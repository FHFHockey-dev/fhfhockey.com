# C7 independent pre-production review — SS1-12, SS1-13, SS1-14, SS1-15 (release gate)

**Reviewer:** Claude C7 lane session (not the author). Read-only, built from code, mocks and SS1's recorded evidence:
- no live requests, no server, no source edits, no Git;
- every test ran under the network-deny preload, with the heavy lock held and then released.

Evidence is in `r15-evidence/ss1-12-15/`.

## Verdict per patch

| Patch | Verdict |
| --- | --- |
| **SS1-12** `e7e5d226…` GP/OFF colour tiers | **Accepted.** Matches TJ's rule (CLAUDE-040) exactly. |
| **SS1-13** `e0a1a46c…` tier list | **Accepted.** Strict tiers are exact (GP, OFF) pairs; widen folds the next pairs; no team is in two tiers. |
| **SS1-14** `7f87b795…` live tier rows + e2e | **Accepted.** The trim keeps only shown players (≤ 66), nothing hidden leaks, and the security files are untouched. |
| **SS1-15** `bc07718b…` reset fix, L5 ranking, roles, chips | **Accepted with findings.** F1 and F2 should be fixed before or soon after the push. F3 and F4 are copy only. None is a data-safety or exposure problem. |
| `LOW-OWNED-HIGH-OPPORTUNITY-PLAN.md` | **Plan-only, confirmed.** No code, and no LOHO symbol anywhere in `lib/socialShare`, `components/SocialShare` or the patch. It ends with open questions for TJ. |

## Pins and chain

- **Hashes:** all four patch hashes match CLAUDE-053.
- **SS1-15:** `git apply --check --reverse` is clean on the canonical tree, and `HASHES-15.txt` is **16/16 OK**.
- **Chain, in scratch** (copies of the 15 touched files, outside `web/`):
  - reversing SS1-15 reproduces `HASHES-14` **9/9**;
  - then reversing SS1-14 and SS1-13 reproduces `HASHES-12` for every file except `schedule.test.ts` and `SocialShare.test.tsx`. Those are the Codex-held test files returned under CODEX-056/-057. After reversing SS1-14, `schedule.test.ts` = `29a8d4f8…`, Codex's returned hash.
- **Security files** against Codex's `latest-social-access/CANDIDATE.json`:
  - **OK:** `AuthProviderContext/index.tsx`, `SocialShareAccessGate.tsx` + test, `access.ts` + test, the page `[format].tsx` and the API `[format].ts`.
  - **One drift, not SS1's:** `__tests__/contexts/AuthProviderContext.test.tsx` is `4b37b6d2…` against the candidate's `c3cf3f66…`. It was last written at 16:59:51 (Codex's social-access edit window), it is in no SS1 patch, and CLAUDE-047 records it as the "merged canonical … pending" file. **Codex should pin the intended bytes before composing.**
- **`fantasyPointsConfig.ts`:** unmodified (clean in git).

## Tests run by me

**Vitest: 151/151** (`ss1t15.json`).
- SS1's **141**, reproduced:
  - SocialShare 3, AccessGate 10, access 24, editionFetch 15;
  - matchups 9, mondayGrid 9, playerSources 5, players 12;
  - schedule 33, score 4, teamRates 3, tiers 8, trends 6.
- **My 10 controls:** `ss1T15.test.ts` (6, node) and `ss1T15ui.test.tsx` (4, jsdom). Results are in `ss1t15-observed.json` and `ss1t15ui-observed.json`.
- **Run 1 is kept** (`ss1t15-run1.*`): my URL-validation control failed there, and that failure is finding F1. I split it into a finding control (M3) and a fallback control (M4).

**E2E:** not rerun; it needs a server.
- SS1's `t15/results.json`: **28 expected, 0 unexpected, 0 flaky**.
- I re-hashed all **22** pinned PNGs in `t15/evidence/` against their `*-pinned.sha256`: **22/22 match**.
- `t15/node-network.jsonl` holds 1 entry, npm's registry check, which was denied.

## 1. SS1-12: GP and off-night colour tiers (TJ's rule, CLAUDE-040)

- **TJ, direct:** "most GP … green … all 3GP teams are white, if there is a 1GP team it will be red and 2GP teams would then be yellow, but if 2GP is the least that would be red. Same for Offnights."
- **Code:** `countTiers` gives highest → green, 2nd → white, lowest → red, anything between → yellow. One value is neutral; ties share a tier. It is applied separately to the GP and OFF columns over the edition's rows.
- **My K1:**
  - TJ's examples give 4/3/2/1 → G/W/Y/R, 4/3/2 → G/W/R and 5/4/3/2/1 → G/W/Y/Y/R;
  - 500 random 32-team columns against my own encoding of TJ's words: **0 mismatches**;
  - the orchestrator's assumed edges (two values → G/R, one value → neutral) hold.
- **Note:** teams with 0 GP take part. On a Wednesday edition where a team has no Thu–Sun games, a 1-GP team is yellow, not red, because 0 is the lowest value. That fits "the least is red", but TJ's sentence names 1 GP as red, so it is worth one line to TJ.

## 2. SS1-13 and SS1-14: the tier list

- **Strict tiers are exact pairs (T1):**
  - in every tier and both modes, each team's (GP, OFF) equals its pair, and no team appears in two tiers;
  - strict mode has one pair per tier; widened mode has T1 alone, then T2 = pairs 2–3 and T3 = pairs 4–5;
  - pairs are ordered by Week Score, TJ's pop-up choice in SS1-13. So strict T3 can be 4/1 ahead of 3/2, as the receipt says.
- **Server trim and cap (P1, real server code with mocked sources):**
  - one recent read over a **69-player** pool (≤ `RANK_POOL_MAX` 132);
  - **37 players** shown (≤ `TRIMMED_PLAYERS_MAX` 66);
  - **32** pool-only players, and **0** of their names in the JSON;
  - every card's players come from the scored pool;
  - tier rows render in score order;
  - `tierCounts` strict [2, 14, 33] and widened [2, 47, 96] drive an exact "+N more".
- **Stale layer (P2):** 0 players and no `tierCounts`.
- **The e2e sign-in:**
  - It seeds a fictional session into the Supabase client's own storage key, answers a fictional `*.invalid` host, and refuses and records writes.
  - The spec asserts the host ends in `.invalid` before running. The real AuthProvider, gate and editionFetch run unchanged, with no app flag or bypass.
  - It is the same mechanism as Codex's CODEX-058 helper, but **not that helper's file**: SS1 says the helper hard-codes :3140 and patches an older spec hash.
  - Negative test #27 shows the gate blocks signed-out and no-role users, with 0 API calls and 0 writes.
  - Codex should confirm this counts as its "supported approach" (CLAUDE-047).
- **Security files untouched:** see "Pins and chain" above.

## 3. SS1-15

### A. Reset fix

- **Root-cause analysis: correct.** I verified each step in code:
  - auth-js **2.89.0** `_onVisibilityChanged` → `_recoverAndRefresh()`; for a valid session that isn't near expiry, it ends in `_notifyAllSubscribers('SIGNED_IN', currentSession)` (`GoTrueClient.js`);
  - `AuthProviderContext` `onAuthStateChange` → `syncUserFromSession`, which keeps the same user's role but calls `setIsRoleLoading(true)`;
  - `SocialShareAccessGate.tsx:8` returns the "Checking share studio access…" paragraph whenever `isLoading || isRoleLoading`, unmounting `children`.
  - `BOUNDARY-REQUEST-15-GATE.md` option 1 is the right minimal source fix, and it is Codex's file.
- **Selection persists:** week, dates and card go in the URL via a shallow `router.replace`, keeping the dynamic `format` key.
  - **M4:** out-of-week and malformed dates and an unknown card (`javascript:alert(1)`) fall back to defaults. The first request is `weekStart=<week>` with no `selectedDates`, and the card is `grid`.
- **A usable edition isn't blanked:** the module memory is keyed `[userId, format, week]`, and only an edition with `expiresAt` in the future is restored. The owner test proves remount restores with no second API call.
  - **M1:** user B after user A refetches with B's bearer and never sees A's edition.
  - **M2:** an expired remembered edition is refetched on remount.
  - Nothing is written to browser storage.
- **F1 (to SS1, medium-low): an impossible `week` in the URL crashes the studio.**
  - `initialSelection` only regex-checks `week`, then calls `calendarWeekStart("2026-13-99T16:00:00Z")`. That throws "Invalid as-of timestamp." inside a `useState` initializer, so the studio component throws during render (M3 reproduces it) and there is no error boundary.
  - Months 13/00 and day 32 throw. Feb 30 rolls over silently to March 2.
  - The URL is now the shareable selection, so a mistyped or hand-edited link kills the studio until the query is removed.
  - **Fix:** check `Number.isFinite(Date.parse(…))` before snapping, else use the default week.

### B. Fantasy-point ranking on every player slide

- **Defaults, read-only:** the score uses `DEFAULT_SKATER_FANTASY_POINTS` (G 3, A 2, PPP 1, SOG 0.2, HIT 0.2, BLK 0.25) and `DEFAULT_GOALIE_FANTASY_POINTS` (W 4, SV 0.2, GA −1, SO 3) by key. The printed formula is built from the same constants, and V1 asserts its text.
- **Vilardi outranks Iafallo (V1):** my own arithmetic equals `playerScore`.

  | Case | Vilardi | Iafallo |
  | --- | --- | --- |
  | No line data | **2.0096** | 1.9393 |
  | With L1 + PP1 vs L3 / no PP | 2.4896 | 2.0393 |

  `scoreOrder` puts Vilardi first.
- **Observation for TJ:** without roles, Vilardi wins **only through the TOI term**. Raw L5 fantasy points per game favour Iafallo, 2.00 vs 1.92, and the multipliers are 1.047 vs 0.970. Live line and PP coverage decides the real margin.
- **Two meanings of "relative TOI":** the **score** uses L5 TOI against a fixed 16:00 F / 20:00 D baseline. The **card** prints L5 TOI against the player's *own* season average (`18:20 +1:05`). Both are labelled, but a reader may assume the printed delta feeds the score. Ask TJ which one he meant.
- **Scope:**
  - covered: pickups, specialists and both tier modes, Monday and Wednesday;
  - not covered: the Tuesday trend cards. They keep their delta rankings and are still not connected live. Confirm with TJ that "all player slides" excludes them.
- **Role source: real columns.** `rolling_player_game_metrics.line_combo_slot` (number), `line_combo_group` (string), `pp_unit` (number) and `toi_seconds_avg_season` all exist in `database-generated.types.ts`, and so does `wgo_goalie_stats.shutouts`. They are normalised by the site's own `normalizeEvDeploymentBucket` / `normalizePpDeploymentBucket` (`lib/rankings/skaterDeploymentAggregation.ts`), from the same bounded read. No new table.

### C. Neon role chips

- **Colours:** L1–L4 are green/yellow/orange/red, P1–P3 green/yellow/red, and PP1/PP2/NO PP green/yellow/red. They use `$success-color`, `$warning-color`, `$color-orange` and `#ff5c5c`.
- **Style:** a role-coloured outline and text, a translucent fill on a dark backing, and a glow. That fits the brand sheet's "Neon Noir" accents.
- **Brand note:** `#ff5c5c` is a literal (the existing count-tier red), not a brand-sheet token. The sheet has no red token.
- **Viewed:** `monday-pickups-50-pinned.png` (30–49%) and `monday-tiers-wide-pinned.png`. The chips match the rule, and nothing overflows.
- **Contrast nit:** on white team bands (TOR) the dim L4 chip has low contrast.

### D. New reads

- **Bounded and fail-closed, with no writes (Q1, real loader):**
  - 132 ids → `rolling_player_game_metrics` limit **1680** (120 × 14), read as `[0,999]` + `[1000,1679]` with the same exact count on each page;
  - `wgo_goalie_stats` `[0,167]` (12 × 14);
  - 0 write calls; the select lists exactly the columns above.
- **Recent-read failure (P2):** gives `recentState: "unavailable"`. The SS1-11 fix is retained.
- **No reads when they shouldn't happen:** **0** recent reads on a schedule failure, partial schedule, Tuesday or stale players.
- **Latent fix:** the 1,000-row page cap fixes a bug in SS1-10/14. A Yahoo source over 1,000 rows (32 teams) used to fail closed on the API's response cap; it now pages.
- **F2 (to SS1, medium-low): multi-page recent reads have a non-unique sort.**
  - The rolling and goalie reads order only by `game_date` / `date`, and many players share a date. Until ticket 15 they always fit on one page. At pool size they now span two pages (`[0,999]`, `[1000,…]`).
  - With `OFFSET` paging on a non-unique order, Postgres doesn't guarantee a stable split, so a page boundary can **duplicate one row and skip another**. That passes the `rows.length === count` check silently.
  - The effect is an older or missing L5 row for a player.
  - **Fix:** add a unique tiebreak, `.order("player_id")` / `.order("goalie_id")` after the date.
  - The Yahoo (`player_key`) and skater-totals (`player_id`) orders are unique per season, so they are fine.
- **F3 (to SS1, low, copy):** the tier-list footer says "ranked by L5 score", but each tier lists skaters before goalies, on different score scales. In the widened PNG, Tier 1 shows WSH-4 at 3.12 above WSH-10 at 6.80. Suggested wording: "skaters, then goalies, each by L5 score".
- **F4 (to SS1, low, copy):**
  - a PP3 player's chip reads "NO PP";
  - a skater with a known line but a null `pp_unit` also reads "NO PP", although null can mean "no PP data".
  - Suggested fix: "PP3" for PP3, and no PP chip when the unit is unknown.

## Cost and safety

- **Caching is off:** the route now sends Codex's `private, no-store, max-age=0` (`access.ts:4`). `shareCacheControl` is no longer applied, so **every editor load is uncached**.
- **Upstream reads per load:**

  | Read | Count |
  | --- | --- |
  | NHL | 1 |
  | `nst_team_stats` | 1 |
  | Yahoo | 1–2 pages |
  | Skater totals | 1–2 |
  | Goalie totals | 1 |
  | Map chunks | ⌈2R ÷ 150⌉, sequential |
  | Recent | ≤ 3 |

  - **Typical: ~17–20. Worst: ~37.** SS1-10's figures were ~15–17 and 34.
  - The audience is role-gated, so this is acceptable, but it is the full cost on every editor visit.
- **Safety holds:**
  - no writes;
  - only shown players leave the server;
  - no Yahoo keys or timelines in the JSON;
  - every source read is bounded;
  - any failure keeps names out and degrades the cards.

## For the composer (Codex)

- Compose from the CLAUDE-053 chain. SS1-15 equals the tree.
- Pin the intended `AuthProviderContext.test.tsx` bytes; the canonical file differs from your candidate.
- F1 and F2 are small SS1-side fixes. Whether they gate the push is TJ's and the orchestrator's call; neither is a security or exposure issue.
- The live paths, including the L5 roles and the Vilardi/Iafallo outcome on real rows, are still not live-verified; TJ confirms by refreshing his own view.
