# FORGE-QUAL checker v2 (Claude, 2026-11-21)

## Scope
Build the v2 evidence checker to the approved `SCOPE-AMENDED.json` (forge-qual-scope-v2, protocolHash `2acaff68…`).
Offline, synthetic fixtures only. Session started by Chef local_9996b7b8 via local_091a3ca0.

## Where
- New: `tasks/artifacts/rso-review-scope-2026-11-21/tooling-v2/` (README, check-readbacks.mjs, metrics.mjs, two test files,
  reference_bootstrap.py, fixtures/{scope,issued,rso,settlement,baseline}.json). v1 untouched.
- No `web/` edits, no commits (Chef commits by pathspec). Reads web/lib/projections/evidenceTime.ts at runtime (as v1).
- Fixture generator was a scratchpad script (not kept); fixtures are static JSON now.

## Decisions / reading
- Verified: canonicalHash(protocol) = 2acaff68…; baseSeed 7f8b18a3b1d413c5 re-derives; preBootstrapProtocolHash dc9c87b7… =
  canonicalHash(protocol without bootstrap). SCOPE-AMENDED.json sha256 1667940c… unchanged.
- artifactHash = canonical sha256 of {codeVersion, configurationHash} (planning.ts revisionModelIdentity at 6ca16d025).
- Served value = line × (basis ends _playing ? 1 : 0); null line stays null (consumerRevisionAdmission.ts:208-211 at 47a1a2628).
- Settlement: a served row of a settled game needs an explicit row (actual 0, dressed false) → settlement_missing otherwise.
- acknowledgedAt required on issued rows (else the after-ack check is vacuous).
- Assumptions listed in README "Assumptions to confirm before slate 1" (opaque surface hash, literal pins, strict < 0.03,
  look 1 recomputed at final, F/D group population from the extractor).

## State
- Done: metrics.mjs, checker v2, tests 52/52 (37 checker + 15 metrics), README. Advisor review 2 fixes applied (literal-only pins so draft dry runs pass; dated findings → fail_integrity reachable; unsettled → inconclusive_data; --tolerance locked; scopeStatus/dryRun; integrityShare over served; no unissued cascade). RNG anchored on published xoshiro256**/splitmix64
  vectors; 10k-replicate bootstrap bit-identical to the Python reference.
- Command: `node --test tooling-v2/check-readbacks.test.mjs tooling-v2/metrics.test.mjs` (a bare directory arg doesn't work).

- Chef (via parent local_091a3ca0) accepted additions; ruled surface = {path: sha256} map of the 3 B7 files, sorted, exact
  path-by-path equality (implemented, pinned_surface_map_invalid / surface_changed added/removed/changed). Tests 52/52 after.

## Next step
Parked until the identity fix (6ca16d025) and participation (47a1a2628) ship; then build the extractor (slate plan, TJ approval).

## Blockers
None.
