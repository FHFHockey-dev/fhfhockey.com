# Reviewed checker installation — allocation pending

The independent [microsecond re-review](../../../rso-settlement-audit-2026-11-01/microseconds-rereview/REVIEW.md) closes downstream P2 in the isolated candidate. Original adapter P2/P3 remain closed. [CLOSURE.json](microseconds-review/CLOSURE.json) records the November 1 22:26 UTC reconciliation: all 19 audited file hashes remain unchanged, 66 distinct tests / 132 independent executions passed across UTC and America/New_York, and both original failures reproduced before the repair. No tests were repeated at this checkpoint.

The pending action is a local installation of the already reviewed patch, not another scientific or production approval. The `FORGE-QUAL` coordination record names the artifact lane but has `write_paths: []` and no current exact-file allocation. The separate `RSO-ADMISSION-FILES` allocation covers only the release catalog and its test. Neither establishes custody of these retained checker files. Installation has not been attempted; it is pending, not denied or of uncertain outcome.

| Target under `tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/tooling/` | Required original SHA-256 | Reviewed replacement SHA-256 |
| --- | --- | --- |
| `check-readbacks.mjs` | `1788c6549ae6f3a8bf3a24c6cfd82599fb349ef89fafc39f5528cd2277235e2e` | `d4b95c100a69d60ce3aea845ed7b4990b43b22c0a6ca5eac8f4d59519a146add` |
| `check-readbacks.test.mjs` | `479edbef96b5af789dd8809f04b8809d885c93fc9a2c423e513308ebf6b28230` | `4a5ad746e1231e0be099c810ce75a23db0fb6dc496c10cd887cc43fe505c8e23` |

Patch: [source.patch](source.patch), SHA-256 `e2ef1e35fd12889838c8ed9c4a2fe6ac85dc72f9715fcde84440954514f87e08`. It includes the earlier completeness/sealed-window/capture-clock supplement and strict microsecond ordering. Independent review checked application against untouched originals, exact replacement hashes and execution from the retained installation layout using disposable copies. The checker now requires existing `web/node_modules` TypeScript tooling to import the unchanged pure production timestamp parser. Its documented pre-existing `/tmp` alias entry-guard limitation remains; use physical absolute paths for CLI verification and require nonempty JSON output.

## Exact orchestration handoff

> Reconcile the retained FORGE-QUAL checker custody and allocate the two exact files above to Codex RSO lane `01a19764-091f-763d-a983-8c692d79200b`, or identify the current custodian who should install this reviewed patch. Before installation, verify the original hashes, patch hash and absence of a conflicting active claim. If they match and allocation is explicit, install only these two files, check the resulting hashes, and perform the focused installed-layout verification. Stop on drift and request the changed file or custody receipt rather than overwriting. Preserve the scientific scope, forecast-use gates, frozen admission candidate and all unrelated dirty work. Git/index/ref custody remains with Claude; no commit, push, build, deployment, production/provider call or activation is requested.

This handoff is prepared for the parent orchestrator. No new mailbox message has been sent for this distinct tooling topic. The two existing authorized Claude requests remain pending: final admission commit matching tree `125279a5a50d661c4a01d585a4c593693e0ab2f6`, and Start Chart bounded-read patch application or exact route/test transfer. This checker patch belongs to a separate coordinated local batch; it does not expand that frozen admission tree.

Model/configuration and genuine issuance evidence still follow [OWNER-DECISION.md](../qualification-capture/OWNER-DECISION.md). The Vercel metadata 403 remains a denied action that was not retried. Synthetic checks establish engineering behavior only; no live-capture authorization, forecast-use approval or daily-beta acceptance follows from this review.
