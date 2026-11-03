# Claude-130: focused S3 contract v1 re-review

Contract reviewed: `tasks/artifacts/rso-wave2-2026-10-25/VORP/S3-SCENARIO-CONTRACT.md`, SHA-256 `ca0ab38245a753953a0d99680f7ec693700a22378ed850dc2db50bdf5f3381a1`.

**Disposition: the prior four amendments are substantially addressed; one availability-witness correction remains before numerical scenario-use acceptance.** The 14-day policy is accepted here only as a proposed operational cap, not actual forecast coverage or an accuracy finding. Uncertainty propagation and weekly isolation are closed at the contract level, with their specified implementation tests still pending. No code, numerical accuracy, production activation or ownership transfer is approved by this coordination review. S1/v1 and the offline S2 path remain independent.

## Remaining correction: bind availability to the exact output version

V1 section 3 proposes `finished_at` from `run-lifecycle-queries.ts:112` as a reliable completion/publication witness. That citation is **stale-running-run failure cleanup**, not successful publication:

- `queries/run-lifecycle-queries.ts:106–130` constructs timeout/failure metrics and marks a stale run failed. Presence of that field alone does not mean success.
- The successful path calls `runMetricsFinalizationStage` at `run-forge-projections.ts:1216`, which sets `metrics.finished_at` in `stages/metrics-finalization-stage.ts:70`. It then awaits the successful run status/metrics write at `run-forge-projections.ts:1225–1232`. Therefore that timestamp is computed before the final write acknowledgement; it is not itself a publication-commit timestamp.
- Player, team, goalie and reserve persistence uses `.upsert` on the run/game/entity/horizon key (`stages/persistence-stage.ts:7–56`). The inspected code does not bind a finish timestamp to an immutable per-output content version/manifest. A checksum computed from a later read proves those later-read bytes, not their existence at the earlier finish time.

Specification counterexamples, not executed fixtures:

1. Metrics finish time is before D; final succeeded-status acknowledgement is after D. Using that finish value can backdate availability across D.
2. A run finished before D. Its same-key projection row is subsequently replaced, then read after D. The old run finish plus a new row checksum does not prove that new row version was available at D.

Requested contract change, sections 3/7/9:

- Replace the blanket finish-time witness with an explicit **exact-output availability witness**: its kind, trusted source, observed/publication time, full row identity, content checksum or immutable version/manifest reference, and binding to the run's successful admitted state/provenance.
- A run-level finish can be supporting evidence only where the publication protocol and immutable output binding establish that the exact selected version was published by the witnessed time. Do not assume that protocol from the field name or from current `status=succeeded`.
- A supported alternative for a new current decision is a retained, trusted server-side read/capture of the exact admitted output bytes completed no later than D, with its observation receipt and checksum retained. Label it **observed available by** that time, not first publication. Bind the admission/identity/conditioning/proof evidence to that capture. The decision follows completion of the capture. Do not backdate a capture taken after a historical D or claim a coherent set of rows without matching capture evidence.
- Missing exact-version timing/binding yields `temporal_provenance_unavailable` and no numeric ΔF. No new database schema, source mutation, production read or output recapture is authorized by this review; establish the method in the contract/offline cases first.
- Add offline cases for finish-before-D/ack-after-D, stale failure metrics, later same-key overwrite with changed checksum, missing version/receipt, a valid pre-D exact-output capture, and a post-D capture that must not be retroactively eligible.

Correct the citation to the success metrics path, but changing the citation alone is insufficient. A reliable end timestamp and exact-output binding are separate requirements. Existing eight-day source/input age rules, ordered clocks, fixed saved decision time and reconstruction exclusion remain appropriate provisional safeguards; they do not supply the missing publication evidence.

## Calendar cap: closed as a policy limit, not coverage proof

V1 correctly captures the calendar policy, requires the whole actual F inside it, forbids clipping/fallback substitution and keeps period/season/team/schedule identity explicit. Keep those rules.

`forecastCalendarPolicy(14)` merely returns a policy object (`player-forecasts/contributions.ts:9–17`); the resolver later rejects missing, stale, out-of-horizon or unapproved sources (`:278–300`). It generates no forecasts. Existing bridge reads successful h1 runs through now +7 days and the configured producer targets seven slate dates through today +6. Neither guarantees successful complete output coverage, and neither becomes a 14-day producer through this policy.

Keep three claims distinct in the scenario and UI:

1. F is inside the allowed calendar bound.
2. Its full schedule/identity coverage and eligible decision-time basis-rate evidence are complete.
3. Native, separately issued forecasts for each F game actually exist, if that is independently established.

This rate scenario intentionally needs the second claim, not a fabricated claim that the third exists. It may apply an eligible basis line to F only under its explicit stationary-rate/fixed-roster assumptions. “Complete” means the required scenario inputs are complete, not that the future is known or that native F forecasts were generated. Retain unknown when the necessary basis/timing/conditioning/schedule evidence is absent. Do not add a requirement for native per-F forecasts merely to run an honestly labelled offline rate scenario.

## Uncertainty and weekly effects: closed in the design

- V1 now distinguishes complete, assumption-based, conditional and unavailable states; gates numeric output on complete arms; propagates relevant unknowns across points and category components/denominators; forbids cancelling identical unknowns; and keeps scoped diagnostics separate from whole-roster ΔF. These address the prior aggregation request. The implementation should retain all reason codes when multiple unavailable states apply.
- Trade/membership conflicts remain unknown; conditional or absent goalie-start basis is not turned into a start probability or zero. Reserve conservative zeros stay assumption-labelled in the arms/result. Missing conditioning does not become unconditional. No further policy broadening is requested.
- The private scenario adapter and scenario-only entry point preserve real conditioning, keep shared/weekly permissions untouched and exclude scenario objects from native/legacy serving and persistence. V1 requires S3-on/off equality for weekly scores, primary, alternative order, frontier/pruning, chains and no-move against the accepted S1 baseline. This closes the earlier design gap; the exact hook and tests still need review when implemented. There is no evidence yet that those runtime invariants have passed.

The proposed five-file handoff remains conditional; S1's carve-out remains resolved. No exact-path transfer or session start occurs here. Return a revised contract hash with the availability method and cases; do not reopen the other three amendments or hold S1/v1 release on this optional scenario. This review performed source inspection only, with no numerical validation, app/native tests, production calls or changes to Claude's contract, code or leases.
