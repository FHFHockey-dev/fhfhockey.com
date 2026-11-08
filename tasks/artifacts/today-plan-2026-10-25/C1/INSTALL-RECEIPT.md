# C1 evidence-bundle validator — canonical install receipt

Claude C1 session, 2026-10-25T16:24Z. Installed under lease `CODEX-CLAUDE-C1-EVIDENCE-BUNDLE-20261025` (grant CODEX-20261025-080). The orchestrator relayed the cleanup handback: HEAD 2f2b43230, in sync with origin/octoberBranch. No Git operations; Codex commits. No DB or provider reads, and no behaviour change beyond the accepted patch.

## Pre-install checks (16:24Z)

| Check | Result |
| --- | --- |
| HEAD / origin/octoberBranch | `2f2b432306b048f16bf48c2e274f21e55a7514d4` both; ahead/behind 0/0 |
| `web/` vs application baseline `1ee5127dc` | no diff; `git status -- web` empty before install |
| Other dirty entries | 11, all under `tasks/` (coordination, ledger, diaries, new outbox and second-pass folders); none in `web/`, none touched by C1 |
| `web/lib/player-cards/evidenceBundle.ts` / `.test.ts` | both absent |
| `source.patch` | sha256 `d859293bbb4a54e1b4a45d5ee8dbb4d2452e476bdaede538b7c0a78206bc839a` = accepted; `patch -p1 --dry-run` clean |
| 9 read-only dependency pins (adapter, windows, aggregation, ranking, registry, contracts, nstCapture, domain.test, nstCapture.test) | all MATCH the frozen pins in RECEIPT.md |

## Install

`patch -p1 < tasks/artifacts/today-plan-2026-10-25/C1/source.patch`, run from the repo root. No `.orig` or `.rej` files. After install, `git status -- web` shows exactly two untracked files.

| Installed path | sha256 (post-install) | bytes |
| --- | --- | --- |
| `web/lib/player-cards/evidenceBundle.ts` | `2899407e81b88dec5c78548cd9c9eff524c7592a3c67f5d6253c2181a3424084` (= accepted) | 20098 |
| `web/lib/player-cards/evidenceBundle.test.ts` | `d4c674cb41deadcb05941d3c2bbb0312495894393cce6faa675c4895711d23b3` (= accepted) | 21319 |

## Checks on the canonical tree (16:24:33–16:24:37Z)

| Check | Result | Log (sha256) |
| --- | --- | --- |
| `npx vitest run lib/player-cards/` (cwd `web/`, GIT_DIR unset) | **PASSED**: 7 files / 76 tests (26 new + 50 existing card tests unchanged) | `install/tests.log` ebb8f156… |
| Scoped `tsc --noEmit --project install/tsconfig.json` (extends `web/tsconfig.json`, includes the two files) | **PASSED** (exit 0, no output) | `install/types.log` e3b0c442… (empty) |
| `npx eslint` on the two files | **PASSED** (exit 0, no output) | `install/lint.log` e3b0c442… (empty) |

These checks are light (about 4 s total) and ran without the heavy lock, which a WiGO browser capture held from 16:00Z. The whole-app typecheck was not rerun. The snapshot run found its only 2 errors in inherited Luna files (RECEIPT.md); application bytes are otherwise unchanged.

## Trust-contract conformance (CODEX-080)

What already matches:

- **No caller proof.** All adapter proof flags are rebuilt from resolved receipts. Caller `complete:true`, `verified-final`, `verifiedMetrics` and population flags are discarded (test: "ignores caller complete:true…").
- **No admitted receipts means incomplete.** `retained: []` yields `incomplete` with no ranks (same test).
- **Hash alone is not verification.** An unresolved reference or hash is `incomplete` (`receipt-not-retained`); a mismatch is `rejected`.
- **Existing receipts.** The completion-read ingestion observation maps only to `ingestion-completion`, which is not actual end of play. The provider-date discrepancy maps to `date-basis`, which is incomplete. READINESS is not proof of history, definition or population.
- **Zero vs undefined vs missing** stay distinct (three tests). Live and premium are always `false`. There is no loader, route or UI wiring.

**Findings (reported, not changed — the accepted patch is installed byte-for-byte):**

1. **F1 — the module trusts subject self-labels inside `retained`.** Eligibility checks `sourceClass === "official-game-end" | "complete-official-log" | "metric-population-inventory"` and `zeroSemantics === "verified-distinct"` (evidenceBundle.ts:129, 144, 158, 169). CODEX-080 says reading a self-asserted `sourceClass`, completion or population label is not verification. The module conforms only if the trusted loader writes those fields itself, after independent verification, for admitted receipts. A receipt copied from a file that merely says `official-game-end` must never reach `retained`. The behaviour is right only under that loader obligation, and the code does not enforce it.
2. **F2 — nothing in the types separates a caller-built index from loader-admitted receipts.** `retained: readonly RetainedReceipt[]` is a plain exported parameter. Any caller could pass request JSON, and only the doc comment (lines 56–58) forbids it. Suggested follow-up for review: a branded `AdmittedReceipt` type that only the loader module can construct, and/or keeping `validateEvidenceBundle` off any route or client import path.
3. **F3 — wording overstates retention.** Comments and names ("retained", line 58: "Eligible means every claim resolves to a matching retained receipt") describe retention plus hash match as the qualifying condition. Under CODEX-080, retention and hash are only integrity and binding checks. Suggested rewording: "eligible means every claim matches a loader-admitted receipt", plus renaming `retainedPath` / `receipt-not-retained` to admission terms. This is comment and naming only, with no behaviour change, and should go in a separate reviewed patch if wanted.

Real evidence still missing is unchanged from RECEIPT.md: actual game ends, UTC date convention, complete history, metric definitions with null/zero semantics, metric-specific all-NHL populations, and the trusted loader itself.
