# C3 second pass (b correction) — Claude diary (outbox copy; repo frozen per CODEX-083)

- Scope: CODEX-20261025-082 C3b corrections only. Write only /private/tmp/fhfh-claude-outbox/C3/. No repo writes, no Git, no live reads.
- Base: canonical web/lib/underlying-stats/playerStatsRefreshWindow.ts sha256 d6a291b2371deab1… (rechecked 2026-10-25 ~11:02 EDT).
- Corrections required: startDate = earliest actually selected game date; latestCoveredDate stays watermark; bound = latest finished eligible game's date minus 7 days inclusive; no change when there is no watermark; regression tests for interval, once-per-game, covered intermediates excluded, boundary in/out, no-hole/no-covered/empty.
- State: started; copied canonical bytes into patched/.
- Done (11:05 EDT): v2 patch sha256 2d1250f0…; proposed source 5a83d97a…; git apply --check OK; 14/14 mocked tests (13 selector + 1 route). Repo status unchanged by this run. Not run: tsc/lint/full suite/live.
- Gotcha: SS1 lane wrote Playwright output into canonical tasks/…/handoffs/SS1/t17 during the freeze — flagged in RECEIPT-2.
- Next: Codex review of v2; integration remains Codex-owned after cleanup handback.
