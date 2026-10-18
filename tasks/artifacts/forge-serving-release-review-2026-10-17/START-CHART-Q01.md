# Q-01: Start Chart shared-forecast acceptance (2026-10-18)

The work ran locally on octoberBranch: no dev server, network, database, deployment or commit. It was reconciled with the handoff `03-start-chart-shared-forecast-ui.md`.

## Handoff items

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Map current changes | Done in `slice.json` (re-pinned) and `BLOCKERS.md`. Production `457435eb` holds none of the slice; nothing has been redeployed | `slice.json`, `RELEASE-PLAN.md` |
| 2 | Model/method labels | **Already done.** The page no longer hard-codes `skater-participation-frequency-v1`; `start-chart.tsx:1161` picks the model by revision, basis and probability. It shows "Participation/Start model estimate · calibration unavailable", event and sample size. The board omits input and evidence proofs (N1) | page tests |
| 3 | API/UI against one pinned manifest | **Done (fixture replay).** One fixture flows through FORGE view decode, the RSO transport round trip plus resolver, the Start Chart API body and the UI parse. All four give the same value, basis, permissions, sources, revision, clocks and null reasons for all 16 independently counted keys (2 players × 1 game × 8 board targets). The 4 null heads keep their reasons. The rendered UI shows the resolved per-appearance values (GOALS, ASSISTS, SOG) | `start-chart-parity-receipt.json`; API and page tests named "parity receipt" |
| 4 | Injected-clock expiry, races and refresh | Already covered: deadline withholding plus failed-refresh recovery, timer clearing across a date change, and an already-expired first render. **Added:** the exact-millisecond boundary (shown at −1 ms, withheld at expiry); an already-expired payload arriving after a fresh one stays withheld, then a valid replacement is accepted; a partial refresh drops players it no longer covers. A stale old-date response cannot reach a new date, because SWR keys data by URL | `start-chart.test.tsx` |
| 5 | Edge cases | **Added:** the Eastern date boundary on the page and the API (04:59:59.999Z → previous day; 05:00Z → new day), and a no-game date. **Fixed:** a game with a team the board cannot identify used to vanish, and with no other games the board claimed "No upcoming scheduled games". It is now `partial` / `unmapped_slate_teams` with degraded reason `unmapped_slate_team` (`startChartContract.ts`). Goalie start uncertainty, unsupported categories and incomplete schedules stay covered by existing tests. Partial scoring lines become null (S-01b) | API and page tests |
| 6 | Checks | Start Chart and dependent suites: 381 passed, 1 skipped. Candidate (production + slice): the 12 failures are exactly the baseline. ESLint clean. tsc not re-run (one run allowed; today's run had 2 errors outside the slice). No browser rendering beyond jsdom | `test-evidence.json` |

## Evidence classes

- **Mocked transport / fixture replay:** every test above, and the parity receipt.
- **Current local UI:** jsdom render of the page component only. There was no browser or dev server.
- **Retained-data replay and production readback:** none in Q-01.

The 2026-10-16 "60 rows, 46 complete / 14 incomplete" figure is historical. It predates S-01b, which now nulls lines with a withheld ES or PP head, so a fresh count can only keep or raise the incomplete share. Re-measuring it needs a local readback against hosted data, which needs separate approval.

## Remaining approvals (TJ)

1. Release A1, env/redeploy A2 and readback A3 (`RELEASE-PLAN.md`). The readback should record payload size, row count, and complete versus incomplete rows.
2. The B2 schedule refresh (`B2-SCHEDULE-REFRESH-PROPOSAL.md`).
3. The accuracy-job 422 proposal (`BLOCKERS.md`).
4. Re-measuring the 46/14 reconciliation on current data, which needs a hosted read.
