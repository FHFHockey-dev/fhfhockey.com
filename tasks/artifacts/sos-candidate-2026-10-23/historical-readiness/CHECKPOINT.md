# Context checkpoint — SoS historical-data prerequisite

Owner: `01a168fb-3199-7407-9b20-160ccb41003d` (SOS-CANDIDATE / MASTER-F9). Parent: `01a15411-3560-7632-8d31-1dd2447ba00e`.

## Work state

The mathematical offline candidate, corrected report/contract/inventory and runnable bundle are complete. The base revision had 41 supplied tests and 7 independent reviewer checks pass. The two minor review findings were closed with three focused temporal checks; demo and exact-input outputs remained byte-identical. Current candidate manifest SHA256 is `d211aa5f1ac59bb396bb9f640de3acf47f30aea1ff5cccc7b425dd9311f2327b`; this data-readiness continuation leaves it unchanged.

New addendum is complete locally under `historical-readiness/` and intended for the same subdirectory in the canonical SoS artifact namespace. It contains README findings, DATA-MANIFEST.json, EXTRACTION-PROPOSAL.md, availability-preflight.sql, runnable inventory.py, LOCAL-INVENTORY.json, SOURCE-PINS.json, VERIFICATION.json and its own manifest/checksums. It is separate evidence, not a replacement mathematical candidate or retrospective acceptance of a new model.

No qualified timestamp-correct NHL cohort was established. All 248 old capture paths and the raw audit extract are missing. The task-8 durable directory has 62 derived files; two sampled payloads match the transformation manifest and were acquired October 22 after October 13/20 cutoffs. Zero original-hash overlap with the old 248 captures establishes different lineage. Only two derived payloads were parsed; all 62 paths/sizes were checked. No model experiments were rerun. The planner has 324 reciprocal team/date cells = 162 games, with matching per-date counts; that is calendar evidence only.

Useful source lead: versioned raw NHL boxscores (`nhl_api_game_payloads_raw`, checked-in update/delete guards and first-observation-preserving writer) plus immutable season schedule snapshots/fixtures. These tables' current deployment, population, complete coverage and true historical availability are unverified. `games` alone is current identity/schedule metadata. Existing power tables are optional; direct/RPI/Colley need a complete result ledger, not a precomputed quality table. Exact game end evidence and raw-hash serialization semantics are explicit remaining adapter issues.

## Files, branch and lease

- Sole repository checkout: `/Users/tim/Code/fhfhockey.com`, observed `octoberBranch`, HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. No commit, index or ref mutation by this lane.
- Owned: `tasks/artifacts/sos-candidate-2026-10-23/**` and `tasks/diaries/2026-10-23-codex-sos-candidate.md`. Release-owner acknowledgment at 14:00:52 UTC was relayed by parent; old pending ledger prose is historical.
- Preserve GameGrid UI/reader owner `01a16599-195b-7550-9700-af8770380001` and release/model/refs owner `01a1637a-4222-70c0-8439-cb3cc46b20c4`. No application ownership requested or used.
- Durable task workspace: `/Users/tim/Documents/Codex/2026-10-23/task-11`.
- External read-only evidence: `/Users/tim/Documents/Codex/2026-10-23/task-8/artifacts/derived-exposure/inputs/`. No file in that owner's namespace was changed.

## Checks and original failures

- This continuation: one bounded local inventory run; JSON parsing, Python AST, selected SQL columns against checked-in schema, read-only keyword/transaction/cap checks pass. SQL execution/plan checks NOT RUN. No new unit/synthetic tests or prediction experiments.
- Earlier stability failure: strict `<.1` bound was mathematically false at the exact 1/10 change. It was replaced by exact Fraction direct/RPI deltas and a 12-decimal Colley check plus all-team rank oracles. Original `tests-initial.log` remains retained.
- Earlier independent review corrected extraction wording (one removed LF) and past diagnostic label. Preserve `review-r1/before/`, review receipt and correction.diff.
- Library: required helper failed at discovery with DNS, then TLS on one network-enabled attempt. Both were before uploads; no Library IDs, pending write or uncertain outcome. Local report and ZIP are preserved under `task-11/delivery/`; exact receipt is LIBRARY-DELIVERY.json. Do not re-upload without a relevant connection change, or bypass the required workflow.
- Executor: three parallel reads failed before execution with `Failed to create unified exec process: exec-server transport disconnected`. After environment recovery, the one harmless pwd check and subsequent local reads succeeded. No killed process, Mac restart, network changes or replacement thread.

## Active operations and stopping state

No active command/session/run IDs. No database/API/capture/model run was launched. No approval is pending. This is a natural completion checkpoint for the bounded data-readiness assignment, not a claim that a verified 5% threshold was received. If the ledger owner signals 5%, do not start a new phase; this diary/addendum already preserves the completed and unfinished work.

## Exact resume steps

1. Verify executor access once. If disconnected, report the exact failure; no retry loop. Check the addendum manifest and base candidate hash before editing; preserve concurrent leases.
2. Read README.md, DATA-MANIFEST.json, EXTRACTION-PROPOSAL.md and LOCAL-INVENTORY.json. Do not repeat broad method research, all 41 tests, the 7 independent checks, or the derived-exposure model run.
3. Ask the parent whether another already authorized durable result/schedule archive was located. A derivative's old declared input cutoff is insufficient; keep actual acquisition and full-cohort/version evidence.
4. If authorized separately, execute only the pinned Stage A availability preflight against the approved FHFH project: three sequential read-only SELECT requests, proposed season 20252026, 10-second statement/1-second lock timeout, 2 MiB combined output, header/game sentinel caps. Inspect relation definitions before later queries. No provider calls, captures, retries, automatic pagination or silently expanded scope.
5. If Stage A supports real historical cutoffs, pin at most four cutoffs by coverage before outcome inspection, resolve end-time/availability/hash semantics, and finalize exact Stage B row IDs/bytes plus evaluation protocol. Preserve chronological held-out data and identical support. Do not treat raw indices as probabilities or selected retrospective reconstructions as predictive validation.
6. If Stage A lacks old revisions, report the irrecoverable vintage gap. A new export can support current retrospective reconstruction; new future collection cannot recreate lost historical knowledge. Any new production read/capture needs its own bounded authorization.
7. Keep Opportunity `GP+.25*offNights` and current WeekScore unchanged. Any eventual integration remains with the existing owners and requires the approved replacement/ablation plan.

The parent/ledger owner can consolidate this checkpoint without deleting the outstanding empirical-data and integration items. The unresolved work is precise data eligibility, a separately authorized extraction if needed, evaluation target/calibration decisions, empirical qualification and later integration—not unfinished mathematical implementation.
