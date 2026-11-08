# C7 independent review — C1 install (`9dbc55afb`): player-card evidence-bundle validator

**Verdict: accepted with limits.**
- **What holds:** inside the validator, **no rank is admitted from hash-only, reference-only or caller-flagged evidence**. Every rank needs a resolved, kind-checked, origin-checked receipt in `retained`.
- **The limit:** the validator **trusts the self-labels inside `retained`** (`sourceClass`, `zeroSemantics`, `capturedAt`, `retainedPath`). It cannot tell a caller-built index from loader-admitted receipts. So the CODEX-080 trust contract holds **only while nothing but a trusted loader feeds `retained`**. Today nothing feeds it: the module has no importer.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git, no live reads, and no server. Tests ran under the outbound network-deny preload. Evidence is in `r17-evidence/c1-install/`.

## Pins

- **Commit `9dbc55afb`** adds exactly 2 files. Canonical bytes:
  - `evidenceBundle.ts` `2899407e…`;
  - `evidenceBundle.test.ts` `d4c674cb…`.

  Both equal CODEX-080's accepted hashes and `C1/INSTALL-RECEIPT.md`, and both are clean in git.
- **No wiring:** `grep -rl evidenceBundle` across `lib`, `components`, `pages`, `scripts` and `app` finds only its own test. No loader, route or UI imports the validator. That matches CODEX-080 ("No loader/route/UI wiring is granted").

## Tests

**89/89 pass** (`c1.json`).
- The owner's `lib/player-cards` suite gives **76**: evidenceBundle 26, domain 19, nstCapture 10, aggregation.r1 7, portraitTreatment 5, ranking 5, shareExport 4. That reproduces C1's 76.
- My 13 adversarial controls (`c1Trust.test.ts`, which reuses the owner's synthetic fixture verbatim) give the rest.
- **Run 1 is kept** (`c1-run1.*`). It had two mistakes of mine: I copied the fixture one line short, and I ran the jsdom `shareExport` test under node.

| Control | Result | Ranks |
| --- | --- | --- |
| A0: full synthetic world (baseline) | eligible | 12 |
| **A1: hash-only.** Refs and hashes match, but every retained entry has an empty `retainedPath`. | incomplete, `receipt-not-retained` | **0** |
| **A2: references only**, `retained = []` | incomplete | **0** |
| **A3: caller proof flags.** `population.complete`, `verifiedMetrics`, `completeHistory` and `verified-final` all set by the caller, with nothing retained. | incomplete | **0** |
| A4: one *non-selected* pool member's history is `latest-n` | incomplete | **0** for everyone |
| A5: one non-selected member's game has only `ingestion-completion` finality | incomplete | **0** |
| A6: population `roster-snapshot` for every metric | incomplete | **0** |
| A7: duplicate retained id (one good, one forged path) | **rejected**, card null | 0 |
| A8: one history receipt referenced for two players | **rejected** (`history-identity`) | 0 |
| A9: one metric lacks a definition receipt | incomplete | 11; that metric has none |
| A10: one metric's zero semantics are `placeholder-coerced` | incomplete | 11; that metric has none |
| A12: history `through` later than its own `capturedAt` | **rejected** | 0 |
| **A11: F1 by construction.** A JSON copy of the receipts, as a caller-built index, carrying the right labels. | **eligible** | **12** |

**Code read** (`evidenceBundle.ts`, plus `adapter.ts`, `windows.ts` and `ranking.ts` for the rank path):
- Every adapter proof flag is rebuilt from resolved receipts: `completeHistory`, `historyThrough`, `historyReference`, `completion`, `verifiedMetrics` and `population`.
- `rankMetric` returns no rank unless the population is fully verified **and** no pool value is missing. So one unverified member, its history or a single game's finality removes ranks for every player (A4, A5).
- A hash that matches still has to come with a retained entry with a non-empty path, the right kind, the same origin and a valid capture time.
- Ambiguous ids, cross-player reuse and coverage claimed beyond capture are **rejected**.
- `liveActivation` and `premiumActivation` are always `false`.

## The three trust-contract findings in `INSTALL-RECEIPT.md`

| Finding | C7 assessment |
| --- | --- |
| **F1: self-labels inside `retained` are trusted** (`:129, :144, :158, :169`) | **Confirmed** by A11. Within CODEX-080 this is acceptable only because `retained` is defined as loader-admitted. The labels the validator relies on are `sourceClass`, `zeroSemantics`, `capturedAt`, `subject.through`/`endedAt` and `retainedPath`. The validator also **never recomputes a hash**: `receipt.sha256` is compared with `ref.sha256`, and both are supplied values. "Hash match" here is a binding check between two inputs, not an integrity check over bytes. **Severity: limit, not defect**, because the module has no importer. |
| **F2: nothing in the types separates a caller-built index from loader-admitted receipts** | **Confirmed.** `retained: readonly RetainedReceipt[]` is a plain exported structural type, and only a doc comment guards it. **Recommendation (owner: C1 / loader author):** before any loader, route or UI wiring, add a branded `AdmittedReceipt` type that only the loader module can create, and keep `validateEvidenceBundle` off client and route import paths. Treat this as a **gate on the first wiring change**, not on this install. |
| **F3: wording overstates retention** ("Eligible means every claim resolves to a matching retained receipt"; `receipt-not-retained`) | **Confirmed, comment and naming only.** CODEX-080's own wording is "`eligible` means the supplied claims match admitted offline evidence". A separate reviewed rename is reasonable and changes no behaviour. |

## Additional observations (not defects)

- **Incomplete still returns a card.** When the bundle is `incomplete`, `card` is still returned with ranks for the metrics that are individually eligible (A9, A10: 11 ranks). A consumer must gate on `metrics[id].state`, not only on `card !== null`. Each surviving rank is backed by complete evidence for that metric, so this is correct per metric. A future loader or UI should not show a bundle-level "verified" badge while the state is `incomplete`.
- **Finality ending after the cutoff.** A game whose verified end falls after the cutoff is skipped by `selectWindow` (`finished > cutoff → continue`), so it can't enter a window. That is correct.
- **The real evidence is still missing,** unchanged by this install: actual game ends, the UTC date basis, complete history, metric definitions with zero semantics, all-NHL metric populations, and the trusted loader itself.

## For the owner (C1) and the orchestrator

- **Before the first importer:** add the F2 branded admitted-receipt type, plus a loader that hashes the actual bytes and derives the subject from them (CODEX-080).
- **Optional:** a separate rename patch for F3.
- **Housekeeping:** the workspace cleanup moved my earlier C7 receipts (`RECEIPT-*.md`) out of `handoffs/C7/`. Copies are kept in `/Users/tim/Code/fhfhockey-workspace-recovery-2026-10-24/{working-files,clean-checkout-2026-10-25-1505,…}/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/C7/`. The evidence folders are still in place. The luna `network-guard.cjs` preload was also moved, so I used an identical copy in my scratch folder.
