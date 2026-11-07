# Qualification discovery and capture protocol — 2026-11-01

**Execution update:** TJ subsequently authorized the two metadata SELECTs through the parent delegation. They completed against the verified active `fhfhockey.com` project: November 1 identity metadata returned **0 rows**; November 2 schedule metadata returned **4 rows**, without overflow. The actual model identity and canary remain unknown. See `discovery-20261101/RESULTS.md` and its receipt. Section A is now the retained proposal/authorization record, not a pending approval request. Sections B/C remain gated; no consumer capture or operational action was authorized or run.

This is a local preparation packet, not permission to execute further production reads. The existing hashed FORGE-QUAL protocol remains unchanged. After #403 reconciliation, the application candidate is tree `394e3cb70d3e9995e8a1f02f75ba13973320df34`; its four source overlays and producer closure are unchanged. No qualification source is added to it.

## Identity actually known

| Fact | Evidence / current value |
|---|---|
| Released web code | #403, `295b384da47f2a4665a76d841d3d1aa701912d8c`; READY production metadata verified |
| Its verified producer import closure | `f87dd7079506915fbdb9602d35c3a97270865ae0f4b8813c4456d6d09e96dc92`, `../after402-committed-release.json` |
| Four-file RSO candidate closure | `ec5bdab6593f58ec19ad9b250fb645aa377616542e98205150e22f085914968c`; verified source commit `c3897d3273ca46ea25a9f2737f09c835e5ec7325`; final admission commit still pending with Claude1e668672 |
| Actual issued qualification identity | **Not yet observed**: method, codeVersion, configurationHash and artifactHash remain unpinned |
| Actual canary/serving configuration | **Not established**; current metadata request denied 403, historical Oct26 receipt is not current |

The release SHA and closure are not a substitute for the actual run identity. `run-forge-projections.ts` records eight model settings, hashes their exact string/null values, and hashes `{codeVersion, configurationHash}` as the no-fitted-artifact identity. Its codeVersion may come from FORGE_CODE_VERSION, VERCEL_GIT_COMMIT_SHA or GIT_SHA. A merge or successful deployment does not prove that a captured live revision was issued under that tuple. Legacy captured-input admission and snapshot-less closure admission are separate paths; absence of the new closure from the catalog does not by itself establish a live captured-revision failure.

No suitable actual revision metadata is present in this lane's retained evidence. The owner can supply an already-authorized saved metadata result instead of making another read. Its provenance/date and byte hash must accompany it; no invented identity or default environment is acceptable.

## A. Executed metadata-discovery proposal retained for provenance

Proposed target: production Supabase project `fyhftlxokyjtpndbkfse` (linked project ref read from `supabase/.temp/project-ref`). The executor must confirm this is still the intended production target before execution.

Proposed approval text:

> Allow one read-only transaction on FHFH production Supabase `fyhftlxokyjtpndbkfse`, executing the two SELECTs in `qualification-capture/identity-discovery.sql`: latest-per-game model/run metadata for November 1, 2026, and game IDs/start times only for the proposed November 2 pilot. Each SELECT returns at most 17 rows, with a 5-second statement timeout and 1-second lock timeout; concurrency one, no retry. No forecast values, player rows, outcomes, Yahoo/NST requests, application requests, writes, jobs, builds or activation. Stop on any error, no identity, mixed identity, missing fields or overflow. Save only the returned metadata and its hash locally.

The 17th row detects overflow; the accepted population is at most 16. Never truncate it to manufacture a passing scope. This is two SELECTs, at most 34 returned rows, in one read-only transaction, followed by rollback. The existing slate index and primary-key joins constrain access, but scanned rows/DB CPU are not measured; the two statement deadlines bound each query's execution. No RSO or Start Chart/Vercel runtime is invoked.

The dates are fixed, not a standing recurring grant. If execution is delayed, revise the proposed dates before asking for the new window. November 1 metadata is discovery only, not a retrospective first prospective slate. November 2 is provisional: no qualifying game set or clock time is invented before schedule evidence exists. A missed T−60 window is a missed slate, not permission to backdate a capture.

The two SELECTs were subsequently authorized and executed once each in separate read-only transactions, with the stated timeouts and rollback. Actual results and exact executed SQL are in `discovery-20261101/`; the proposal above describes the earlier requested grouping. No database credential was read. The production-read boundary comes from AGENTS.md and the delegated scope, not an inferred skill approval rule.

## B. Validate discovery offline, before any consumer request

1. Preserve exact metadata bytes, query hash, observedAt and target project identity. Keep no auth headers or credentials.
2. Run `node tasks/artifacts/rso-resume-2026-11-01/release-prep/qualification-capture/inspect-identity.mjs <metadata-array.json> 2026-11-01`.
3. The tool checks captured_live/h1, successful run, exact revision/snapshot identity, complete eight-setting environment, recomputed configuration/artifact hashes, chronology, duplicate game IDs and mixed tuples. It emits the observed tuple only when these checks pass. It always reports `qualificationReady: false`: consistency is not release attribution or consumer selection.
4. Verify actual codeVersion against its exact released commit and receipt; review the run's producer stamp/invocation lineage with the existing release/proof logic. Do not use the RSO candidate receipt or a closure hash as a model artifact hash. Reconcile the observed version rather than assigning the latest deployed SHA to it.
5. Obtain the producer owner's existing non-secret canary and capture/compute/serving receipt. Metadata rows alone do not establish that the complete canary population was observed. No flag or schedule changes are authorized.
6. Use November 2 schedule metadata to state the actual canary game IDs, first puck-drop instant and T−60 capture instant. Require the same tuple on that future slate; pin a **new artifact copy** of the frozen scope before E1 capture. Do not rewrite the retained scope or waive its reset rule. If no suitable future slate exists, return the exact producer/identity gap.

The owner must also establish the first eligible slate for that tuple from existing issuance metadata. If an earlier post-October-30 slate already satisfied the fixed first-slate rule and its capture was missed, do not silently relabel November 2 as the first slate. A prospective restart/start-date amendment requires the scope owner's explicit decision before new capture, with the missed evidence recorded and thresholds unchanged. This discovery query alone does not establish that historical eligibility boundary.

`inspect-identity.test.mjs`: 10 synthetic tests pass, including missing configuration staying unknown, changed/mixed identities, reconstruction, local code labels, chronology, sealed dates and population limits. This is not live evidence. The discovery query intentionally reads latest-per-game metadata; it is not the RPC's selected/frozen revision contract and cannot replace E1.

## C. Prospective capture contract after A/B and a separate bounded approval

Preserve the original claim: skater unconditional SHOTS_ON_GOAL, h1; Start Chart display plus eventual RSO totals/comparison. RSO assignment and conditionalTieBreak stay denied. No review is added before prospective evidence and explicit owner approval.

For the exact approved future slate/canary population:

1. **E1 at T−60:** capture the selected immutable revisions via `read_forge_game_revisions`, plus only the referenced input-snapshot identity metadata needed to bind them. Save the original bytes/hashes. Evaluate issued unconditional values offline using the issuing version's existing admission/scoring code; do not rebuild forecasts using current inputs. Preserve every canary skater row, including explicit unknown/excluded rows.
2. **E2 once at T−60:** one ordinary GET to `/api/v1/start-chart?date=D` (complete slate, no pagination or nonce) and one GET to `/api/v1/roster-schedule-optimizer/data?seasonId=20262027&startDate=D&endDate=D`. Record actual request/response times, hashes, returned date, source, serving state and policy. Stop if Start Chart falls forward to another date, either consumer changes source/identity, the population exceeds the approved cap, or a response is missing/oversized/non-200. No retries, cache busting, browser reloads or private Yahoo endpoints.
3. **Normalize E2 offline:** decode the RSO `body.data` through the issuing release's `decodePlanningDataTransport`; read decoded forecasts and map canonical IDs through issuedContext.nhlPlayerId. Compact bridge rows are a different path and do not stand in for captured game revisions. Preserve source clocks and targetAllowedUses; a denied use remains denied. Start Chart rows must join to exactly one gameRevisions entry per game. Use the original issue revision and unconditional value, never a convenient alternative row.
4. **E3 at D+1 noon America/New_York:** one bounded settlement query for the frozen game IDs, and one final-pregame-pin query. Actual SOG is ES+PP+PK only when all three components are known. Missing rows/fields remain unknown; a non-dressing zero requires affirmative participation evidence under the predeclared rule. Save immutable version 1; any repair becomes version 2.
5. Run the corrected integrity checker; preserve failures. It does not compute accuracy metrics. Freeze the season-rate comparator at the same issue cutoff from existing original evidence before reading outcomes. If that evidence/extractor is absent, report a missing comparator, not a retrospective substitute. Metric tooling must implement the unchanged player-and-game clustered bootstrap and predeclared two looks before any qualification decision.

Potential pilot envelope: two E1 database reads + two application GETs + two settlement/pin reads = six external reads. This is **not yet an approved or fully cost-bounded execution plan**: exact game/row/byte caps depend on A/B, original-input baseline availability remains to be established, and application internal DB fan-out is not bounded by the client request count. The current RSO route has a 20-second shared data deadline, but this is not a Vercel CPU ceiling. Start Chart's page-specific cache keys can cause each page request to repeat a full slate load; its CTPI read loops until exhausted. Client cancellation does not prove server work stops. Do not reuse the old “9 requests” estimate as a total cost guarantee.

Only after these bounds and missing evidence are resolved should the orchestrator request a concrete pilot approval (date, times, IDs, maximum rows/bytes, runtime/fan-out and stop conditions). Do not activate serving or run issuance to make a pilot possible. Existing producer owner must report any required operational decision separately.

The full protocol remains 14 slates with at least 500 settled skater-games; slate 7 is harm-only and slate 14 the final look. Preserve the original thresholds and sealed October 23–30 block. No new production reads, review, recurring automation or release is authorized by this document.

**Offline E2 implementation update:** `normalize-readbacks.ts` implements step 3 for the inspected released transport/response contract. After independent review, 18 typechecked tests pass under both UTC and America/New_York; capture clocks require explicit timezones and real calendar dates. CLI usage and retained-evidence reconciliation are in `RETAINED-EVIDENCE.md`. E1 issue-version extraction and prospective accuracy/comparator evidence remain separate; the adapter grants no qualification.

The subsequent integration checkpoint passes **12 typechecked tests**, including normalized RSO/Start Chart rows through the actual integrity CLI. Synthetic unknown values and denied uses remain intact; changed revision identity and unknown-to-zero substitution fail. See `normalizer-integration-check.json`. This adds evidence-chain verification without pinning a real model or changing the scientific scope.

**Offline E3 implementation update:** `normalize-settlement.mjs` converts saved strength rows into the checker's settlement schema, preserving missing outcomes as unknown and requiring complete ES/PP/PK counts, explicit versions and source/capture chronology. Its 18 synthetic tests pass under both timezones. All four clocks reject impossible dates and preserve microsecond ordering. See `SETTLEMENT-HANDOFF.md` and `timestamp-review-fix/REVIEW-RESPONSE.md`; game completion and affirmative non-dresser evidence remain separate, and no live data or scientific acceptance is implied.

**Offline E1 binding preflight:** `inspect-issued-packet.mjs` checks saved selected-RPC revisions against saved identity metadata and their original game/roster contexts; 11 synthetic tests pass. This prevents latest-per-game metadata from being substituted for a different selected revision. It calculates no forecast value and does not perform original issue-version scoring/admission. See `ISSUED-PACKET-HANDOFF.md`; authentic inputs and their release attribution remain required.

**#403/configuration update:** all 195 producer modules are unchanged; existing #402 closure evidence carries forward. Current environment metadata access returned 403 and no CLI fallback is installed. `OWNER-DECISION.md` records the exact missing owner receipts, provisional four-game clock window and unresolved cost bounds. No live canary approval is requested before those prerequisites are concrete.

## Sources and custody

- Existing frozen `FORGE-QUAL/scope.json` and `TJ-DECISIONS-RECORDED.md` control scientific intent; this packet corrects capture mechanics, not thresholds or population selection.
- Released/current source inspected: `run-forge-projections.ts`, `gameRevisions.ts`, `externalInputProof.ts`, `starterBoardFlags.ts`, `planning.ts`, `planningInputs.ts`, `planningDataTransport.ts`, the RSO data route and Start Chart route; the revision/RPC SQL migrations establish the metadata query's schema.
- Supabase skill applied for DB preparation. Official [function documentation](https://supabase.com/docs/guides/database/functions) and [changelog](https://supabase.com/changelog) were consulted; the markdown changelog endpoint was unsupported by the browser tool, so the HTML fallback was used. No relevant API/schema feature change was introduced.
- Original PROV-GUARD/FORGE-QUAL custody remains intact. See the single coordination addendum in CODEX-TO-CLAUDE.md. Any supplied exact candidate SHA/transfer must first pass the existing admission preflight; no push/build/deploy is implied.
