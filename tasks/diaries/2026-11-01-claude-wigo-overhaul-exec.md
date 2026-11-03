# WiGO Charts overhaul: executor diary

- **Scope:** implement PLAN.md (tasks/artifacts/wigo-charts-overhaul-2026-11-01/) D1-D13, S1-S9, U1-U12. Local code only; production steps are TJ's, by pop-up.
- **Where:** /Users/tim/Code/fhfhockey.com, octoberBranch, base 69e64976c. Session started 2026-11-03.
- **State:** brief read. WiGO paths clean at start; `web/lib/cron/withCronJobAudit.ts` dirty from another lane (do not touch). Coordination JSON files dirty from others.
- **Checks:** Axe MCP down (CONNECTION_CLOSED) at start: report as not run.
- **Lease:** TJ approved (pop-up): WIGO-UI-PASS released, WIGO-OVERHAUL opened in CLAUDE-LEASES.json (file was already dirty from others; not committed).
- **Commits:** D1 93b29d61e, D2 324998902, D3 d6727a5b3 (one writePeriod builder for STD/LY/3YA/CA), D4 a74858160, D5 6312453b7, D6 6bbd27945. calculate-wigo-stats.test.ts 44/44.
- **Stage 1 done:** D7 b408260b3, D8 078490fbc, D9 89fc6eb52 (fetchPlayerAggregatedStats now returns {rows, freshness}), D10 cc0d8e51f (useSeasonPendingMessage in useCurrentSeason.ts), D11 2ab9b732a, D12 a33899441, D13 27b26632a. WiGO tests 22 files/174 + writer 44 + hooks all pass. Stage-1 tsc: exit 2, 51 errors all in other lanes' BLSH files (lib/buyLowSellHigh/currentProcessEvidence.server*.ts, lib/player-cards/retainedBlsh.test.ts); 0 in WiGO.
- **Decisions:** D7 tile guard = at least one other player at min GP (not a size threshold); fallback floor 10 GP. D12 radar floor 5 GP. D13 kept ratesData branch (tested, not in band's way).
- **Stage 2 done:** S1 880fee6ba (+ test fix 4th commit below), S2 f85a0c164 + 3f82248ee (test fix: S2 was committed with a failing test — chain tests before commits), S3 708bd948e, S4 a61073139, S5 76fa241f4 (one game log incl. team_abbrev replaces D11 read; totals via useWigoPlayerTotals; no defense cohort read), S6 d4ee3400c (sections React.memo), S7 3c4776113, S8 79805e543, S9 627ac8f93 (saving negligible), S1 test fix (typed table). tsc stage 2: 0 WiGO errors; 51 in other lanes' BLSH files.
- **Decisions:** percentile fallback kept serial (prefetch would double cohort bytes). TOI chart counts appearances only. No chart-internal useMemo (section memo covers it).
- **Slip:** once ran a plain `npx tsc` outside the heavy lock (piped to an invalid head; exited at once). Use only `npm run typecheck` under the lock.
- **UI:** U1+U2 20fb5474b (TJ's grid + band; TJ asked to bring U2 into U1 after round 1); S8 follow-up 3227451c8 (datalabels crash); U3 committed (see git log). UI-STEPS.md is the record.
- **U1 (old note):** width 95%, floor 1280, TOI tick padding; uncommitted. TJ requested changes: expects the horizontal band now (that is U2 scope); waiting for TJ's reference image. S8 follow-up 3227451c8 fixed a datalabels crash. Dev server :3150 running, pids 11934 (wrapper) and 11942 (listener); stop by exact PID.
- **Next (old):** Stage 3 U1 (width 95%, fit floor 1280). Needs isolated dev server + fixtures + screenshots + TJ pop-up per pass.
- **Blockers:** none.
- **Gotchas:** TJ's dev server on :3000 (pid 98909): do not touch.

## 2026-11-03 end of session
- **All D, S, U items done and committed.** UI passes each approved by TJ pop-up: U1+U2 20fb5474b (TJ asked for the band in round 1), U3 2f6333678, U4 143536e10, U5 04a91564b, U6 f375d5736, U7 a0c304f30, U8 2f8336b2e, U9 8c64d0c57, U10 11366ec6a, U11 77f85c6fa, U12 9935043b7 + type fix 331f223ca. Record: tasks/artifacts/wigo-charts-overhaul-2026-11-01/UI-STEPS.md.
- **Checks at the end:** WiGO vitest pass; e2e wigo-one-page 13/13 on :3150; tsc 0 WiGO errors (51 in other lanes' untracked BLSH files); axe-core 4.11 run locally 0 violations (MCP down).
- **Server:** :3150 stopped by PID (11942, 11934). TJ's :3000 untouched.
- **Not committed:** the artifacts folder (planning thread's PLAN/audits plus my UI-STEPS, tools, screens) is untracked; CLAUDE-LEASES.json edit uncommitted (file was dirty from others). Lease WIGO-OVERHAUL still active (production steps pending).
- **Next:** TJ's production steps P-1..P-11 (PLAN section 6). Nothing pushed or deployed.
- **Follow-ups:** dead `.statsTable*` CSS; left reference line does not re-enable on compare change; 11/12/13 chart tick tier; Game Score axis range on real data.
