# PC lane — trusted retained-evidence loader (Claude, 2026-10-25)

## Scope
Build the trusted loader that feeds the C1 validator (`web/lib/player-cards/evidenceBundle.ts`, 9dbc55afb), per CODEX-080 trust contract and C7 RECEIPT-C1-INSTALL (F1/F2). No UI/route wiring, no formula/reader/ranking change, EditorialPlayerCard untouched. No Git; orchestrator commits.

## Where
- Branch octoberBranch, HEAD ac98431aa. Lease PC in CLAUDE-LEASES.json (36 pinned paths + new loader files under web/lib/player-cards/).
- Artifacts: tasks/artifacts/claude-lanes-2026-10-25/PC/

## Checkpoints
- 16:5xZ start: 36 PC pins rechecked, 0 drift; player-card paths clean in git.
- Five-row result (completion-read-01/RESULT.json, sha 6ee7b37d…) is no longer in tasks/artifacts; the only copy is in the recovery checkout (TRANSFER-MANIFEST resolved_path). Copying its bytes into a test fixture.
- Design: reviewed admission ledger (path + sha256 + format + authority + per-claim verified labels) → loader reads bytes, hashes, parses facts from the same bytes, writes labels only from the ledger → runtime-branded `AdmittedEvidence` handle → `validateAdmittedEvidence` (rejects any caller-built index). Validator itself unchanged.

- 16:48Z: built evidenceAdmissions.ts, evidenceLoader.ts, evidenceLoader.test.ts and the RESULT.json fixture. 94/94 player-card tests, scoped tsc and eslint clean (under the heavy lock, released). Mutation check confirmed that the self-label and WeakSet tests bite. 36 pins: 0 drift. HEAD moved ac98431aa→80425a4a9 (orchestrator).
- 17:02Z rev 2: fixed the 3 whole-project tsc errors (@types/node 18 Buffer vs TS 5.7 Uint8Array) by copying into a plain Uint8Array. Whole tsc, scoped tsc, 94 tests and lint are clean; 0 pin drift. Next: C7 review, then orchestrator commit.
- RECEIPT: tasks/artifacts/claude-lanes-2026-10-25/PC/RECEIPT.md (exact paths and hashes).

## Next
The orchestrator commits the 4 new web files (plus PC artifacts). Retire this diary after the commit lands.

## Blockers / approvals
None.

## Gotchas
- zsh: `echo ====` errors (`=` expansion). Use `echo ---`.
- windows.ts `instant()` accepts at most 3 fractional digits; Postgres timestamps have 6.
- Gotcha: scoped tsc misses the whole-project Buffer/Uint8Array clash (@types/node 18 + TS 5.7). Run whole tsc with NODE_OPTIONS=--max-old-space-size=8192.

## Ticket 2 (WIRING-1 draft, ~18:30Z)
- Loader committed 4d37b51c9. WIRING-1.patch + WIRING-1.md in PC artifacts; not applied to web/. Snapshot /private/tmp/pc-wiring-1: 98/98 tests, scoped tsc and lint clean. Whole tsc not run (lock held by WIGO). Open: page-test path is outside the lease.
- 18:29Z: whole-project tsc on the snapshot passed (after adding e2e/ to it). WIRING-1.md updated. Awaiting C7 review and the lease decision for the __tests__ path.

## Ticket 3 (apply WIRING-1 + C7 L1 fix, ~18:50Z)
- C7 R23 L1: the verdict is now states and coded enums only (no reasons, bundleId, receipt ids). L2: the guard catches import()/require(). L4: the __tests__ page test was dropped (not granted) and its check moved into cardEvidenceVerdict.test.ts.
- Snapshot /private/tmp/pc-wiring-3: 100/100 tests, eslint clean; mutation (reasons back in props) fails 3 tests.
- Applied 3 granted files to canonical (page pre-hash fac7acb9 verified; new files did not exist, cp -n). Canonical checks queued under the lock. Not committed.
- 19:07Z: canonical checks passed: 100/100 tests, scoped and whole tsc, eslint (incl. C1 rules). RECEIPT-3.md written. Next: orchestrator commit; L3 (client bundle) waits for build authority.

## Ticket 4 (status line, ~20:52Z)
- TJ chose "Small status line" by pop-up. New evidenceVerdictCopy.ts; the page renders fixed copy by state; 2 tests. 102/102 tests, scoped and whole tsc, eslint clean. RECEIPT-4.md written. Not committed; the line is unstyled and not visually checked.

## Ticket 5 (R28 P1/P2, ~21:07Z)
- Page prop narrowed to { state } via clientEvidence(); copy takes an explicit context (preview vs bundle). 103/103 tests, scoped and whole tsc, eslint clean. RECEIPT-5.md written. Not committed.
