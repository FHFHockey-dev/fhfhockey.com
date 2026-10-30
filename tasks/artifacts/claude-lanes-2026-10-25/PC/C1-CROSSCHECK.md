# C1 ↔ PC cross-check: evidence loader vs evidence-bundle validator

Claude C1 session, 2026-10-25. Read-only: no `web/` edits, no Git, no production or DB reads.

Inputs, at HEAD `48809914a`:

| File | Commit | Notes |
| --- | --- | --- |
| `web/lib/player-cards/evidenceBundle.ts` | `9dbc55afb` | sha256 2899407e…, the accepted C1 bytes |
| `web/lib/player-cards/evidenceLoader.ts` | `4d37b51c9` | |
| `web/lib/player-cards/evidenceAdmissions.ts` | `4d37b51c9` | |
| `__fixtures__/retained/player-cards-2026-10-25/completion-read-01/RESULT.json` | | sha256 6ee7b37d…, which equals the CODEX-080 pin |

Check run: `npx vitest run lib/player-cards/evidenceLoader.test.ts lib/player-cards/evidenceBundle.test.ts` passed, 2 files and 44 tests (18 loader, 26 validator).

**Verdict: the two modules agree.** There is no schema, identity or authority mismatch that could produce a false `eligible`. One structural gap (X1) lets a caller-built index reach `retained` by bypassing the loader's guard. X2–X5 are lower-severity. None of them blocks the loader as committed; X1 and X5 should be closed in or before PC's wiring patch.

## Field agreement

| Receipt kind | Validator subject (evidenceBundle.ts) | Loader facts / labels (evidenceLoader.ts) | Agree |
| --- | --- | --- | --- |
| appearance-history | :9–13 playerId, season, gameType, through, appearances{gameId,date,played}; labels sourceClass, dateBasis | FACTS :35; LABELS :42 | yes |
| game-finality | :14–17 gameId, season, date, endedAt; label sourceClass | FACTS :36; LABELS :43 | yes |
| metric-definition | :18–21 metricId, registryVersion, sourceDefinition, sourceVersion, definitionVersion; label zeroSemantics | FACTS :37; LABELS :44 | yes |
| population-membership | :22–26 metricId, scope, definitionVersion, season, gameType, strength, period, cutoff, memberIds; label sourceClass | FACTS :38; LABELS :45 | yes |
| envelope | :8 kind, receiptId, sha256, retainedPath, origin, capturedAt, subject | :127 builds the same keys; sha256 is the loader-computed file hash (:107), already equal to the pin (:108); retainedPath = admission.path | yes |

**Identity.** The receiptId and kind come from the hashed bytes and must match the claim exactly once (:116–119). Origin must equal the admission origin (:119), and the validator re-checks origin per receipt against the bundle (evidenceBundle.ts:92). Any subject identity mismatch against the selection is then rejected by the validator (:119 history, :142 finality, :157 definition, :164 population).

**Source authority.** The validator's qualifying values are the same five strings as the loader's `AUTHORITATIVE` set (:47):
- `complete-official-log` (:129)
- `UTC` (:130)
- `official-game-end` (:144)
- `verified-distinct` (:158)
- `metric-population-inventory` (:169)

The loader writes these labels only from the reviewed claim (`subject: { ...facts, ...labels }`, :127). A file's own label never counts:
- a disagreement with an authoritative claim is not admitted (:125, `self-label-conflict`);
- a disagreement with a weaker claim is admitted at the weaker label (:126).

So the module meets the CODEX-080 requirement that "self-labels are never verification", via the loader. This closes my INSTALL-RECEIPT F1 for loader-sourced receipts.

**Time formats.** `pgInstant` (:68–72) turns `…+00` microsecond values into the validator's `instant()` millisecond `Z` form. Truncation never moves a time later, so the `endedAt ≤ capturedAt` check (evidenceBundle.ts:143) keeps its order.

**Existing five-row read.** The format ceiling (:51) caps `completion-read-rows-v1` at `ingestion-completion`. The validator turns that into `finality-not-actual-end`, which is incomplete (:144). This agrees with CODEX-080 and the C1 receipt.

## Can a caller-built index reach `retained`?

- **Through `validateAdmittedEvidence`: no.** A handle not issued by `loadAdmittedEvidence` (WeakSet, :17, :151, :157) is rejected with `untrusted-evidence`, the card is `null`, and the validator gets `[]` (:159). The handle is deep-frozen (:150) and carries a `unique symbol` brand (:14–16). Loader tests cover plain objects, copies, JSON clones and attempts to raise a label after loading.
- **Admissions:** `EVIDENCE_ADMISSIONS` is a reviewed, frozen code constant (evidenceAdmissions.ts:30). It is not request input. Bytes are pinned by sha256, so a caller-chosen `root` (:142) can't swap content. Path traversal is refused (:101–102).
- **Directly through `validateEvidenceBundle`: yes** — this is X1.

## Findings

**X1 (medium) — the raw validator is still a public bypass.**
- *Where:* `evidenceBundle.ts:60` exports `validateEvidenceBundle(input, bundle, retained: readonly RetainedReceipt[])`, which accepts any structurally typed array. Today its only non-test importer is `evidenceLoader.ts:6`, but nothing enforces that.
- *How it breaks:* any route or client module could import it and pass request JSON as `retained`, getting `eligible` and ranks with no loader. `evidenceBundle.ts` has no Node dependencies, so it bundles into client code freely.
- *Proposed fix* (no C1 behaviour change; PC/Codex own the choice):
  1. Add an ESLint `no-restricted-imports` override in `web/eslint.config.mjs`. It should forbid the `validateEvidenceBundle` import name from `**/player-cards/evidenceBundle` everywhere except `lib/player-cards/evidenceLoader.ts` and `lib/player-cards/evidenceBundle.test.ts`.
  2. Mark the export `/** @internal — call validateAdmittedEvidence */`, a comment-only edit to C1 under a fresh grant.
  3. Optionally, have `evidenceBundle.ts` take the branded `AdmittedEvidence` type. This needs a type-only import from the loader, a behaviour or signature change to C1 that needs review, so I'd do 1 and 2 only.

**X2 (low) — no top-level origin check in the wrapper.**
- *Where:* `evidenceLoader.ts:163` passes `evidence.receipts` without checking `evidence.origin === bundle.origin === input.origin`.
- *Impact:* no false eligibility, because per-receipt `receipt-origin` rejects any receipt that is referenced (evidenceBundle.ts:92). But a synthetic handle used with an observed bundle only shows up as `receipt-not-retained` or `receipt-origin` noise.
- *Proposed fix:* at :163, if `evidence.origin !== bundle.origin`, return the same `rejected` shape as :158–161, with code `evidence-origin`.

**X3 (low) — wrapper load issues don't update per-metric state.**
- *Where:* `evidenceLoader.ts:165–166` adds load issues as `incomplete` and can lower `eligible` to `incomplete`, but leaves `result.metrics` unchanged. The mapped issue also drops `gameId`, `playerId` and `metricId`.
- *Impact:* I found no reachable path today. A self-label disagreement is only admitted at a weaker label, which the validator already marks incomplete, and duplicate admissions are filtered (:149). If one ever appears, it would give a top-level `incomplete` with every metric `eligible`.
- *Proposed fix:* when lowering the state, also mark the metrics or add a test pinning that it can't happen.

**X4 (informational) — hash binding is per file, not per receipt.**
- For multi-receipt formats (the five completion rows), all receipts share one `sha256`, the file hash (:107, :127). The bundle reference therefore binds file bytes plus `receiptId`, not per-receipt bytes. This is acceptable because `receiptId` must be parsed exactly once from those bytes (:117).
- Document it in the bundle-reference contract, so producers don't expect per-receipt hashes.

**X5 (wiring note for PC) — the existing UI calls the adapter directly.**
- *Where:* `components/player-cards/PlayerCardFlow.tsx:27` and `PlayerCardShareStudio.tsx:49` call `adaptLocalSnapshot`, which trusts caller `completeHistory`, `completion`, `verifiedMetrics` and `population.complete`. Today they use synthetic interaction fixtures only, which is fine.
- *Proposed fix:* for any observed (`local-observed`) input, the wiring patch must call `validateAdmittedEvidence` server-side, where the loader uses `node:fs`, and render only its `card`. It must never pass observed input to `adaptLocalSnapshot` directly. The same restricted-import rule from X1 could also cover `adaptLocalSnapshot` for non-synthetic call sites.

## Not checked

- PC's in-progress wiring patch: not present here.
- Whole-app typecheck and lint: not rerun.
- Production data: not read.
