# v2 offline replay runbook (patches 06 + 07), 2026-10-20

**What it is:** an offline replay of one v2 daily run at 2026-10-21 clocks, on the committed v2 stack (06 + 07). It reads your private 2026-10-16 folder, makes **no network requests** (`fetch` throws) and **no database writes** (no client exists), and writes only into a new output folder you name.

**Script:** `tasks/artifacts/forge-v2-prerollout-gates-2026-10-19/v2-replay-20261021-split.ts` (sha256 `c6dc063d0ef7a1d6b8094908586c9d3cd5cb440757026859b1c68f7f364860dd`).
- It is a copy of `../forge-target-scope-fix-2026-10-19/v2-replay-20261021-publishdry.ts`, updated for 06's gates and 07's two requests and two proofs. The old script still matches its recorded receipts and is not changed.
- The receipt it writes holds counts only, with no player identities. The rest of the output folder holds private data, so keep it in your private area.

## Run it

Pick an output folder that does not exist yet and is outside the repository. From `web/`:

```bash
NODE_PATH=. npx ts-node --transpile-only -O '{"module":"commonjs","moduleResolution":"node"}' ../tasks/artifacts/forge-v2-prerollout-gates-2026-10-19/v2-replay-20261021-split.ts /Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1 /Users/tim/Documents/FHFH-private/v2-replay-split-20261021-run1
```

- It takes about 25 seconds, prints the receipt, and also writes it as `replay-receipt.json` in the output folder.
- To run it again, pick a new folder name. The script refuses to write into an existing folder.

## What the replay does

| Phase | Steps |
|---|---|
| **A** | The means plan's **true** status. The retained cache lacks 6 goalie summaries, so the plan is `requests_pending`. `inputs-v2` must stop with `means_plan_incomplete` (the A-17 gate) |
| **B** | The same means with the plan **marked complete** (a disclosed stand-in), then:<br>• `inputs-v2` (two requests);<br>• two simulated closures;<br>• `outputs-v2` with both proofs and the pinned ref `tj-standing-approval-2026-10-17:forge-daily`;<br>• a synthetic review;<br>• `validateCadenceCommand` with both proofs;<br>• a publish dry run.<br>Three gate checks also run, and each must stop |

The other stand-ins are listed in `standIns`:
- the retained 69-player universe (no Yahoo read);
- re-stamped captures;
- means history only through 2026-10-12;
- a simulated closure and a synthetic review.

## Pass criteria (receipt fields)

| Field | Must be | Reference run, 2026-10-20 |
|---|---|---|
| `phaseA.stopped`, `phaseA.reason` | `true`, `means_plan_incomplete` | as required |
| `inputs.status`, `inputs.method` | `inputs_bound`, `frozen_window` | as required |
| `inputs.materializations` | skater and goalie both > 0; each ≤ 1,500 | 1,060 / 200 |
| `inputs.meansOnlyExcluded` | the means-only players (10 on retained data) | 10 |
| `proofs.manifestItemsTotal` | about 1,324 (skater + goalie) | 1,324 (1,113 + 211) |
| `proofs.sharedClosureScope` | `true` | `true` |
| `gateChecks.unpinnedApprovalRef` | `standing_approval_ref_not_pinned` | as required |
| `gateChecks.missingGoalieProof` | `split_materialization_proofs_required` | as required |
| `gateChecks.singleProofValidation` | `materialization_publication_scope_mismatch` | as required |
| `outputs.status` | `outputs_built_pending_independent_review_and_catalog_head` | as required |
| `outputs.nulls.gated` | ≤ 100 (the `--max-null-participation` bound) | 100 (exactly at the bound) |
| `pendingRejected` | `Native publication admission failed.` (pending reviews are not admitted) | as required |
| `reviewedValidation`, `cadenceValidation` | equal row counts, no `…Error` field | 84 / 84 |
| `cadence.requiredSources`, `cadence.producerReceipts` | 2, 2 | 2, 2 |
| `publishDry.status`, `publishDry.reasons` | `dry_run`, `[]` | `dry_run`, `[]` |
| `publishDry.unboundSources` | 0 | 0 |
| `networkRequests`, `databaseWrites` | 0, 0 | 0, 0 |

Other figures from the reference run:
- 64 native inputs and 505 sources in the plan;
- 1,260 participation entries;
- request sizes of 35.1 MB (skater) and 12.8 MB (goalie), against the 64 MiB bound. Each request carries all the shared parents.

**Any other result is a fail.** Keep the output folder and send the receipt (counts only) to the Chef.

## What this replay does not cover

- **The rolling method (the Oct 27 run).** The retained data has no rolling-window boxscores, so this replay can only run the frozen-window path.
  - The rolling split is covered by unit tests: a synthetic 62-skater, 7-goalie, 20-game day (1,520 inputs) in `nativeDailyPipelineV2.test.ts`, run through to a publish dry run.
  - The first live rolling day needs `capture-v2` plus the `rollingFirstIssuance` flag.
- **Live captures, hosted materialization, publish, CAS and readback.** These remain separate approvals.
