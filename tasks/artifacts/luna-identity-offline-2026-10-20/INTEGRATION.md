# Local integration and comparison milestone

Completed locally on `octoberBranch` in the canonical checkout; starting HEAD `e24b43712785308e36e65c67e825d51b9edd1805`. Changes are uncommitted. This milestone integrates the first-stage modules into a local evaluation caller, not production traffic. It changes no alias assignments, notifications, publication or live settings.

## Exact diff

New code/test paths:

- `web/lib/sources/tweetIdentityLocalReview.ts`
- `web/lib/sources/tweetIdentityEvaluation.ts`
- `web/lib/sources/fixtures/tweetIdentityDevelopmentComparison.ts`
- `web/lib/sources/tweetIdentityLocalReview.test.ts`
- `web/lib/sources/tweetIdentityEvaluation.test.ts`
- `web/scripts/run-identity-offline-comparison.ts`

Existing-source change: `web/lib/sources/tweetNewsInference.ts`, one parameter type changes from `TweetNewsAutomationReviewRow` to `Pick<TweetNewsAutomationReviewRow, "team_id">`. An exact comparison to starting HEAD proved that this is the only change; the shortlist's runtime body and all existing callers retain their behavior. The local caller executes this actual baseline function rather than a copied implementation.

`LOCAL-INTEGRATION.patch` contains precisely these six new files and the one-line type edit. It is a zero-context review patch and depends on the first-stage files already present in this checkout. No staging, commit, push, merge, deployment, build, dependency/lockfile, migration or unrelated source edit occurred.

Artifacts added in this directory: `INTEGRATION.md`, `LOCAL-INTEGRATION.patch`, `LOCAL-COMPARISON.json`, `PAID-GATE.json`. The existing task diary was updated; it is working context, not release evidence. The original `HANDOFF.md` links this follow-on result.

## Caller and boundary behavior

`evaluateLocalAliasIdentityReview` consumes the actual `AliasReviewName` shape plus one retained full source and dated snapshot. It reuses `getAliasReviewOccurrence` and, for a whole malformed name row, the existing `segmentPlayerRow`. Original source text, timestamp/provenance and exact subject offsets remain bound. The source text on every review row must match exactly; contradictory extractor evidence cannot silently fall back to another token. Multiple repeated names require exact retained offsets.

Directory-backed splitting is accepted only when the existing segmenter finds a unique complete segmentation. A regression exposed that the existing segmenter may include a trailing separator after normalizing a name. The local adapter trims only trailing separators from multi-person evidence, preserves internal compound hyphens and checks the resulting exact original spans. The global segmenter is unchanged.

The evaluation itself is off unless literal `enabled: true`. Even then, model dispatch has a separate default-off boundary and supports injected mocks only. Tests prove disabled getters/transport are not inspected. There is no production route import, provider adapter, environment activation, credential lookup, alias writer, status transition, publisher or notification hook.

Undated `row.team_id`, parser situation/role metadata and a team heading are not evidence for a player's team or position. Explicit position syntax such as `G: Vale` or `Vale (G)` may be retained as a local hint. Bare initials, handles, hashtags and character sequences ending in G are not roles. Shared-heading team scope remains unsupported. Legacy extractor evidence that omits part of the occurrence the helper expands is held until a complete retained span is supplied. Missing source-time membership remains unknown; lexical identity suggestions do not establish a historical team.

All outputs remain identity suggestions for human review. No model result becomes an alias assignment or news/claim certainty. An invalid model reply is retained as a model hold/abstention. The first-stage cap/ID/span/alias-scope/timeout guards remain active.

## Comparison and labels

`LOCAL-COMPARISON.json` is reproducible by the CLI below. It contains:

- Nine synthetic development documents, eleven authored occurrence labels and seven scripted mock requests. Two documents are held before model dispatch. These are plumbing controls, not numerical evidence of Luna accuracy.
- Four unchanged retained real development observations from `web/lib/sources/fixtures/iftttComparisonObservations.json`. All four remain ungraded for canonical identity; no real-model request was made.
- Zero independently adjudicated real holdout examples. The existing human-reviewed semantic benchmark explicitly leaves canonical identities ungraded and has no untouched holdout. Its filename does not establish independent identity gold.

The grader keeps candidate retrieval coverage separate from selected/wrong IDs, abstentions, non-player assignments, missing/excess extracted occurrences and model holds. Denominators and missing extraction remain visible. Labels must be complete, source/directory-hash bound and carry the correct provenance; incomplete labels are ungraded. Labels are joined after execution and never included in model inputs. Duplicate documents and cross-cohort lineage leakage are rejected. S10 observations are conservatively grouped in the same development family for splitting; their actual correction target remains unverified. Claim-certainty inflation and real-model accuracy are null/unmeasured.

| Development case | Observed local behavior |
| --- | --- |
| Synthetic verified `Sparky` alias | Current shortlist misses it; improved retrieval and deterministic proposal retain the alias candidate; mock proposal selects the scripted fixture ID. |
| Synthetic `Milo Nort` typo | Fuzzy retrieval supplies a candidate; deterministic selection abstains; scripted mock selects it. |
| Synthetic ambiguous `Vale` | Both candidates remain; all arms abstain without distinguishing context. |
| Accented/compound multi-person row | Unique segmentation preserves all three original spans and literal names. |
| Team heading / non-player text | Heading is held before dispatch; non-player mock response rejects every candidate. |
| Dated versus stale team-scoped alias | Valid historical alias is eligible; the same alias outside its scope remains unresolved. |
| Malformed extractor evidence | Held before dispatch; its expected occurrence stays in the grading denominator. |
| Real S04 PP row | Held: no approved real directory is available for unique splitting. |
| Real S06 Podkolzin / RNH | Two exact source occurrences, no fabricated NHL IDs or aliases; unresolved with empty real identity context. |
| Real S10A | Held: retained receipt timestamp is missing; no date invented. |
| Real S10B 5-on-3 clarification | Non-name chunk remains held; no ordinary PP update is created. |

Tests deliberately inject wrong IDs into a saved comparison result to verify wrong-player/non-player counters independently of retrieval coverage. Those negative controls are not model observations. No fewer-email or accuracy claim follows from this fixture exercise.

## Checks actually run

Node v22.11.0, existing npm dependencies only. Commands from `web/`:

```sh
NODE_OPTIONS=--require=/tmp/fhfh-luna-offline-network-guard.cjs npx --no-install vitest run lib/sources/tweetIdentityLocalReview.test.ts lib/sources/tweetIdentityEvaluation.test.ts lib/sources/tweetIdentityCandidates.test.ts lib/sources/tweetIdentityProposal.test.ts lib/sources/playerIdentity.test.ts lib/sources/tweetNewsInference.test.ts lib/sources/tweetDecisionReview.test.ts lib/sources/tweetClaimExtraction.test.ts

NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit -p .

npx --no-install eslint lib/sources/tweetIdentityLocalReview.ts lib/sources/tweetIdentityEvaluation.ts lib/sources/fixtures/tweetIdentityDevelopmentComparison.ts lib/sources/tweetIdentityLocalReview.test.ts lib/sources/tweetIdentityEvaluation.test.ts lib/sources/tweetNewsInference.ts scripts/run-identity-offline-comparison.ts

TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' NODE_PATH=. node -r ts-node/register/transpile-only -r /tmp/fhfh-luna-offline-network-guard.cjs scripts/run-identity-offline-comparison.ts
```

- Final guarded Vitest: **8 files / 164 tests passed** = 62 first-stage task tests + 21 integration/grading tests + 81 neighboring existing tests. The prior 143 included the 62 first-stage tests, rather than being an additional independent total.
- Targeted ESLint: **passed** on final code and CLI.
- Project TypeScript: **passed** on final code, including the complete-label contract and CLI.
- CLI: **passed**, generated `LOCAL-COMPARISON.json` locally; no real-model transport used.
- The network preload replaces global fetch and Node HTTP/HTTPS request/get, throws on attempts and fails exit if attempted. New local tests also spy on request/fetch. No network attempts occurred. This is coverage of the reviewed interfaces, not an operating-system network sandbox.
- No production/browser tests or production builds were run. The existing full-checkout whitespace issue in a separate release patch is outside this task; only this slice's whitespace/diff is checked for acceptance.

## Retained reference and concurrent work

Adapter SHA-256 is unchanged: `055bc80ccf9874de8a976da6106bc34af15e424d6b905d39fccf57ecfd2b92a1`. Its model remains `gpt-6-luna`; bytes, declaration/interface, downstream mapping/results and temporal/single-player gates are preserved. The protected existing-source comparison to starting HEAD exited zero. The only existing-source edit is the explicitly documented inference parameter type. Concurrent IFTTT interpretation tests, player-page, cron, native/FORGE, draft, database artifacts and release work were not edited or reset.

## Paid trial: stopped before dispatch

This is a preflight block, not a provider denial or an uncertain new attempt. No model request, retry or reviewer fan-out was made in this milestone; new provider spend is zero. No credentials were read or configured.

The existing aggregate SQLite ledger was read in `mode=ro`, with identical file hashes before/after: `52d4848b5a9eb1a91b3ddfd9928625951fe2da81814669d41bdbd08a261c9b5c`. The observation includes 12 settled Responses attempts, 23 settled Decisions attempts and one uncertain Responses attempt. As recorded:

| Existing ledger item | USD |
| --- | ---: |
| Original aggregate cap | 0.520000000 |
| Settled recorded amounts/ceilings | 0.007782393 |
| Retained uncertain reservation (`lindgren-0`) | 0.254394800 |
| Charged-or-reserved exposure | 0.262177193 |
| Arithmetic unreserved headroom | 0.257822807 |

The blocked state is still `unknown billed outcome`. Arithmetic headroom is not new spending authorization. No unknown reservation, block or ledger was cleared/reset, and no competing budget ledger was created. These are recorded ceilings/reservations, not a newly authenticated provider invoice. `PAID-GATE.json` records this pinned observation and the unmet gates.

Required before any one-or-two-request trial:

1. Reconcile the existing unknown/budget block through its reviewed scope-specific process while retaining its reservation; establish the exact permitted remaining total-cap continuation.
2. Verify current availability, pricing and input/output limits for the exact requested model. The retained model name and archived 2026-10-19 pricing are not fresh access/pricing proof; no substitute was chosen.
3. Establish a usable already configured authorized upstream identity-test transport without prohibited credential access or configuration. The retained reviewer is a separate downstream interface; it is not repurposed here.
4. Supply independently adjudicated real occurrence identities and an approved dated canonical directory. No original context or NHL IDs were invented for the troublesome strings or real observations.
5. Seal at most one or two justified small requests, explicit output limits, no retries/fan-out, and verified worst-case aggregate cost/reservations under the existing $0.52 total cap.

Local preparation is complete. A real graded trial and any later live rollout remain separate outstanding steps. No traffic switch, notification cadence change, alias learning or publication authority is implied by these results.
