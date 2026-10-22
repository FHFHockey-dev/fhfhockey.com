# RSO R5–R8 diary (Claude, 2026-10-20)

## Scope
Chef ticket (local_60e96358): Stage 1 R5 — planner admission requires an independently fresh schedule witness at planning time (forecast refresh can't revive an expired schedule; distinct clocks; explicit repair messaging). STOP + report uncommitted.
Stage 2 R7+R8 — design only: tasks/artifacts/rso-r7-r8-2026-10-20/DESIGN.md. STOP for TJ approval.
Owned: web/lib/rosterScheduleOptimizer/** + tests; web/lib/rosterScheduleData/planning.ts(+test).

## Where
octoberBranch @ e24b43712 (R8 synced). No commits (Chef commits). Prior R1–R3 shipped in R7 986144844.

## State
- R5 RED: refreshForecastInputs.test "does not let a forecast refresh revive a schedule witness that expired before planning time" — stale baseline was still comparisonEligible with projectedValue 10.
- R5 fix (planning.ts only): scheduleAdmissionProblem(snapshot) — complete AND schedule.asOf finite, <= context.asOf, and context.asOf - schedule.asOf < 36h (matches canonicalSchedule validUntil). Used for opportunitiesComplete (projection/recommendation admission) and the drop-swap AGP admission. Messages distinguish incomplete / no observation time / expired, each with "Reload the schedule; a forecast refresh does not renew it."
- R5 GREEN: vitest lib/rosterScheduleOptimizer/ + lib/rosterScheduleData/planning.test.ts → 15 files, 492 passed. Consumers (components/RSO, __tests__/components/RSO, forgeDailyBridge, yahoo rosterPlanning, player-forecasts, in-season) → 47 files, 1718 passed. tsc (heavy lock) exit 0.

- Chef correction (release safety). Trace: all three snapshot paths (manual RSO.tsx:615 master/616 HEAD, retained workspace.ts:287, Yahoo rosterPlanning.ts:406) take evidence.schedule from planningInputs (master :124-129, HEAD :167-172): complete only with no scheduleProblems, which requires timestamps[0] (oldest fetched_at) <=36h at load, so complete ⇒ asOf present on both. Planning clock: Yahoo now (rosterPlanning:404), manual = last edit (RSO.tsx:344, restored workspaces keep an old asOf), retained = lastUpdated, forecast-expiry clock (RSO.tsx:632-636), refreshForecastInputs checkedAt. Saved snapshots allow asOf null (workspaceSchema:17).
- Risk found: my "witness after planning time" block would hit restored manual workspaces / clock skew. Chose (b): legacy no-asOf → admit + note; newer-than-planning witness → admit; expired → block.
- Correction RED: refreshForecastInputs.test "keeps legacy schedule evidence without an observation time usable, with a visible note" (was blocked). GREEN after fix. Added data-path proof in rosterScheduleData/planning.test (complete ⇒ asOf = oldest fetch) — passes on HEAD (proof, not red→green).
- Checks: owned 15 files/493 passed; consumers 47 files/1728 passed; tsc exit 0.

- Stage 2 done: tasks/artifacts/rso-r7-r8-2026-10-20/DESIGN.md (current-state map w/ file:line, R7 group-level drop ordering + caution, R8 gain/sacrifice breakdown reusing categoryResults/forecastInputs, wording table W1–W12, 5 TJ decisions). No code.
- R5 gap found during design: candidatePlanMetrics.ts:124 scheduleKnown still uses completeness only, so Best Fit netAGP can still show for an expired schedule. Not fixed (budget); flagged to Chef.

- R5 + DESIGN committed by Chef as 767764471. TJ approved defaults (50% high demand, 3-day fresh, exact-tie-break only, one drop order, R8 per-category gains/losses). Implement W1–W12 exactly.
- New stage order: (A) R5 gap candidatePlanMetrics scheduleKnown → scheduleAdmissionProblem; (B) R7 retention.ts + unify orderings; (C) R8 explanation slice. Now also own CandidateCard, CandidateBrowser, CategoryGains, RosterPlayerRow, BenchDecisions + tests. workspaceSchema stays R6 owner (stop if schema field needed).

- Stage A RED→GREEN: refreshForecastInputs.test "shows no Best Fit net games or points once the schedule witness has expired" (stale plans had net values). Fix: export scheduleAdmissionProblem; candidatePlanMetrics scheduleKnown + reason use it. 33 files/861 passed.
- Asked Chef (one msg): W2 stale "last known" needs strict workspaceSchema player field → defaulting to skip W2 (stale = unknown) until R6 owner adds `ownershipEvidence`.
- Stage B (R7): new retention.ts (+test): HIGH_DEMAND 50, providerListsOut moved here, knownOwnership, retentionCaution, dropEligible, reservedPlayerIds, orderDropCandidates (group-level ownership tie-break), droppedOwnership, dropContribution, ownershipLabel/retentionCautionText/OWNERSHIP_TIE_NOTE (W1,W4,W5,W6).
  RED: planning.test "offers the same less-rostered drop on the chip, in candidate proposals and in Best Fit swaps" + "keeps and shows the less-rostered drop among exactly equivalent plans, whatever the ids"; CandidateCard.test R7 caution test; new RosterPlayerRow.test. GREEN after wiring lineupGaps, candidatePlanMetrics (dropOrder, droppedOwnership, dominance keeps different-drop ties, group reorder in candidatePlanForSort, ownershipBrokeTie), planning (extensions dropEligible+order, planRoster dropOrder from no-move contribution, orderStates ownership in equivalence groups), RosterPlayerRow/CandidateCard UI, W1 in RosterScheduleOptimizer.tsx:1078 (clean file, one line).
  Updated expectations: lineupGaps bestDrop gains caution; dailyDecisionReplay x keeps both tied drops (b,a) and still shows a (unknown ownership).

- Stage C (R8): planning.ts swapCategoryBreakdown + CategorySwapRow (gain/sacrifice per player delta; ratios pooled with component nets; incomplete with reason; null when not comparable or goalie forfeiture). CandidatePlan.categoryBreakdown. CategoryGains (W8–W11, snapshot prop), CandidateCard W12, CandidateBrowser W7.
  RED: planning.test R8 block (4 tests, function missing); UI tests proved red by running against HEAD component copies, green on mine.
  Updated CategoryGains tests: forecast-problem cases now W10 "Incomplete: …"; opponent-missing now shows W8 (approved change).
- Checks: vitest RSO/data/components/__tests__ RSO/yahoo/in-season/player-forecasts → 68 files, 2280 passed; tsc exit 0 (lock); eslint 0 errors (6 pre-existing warnings in RosterScheduleOptimizer.tsx); CSS pure check ok for both edited modules.
- Shots: tasks/artifacts/rso-r7-r8-2026-10-20/shots/*.png (5) from fixture scenes rendered via a temporary vitest harness + local headless Chromium; no dev server, no network.
- Wording deviations to report: W8 fragment "gain g / sacrifice s" also shown as its own line when an opponent exists; ratio rows without opponent omit gain/sacrifice; W12 ratio = "{key} {Δ} (pooled)"; W2 not implemented (schema). W6 on candidate cards only (planner alternatives get the ordering but no note).

- Chef: option (1) confirmed; W2 sequenced, not dropped. R6 owner (local_27758367) is adding an optional strict `ownershipEvidence { value 0..100|null, observedOn date|null, provider "yahoo"|null, status fresh|stale|unknown }` to workspaceSchema player.

- Added optional `ownershipEvidence?` to PlanningPlayer (planningTypes.ts) per Chef; nothing sets it yet, so strict saves are unaffected. tsc exit 0.

- W2 done after R6 schema landed (uncommitted, R6 owner's file untouched). Loader: ownershipPct (number or plain numeric string, 0–100), future dates rejected, fresh (≤3 days) → ownership, older fetched row → ownershipEvidence status "stale" (only stale rows carry evidence, to keep payload small). retention: "stale" caution level (no text, no tie-break), ownershipLabel "Ownership {x}% · last known {date}".
  RED: rosterScheduleData/planning.test W2 loader test (numeric string, stale); retention.test W2 label. Round-trip test passes as proof (schema already landed). GREEN all: 68 files/2283 passed; tsc 0; eslint clean.
  Transport planningDataTransport players are .passthrough(), so evidence reaches the client.
  Limitation: loader still reads only the last 3 days, so "last known" appears only when the newest row is just past the cutoff (e.g. a stalled ownership job). Wider history = more rows read (cost decision).
- Shots (6): fixture-rendered via temporary vitest harness + local headless Chromium (no dev server: the live RSO page reads Supabase through the data route).

- R8 correction (Chef): ratio display by unit. New lib/rosterScheduleOptimizer/categoryFormat.ts (no existing formatter found): percentage ratios (key ends "%") 1-dp % with Δ in "pts" (multiplier ≥100 = already percent); other ratios 2 dp; counts unchanged. CategorySwapRow gains `multiplier`. Used in CategoryGains (change, pooled, opponent lines) and CandidateCard W12 ratios; components stay counts.
  RED: CategoryGains W8/W9 test + goalie ratio test (SV%/GAA strings) + CandidateCard W12 (SH%, GAA). GREEN: 68 files/2283 passed; tsc 0; eslint clean. Regenerated r8-category-gains-no-opponent.png and r8-candidate-category-line.png.

- Lane committed by Chef as dad7c619f. Master patch built: tasks/artifacts/release-r10-2026-10-21/RSO-R7-R8-master.patch (sha256 a6a68f97…59b9e7) + RSO-R7-R8-master.md. Scratch export b5e801d8f: apply-check PASS (tree identical), 47 files/1298 passed, tsc 0, pure ok, G1 guard PASS (checks 1,2,4; check 3 manual: no reader files touched).

## Next
Lane done after report; Chef releases. Retire this diary once the release is recorded.
