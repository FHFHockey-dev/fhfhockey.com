# RSO UI-BATCH-1 (Claude lane)

- Scope: TJ live-test batch: (1) tab-return reset, (2) Bench days tab, (3) goalie cell height, (4) Top five team schedule cards. Uncommitted; lease = RSO component folder, its tests, rso-acceptance spec + fixtures.
- Where: octoberBranch working tree; receipt `tasks/artifacts/astra-rso-handoff-2026-10-26/slices/UI-BATCH-1/RECEIPT.md`.
- State: all four items done; receipt written. Item 1 root cause: the Yahoo private read's ≤2-minute deadline withdrew the whole plan, so the page blanked and re-planned on tab return. TJ chose a public stand-in (useRosterPlanning + executionAdapter `privateLapsesFirst`). Checks: Vitest 1266/1266 in UTC and New York; Playwright 8/8 ×2; tsc 0; pure OK.
- Next: orchestrator review / Codex vet; TJ live check that the page no longer blanks on return.
- Gotchas: next/image decodes async, so wait for `img.decode()` before page screenshots; goalie labels shortened to "exp" / "if GS" so the name keeps room (aria-labels unchanged); `.next-playwright` is shared with other lanes; check for a second isolated server first.
