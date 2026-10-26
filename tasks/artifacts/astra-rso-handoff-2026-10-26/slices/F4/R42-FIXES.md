# C7 R42 fixes (PROV-GUARD): A1, A2, A4, A7

**Base** HEAD `595ab13d9773808057b49cc3ed91d9eaca8ed317` · **Uncommitted.**

No git mutations, production reads or deploys. Git use was read-only (`rev-parse`, `archive`, `show`), with `GIT_DIR` unset.

| Item | Fix | Test |
|---|---|---|
| **A1** | `6613c9ef…` is de-listed. `VERIFIED_FORGE_PRODUCER_CLOSURES` now has one entry, `4c06fd9e…9993`, with a new required field: `commit: 595ab13d9…`. Its receipt is the verifier run on that commit (`release-verification/595ab13d9….json`, sha256 `8b651750…7f42`, 193 modules, 0 findings). | `verifiedForgeReleases.test.ts` requires each closure entry to name a full-SHA commit, and requires its receipt to be a **commit** receipt (`sha` = commit, a tree hash, no worktree or export `source`) with a matching identity. |
| **A2** | On a failed proof read: the feature builder uses **no** FORGE team row (`forgeTeamProjectionProofUnavailable`, fallback flag `<side>_forge_projection_proof_unavailable`, warning `forge_projection_proof_unavailable`); snapshot reuse returns null so the snapshot is rebuilt; public serving keeps stored predictions visible, labelled `proof_unavailable`. | `featureBuilder.test.ts`: proof read failed. `workflow.test.ts`: doesn't reuse when it can't classify. `publicPredictions.test.ts`: stays visible as `proof_unavailable`, including the would-be `claim_withheld` game. |
| **A4** | Closure admission requires the V2 `code_versions` array, so a 5a19f1def-era stamp denies. The check is in `externalInputProof.verifiedRunAttribution`, keeping the producer closure unchanged. | `externalInputProof.test.ts`: "denies a closure stamp that predates code_versions". |
| **A7** | `contradicted` is split into `claim_withheld` (verified producer capture without the claim) and `malformed_capture` (the claim is present, but the receipt is invalid or the payload names another run). Both are always withheld. | Classification table: 9 cases, including 2 `malformed_capture` cases. The builder never uses a `malformed_capture` run. |

A3 is an accepted residual, with no change.

**Closure:** unchanged at `4c06fd9e…9993`. HEAD plus these 11 files, verified with `--tree`, gives 193 modules and 0 findings; none of the 11 is in the closure. The `--tree` run rewrote the committed `closure-4c06…json`; I restored it byte-for-byte from HEAD.

## Checks

| Check | Result |
|---|---|
| Focused vitest, 41 files (proof, allowlist, identity, run fence, `forge/*`, `projections/*`, start-chart, ledger, `lib/game-predictions`, `nhl-predictions` page, game-prediction routes, `lib/dashboard`), UTC and America/New_York | **passed**: 621, 1 skipped, in each |
| Whole-project tsc on a HEAD + 11-file `/private/tmp` export, under the heavy lock | **passed**: exit 0 |
| eslint on the 11 files | **passed**: exit 0 |

## Files (sha256)
- `6452eb1095ade54359dd99e580d433e8f7906359815d6a36293fa907c644b4ca`  web/lib/game-predictions/featureBuilder.ts
- `b5642675186594a4e511e7bd27b8f08e9844eb1c0698ba5ffdcb008cd541359b`  web/lib/game-predictions/featureBuilder.test.ts
- `1036dd295fe642f29fba9652bd1bfe889583b7533e6a23c5d4e9cbf75d53526a`  web/lib/game-predictions/publicPredictions.ts
- `9a439fe7454c3ee586f0c9ad3b57f659dce82464d686de5a8581cc19fe251639`  web/lib/game-predictions/publicPredictions.test.ts
- `24b936b3e20c2a80b99af4c3d96c23636f7d33361dde46a5ec746570e4484ff2`  web/lib/game-predictions/workflow.ts
- `fd7fa7539131e5c9374ce2fda4daaa7a1fe867800554bbf4ad6b3fa0ebbccfbb`  web/lib/game-predictions/workflow.test.ts
- `81781a819462b4e0a0081e57816d6b5cd0785df97f36583d5ad879b9cac7c489`  web/lib/projections/externalInputProof.ts
- `b7b8d5bde35993ab1a5bc875c239dd9f455eb64c884e36aba7ade81a55e443e1`  web/lib/projections/externalInputProof.fixtures.ts
- `d320f135108c7ffb4fbd2a8083dc8627740722c88319d5d5f7b68a131978a930`  web/lib/projections/externalInputProof.test.ts
- `e6b969de2abdde065618191d5b2695c4f96af567d55111c621ac3b88e41148c8`  web/lib/projections/verifiedForgeReleases.ts
- `aeb2404ac7a6f1d1781dd57424a60cdcf852bb14471c91de9029f80f23cf3844`  web/lib/projections/verifiedForgeReleases.test.ts
- `8b651750974bdd84b4bfe798580c6716dc4cf423efceca97eb44ba991c8b7f42`  tasks/artifacts/projection-table-audit-2026-10-26/release-verification/595ab13d9773808057b49cc3ed91d9eaca8ed317.json
