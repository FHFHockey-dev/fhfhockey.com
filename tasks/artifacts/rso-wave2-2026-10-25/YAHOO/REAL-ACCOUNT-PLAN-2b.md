# RSO Yahoo real-account window 2b: R2–R4 plus the D7 diet comparison (ready to approve)

This supersedes the draft REAL-ACCOUNT-PLAN-2.md (left unchanged). It's a plan only: nothing here runs until TJ answers the pop-ups in §6.

**Code baseline.** Released master 0b21422db (#387), which includes:
- RSO with the diet code behind `RSO_YAHOO_DIET`, **off in production**;
- account-keyed caches;
- the bounded upkeep-lease retry (00d375839);
- the "first load always attempts" fix for the `navigator.onLine` hang.

The D4 past-lineup migration (`20261026200000_rso_yahoo_past_lineups.sql`) is **not applied**, so elapsed days are still read from Yahoo.

**Sizing source.** WINDOW-RESULTS-2026-10-26.md: one snapshot was 6 base reads + 58 discovery pages = 64. Two tabs pushed the total to about 131, past the 100 ceiling.

---

## 1. Read budget

### Per snapshot

`d` is the number of elapsed days in the current matchup week before the window date: 0 on the week's first day, up to 6 on its last. Those reads aren't cached across serverless instances, and the D4 table isn't applied.

| Situation | Yahoo reads | Where it comes from |
|---|---|---|
| Flag **off**, any snapshot (open, reload, Refresh provider, a 5-minute auto-upkeep tick while visible) | **S = 64 + d** (6 base + 58 pages + d past days) | measured 10-26 |
| Flag **on**, cold instance, or **Refresh provider** (manual bypasses every cache) | **S = 64 + d** | the cadence test in `yahooDiet.test.ts` |
| Flag on, warm instance, auto, today's roster read < 2 min old | **1** (league rosters only) | same |
| Flag on, warm, auto, roster ≥ 2 min old, availability scan < 15 min old, no ownership change | **2** | same |
| Flag on, warm, auto, scan ≥ 15 min old or league rosters changed | **3** (+1 counter re-read if ownership changed) | same |
| Flag on, warm, auto, scoreboard/counter ≥ 30 min old | 2–3 more | same |
| Goalie confirmations (`yahoo-current-data`) | flag off: **1 per planning execution** while today is in the horizon (open, refresh and each plan edit). Flag on: 0 while a roster read < 2 min old is shared, 0 when no rostered goalie plays today, otherwise 1 | `planningConfirmations.ts` |

On production, a flag-on request may land on a cold instance, so budget every flag-on snapshot at **S** and treat 1–3 as the expected case. With the flag on, the Data health panel shows `Yahoo reads this snapshot: N`, so every flag-on snapshot is counted exactly. Flag-off snapshots are counted as S each.

**Pick a window date early in the matchup week (d ≤ 2), so S ≤ 66.** The caps below use S = 70 as a safety margin.

### Window caps (hard stops, checked before every step)

| Window | Steps | Planned (S = 66) | **Cap** |
|---|---|---|---|
| **2b-A** (production, flag off) | A1–A3 | ≈ 214 | **230** |
| 2b-A optional | A4 | +70 | **300** with A4 |
| **2b-B** (D7 comparison, isolated local server) | B1–B5 | ≈ 212 | **225** |
| **2b-C** (production flag enablement smoke, only after B passes) | C1–C3 | ≈ 70–140 | **215** |

At most two windows per day, at least 60 minutes apart. Daily total cap: **455 Yahoo reads**, whatever combination runs.

**Rule:** before each step, Claude compares (running total + that step's worst case) with the cap. If it would cross, **stop and ask** instead.

### The one-RSO-tab rule (from the 10-26 overrun)

- Exactly **one** RSO tab may exist in TJ's Chrome during a window: open, hidden or in any group.
- Every visible, connected RSO tab auto-loads a snapshot, and with the flag off, every one runs a 64-read upkeep each 5 minutes.
- Claude runs `tabs_context_mcp` before each step and after any tab close (a close can dissolve Claude's tab group).
- TJ closes any other fhfhockey.com RSO tab beforehand, including ones in other windows.
- Between steps the RSO tab is **hidden** (switch to another tab) or closed. A visible idle RSO tab costs S every 5 minutes with the flag off.
- Returning to a hidden tab after more than 5 minutes triggers one snapshot (S). It's budgeted where planned and counted where not.

### Chrome `navigator.onLine` / DevTools-offline quirk

- TJ's Chrome has reported `navigator.onLine === false` while the network worked. The cause was DevTools network emulation stuck "offline" even though it showed "No throttling".
- The released fix means the first load always runs and never sticks on "Checking access…". But **timed and event-driven upkeep still pause while `onLine` is false**, which would hide the flag-on warm path.
- **Preflight (both windows):**
  1. TJ opens DevTools on the RSO tab and selects Network → throttling → "Fast 4G", then "No throttling" again.
  2. Claude reads `navigator.onLine` through the page; it must be `true`.
- If it reads false after the reset, stop. **Never clear site data**: that wipes per-account RSO workspaces.

---

## 2. Window 2b-A: R2–R4 on production, flag off (TJ's logged-in Chrome)

**Who does what**
- TJ: signs in, keeps exactly one RSO tab, does the DevTools reset, picks his own daily-league team in Planning setup, and sets League rules when RSO asks.
- Claude drives that one tab through Claude in Chrome and keeps the running read tally.
- Neither of us makes any Yahoo transaction or lineup change, accepts any OAuth scope, or touches Yahoo itself.

**Time:** an afternoon on a day an owned goalie has a game, after Yahoo posts goalie marks and before that game starts.

| Step | Action | Who | Worst-case reads | Records |
|---|---|---|---|---|
| A0 | Preflight: one tab, DevTools reset, `navigator.onLine === true`, and the provider response has no `yahooDiet` field (flag off). The Data health panel stays closed until names are scrubbed. | TJ + Claude | 0 | tab count, onLine, flag off |
| A1 (R2) | Open the single RSO tab. This runs the snapshot plus the automatic confirmations. | Claude | S + 3 | **(d) weekly counter:** present, coverage week matches the current week, horizon contained, used/limit/remaining known, remaining ≥ 0. **(e) goalie marks:** for each owned goalie with a game today, `startingStatus` present and its source; start chance becomes 1 (Starting) or 0 (Not Starting) on a verified mark; per-start line kept; `expiresAt − observedAt ≤ 120 s` |
| A2 (R3) | 60 s to 4 min after A1, one **Refresh provider** | Claude | S + 3 | **(g) reconciliation:** selected moves kept; a changed fact shows as a reconciliation issue, not a silent replacement; `suggestedSteps` null or not; refresh notice text |
| A3 (R4) | Within 4 min of A2, without leaving the tab: (1) if timing is unknown, TJ sets his league's real add timing in League rules; (2) Claude picks **one legal drop→add** in RSO's plan (details below); (3) records the gain; (4) **Undo**; (5) **reopen** = reload the tab (one snapshot). | TJ (timing) + Claude | ≤ 6 edits × 1 + Undo 1 + reopen (S + 3) | see "Legal drop→add" below |
| A3 end | Hide or close the RSO tab within 4 minutes | TJ or Claude | 0 | tab count 0 or hidden |
| A4 (optional, approved separately) | After the owned goalie's game starts: return to the tab, which triggers one snapshot, then make one plan edit | Claude | S + 3 + 1 | started game withheld: no mark applied, rows unchanged |

**Legal drop→add (A3), all in RSO's plan. Nothing is submitted to Yahoo.**
- **Add:** a player whose availability is individually verified `free_agent` (not waivers, to avoid waiver timing), with verified eligible positions and at least one scheduled game left in the horizon.
- **Drop:** a rostered player who is droppable (`canDrop === true`), not protected, not on IR, IR+ or NA, and not locked today.
- **Legality:** weekly adds remaining ≥ 1 from the verified counter (A1). If the counter is unknown, use League rules allowance only with TJ's confirmed value, and record "allowance manager-supplied".
- **Gain:** `selected − no-move baseline > 0` in startable games (Most starts) or in projected points (points objective).
- **Dropped player's loss:** the Plan details or Category gains panel shows the dropped player's lost contribution as a negative component. Check that **net gain = added player's startable contribution − dropped player's lost contribution**, within display rounding.
- **Undo:** after Undo, the selected steps are empty and the plan equals the no-move baseline.
- **Reopen:** after the reload, the saved intent matches the post-Undo state (no selected steps). The snapshot reloads with the context unchanged, and no selected step from before the Undo returns.

**Window A total:** A1 69 + A2 69 + A3 ≤ 76 = **≤ 214** at S = 66. **Cap 230**, or 300 with A4.

---

## 3. Window 2b-B: D7 diet comparison (flag off versus on)

### Where (pick in §6, question 3)

- **(Recommended) B-local.** An isolated local dev server, `cd web && PLAYWRIGHT_ISOLATED_NEXT=1 npx next dev -p 3110`.
  - Claude starts it under `/private/tmp/fhfh-heavy.lock` (noclobber, never stolen). Never port 3000 (TJ's) or a shared `.next`.
  - It talks to the real Supabase and Yahoo through the app's own authorized read routes. This is the same approved exception as 10-26, and like 10-26, a Yahoo token refresh writes the rotated token to production Supabase.
  - The flag is set **only in that process's environment** (`RSO_YAHOO_DIET=1 PLAYWRIGHT_ISOLATED_NEXT=1 npx next dev -p 3110`). Production is untouched and nothing is built on Vercel.
  - One process means the caches are always warm, so this proves correctness and agreement but not the real-world cache hit rate. Window C measures that.
  - TJ signs in on `http://localhost:3110` in his Chrome. One RSO tab, same rules as Window A.
- **B-production.** Run the same comparison on production. This needs the production env change in §4 first, and it costs a Vercel build each way. Not recommended for the comparison itself.

### Steps (B-local)

| Step | Action | Worst-case reads | Records |
|---|---|---|---|
| B0 | Preflight: heavy lock, port 3110 free, server up with the flag **unset**, one tab, DevTools reset, `onLine` true | 0 | lock, port, flag off |
| B1 | Flag **off**: open RSO, snapshot plus confirmations | S + 3 | facts **F_off** (below) |
| B2 | Stop the server, restart it with `RSO_YAHOO_DIET=1` (fresh process, empty caches), reload the one tab | S + 3 | facts **F_on**; Data health shows `Yahoo reads this snapshot: N` with N ≈ S; response has `yahooDiet: true` |
| B3 | Reload within 2 min of B2 (auto) | **expected 1** (league rosters) + 0 confirmations; stop if > 3 | N; facts unchanged; scan reused; counter and settings read times labelled |
| B4 | Reload 3–5 min after B2 | **expected 2** + ≤ 1 confirmation; stop if > 4 | N; same agreement checks |
| B5 | One **Refresh provider** (manual) | S + 1 | N ≈ S (bypass proved) |
| B6 | Stop the server and release the lock. The flag goes with the process, so production stays off. | 0 | lock released |

**Window B total:** 69 + 69 + 3 + 4 + 67 = **≤ 212** at S = 66. **Cap 225.**

### What's compared (F_off versus F_on)

Claude computes everything in the tab and records only booleans, counts and the expected-difference notes. A transient comparison object lives only in that tab's `sessionStorage` and is deleted at B6.

| Fact | Agreement criterion |
|---|---|
| Ownership: league rosters, unchanged between B1 and B2 | Same owned set (boolean, computed in page). If it changed, redo B1 once (budget permitting) or mark the run "league changed, inconclusive". |
| Owned roster resolution (D8 resolver versus legacy) | Same number of resolved roster players. **Every roster player legacy resolved, verified also resolves to the same FHFH player.** No "no unique canonical identity" limitation appears with the flag on that was absent with it off. |
| Discovery pool (both runs do the full scan, D1) | Same pages accepted and rows read. Same counts of `free_agent`, `waivers`, `rostered` and `unknown` among catalog players, **except** differences explained only by the resolver: record legacy-only, verified-only and disagreement counts. **Any disagreement (same Yahoo key → different FHFH player) fails.** |
| Eligibility | Same "both known / eligibility only / availability only / neither" counts, up to resolver-explained differences |
| League rules | Roster slots, scoring mode and weights, and goalie minimum identical |
| Weekly counter | Same used, limit and remaining, and the same coverage week |
| Add timing (D6) | **Expected difference:** off → `unknown`; on → `same_day` or `next_day` from `weekly_deadline` with the "Inferred from Yahoo weekly deadline" label (or `unknown` if absent or ambiguous). In League rules, a manager override replaces the inference. |
| Goalie marks | Same `startingStatus` for each owned goalie playing today |
| Warm reloads (B3, B4) | N within the expected 1–2 (± 1 confirmation). Facts identical to F_on, or showing only labelled, newer live changes. Cached facts show their read times. |
| Manual refresh (B5) | N ≈ S: every cache bypassed |
| Access safety | No warm reload ever returns data after an access error. If any `yahoo_access_denied` or `reauth_required` appears, the request shows the error and the next one is a full read. |

**B passes** when every row agrees: the D6 timing difference and resolver-explained pool differences are allowed, and roster coverage may not drop. A pass then allows question 5 (production enablement).

---

## 4. Turning the flag on and off in production (Window 2b-C; own approval)

`RSO_YAHOO_DIET` is read from the server environment. On Vercel, an env change takes effect only on a **new deployment**, so turning it on means:

1. **TJ** sets `RSO_YAHOO_DIET=1` for **Production** on the `web` Vercel project.
2. **TJ** redeploys the **current production commit** of that project: one web build, the same SHA as is live. Before that, Claude confirms the SHA and status of the live deployment and that no other Vercel project will build (the four-project check in AGENTS.md's Vercel rules). Claude doesn't change project settings or Git integration.
3. **Smoke (C1–C3), one RSO tab in TJ's Chrome**, under the same caps and stops:
   - C1: open (S + 3)
   - C2: reload within 2 min (expected 1–2, up to S on another instance)
   - C3: reload at 3–5 min (expected 2–3, up to S)
   - Record each N from Data health, `yahooDiet: true`, and that F_on agrees with Window B's criteria. **Cap 215.**
4. **Off / rollback:**
   - Fastest: Vercel **Instant Rollback** to the previous production deployment, which was built with the flag off. No build.
   - Or remove the env var and redeploy (one build).
   - Either happens immediately on any stop condition in C, or later if TJ chooses.

---

## 5. Stop conditions, evidence and privacy

**Stop immediately (all windows)**
- **Errors:**
  - Any `yahoo_rate_limited`, `yahoo_reauth_required` or `yahoo_access_denied` code.
  - Any non-200 from `/provider`, `/yahoo-current-data`, `/access` or `/workspace`.
  - Any 5xx.
- **Tabs and budget:**
  - A second RSO tab appears anywhere in TJ's Chrome.
  - Running total + next step's worst case > the window cap.
  - A flag-on warm reload exceeds its expected count (B3 > 3, B4 > 4) twice.
- **Browser and safety:**
  - `navigator.onLine` false after the DevTools reset.
  - Any Yahoo write path, transaction or lineup control would be used, or an OAuth or scope prompt appears.
  - Anything would require storing league, team or player names, rosters, standings or tokens.
  - Any B agreement failure (then also stop the local server). Any C anomaly (then also roll back).
- TJ says stop.

**Evidence written:** `YAHOO/WINDOW-RESULTS-2b-<date>.md`. It contains only:
- counts, booleans, field presence, read tallies per step (`N` per snapshot, request counts by route and status);
- limitation strings with names scrubbed in the page before Claude reads them (as on 10-26);
- the gain sign, the gain value and the dropped-player loss value (numbers only, no names).

**Never written:**
- names, team or league names or keys, rosters, standings;
- player ids or hashes of id sets (small sets can be reversed);
- tokens, screenshots containing names.

Response bodies are never pasted. A needed field is extracted in the page, and only its count or boolean leaves the page.

**Read tallying:**
- Flag off: S per `/provider` snapshot, and 1 per `/yahoo-current-data` call, counted from request metadata (URL, status, time).
- Flag on: N from Data health, plus confirmation calls.
- Claude keeps the running total in the results file as each step ends.

---

## 6. Approvals TJ must give (one pop-up each)

1. **Window 2b-A:** "Run Yahoo window 2b-A (R2–R4, flag off) on production in your logged-in Chrome on <date>, afternoon before your goalie's game: one RSO tab, read-only, no Yahoo changes, cap 230 Yahoo reads?" — *(Recommended) Yes, that date* / Another date / Not now
2. **Optional A4:** "After your goalie's game starts, spend up to 74 more reads (cap 300) to confirm a started game's mark is withheld?" — *(Recommended) Skip: unit tests cover it* / Yes, include A4
3. **Window 2b-B (D7):** "Run the D7 diet comparison (flag off versus on, cap 225 reads) on an isolated local dev server at :3110, with the flag set only in that process and production untouched?" — *(Recommended) Yes, local server* / Do it on production (needs question 5 first) / Not now
4. **Local-server exception for B:** "The local server uses production Supabase and your Yahoo connection through the app's own read routes; a token refresh writes the rotated token to production. Allow this, as on 10-26?" — *(Recommended) Allow for window B only* / Don't allow
5. **Production enablement (only after B passes):** "Set RSO_YAHOO_DIET=1 for Production on the web Vercel project and redeploy the current production commit (one web build), then run the C smoke (cap 215 reads), with Instant Rollback on any stop?" — *(Recommended) Yes, after B passes* / Keep it off for now
6. **Leave it on:** "If the C smoke passes, leave RSO_YAHOO_DIET on in production?" — *(Recommended) Leave it on* / Roll back after the smoke
7. **D4 (optional, independent):** "Apply migration 20261026200000_rso_yahoo_past_lineups.sql to production Supabase, so elapsed days stop costing Yahoo reads (up to 6 per snapshot)?" — *(Recommended) Not yet: after C passes* / Apply now
