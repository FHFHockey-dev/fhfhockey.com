# PC lane: trusted retained-evidence loader for the C1 validator

Claude PC session, 2026-10-25, ~16:50Z. Lease PC in CLAUDE-LEASES.json (authority: TJ 16:22–16:27 + CODEX-20261025-086). This closes the C7 limit in `handoffs/C7/RECEIPT-C1-INSTALL.md` (F1 and F2). The orchestrator commits. I made no Git changes, used no GIT_DIR, did no live or DB reads, started no server and processed no portraits or images.

## Changed paths (all new, untracked; no existing file edited)

| Path | sha256 | bytes |
| --- | --- | --- |
| `web/lib/player-cards/evidenceAdmissions.ts` | `d2af7842eaa250b813c55d595e20cfb2a4ea6bd46bc13ac76d4658dfc470cfda` | 2395 |
| `web/lib/player-cards/evidenceLoader.ts` | `ec89625c48056f96bb5d32a673547c0a334fdacb7a0b93e449e1ff61a68ccad1` | 15020 |
| `web/lib/player-cards/evidenceLoader.test.ts` | `82b96d9dbc200dd675269dfbb13c071ef56d56eedcfcdea1965a4fdb61e646ee` | 20554 |
| `web/lib/player-cards/__fixtures__/retained/player-cards-2026-10-25/completion-read-01/RESULT.json` | `6ee7b37d6f6d075557d9987599043ba09320ca9d66e9c9a6bbdf75bf5dd5dae2` | 2982 |

- The fixture is a byte copy of the five-row result. Its source is `/Users/tim/Code/fhfhockey-workspace-recovery-2026-10-24/clean-checkout-2026-10-25-1505/files/tasks/artifacts/player-cards-2026-10-25/completion-read-01/RESULT.json`, because the cleanup emptied the in-repo `completion-read-01/`. Its hash equals the CODEX-080 pin.
- Also written (lane artifacts, not source): this receipt and `checks/` (logs, scoped tsconfig). The diary is `tasks/diaries/2026-10-25-claude-pc-evidence-loader.md`.

## Pins

- **36 PC lease baselines:** rechecked before and after the work, **0 drift**. `evidenceBundle.ts` (`2899407e…`) and `evidenceBundle.test.ts` (`d4c674cb…`) are byte-unchanged. EditorialPlayerCard was not touched.
- **HEAD:** `ac98431aa` at start, `664345ce5` at the 17:02Z recheck. Those commits came from the orchestrator; no file in this lane was involved. `git status` for the player-card paths shows only the four new files above.
- **No wiring:** outside their own files, `grep` for `evidenceLoader`/`evidenceAdmissions` in `web/{lib,components,pages,app,scripts}` finds nothing. There is no route, no UI and no formula, reader or ranking change.

## What the loader does (CODEX-080 trust contract)

1. **Admission ledger** (`evidenceAdmissions.ts`) is the only source of admitted evidence. It is reviewed code, not request, card or browser input. Each entry pins:
   - a relative path and the SHA-256 of the exact bytes;
   - a format;
   - an origin;
   - a recorded review authority: a `CODEX-|CLAUDE-YYYYMMDD-NNN` decision for observed data, and only `SYNTHETIC` for synthetic data;
   - per-claim verified labels (`sourceClass`, `dateBasis`, `zeroSemantics`).
2. **`loadAdmittedEvidence({ root, origin })`** works from that ledger:
   - It reads each admitted file under `root` and **hashes the actual bytes**. A missing file, or any byte difference (even whitespace), admits nothing.
   - It **parses the subject from those same bytes**, using a strict per-kind schema. Unknown fields fail, including a self-declared `sha256`.
   - It checks identity: the claim's receipt id appears exactly once, and the kind and origin match.
   - It checks authority: the review decision must be recorded, and the claim must stay within its **format ceiling**. A `completion-read-rows-v1` file can only ever establish `ingestion-completion`.
   - Authority labels are **written from the admission, never from the file**:
     - If the file claims more than the review verified, the receipt is admitted at the reviewed label, with a `self-label-unverified` issue.
     - If the file contradicts a verified authoritative label, the receipt is not admitted (`self-label-conflict`).
     - A file with no admission is never read.
   - The output is deep-frozen and registered in a module-private `WeakSet`. It is a branded `AdmittedEvidence` handle (F2).
3. **`validateAdmittedEvidence(input, bundle, evidence)`** is the entry point for future wiring:
   - Any object the loader did not issue, including a spread copy or a JSON clone of admitted receipts, is **rejected**: `untrusted-evidence`, card `null`, every metric rejected.
   - Otherwise it calls the unchanged validator with the admitted receipts. It attaches loader issues for the receipts the bundle references, which can only make the result less eligible, never more.
   - Absent admission means no receipts, so the card stays incomplete.

**Real admissions today: one.** CODEX-080 says the five-row read "establishes an ingestion completion observation only". So its five games are admitted as `game-finality` with `sourceClass: "ingestion-completion"`, and `endedAt` holds the ingestion time. The validator then reports `finality-not-actual-end` for each game, so nothing becomes `verified-final` and there are no ranks.

## Checks (rerun 2026-10-25T17:01:14–17:02:17Z; cwd `web/`, GIT_DIR unset, under `/private/tmp/fhfh-heavy.lock`, released after)

**Revision 2 (17:00Z).** The orchestrator relayed that TG's whole-project `tsc` found 3 errors in these files: `evidenceLoader.ts:106` and `evidenceLoader.test.ts:25,81`. I reproduced them.
- **Cause:** `@types/node` 18.0.2's `Buffer` does not satisfy TypeScript 5.7's generic `Uint8Array`/`BinaryLike` in the full project graph. The scoped `tsconfig` did not surface this.
- **Fix:** the loader copies `readFile` output into a plain `Uint8Array` before hashing and decoding. The test hashes through `new Uint8Array(...)` and writes `TextEncoder` bytes. Behaviour is unchanged.

| Check | Result | Log sha256 |
| --- | --- | --- |
| **Whole-project** `NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit` (the repo's `typecheck` setting) | **PASSED** (exit 0, no output) | `checks/types-whole.log` `e3b0c442…` (empty) |
| `npx vitest run lib/player-cards/` | **PASSED**: 8 files, 94 tests (the existing 76 unchanged, plus 18 new) | `checks/tests.log` `a5ac2215…` |
| Scoped `npx tsc --noEmit --project checks/tsconfig.json` | **PASSED** (exit 0) | `checks/types.log` `e3b0c442…` (empty) |
| `npx eslint` on the 3 new TS files | **PASSED** (exit 0) | `checks/lint.log` `e3b0c442…` (empty) |
| Mutation check (revision 1, reverted) | Letting file self-labels win fails the "reviewed label" test. Dropping the WeakSet gate fails the caller-built-index test. | console only |

Timings and exit codes are in `checks/run2.txt` (`f4c0ce64…`). Not run: build, browser and E2E, since nothing imports these modules.

## Required test coverage → tests in `evidenceLoader.test.ts`

| Requirement | Test |
| --- | --- |
| Genuine admitted evidence | "hashes and parses the retained bytes…eligible": 42 receipts, each `sha256` equal to the on-disk bytes; eligible; 12 ranks over population 3. Plus "admits nothing when the reviewed ledger has no entry". |
| Caller-built index rejected | "rejects plain objects, copies and JSON clones…"; "freezes the admitted handle…" (raising a label after load throws). |
| Tampered bytes | "does not admit tampered bytes, even a whitespace-only rewrite" → `retained-bytes-mismatch` + `receipt-not-retained`, incomplete, 0 ranks. |
| Self-labelled but unverified | "never reads a self-labelled file that has no admission"; "writes the reviewed label, not the file's own…" (`official-game-end` → `ingestion-completion`, `verified-distinct` → `unknown`); `self-label-conflict`, `admission-authority`, `claim-absent`, `claim-identity`, `retained-schema`×2, `claim-label`. |
| Missing receipt | "leaves a card incomplete when an admitted receipt's file is missing" → `retained-file-missing` + `receipt-not-retained`. |
| Five-row stays "ingestion observed" | "keeps the retained bytes identical to the CODEX-080 pin"; "admits the five rows only as ingestion observed, never as game ended" (5× `finality-not-actual-end`, none `verified-final`, 0 ranks); "refuses an admission that would read the rows as game ended" (`authority-exceeds-format`). |

## Limits and open items

- **Still missing:** real authoritative evidence — actual game ends, the UTC date basis, complete history, metric definitions with zero semantics, and all-NHL metric populations. Each new real admission is a reviewed ledger edit pinned to exact bytes.
- **Direct validator calls are still possible.** `validateEvidenceBundle` stays exported, because its 26 tests and C1's accepted bytes depend on it. Future wiring must import `validateAdmittedEvidence`, not the raw validator. Keeping the raw validator off route and client paths remains a review gate (C7 F2).
- **Server-only.** The loader uses `node:fs`. The production `root` is not decided: the five-row bytes now live only in the recovery checkout and in this test fixture. Choosing where retained evidence lives for a deployed route is for the wiring slice.
- **F3 wording** (`retainedPath`, `receipt-not-retained`) is unchanged in the validator. The loader now gives "retained" a precise meaning: admitted bytes.
