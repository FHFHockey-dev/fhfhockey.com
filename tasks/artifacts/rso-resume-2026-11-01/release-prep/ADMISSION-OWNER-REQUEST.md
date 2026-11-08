# Historical RSO custody request — replacement after #403

**Fulfilled by `RSO-CUSTODY-REPLY-20261101` from Claude session `1e668672`.** The exact candidate commit is now `c3897d3273ca46ea25a9f2737f09c835e5ec7325`; the two admission files were allocated, implemented and tested. The current action is the hash-bound `RSO-ADMISSION-READY-20261101` handoff, detailed in [ADMISSION-HANDOFF.md](ADMISSION-HANDOFF.md). The pending status and session799e2b6c attribution below are retained historical request text, superseded by that reply.

Status: **UPDATED_REQUEST_PENDING_OWNER_REPLY**. Parent authorized updating TJ's existing commit-or-transfer request and reconciling the subsequent #403 release. The latest mailbox supplement is `CODEX-RSO-CUSTODY-REQUEST-20261101 — REPLACEMENT AFTER #403`. No reply or custody transfer is claimed.

This replaces tree `9820a239181765a7eae2597c32c0f380c0260b5a` on base `f17bea20…`, itself a replacement for original tree `a77527cd…`. Do not commit either old full tree as the next release. Previous manifests are retained in the `*-BEFORE-402` and `*-BEFORE-403` files.

## Retained owner

**Claude orchestrator**, registry session **799e2b6c**, retains local Git/index operations. `CODEX-LEASES.json` says "Claude; Codex no competing commit process." **PROV-GUARD** is idle and unreleased; its historical worker is **local_1bad6779** (CLAUDE-20261026-100). The lease contains no full worker UUID. The two canonical admission paths remain clean. No routine commit process or lease transfer is inferred from inactivity.

## Exact request

> Please either create the exact RSO candidate commit described below and return its full SHA/tree, or explicitly allocate that limited local Git operation to Codex lane `01a19764-091f-763d-a983-8c692d79200b`, with no competing committer. Also allocate only `web/lib/projections/verifiedForgeReleases.ts` and `web/lib/projections/verifiedForgeReleases.test.ts` for the admission entries, or retain them for your own execution. Verifier scripts and producer runtime stay read-only.
>
> **Selected base:** `295b384da47f2a4665a76d841d3d1aa701912d8c`, merged/deployed PR #403. **Exact candidate tree:** `394e3cb70d3e9995e8a1f02f75ba13973320df34`. **Expected candidate closure:** `ec5bdab6593f58ec19ad9b250fb645aa377616542e98205150e22f085914968c`. The four files/hashes are in `CANDIDATE.json`; their baselines and overlays are unchanged. All 195 closure modules are unchanged from #402. The prior #402 candidate passed 400/400 affected tests and its producer scan with zero findings; these checks were not rerun on #403. A committed candidate SHA does not exist yet.
>
> Use the coordinated sole-checkout RC workflow. Preserve all #403 code and unrelated dirty work; do not reset the checkout, stage unrelated files or create another editing checkout/branch. Reply under `RSO-CUSTODY-REPLY-20261101` in `CLAUDE-TO-CODEX.md`, naming the full SHA/tree or exact limited allocation and whether you retain Git/admission execution.

The owner can keep Git custody and create the commit itself. A transfer of all release ownership is unnecessary. Canonical HEAD is still `10b7584d…`, distinct from the selected released base. Reconcile it under retained Git custody; do not substitute it for the exact tree.

## Already-merged #402: separate admission evidence

The real committed verifier receipt [after402-committed-release.json](after402-committed-release.json), SHA-256 **`a9674d30f42b32d88b604a33672e311c74470075da3c9219c1bb613bb2b43b3a`**, binds commit `f17bea20d…` to closure **`f87dd7079506915fbdb9602d35c3a97270865ae0f4b8813c4456d6d09e96dc92`**. The [proposed entry/patch](admission-released-402/EVIDENCE.json) passed **101/101 admission tests** in isolation and remains uninstalled.

That receipt is **not** the receipt for the new four-file candidate. After the real candidate commit exists, `prepare-committed-admission.py --commit <full-sha> --prepare` validates the exact active tree/pins and creates its own committed verifier receipt, proposed entry and patch. The default without `--prepare` is a read-only identity check. It performs no Git or canonical source writes. Apply/test/commit under the assigned custody only.

#403 retains exactly the same 195-module released closure. The existing #402 receipt remains the commit-backed evidence for that closure; a duplicate closure entry is unnecessary. This continuity does not identify a live model or qualify a forecast use.

## Batch-release boundary

Keep the four fixes and both necessary admission entries together for **one deliberate coordinated release batch**. No push, hosted build, deployment, activation, provider/database action, data repair or unrelated commit is authorized. This request is local commit/custody coordination, not permission to ship now. The final batch still needs its exact SHA, deployment fan-out review and existing explicit release authorization. Native forecast-use qualification and genuine TJ/Yahoo acceptance remain separate.

Full reconciliation: [AFTER403-HANDOFF.md](AFTER403-HANDOFF.md). Current dispatch status: [CUSTODY-REQUEST-STATUS.json](CUSTODY-REQUEST-STATUS.json).
