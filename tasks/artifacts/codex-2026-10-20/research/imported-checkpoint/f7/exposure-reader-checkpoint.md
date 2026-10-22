# Reader seam verified; full writer round trip remains open

Later checkpoint: `exposure-writer-roundtrip.md` now executes actual deriveOutputs/compactor with explicitly scoped no-op dotenv/inert-client mocks. The import restriction below describes this earlier stricter slice; full processPlayer/database execution remains unperformed.

2026-10-20 UTC. **PASS: eight grouped contract checks**, including six substituted-identity cases, using the actual `fetchRollingRows` and `mergeRollingSupportPayloadFields` exports. Run `bash /workspace/shared/fhfh-research-2026-10-20/run_exposure_reader.sh`. Results, source hashes and query calls: `exposure-reader-results.json`; console receipt: `exposure-reader-run.txt`.

Explicit Node22.11.0, existing TypeScript loader, empty inherited environment and the same network/provider/env guards. No network, client creation or dotenv-load attempt occurred. No application edits, historical inputs or real service queries. The “db” argument is a bounded in-memory query double, not a connection.

## Observed reader result

Hand-authored post-compaction-shaped rows were supplied. They are **not claimed to be outputs of the real writer**.

- Actual reader restores selected scalars from the matching sidecar: shots_total_all=11, toi_seconds_total_last5=6,000, sog_per_60_all=16.5.
- It rejects substituted player, game, date, season, strength and payload-schema identities. Conflicting non-null wide/sidecar values are also rejected. Absent support leaves a selected count null, not zero.
- **Paired SOG support remains unavailable.** Even when the synthetic sidecar contains sog_per_60_shots_last5=1 and sog_per_60_toi_seconds_last5=1,200, the actual reader does not restore them: neither is selected. It similarly does not select/restore toi_seconds_total_all. This proves a consumer exposure gap, not that the writer currently emits those paired fields.
- The actual generic merge helper also fills only keys already present in the consumer row. Supplying more sidecar metadata alone does not extend a consumer's schema.

Snapshot identity survives the tested reader boundary; observation-level numerator/TOI frame identity has not been established. Existing aligned conversion support is a goal/shot or assist/goal frame, not a SOG/TOI frame.

## Precise writer blocker and smallest next plan

The actual compactor `splitRollingUpsertRowForDurableStorage` is exported only by `web/lib/supabase/Upserts/fetchRollingPlayerAverages.ts:451–543`. Importing that module first imports dotenv, calls dotenv.config three times, validates provider credentials and initializes a client (`:325–347`). It has no injected-client/import-safe seam for the pure compactor. **That module was not imported, no guard was bypassed, and a full writer/compaction/readback round trip was not run.** Source inspection is not execution evidence.

Smallest subsequent engineering prerequisite, not implemented here: provide an import-safe module for the existing pure compactor and required pruning helpers/constants, leaving env/client initialization in the invoked writer. Then run a synthetic producer → real compactor → injected actual reader fixture. Before changing F3's caller, bind the intended SOG/TOI numerator, exposure, window, missing/reconstructed support and source identity; explicitly test whether current writer output and reader selection can carry that contract. Missing transport fields must be surfaced, not replaced by generic cumulative TOI.

Task-list checkpoint: “Pure aggregation/sample/bootstrap checks and actual injected reader verified. Reader rejects substituted sidecar identities but does not transport paired SOG/TOI fields. Complete writer round trip blocked by import-time env/client setup; import-safe compactor seam and typed support contract remain prerequisites. No predictive/release qualification.”
