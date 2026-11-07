# Additive research and fixture integration — 17 October 2026

Local integration on canonical `octoberBranch`, starting at `ceceb407a29b45f2e5b0c090ecfcff0c27e15d4c`. Changes remain uncommitted. This note describes the current local comparison; imported research and its review describe their historical cloud snapshots.

## Newly imported

- [Reasoning audit](IFTTT-REASONING-AUDIT.md), [claim-rule contract](CLAIM-RULE-CONTRACT.md), and [original fixture review](OCT16-ORIGINAL-PACK-INDEPENDENT-REVIEW.md). These are historical research, design and provisional review evidence, not instructions to activate anything or claims about current implementation coverage.
- [Curated family fixtures](../../../web/lib/sources/fixtures/iftttSemanticResearch/semantic-family-cases.json): 15 provisional cases, 40 selected claim spans, 29 exact text variants and 19 indexed families. Fixture bytes are unchanged from the curated transfer. The derivative excludes raw export records and transport identifiers; metadata-dependent relation assertions cannot be verified from it alone.
- [Repository-native integrity tests](../../../web/lib/sources/iftttSemanticResearch.test.ts): exact UTF-8 text hashes, code-point and UTF-16 offsets, complete family membership, unresolved canonical bindings and provisional/non-runtime labels. NX015 remains divergent historical prognoses, not an established same-game IN-versus-OUT dispute.
- [Curation receipt](CURATION-RECEIPT.json) and [import provenance](IMPORT-PROVENANCE.json) preserve archive identity, source/installed hashes and transformations. Only two absolute cloud workspace prefixes were removed from the contract document. Other imported files are byte-identical.

The downloaded archive's SHA256 is `0ceaf0cbb5a372b3e75e8e900ef3451eedab854ed6403f54b82374a9df5bd82f` (79,543 bytes). All packaged member hashes were verified before selecting files. ZIPs, raw historical audit data embedded in the compare-only patch, full retained source trees and machine-path test receipts were not imported.

## Already present or reconciled

| Reviewed item | Current local result |
| --- | --- |
| Final r3 source-claim registry | Already committed; byte-identical to the prior reviewed handoff. Unchanged. |
| Final typed NO-DISPATCH reducer adapter | Already committed; only the two repository-relative imports differ from the handoff. Unchanged. |
| Compact-initial resolver | Reviewed initial-only normalization and comparison already present. Existing 26-case regression file is byte-identical to the compare-only test patch. No source/test change needed. |
| Injury-to-goalie contamination guard | Already prevents injured player IDs/names from occupying goalie slots, but cleared inherited goalie fields. Applied only the reviewed conditional override in `tweetProjectionStorage.ts`, preserving base goalie fields for injury-kind rows. Added one synthetic regression to the existing `projectedLineups.test.ts`. No old fixtures or audit rows copied. |
| Newer intake/receiver/scheduler/alias-replay work | Occupied paths preserved. No historical receiver/replay patch applied. |

The goalie regression observes both retained goalie names, null unresolved goalie IDs, retained injury fields/events, and no goalie capture call. It failed on the previous implementation because both goalie names were cleared, then passed after the correction. Existing tests also cover typed goalie rows, immutable version conflicts, retry and publication boundaries. Existing polluted immutable rows were not repaired; corrected retries can still encounter the existing version-conflict guard.

## Explicitly held work

- No semantic adapter was invented for the NX cases. The existing pure reducer expects bound identities, scope, provenance and clocks absent from this derivative. The 47 new research tests establish integrity only; all 15 cases retain `not_run_against_implementation` and provisional annotations. Original metadata, human adjudication and runtime semantic acceptance remain absent.
- The historical evidence-context `without` span patch remains blocked because changing evidence offsets can change immutable identities. No evidence-span, report-key or event-key changes were made here.
- Earlier lineup-parser sibling experiments remain withdrawn. Separate four-lane historical parser/provenance/replay/ingress patches were not present in this curated transfer and were not applied.
- Pure registry/planner reviews do not grant durable-persistence, dispatch or production approval. Historical review counts are not new local test results.
- No Decisions API, Luna Agent or Vercel AI implementation; no provider request, deployment, push, migration, ingestion, repair, credential or schedule change.

## Verification actually run

Node `22.11.0`, npm `10.9.0`, existing repository dependencies; no install or lockfile change.

From `web/`:

```sh
npm test -- --run lib/sources/iftttSemanticResearch.test.ts lib/sources/projectedLineups.test.ts lib/sources/playerIdentity.compactInitial.test.ts lib/sources/playerIdentity.test.ts
npx --no-install eslint lib/sources/iftttSemanticResearch.test.ts lib/sources/projectedLineups.test.ts lib/sources/tweetProjectionStorage.ts
```

- Passed: 138 tests across four files (47 research integrity, 58 projection, 26 compact-initial, 7 identity). Projection persistence/RPC behavior uses the existing in-memory database fixture, not live services.
- Passed: scoped ESLint; import hash checks; scoped whitespace/diff inspection and local documentation links.
- Expected pre-fix failure: one new goalie-name regression failed; 57 other tests were skipped by its name filter. The failure was resolved by the narrow correction.
- Not run: full TypeScript check, full lint/unit suite, browser/build checks, original metadata revalidation, NX semantic acceptance or any production check. No current acceptance is inferred from historical receipts.

## Concurrent-work preservation

[Preservation receipt](PRESERVATION.json) records the pre-edit dirty-file hash comparison and relevant protected source hashes. Existing dirty IFTTT paths and the integration README were not edited. Concurrent changes outside this task are reported separately rather than represented as unchanged or attributed to a particular author. Only `tweetProjectionStorage.ts` and `projectedLineups.test.ts` modify previously tracked files; both were clean before this work. All other additions use fresh paths listed in the import manifest and this note.
