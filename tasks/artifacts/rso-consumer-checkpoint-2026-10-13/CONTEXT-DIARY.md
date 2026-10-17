# RSO / Start Chart consolidated local handoff

2026-10-13. Canonical `/Users/tim/Code/fhfhockey.com`, `octoberBranch`, HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`. Changes remain local and uncommitted. This diary supersedes earlier open explicit-ID/fallback notes, without changing historical receipts or declaring beta acceptance.

## Ready locally

- Existing solver selects legal crowded-day assignments using supported player values, including overlapping positions and scoring changes. Unknown/conditional values withhold qualification; rejected moves preserve inputs and the subsequent baseline.
- Consumer permission checks reject conditional scoring uses. Raw conditional detailed rows are rejected before reconstruction, including populated baseline catalogs; independent supported baseline fallback is preserved.
- Product baseline admission verifies existing captured native history, bound boxscore values, identities, cutoff and exact reproduced rate/source ID. External or unclassified inputs are excluded visibly. The generic contribution store and isolated comparison references remain unchanged. Missing native proof yields unavailable baselines, not replacement values.
- Shared RSO/Start Chart revision admission and Start Chart raw runs require the existing native external-input exclusion marker.
- FORGE player fallback candidates require that marker before projection access. The goalie reader validates the actual selected run, including fallback and explicit selection. A requested-date 404 now fetches the actual fallback summary: qualified fallback 200; unqualified fallback 422.
- The separate FORGE owner closed default latest-run admission and all three compatibility projection routes' explicit-ID bypasses. Those previously listed bypasses are no longer open in this candidate.

## Reviewed versus outside this packet

The parent confirmed independent review passed for the bounded consumer increments, goalie follow-up and default/explicit-ID increments. This worker verified bytes against retained accepted inventories; it did not repeat independent review.

- **17 owned reviewed paths:** complete inventory in `reviewed-owned.sha256`. It merges the original planner/contribution five-file packet with the latest 13-file provenance packet; Start Chart is shared between those packets. All hashes matched before and after final TypeScript.
- **Six separately reviewed default/explicit-ID paths:** `apiHelpers.ts`, its test, `projections/{players,goalies,teams}.ts`, and `explicitRunAdmission.test.ts`. Hashes match the FORGE owner's `native-run-admission/receipt.json` and `explicit-run-admission/receipt.json`.
- **Six native producer/calibration paths:** preserved and hash-verified against those owner receipts. Their earlier producer evidence remains in `tasks/artifacts/forge-native-input-separation-2026-10-13/`; no fresh independent-review claim is added here.
- **Other dirty work:** outside this review packet and untouched here. This includes CategoryGains, source audit/lineage tests, task documentation and other owners' patches. Their review status is not inferred from the combined compiler pass. The complete status snapshot is in `verification.json`.
- **New handoff files:** this diary, two hash manifests, `verification.json` and the empty successful compiler log are handoff-only artifacts, not product changes. They have not undergone separate independent review.

## Checks and recovery evidence

Final combined current-tree check: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false` from `web/` **passed**, exit 0, empty `combined-typecheck.log`. All 29 inventoried paths still matched afterward. No test suite, build or server was rerun for this final handoff.

Reuse existing focused evidence: initial planner/Start Chart 199 cases; contribution correction 267 cases; provenance boundary 196 cases; final goalie-reader correction 7 cases; separate latest-run 26 and explicit-ID 38 cases. These overlap and must not be summed. Relevant scoped lint/whitespace passed in the corresponding receipts.

Recoverable worker evidence remains at `/tmp/rso-daily-beta-checkpoint-20261013/`:

- `review-correction/`: initial consumer reconstruction delta and exact five-file candidate.
- `provenance-correction/`: distinct 13-file incremental patch, before-copies, hashes and focused verification.
- `goalie-fallback-review/`: final two-file delta, red/green regression and updated 13-file candidate hashes.
- `final-handoff/`: final 17 owned hashes and 12 other-owner inventory matches.

Original evidence is preserved. The prior provenance patch plus the goalie follow-up delta reconstructs that candidate. The FORGE owner's distinct patches and receipts remain in its repository artifact directory.

## Genuine gaps that remain

1. Historical accuracy summaries, stored calibration hints and the atomic-result SQL contract are not comprehensively filtered or quarantined for native exclusion provenance. The SQL contract's older rolling-history check alone is insufficient. Historical investigation, lineage disposition and any migration remain separate authorized work; no existing records were inspected live or changed here.
2. Genuine immutable player/goalie issuance, lawful input/cutoff/participation/lineage, supported declared scope, and matching positive RSO/Start Chart readbacks remain required. Synthetic success and source separation do not supply those facts.
3. Predeclared evaluation/calibration evidence, uncertainty/coverage and supported performance claims remain separate from engineering guards. No coefficients were retuned.
4. Actual provider/account/both-tier continuity acceptance, measured real workloads and owner beta/release decisions remain open. Weekly-lock and commercial additions remain full-launch scope. No historical preservation blocker is revived.
5. No live native baseline inventory was queried. If existing released data is external/blended or lacks bound native input proof, the product boundary returns unavailable with an explicit limitation. No fallback replacement was synthesized.

## Exact next command and resume rule

Start by checking the frozen reviewed bytes, then the separate owner bytes:

```sh
cd /Users/tim/Code/fhfhockey.com
shasum -a 256 -c tasks/artifacts/rso-consumer-checkpoint-2026-10-13/reviewed-owned.sha256
shasum -a 256 -c tasks/artifacts/rso-consumer-checkpoint-2026-10-13/forge-preserved.sha256
```

If a hash differs, identify its current owner and changes before proceeding; do not reset or overwrite. Otherwise reuse these receipts and take one newly authorized acceptance/calibration item. Do not restart settled tests, reopen preservation holds or use production endpoints as discovery. Release, database changes and genuine issuance require their own explicit scope.

No owned process remains running. Shared servers/browser sessions were untouched. No commit, push, deployment, database write or production request occurred. Usage last showed 2% available with the same reset timestamp; no transition to 100% was observed or consumed.
