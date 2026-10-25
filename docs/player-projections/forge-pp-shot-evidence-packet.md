# ⠕ Prospective FORGE PP shot evidence packet

This is the normative private export contract. `pp_evidence_capture.py` now records
supplied original receipts before a game, then seals supplied freeze and outcome
receipts into new immutable packet revisions. It performs no acquisition, model
execution, training or serving. `pp_shot_support.py` remains an engineering harness: its CLI accepts
only a discovery inventory and always reports unqualified predictive evidence.
An authentic packet can supply its pure `pp_rate_ablation` helper through the
mapping below; count replay and predictive evaluation require later qualification.

## Encoding and identity

Use a private, immutable directory outside the repository. `manifest.json` is the
entry point; other files are UTF-8 JSON. Store existing source payloads once and
refer to them, including their original IDs, versions and hashes. All properties
in the types below are required; unavailable values are explicit `null`, never
inferred zero. No extra properties belong in these new envelope types. Referenced
existing payloads retain their own versioned contracts without reshaping them.

`Instant` is a timezone-qualified ISO-8601 timestamp, `Date` is a valid YYYY-MM-DD,
`Id` a positive safe integer, `Hash` a lowercase 64-character SHA-256 and `Number`
a finite JSON number. The additional numeric bounds appear in the validation
rules. `Ref.pointer` and `original_row_pointer` are RFC 6901 JSON Pointers (empty
string means the root of their respective referenced file or read result).
Paths are relative to the packet root, with no traversal, symlinks or remote URLs.
`Ref.sha256` hashes the exact referenced file bytes. Retain existing semantic
`projectionInputHash`/provider hashes separately; do not substitute byte hashes
for them. Every referenced file must appear once in `manifest.files`; a reference
must agree with that entry. Verify the pointer after verifying the file hash.

```ts
type Instant = string; type Date = string; type Id = number;
type Hash = string; type Number = number;
type File = { path: string; sha256: Hash };
type Ref = File & { pointer: string };
type Receipt = {
  source_ref: Ref; source_revision: string;
  published_at: Instant | null; received_at: Instant | null;
  available_at: Instant | null;
};
type Manifest = {
  version: "forge-pp-shot-evidence-packet-v1";
  packet_id: string; exported_at: Instant;
  experiment_base_sha: "76d507ea84634a91a69f61648d0a58e85e76571b";
  protocol_ref: Ref; files: File[];
  games_ref: Ref; opportunities_ref: Ref; outcomes_ref: Ref;
  coverage_ref: Ref; development_use_ref: Ref;
  capture_receipt_ref: Ref;
  checkpoint_policy: "frozen_final_pregame";
  protected_inclusive: ["2026-01-03", "2026-04-16"];
  predictive_qualification: "pending";
};
// games_ref resolves to Game[]; each entry references one original FrozenBoardSource.
type Game = {
  game_id: Id; slate_date: Date; season_id: Id; game_type: 2;
  home_team_id: Id; away_team_id: Id; horizon_games: 1;
  cutoff_at: Instant; source_query_cutoff_at: Instant;
  maximum_feature_available_at: Instant | null;
  issued_at: Instant; scheduled_start_at: Instant; frozen_at: Instant;
  run_id: string; revision_id: string; input_snapshot_id: string;
  input_snapshot_hash: Hash; output_hash: Hash;
  captured_code_version: string; resolved_code_sha: string;
  code_bundle_ref: Ref; nonsecret_config_ref: Ref;
  frozen_board_source_ref: Ref; issued_context_ref: Ref;
  schedule_receipts: Receipt[];
  population_policy: {
    id: string; definition: string; declared_at: Instant;
    candidate_player_ids: Id[]; roster_receipts: Receipt[];
    completeness: "complete" | "partial" | "unknown";
    completeness_proof_ref: Ref | null;
  };
};
type Window = {
  membership_rule_ref: Ref; weighting_recipe_ref: Ref;
  members: {
    game_id: Id; team_id: Id; source_ref: Ref;
    pp_seconds: Number | null; pp_shots: Number | null;
    rate_weight: Number | null; receipt: Receipt;
  }[];
  // Unweighted cumulative exposure is the candidate's support, not a new rate denominator.
  cumulative_pp_seconds: Number | null;
  original_rate_denominator_seconds: Number | null;
  coverage: "complete" | "partial" | "unknown";
  completeness_proof_ref: Ref | null;
};
type Scalar = { value: Number | null; derivation_ref: Ref | null };
type PPInput = {
  original_read_index: number; original_row_pointer: string;
  supplement_ref: Ref | null;
  row: {
    sog_per_60_last5: Number | null; sog_per_60_avg_last5: Number | null;
    sog_per_60_all: Number | null; sog_per_60_avg_all: Number | null;
    toi_seconds_total_last5: Number | null; toi_seconds_total_all: Number | null;
  };
  windows: { last5: Window | null; all: Window | null };
  baseline_weight: Scalar;
  context: {
    shot_quality: Scalar; on_ice: Scalar; team: Scalar; rest_schedule: Scalar;
  };
};
type Opportunity = {
  key: string; game_id: Id; team_id: Id; opponent_team_id: Id;
  canonical_player_id: Id; nhl_player_id: Id;
  membership_revision: string; membership_ref: Ref;
  position: "F" | "D" | null;
  pp_input: PPInput | null;
  issued_projection_ref: Ref | null;
  baseline_pp_shots: Scalar;
  production_conditioning: "conditional_playing" | "full_health_pace" | "legacy_unclassified";
  workload: {
    conditional_pp_seconds: Scalar;
    conditioning: "conditional_playing" | "full_health_pace" | "legacy_unclassified";
    contract_ref: Ref | null;
  };
  participation: {
    probability: Scalar;
    status: "confirmed_evidence" | "modelled" | "missing";
    evidence_refs: Ref[]; contract_ref: Ref | null;
  };
  integration: {
    basis: "existing_joint_scenarios" | "existing_conditional_expectation" | "unavailable";
    contract_ref: Ref | null; joint_scenarios_ref: Ref | null;
    unconditional_pp_shots: Scalar;
  };
  segments: {
    rookie: boolean | null; traded: boolean | null;
    availability_changed: boolean | null;
    evidence_refs: Ref[];
  };
};
// outcomes_ref resolves to Outcome[]; labels never appear in feature source files.
type Outcome = {
  opportunity_key: string; game_id: Id; team_id: Id;
  canonical_player_id: Id; nhl_player_id: Id;
  target_key: "PP_SHOTS_ON_GOAL";
  target_version: "forge-pp-shots-outcome-v1";
  definition_ref: Ref; revision_id: string; supersedes_revision_id: string | null;
  finality: "pending" | "final" | "corrected";
  available_at: Instant | null; receipts: Receipt[];
  played: boolean | null; pp_seconds: Number | null;
  pp_shots: Number | null; total_shots: Number | null;
  coverage: "complete" | "partial" | "unknown";
  completeness_proof_ref: Ref | null;
  zero_basis: "observed_zero_shots" | "observed_zero_pp_exposure" | "certified_nonparticipation" | null;
};
type Coverage = {
  games: {
    game_id: Id; cutoff_candidate_count: number; opportunity_count: number;
    issued_pp_count: number; qualified_window_count: number;
    unconditional_count: number; final_label_count: number;
  }[];
  exclusions: {
    opportunity_key: string; stage: "population" | "features" | "forecast" | "outcome";
    reason: string; evidence_refs: Ref[];
  }[];
};
type DevelopmentUse = {
  windows: {
    start: Date; end: Date;
    use: "untouched" | "development_used" | "protected" | "unknown";
    purpose: string; recorded_at: Instant; evidence_refs: Ref[];
  }[];
  retrospective_or_prospective: "retrospective" | "prospective";
};
// opportunities_ref, coverage_ref and development_use_ref resolve respectively to
// Opportunity[], Coverage and DevelopmentUse. No candidate estimates are captured.
```

## Implemented recorder lifecycle and input schemas

Run the recorder from the canonical checkout on `octoberBranch`. It is dormant
until explicitly invoked. The existing acquisition owner provides the files; this
module never calls the collector, database, network or forecasting code. All
paths inside a request are relative to that request's directory. File references
may also point to unchanged files already retained in the parent packet when
sealing. A new file cannot replace an existing path with different bytes.
`recorder/` and `manifest.json` are reserved output paths.

The lifecycle adds `capture_receipt_ref` to the original proposed manifest. Source
payload contracts and baseline read arrays remain unchanged. A pregame draft has
its own version and null freeze/outcome fields; it is not a frozen forecast.

```ts
type Scope = { game_id: Id; slate_date: Date };
type IssuedBoardSource = Omit<FrozenBoardSource, "frozen">;
// The game/revision/observation objects are ORIGINAL producer exports. In particular,
// retain observation.payload: ForgeInputSnapshot and revision.payload.players.
type DraftGame = Omit<Game, "frozen_at" | "frozen_board_source_ref"> & {
  frozen_at: null; frozen_board_source_ref: null; issued_source_ref: Ref;
};
type RecordRequest = {
  version: "forge-pp-shot-capture-request-v1"; packet_id: string;
  scopes: Scope[]; files: File[]; protocol_ref: Ref;
  games_ref: Ref; opportunities_ref: Ref; coverage_ref: Ref; development_use_ref: Ref;
};
// games_ref resolves to DraftGame[]; other refs use the types above.
type DraftManifest = Omit<Manifest, "version" | "outcomes_ref" | "checkpoint_policy"> & {
  version: "forge-pp-shot-capture-v1"; outcomes_ref: null;
  checkpoint_policy: "awaiting_frozen_final_pregame";
};
type SealRequest = {
  version: "forge-pp-shot-seal-request-v1"; packet_id: string;
  parent_manifest_sha256: Hash; files: File[];
  frozen_sources: { game_id: Id; source_ref: Ref }[];
  outcomes_ref: Ref; coverage_ref: Ref;
};
// frozen_sources reference ORIGINAL FrozenBoardSource objects, one per parent game.
// outcomes_ref resolves to the selected Outcome[] revisions, possibly [] while pending.
type CaptureReceipt = {
  version: "forge-pp-shot-capture-receipt-v1"; phase: "pregame" | "sealed";
  recorded_at: Instant; scopes: Scope[]; request_ref: Ref;
  parent_manifest_ref: Ref | null; recorder_sha256: Hash;
  qualification_blockers: string[];
};
type PPSupplement = {
  input_snapshot_hash: Hash; original_read_index: number; original_row_pointer: string;
  source_revision: string; revision_proof_ref: Ref; receipt: Receipt;
  row: { toi_seconds_total_last5: Number | null; toi_seconds_total_all: Number | null };
};
// PPInput.supplement_ref must resolve to PPSupplement. Its revision proof must be
// verified by later qualification; a mutable lookup cannot supply missing history.
type ZeroProof = {
  version: "forge-pp-zero-proof-v1"; opportunity_key: string;
  zero_basis: "observed_zero_shots" | "observed_zero_pp_exposure" | "certified_nonparticipation";
  fields: { field: "pp_seconds" | "pp_shots" | "total_shots"; source_ref: Ref }[];
  evidence_refs: Ref[];
};
// When any Outcome number is zero, completeness_proof_ref resolves to ZeroProof.
// Exactly every zero-valued field appears once and points to an explicit numeric
// zero in the original provider/adapter receipt. evidence_refs retain the complete
// official sources/certificate. A boxscore omission is insufficient. Qualification
// still verifies the adapter and provider's strength/nonparticipation semantics.
```

`record` requires 1–16 unique, unprotected game scopes. The cutoff-known game
envelope is checked before any feature or label source file is opened, including
when a scope header disagrees with its envelope. The wall clock must be after
original issuance and strictly before the captured scheduled start. There is no
CLI clock override. Historical reconstruction and candidate-mode snapshots are
rejected. Complete candidate lists must have a proof; partial/unknown population
coverage is retained explicitly. Every candidate still needs an opportunity row,
including missing inputs, missing forecasts and eventual nonparticipants.

`protocol_ref` must resolve exactly to `pp_shot_support.PROTOCOL`. The acquisition
owner supplies the actual code bundle as JSON with `commit_sha` equal to
`resolved_code_sha` and retained code/configuration receipts. The nonsecret config
must preserve the snapshot's `modelEnvironment`, `deterministicSeed` and
`seasonBootstrapApplied` values; absent values stay absent/null. Neither the
recorder nor those metadata assertions verify an executable bundle or semantic
JavaScript hashes. Preserve the original semantic hashes separately from file
byte hashes. `Scalar.derivation_ref` must point directly to its original number;
the recorder does not recreate the weight, context or workload formulas.

`seal` creates a fresh directory and distinct packet ID. It verifies the exact
parent manifest hash and preserves all parent source bytes. Only the frozen
checkpoint, selected outcome revisions, coverage ledger and new lifecycle receipt
are added. Original game/revision/observation objects must match the pregame
recording exactly. Schedule updates and trades cannot rewrite its cutoff or team
stint. A corrected label must use a new revision ID, declare `finality: corrected`
and supersede the previously selected revision. Earlier labels and manifests
remain referenced in the packet's immutable ancestry. Sealing without settled
labels is allowed with an empty outcomes array and disclosed exclusions.

Coverage counters are checked against retained rows. `qualified_window_count`
remains zero because the recorder does not qualify rate weighting. Earlier
exclusions are carried into every new selected coverage ledger, even after new
evidence resolves a missing label; the immutable ancestor identifies when they
applied. A later consumer uses current referenced evidence to determine readiness
and retains the disclosures rather than treating the ledger as an automatic
eligibility filter.

The recorder checks captured PP table/identity filters, date bounds, result order,
page size, completeness and final recorded re-read selection, including first-row
ties. Exact select/filter/lower-bound agreement with the **issued code** and
consumption of every input read still require existing offline replay. Rate
weighting, same-revision supplement proofs, provider PP definitions, source
completeness and participation contracts likewise require qualification.
`maximum_feature_available_at` must remain null in recorder packets: this module
cannot verify original availability for every consumed source. Original known
availability remains in receipts; export/receipt time is never substituted.
Every output stays `predictive_qualification: pending` with explicit blockers.

The recorder uses UTF-8 JSON only, rejects duplicate keys/nonfinite numbers,
verifies SHA-256 and JSON Pointers, and refuses traversal, symlinks, overwrite or
repository output. Limits apply before parsing and after generated receipts are
added: 512 total files including the manifest, 64 MiB per file (including requests/manifests), 256 MiB
total packet bytes. Output directories/files are private (0700/0600), file
contents and directory entries are synced before success. A successful command
is retention/structural evidence, not a predictive result.

```sh
# Run from /Users/tim/Code/fhfhockey.com with fresh private output directories.
.venv/bin/python -m modeling.player_forecasts.pp_evidence_capture record \
  --request /absolute/private/acquisition/record-request.json \
  --output /absolute/private/forge-packets/pregame-unique-id
.venv/bin/python -m modeling.player_forecasts.pp_evidence_capture seal \
  --parent-manifest /absolute/private/forge-packets/pregame-unique-id/manifest.json \
  --request /absolute/private/acquisition/seal-request.json \
  --output /absolute/private/forge-packets/sealed-unique-id
.venv/bin/python -m pytest modeling/player_forecasts/tests/test_harness.py -k pp_capture -q
```

These are manual integration entry points for the existing acquisition owner.
No scheduler or live producer is modified or invoked by this change. Existing
`captureForgeReconstruction` output cannot be relabeled as prospective evidence;
future producer contract changes require an explicit adapter/review.

## Qualification rules for the future consumer

1. Bind every game to the existing `FrozenBoardSource`, `ForgeInputSnapshot` and
   `ForgeIssuedContextV1` identities. Resolve the actual immutable code SHA (40
   lowercase hex characters) and keep its original version, model environment,
   seed, bootstrap setting and output hash. The experiment base identifies this
   cycle's policy; it never overrides the code that actually issued a forecast.
   Different pinned baseline dependencies require a separately reviewed re-pin.
2. Verify original feature receipt times and availability at or before the game's
   cutoff; unknown availability remains unqualified.
   `maximum_feature_available_at` is the maximum verified original availability
   of all consumed feature sources, or null if any is unknown. Never substitute
   receipt, export or issuance time. The existing board export's analogous field
   is derived from `read.receivedAt`; retain it as a receipt bound, not proof of
   original source availability. Require
   `source_query_cutoff_at <= cutoff_at <= issued_at < scheduled_start_at` and the
   existing stricter capture/observation/freeze sequence in
   `exportFrozenBoardForecasts`. Keep the original schedule revisions, postponement
   status and per-game cutoff; a later schedule update cannot rewrite this issue.
   Whole slates share a split, while paired forecasts share each game's cutoff.
3. Define the eligible candidate policy before outcomes. Record the complete
   cutoff-known F/D roster candidate list, including scratches, injuries, rookies,
   zero-PP players and eventual nonparticipants. `Opportunity.key` is
   `game_id:team_id:canonical_player_id`; require one row for every candidate and
   unique canonical/NHL identity mapping at that game and team stint. Do not use
   the issued-output manifest as a candidate list, realized GP as an eligibility
   filter or current roster membership to repair a historical trade. Missing
   projections/inputs remain rows with nulls and disclosed exclusions.
4. Rates, exposures, weights and counts must be finite/nonnegative; shots are
   integers, baseline weights/probabilities lie in [0,1], read indices and all
   coverage counts are nonnegative integers. Resolve the original PP row in
   `snapshot.reads[index].result` using its pointer. Require `player_id` to equal
   the opportunity's NHL ID, `strength_state` to equal `pp`, and `game_date` to
   match the row actually selected by that issued run's final consumed
   `fetchRollingRows(..., "pp", asOfDate)` and `pickLatestByPlayer` result. Verify
   the captured table, select, player filter, strength filter, date bounds, order
   and limit against the issued code/query; replay its exact result order and
   latest-date selection, including first-row tie handling and any recorded
   re-read. An older row or another player's internally consistent row is invalid.
   Missing selected rows remain missing; no substitute is allowed. Preserve
   canonical-first, last5-before-all rate selection. A capture-only supplement
   must prove the cumulative
   fields came from that same original row revision/window; a later mutable
   lookup is insufficient. `last5` and `all` mean the source's documented member
   selection, never an assumed five calendar days or a hardcoded season length.
5. For a complete window, require unique member identities, all member receipts,
   complete coverage proof and a documented original rate weighting recipe.
   The sum of member PP seconds must match both `cumulative_pp_seconds` and the
   selected `toi_seconds_total_*`. Reproduce the issued weighted rate using its
   original recipe and denominator; do not assume it equals 60 times unweighted
   shots divided by unweighted minutes. Missing or unverified exposure retains
   baseline support. Certified zero exposure/raw zero has zero candidate weight;
   a positive raw rate with zero exposure is a disclosed contradiction/fallback.
6. Scalars must reference captured diagnostics or deterministic replay traces
   from the issued code/configuration. Preserve workload conditioning, role bounds
   and team reconciliation. `baseline_pp_shots` refers to the issued
   `proj_shots_pp`; it is not the pre-bound rate multiplied by a new marginal TOI.
   Require compatible playing probability plus an existing conditional-expectation
   contract or retained joint scenarios before accepting unconditional counts.
   Unknown, full-health or legacy conditioning cannot silently become expected
   contribution. Keep candidate calculations and comparator estimates out of the
   capture system; they belong to the later offline consumer of the same packet.
7. PP shots require official credited shots on goal and credited goals under a
   declared, versioned provider strength definition. Retain the official event/
   strength and exposure receipts and complete-game coverage proof; total SOG or
   PP points do not identify PP SOG. Final/corrected labels may arrive after the
   cutoff and stay label-only. Select and hash one declared outcome revision per
   opportunity before scoring; preserve superseded revisions. A missing boxscore
   player row alone never certifies nonparticipation. Every numerical zero needs
   its matching complete-source zero basis. Unknown labels remain null. When
   complete comparable totals exist, require PP SOG <= total SOG; positive PP SOG
   with zero PP exposure is unqualified until provider semantics are reconciled.
8. Verify coverage counts against referenced rows and retain every exclusion.
   Reject protected slates without reading their feature/label files. Disclose
   prior development use; retrospective reconstruction stays retrospective.
   After packet qualification, the offline evaluator freezes whole-slate 60/20/20
   split dates and meets the sample/acceptance rules in `protocol.json` before
   tuning. The capture manifest's `pending` status cannot bypass those gates.

## Integration points; reuse rather than duplicate

| Existing interface / evidence | Packet use | Required addition in the next capture phase |
| --- | --- | --- |
| `inputCapture.ts`: `ProjectionInputRead`, `captureProjectionInputs`, `capturedReadReceipt`, `projectionInputHash`, `replayProjectionInputs` | Retain original query/results and receipt hashes; reuse replay's network/write suppression | Capture-only sidecars must not insert unconsumed reads into the baseline replay array; keep them separately hashed and linked to the original source revision |
| `gameRevisions.ts`: `ForgeInputSnapshot`, `saveForgeInputSnapshot`, `projectionWritesHash`; tables `player_forecast_source_observations` (`forge-run-inputs-v1`) and `forge_game_revisions` | Original `IssuedBoardSource` in `record`; unchanged `FrozenBoardSource` in `seal` | Acquisition owner exports the existing source objects and original availability; recorder performs no database writes |
| `starterBoardDataset.ts`: `FrozenBoardSource`, `readFrozenBoardSource`, `exportFrozenBoardForecasts`; `forge_final_pregame_revisions` | Reuse identity, frozen-checkpoint and timing validation | Complete pre-outcome candidate population alongside its serving-only forecast pool; its manifest explicitly reports `completeParticipationCandidatePool: false` |
| `issuedContext.ts`: `ForgeIssuedContextV1`, `captureForgeIssuedContexts`, `forgeScheduleRevision`, `forgeRosterRevision` | Reuse canonical/NHL identities, team-stint roster and authoritative schedule revisions | Original availability/completeness proof for all candidates, including players without issued rows |
| `queries/skater-queries.ts`: `fetchRollingRows`, `ROLLING_ROW_SELECT_CLAUSE`; `types/run-forge-projections.types.ts`: `RollingRow` | Reference the original selected PP row and its rates | Private same-revision cumulative `toi_seconds_total_last5/all` and window/weighting receipts; these fields are currently absent from the live select/type. Leave live baseline reads and types unchanged in the capture-only phase |
| `stages/skater-stage.ts`: `sampleShrinkage`, `sogPer60PpPreBound`, role bounds, reconciliation and `playerUpserts.proj_shots_pp` | Existing replay supplies scalar weights/context, workload and unchanged baseline counts | Retain referenced replay diagnostics, not a second implementation of FORGE formulas |
| `starterBoardScoring.ts`: `boardSkaterForecast`, `integrateBoardParticipation`; `planningContributions.ts` | Reference existing participation/conditioning contracts and evidence | Missing probability remains unavailable. Board categories omit PP SOG; preserve the primitive split before scoring and do not rename total SOG to PP SOG |
| `settlement.ts`; `player_forecast_outcome_revisions`; official raw NHL sources | Reuse correction/finality/source-revision conventions for available targets | A private PP-SOG outcome adapter with full event-strength/completeness evidence. Current `SKATER_COLUMNS` maps total `shots_on_goal`, not PP SOG; no existing PP label is asserted |
| `run-forge-projections.ts`: `replayForgeSnapshot` | Reuse exact captured code/environment/read-consumption/output-hash verification | Full replay runs offline only; `captureForgeReconstruction` remains historical reconstruction, not original feature availability |
| `pp_shot_support.py`: `pp_rate_ablation` | Use the mapping below for primitive rate mechanics | Later consumer verifies the packet first; current exporter never qualifies it or computes accuracy |
| `pp_evidence_capture.py`: `record_pregame`, `seal_packet` | Private, immutable retention of the same source objects and packet envelopes | Acquisition owner supplies `RecordRequest` then `SealRequest`; future evaluator consumes the final manifest after qualification, with no duplicated FORGE calculations |

The future qualified consumer passes `Opportunity.pp_input.row` unchanged to
`pp_rate_ablation`, supplies `baseline_weight.value` and the product of the four
existing context scalar values, and iterates only the five predeclared prior
minutes. It derives `exposure_complete` from the selected window's verified proof,
not an inventory flag. Null baseline/context scalars exclude the mechanics row;
null exposure keeps baseline support. Multiplying these existing context
adjustments reproduces the deterministic baseline expression; it is not an
assumption about independence of participation, workload and production.

The next phase must capture evidence only. No candidate gate is enabled or added
to serving here, no projections are republished, and no model is trained. Packet
availability by itself does not select a parameter or permit rollout. Preserve
the current baseline; any later candidate integration requires the original
acceptance and independent-review gate and a dedicated default-off mechanism.
