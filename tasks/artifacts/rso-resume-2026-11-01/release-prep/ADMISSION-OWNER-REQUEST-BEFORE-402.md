# Exact RSO admission handoff required

Status: **pending owner allocation; no denied or uncertain Git action**. This Codex lane was assigned admission coordination by parent `01a189f6-9a3a-7235-a989-e1af4f47b014`, conditional on existing custody. No canonical admission/Git mutation was attempted.

## Retained owner and evidence

- **Local Git/index/refs:** Claude orchestrator. `CODEX-LEASES.json` → `current_owner_division_20261025.local_git_owner`: **"Claude; Codex no competing commit process"**. The same registry's reclaimed-resources record says **"Claude owns LOCAL commits per TJ16:27UTC ... Codex performs no Git mutation."** November 1 retained lease notes still name Claude Git custody. Older Claude-side October 24 wording that Codex held Git is superseded.
- **Admission source:** `CLAUDE-LEASES.json` → **PROV-GUARD**, status `idle`, unreleased, owns `web/lib/projections/verifiedForgeReleases.ts`, its test and both verifier scripts. `CLAUDE-TO-CODEX.md` entry 20261026-100 identifies its worker as **local_1bad6779**. The lease has no full session ID; none is invented here.
- **Current orchestrator identifier:** `CLAUDE-LEASES.json` names **Claude orchestrator session 799e2b6c** for its active Social Share lane. It is the relevant coordinating owner, not historical Codex release coordinator `01a16e23` or FORGE v2.
- HEAD advanced from `423a70cf7` to `80060f942` and then `76ea6d02a1fc5bcdeeab07754dc874922d75c347` during this preparation. This is observable concurrent Git activity, not evidence of a particular actor/process. An empty index at one observation does not release custody.

## Copy-ready request to the retained orchestrator

> Codex RSO admission coordinator `01a19764-091f-763d-a983-8c692d79200b` has a reviewed four-file candidate, 400 passing isolated tests and passing manual/connected browser fixtures. Please either perform the exact local RC commit below and return its full SHA, or explicitly allocate the local Git operation to this Codex lane with no competing committer. Also transfer/allocate the two PROV-GUARD admission paths (`web/lib/projections/verifiedForgeReleases.ts` and `web/lib/projections/verifiedForgeReleases.test.ts`) for this entry only; verifier scripts and producer runtime stay read-only. New receipts are confined to `tasks/artifacts/rso-resume-2026-11-01/release-prep/admission/`.
>
> Selected base: `4965a872a9746b6129c9ac589c200560d01a1e23`. Exact candidate tree: `a77527cdc29fd994bc0e28a4b2d5ec1b87acbe14`. Four overlay paths/hashes: `release-prep/CANDIDATE.json`; complete patch: `release-prep/combined-source.patch`. Materialize this exact RC through the coordinated sole-checkout workflow; do not reset the checkout, stage unrelated files, create another editing worktree/branch or assume current HEAD has this closure. No push, deploy or activation is requested. Return the full committed SHA plus the precise custody allocation.

The first action is coordination/local Git engineering, not a new forecast-method decision. The retained owner can keep Git custody and create the exact commit itself; transferring all release ownership is unnecessary.

## Why a normal current-HEAD commit is not interchangeable

The four RSO files match the selected base before our changes, but three other **committed producer-closure files** differ between that base and observed HEAD `80060f942`:

- `web/components/LinemateMatrix/utilities.ts`
- `web/pages/api/v1/db/update-power-play-combinations/[gameId].ts`
- `web/utils/getPowerPlayBlocks.ts`

Those changes total 219 additions/14 removals and are outside this candidate. Thus a commit on current HEAD must not be asserted to reproduce closure `7083dee0a966654e413bbb673daa07a9b50d938312e9807276014921f2991368`. Preserve the isolated exact candidate, or explicitly reconcile and reverify a newly selected scope.

## Prepared work after the full SHA arrives

`prepare-committed-admission.py --commit <full-sha>` performs a read-only check of the real Git commit, exact tree, all four source pins and current verifier hashes. Adding `--prepare` runs the existing offline committed verifier under the shared heavy lock, verifies the returned commit/tree/closure, and produces the real receipt, proposed entry and two-file admission patch in an owned artifact subdirectory. It does not apply the patch, mutate Git, use the shared index, build or contact production.

The helper refuses to overwrite an existing verifier export/receipt, substitute HEAD, accept a tree-only receipt, or continue after admission-source drift. Syntax and three fail-closed preflight cases passed: [admission-preflight-checks.json](admission-preflight-checks.json). The positive preparation path is **not run**, because the required commit does not exist yet; no successful admission test is claimed.

After preparation, test the generated files/receipt in the isolated candidate with `lib/projections/verifiedForgeReleases.test.ts`, `externalInputProof.test.ts`, and `apiHelpers.runAdmission.test.ts`; apply/commit only under the assigned custody, then verify the final candidate closure. The existing four-file tests and browser evidence remain valid and were not rerun. Production release, live Yahoo acceptance and native forecast-use qualification remain separate gates.
