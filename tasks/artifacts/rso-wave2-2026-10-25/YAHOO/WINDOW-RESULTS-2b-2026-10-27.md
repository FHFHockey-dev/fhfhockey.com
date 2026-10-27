# Yahoo window 2b-A results, 2026-10-27 (production, flag off, TJ's Chrome via Claude in Chrome)

Plan: REAL-ACCOUNT-PLAN-2b.md §2, with AMENDMENT-01. Released master 598942a78 (#393). `RSO_YAHOO_DIET` isn't set for Production (checked with `vercel env ls production`, names only). The evidence is counts, booleans and scrubbed strings only. No league, team or player data is recorded.

## Approvals and deviations (all by TJ pop-up on 10-27)
- 2b-A today, cap 230. A4 skipped.
- **Deviation 1 (two tabs):** TJ's own RSO tab was outside Claude's tab group, so Claude couldn't close it. TJ approved running in a new tab of Claude's, with every RSO request from either tab tallied from Vercel request logs. Over the prior 3 h, TJ's tab made only `access` polls, every 5 min until 11:12Z, and no `provider` or `yahoo-current-data` calls. During the window, the server log shows no Yahoo-reading request beyond Claude's own.
- **Deviation 2 (offline flag):** `navigator.onLine === false` even in Claude's fresh tab, which never had DevTools open. That contradicts the DevTools-only explanation. TJ approved going ahead with manual Refresh provider only.

## Read tally (server-side, Vercel request log 11:55–12:07Z)
| Route | Count | Yahoo reads |
|---|---|---|
| `provider` (S = 64 + d, d = 1) | 3 | 195 |
| `yahoo-current-data` | 10 | 10 |
| **Total** | | **205 / cap 230** |

All responses were 200. No `yahoo_rate_limited`, `reauth_required` or `access_denied` errors.

## A0 preflight
| Check | Result |
|---|---|
| Flag off in production | ✅ (env var absent) |
| One RSO tab | ⚠️ deviation 1 |
| `navigator.onLine` true | ❌ false (deviation 2) |

**First-load behaviour while offline:** the load ran `access` + `workspace` + `yahoo-current-data` and showed "Saved roster · refresh to sync". There was no provider snapshot, so A1 needed a manual refresh. The later reload (A3 reopen) did run a provider snapshot.

## A1 (R2): one Refresh provider, 11:59:55Z
| Check | Observed | Result |
|---|---|---|
| (d) Weekly counter | "Planned adds: 0 · yahoo-week-5: 3 remaining (provider) · Week 5: 1 used (Yahoo)". Header: "Synced · 3 adds left this week". Matchup range: "Yahoo matchup dates", Mon Oct 26 – Sun Nov 1 (current week) | ✅ used 1 / remaining 3 (limit 4 implied); coverage week = current week; remaining ≥ 0 |
| (e) Goalie marks | One owned goalie has a game today. No Yahoo mark rendered ("Starting/Not starting (Yahoo, read …)" absent everywhere). The cell shows FORGE "Likely starter (97%)" | ⚠️ **not observed**: either Yahoo hadn't posted a starting status by 8 a.m. ET, or it wasn't parsed. Not distinguishable from the page. |
| D6 add timing (flag off) | Data health: "Add timing is inferred from Yahoo's weekly deadline (same-day)…" | ✅ #393 live |
| League-rules limitation | Names only add-timing confirmation, reset time and goalie-minimum counting. FAAB/waiver mode is no longer listed as unreported | ✅ |
| Discovery | 58 pages attempted / 58 returned / 56 accepted; 1384 rows, 1384 unique, 0 repeats; 5978 ms of 8000; "Stopped: end of list". 815 catalog matches, 569 unmatched; catalog 848: 815 both known, 33 neither | ✅ matches 10-26 |

## A2 (R3): one Refresh provider, 12:01:56Z (2 min after A1)
| Check | Observed | Result |
|---|---|---|
| (g) Refresh notice | "Provider inputs refreshed. Selected moves were kept." | ✅ |
| (g) Reconciliation | No issue with no selection. Once a move was selected (A3), the refresh banner showed "Provider refresh found 1 item(s) to review. Selected moves were kept…" with "Accept suggested repair", which is explicit, not a silent replacement | ✅ |

## A3 (R4): legal drop→add, Undo, reopen
- **Inputs:** Preview swap buttons were disabled until the session-only "Confirm planning inputs" was pressed. Claude pressed it under TJ's delegation; it isn't persisted and saves nothing.
- **Candidate:** the selected card was verified FA with no "Recheck availability" warning and showed +6.1 net points. Weekly adds remaining = 3.
- **❌ Defect RSO-2b-A3 (blocks R4):** a Preview-swap selection can't stay legal.
  1. Right after the selection, the timeline rejects it: "Selected moves are not legal on the refreshed timeline: Future acquisition add:…:2026-10-27:drop:… must be conditional on availability recheck." The step's `at` (8:03 a.m. ET) is later than the snapshot `asOf`, but `conditional` is false.
  2. A few seconds later, after the automatic confirmation re-read, reconciliation reports "Selected action time has passed; review this step." The suggested repair removes the step (Planned adds 0).
  3. Projected points therefore never show the swap. They stayed 152.2, or showed "—" while recomputing.
  4. Plan alternatives listed only "Hold roster".
  5. Net-gain and dropped-player loss checks: **not verified**.
- **Undo:** works. The first Undo restored the removed step (Planned adds 1, "Next selected action … Selected action time has passed"). The second returned to the no-move baseline (Planned adds 0, "No acquisition selected"). ✅
- **Reopen:** after the reload, "Planned adds: 0 · … · Week 5: 1 used (Yahoo)", "No acquisition selected". No pre-Undo step came back. ✅
- **A3 end:** the RSO tab was navigated away at about 12:07Z.

## Open items
1. **RSO-2b-A3 defect.** A same-day Preview swap step is created with `at` after the snapshot `asOf` but not conditional, then goes stale against the wall clock or refreshed `asOf`. Needs a fix and regression test; then R4 is re-run.
2. **(e) goalie marks unverified.** Re-check with one Refresh provider (S + 1) later in the day, closer to game time.
3. **`navigator.onLine` false without DevTools.** Window 2b-B needs it true for the warm-path checks (plan §1).
