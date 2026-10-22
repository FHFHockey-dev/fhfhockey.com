# P04 search — local implementation

- Scope: only shared StatsPage PlayerSearchBar stale requests/clear/unmount, keyboard selection and focused state fixtures. No connected navigation follow-on.
- Where: canonical `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, starting HEAD `d3f057c6c849d5d5474bc912a6f461f617c65b15`; application ownership limited to `web/components/StatsPage/PlayerSearchBar.tsx` and nearest new test.
- Start: read AGENTS.md, WORK-PACKETS.md and HEALTH.md. `.agents/skills` absent; applying available better-accessibility skill. Node v22.11.0/npm 10.9.0 confirmed. Existing unrelated dirty changes preserved; target component starts clean.
- Next: mount actual component under deferred Supabase/router mocks; reproduce races and inaccessible selection, patch narrowly, run focused tests and scoped lint/typecheck, record file hashes/evidence.
- Boundaries: offline only; no application routes, services, NST, ingestion/runner/process work, dependency/lockfile changes, commits or deployments. Stop on shared-file conflicts.
- Blockers/approvals: none.

## Reproduction and implementation checkpoint

- Actual mounted component with deferred client/router mocks: original 12-case suite produced 11 failures/1 pass, including out-of-order responses, input invalidation before debounce, clear/short input, unmount debounce, missing status/links and post-dismiss reopen. Log: `tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p04-search/baseline-tests.log`.
- Original source SHA256: `dc702cd14c1a27890d9f692030df09c3d6ec6cc4aecd3765584b11a65d1b71e0`.
- Added monotonic request ownership, debounce cleanup, captured input, explicit error/empty/loading states. Results use native Next links with prefetch disabled, focus containment, arrow-key focus and Escape dismissal; ordinary selection clears while modified clicks retain current search. Existing input styling remains.
- Available Supabase skill read; its live docs/query instructions are superseded by this task's explicit offline-only scope. Existing query shape unchanged and entirely mocked. Home `.agents` contains only REA, whose instructions exclude ordinary source-repository work.
- Expanded fixture suite passes 14 tests; first patch's lone keyboard failure was the mock missing forwardRef and was fixed in the mock. No runtime services loaded. Next: final scoped TS/lint/diff, hashes and review receipt. In-flight queries are invalidated, not physically aborted.

## Handoff checkpoint

- Final 14/14 component tests pass, scoped TypeScript passes, scoped ESLint passes with one pre-existing raw-img warning, and component `git diff --check` passes.
- Evidence, exact commands, limitations and two SHA256 pins: `tasks/artifacts/fhfh-sprint-ledger-2026-10-22/p04-search/REVIEW-RECEIPT.md`.
- Component SHA256 `078fc18af0c5a50c5b1aa859f7bc99b13227c46025ed0138fd321bfe2f0a2826`; fixture SHA256 `dbe37d2a8d53c657c8e6cd130a951120642f875c4c10ccc9006e6e6802e2157c`.
- Ready for independent review; browser/native Enter/AT/touch/live-query evidence remains unverified. No conflicts, approvals, uncertain outcomes or running operations. No forbidden external actions performed.
- Next owner: parent/independent reviewer; source ownership available to transfer. No later P04 packet started. Retain diary until handoff acceptance; exclude from release candidates.
