# Acronym correction and sealed S06 continuation

**Completion update:** explicit user confirmation cleared the execution rejection. The one real request completed and passed validation; see [TRIAL-RESULT.md](TRIAL-RESULT.md). The denial description below is retained as historical evidence.

Generic acronym retrieval is implemented and locally verified. The real request passed independent preflight review, but automatic approval review rejected process execution before it started. There was no provider request, credential load, reservation admission, retry or new uncertain outcome.

## Implementation

Only the experimental path changed:

- `web/lib/sources/tweetIdentityCandidates.ts`: derive three-to-five uppercase token initials from canonical names, including Unicode and hyphenated surnames, retaining apostrophes within tokens. Candidate basis is `acronym`, quality remains weak, spelling distance is null, and no alias is created. No player-specific name/ID rule.
- `web/lib/sources/tweetIdentityProposal.ts`: explain acronym hypotheses in the model instructions; retain all collisions and require uniquely supporting explicit occurrence context before selecting a colliding acronym candidate. Existing ID/span, truncation, scope, context-only and authority checks remain in force.
- `web/lib/sources/tweetIdentityLocalReview.ts`: exclude acronym hypotheses from deterministic identity assignments.
- Corresponding three test files add eight tests covering full-name/acronym provenance, Unicode/compound names, collisions and caps, unrelated acronym text and rejection, absent true IDs, scoped aliases and context-only selection.

No production caller/default, settings, permanent alias, notification cadence, claim interpretation, lineup rendering, database schema, dependency or lockfile changed. No additional Supabase reads were needed. The approved directory hash remains `1e95394b5e380e815f16bbc9c7b2c84d8a36ce8144d807556b0179c64f517e30`.

## Actual local comparison before dispatch

S06 remains unchanged: “Podkolzin will take RNH’s spot on the first unit powerplay… via Babcock.” Published 2026-09-29T16:28:31Z. The source contains no explicit occurrence team or position hint.

| Occurrence | Existing baseline | Experimental candidates | Experimental deterministic result |
| --- | --- | --- | --- |
| Podkolzin | Vasily Podkolzin, NHL 8481617 | NHL 8481617, surname | Same identity |
| RNH | Abstain | Ryan Nugent-Hopkins, NHL 8476454, canonical-name acronym hypothesis | Abstain |

The expected IDs come from the approved export; registry IDs remain separate. Owner names are exposed development labels, joined after retrieval and excluded from the wire. Neither alias table supplied RNH. No verified alias or source-time membership evidence was fabricated. The same approved roster intervals and source time are retained.

The two-player partial directory is a narrow development universe. It cannot establish league-wide acronym uniqueness, collision rates, retrieval recall or identity accuracy. The actual model may reject every candidate; no output was obtained.

## Sealed request and independent review

- Destination: one `POST https://api.openai.com/v1/responses`.
- Exact model `gpt-6-luna`, default tier, reasoning none, max output 1,024, tools empty, store false, explicit 30-minute cache mode with no breakpoints. No retries, paid widening, model substitution or reviewer fan-out.
- Canonical wire SHA-256: `3f30779c9e886822373e491404a26d49e87edca98799abdd1a4676664988127f`.
- Approved manifest SHA-256: `1bf7243e870dd0a7c82f5883e4e5fcd7657384685759b18fe54d83db88edba08` (40 pinned dependencies).
- Independent reviewer initially required a stronger owner-label binding. Corrected with pinned, separate `GRADING-BINDINGS.json`: unique occurrence IDs/counts and exact spans checked before and after response; grading keyed by occurrence ID. Reordered labels pass; duplicate IDs and wrong spans fail. The corrected exact manifest was independently approved.
- `run-once.py` reuses the existing authorized `pilot.post_once` and key loader only on explicit execution after checks. Atomic admission uses the same aggregate SQLite ledger, preserves every original row/authorization/reconciliation and the original block, reserves only the exact new attempt, marks sent before the sole transport call, and prohibits resend. Unknown outcomes retain the full new reserve. Known complete usage is conservatively priced before settlement of only the new attempt.

## Cost and preserved state

The unused reservation is $0.231844800: `(1,050,000 × $0.20 + 1,024 × $0.75) / 1,000,000 × 1.10`. This full-context/long-rate/regional envelope is a worst-case limit, not a prediction of a small request's usage. Existing exposure $0.262177193 plus this reserve would total $0.494021993 under the original $0.52 total cap, leaving $0.025978007. There is no new allowance.

Actual new provider requests **0**, tokens/latency/request ID/raw proposals **unavailable**, new model cost **$0**, admitted reserve **$0**. The execution marker and identity attempt are absent. The ledger still contains 36 attempts.

- Ledger SHA-256 unchanged: `52d4848b5a9eb1a91b3ddfd9928625951fe2da81814669d41bdbd08a261c9b5c`.
- Original `lindgren-0` remains uncertain, reserve $0.254394800, actual null; `unknown billed outcome` block unchanged.
- Retained reference adapter SHA-256 unchanged: `055bc80ccf9874de8a976da6106bc34af15e424d6b905d39fccf57ecfd2b92a1`.

## Checks actually run

Node 22.11.0, from `web/`:

```sh
NODE_OPTIONS='--require=/tmp/fhfh-luna-offline-network-guard.cjs' npx --no-install vitest run lib/sources/tweetIdentityCandidates.test.ts lib/sources/tweetIdentityProposal.test.ts lib/sources/tweetIdentityLocalReview.test.ts lib/sources/tweetIdentityEvaluation.test.ts
NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit -p .
npx --no-install eslint lib/sources/tweetIdentityCandidates.ts lib/sources/tweetIdentityCandidates.test.ts lib/sources/tweetIdentityProposal.ts lib/sources/tweetIdentityProposal.test.ts lib/sources/tweetIdentityLocalReview.ts lib/sources/tweetIdentityLocalReview.test.ts
TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' NODE_PATH=. node -r ts-node/register/transpile-only -r /tmp/fhfh-luna-offline-network-guard.cjs ../tasks/artifacts/luna-identity-offline-2026-10-20/acronym-continuation/prepare-and-validate.ts
TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' NODE_PATH=. node -r ts-node/register/transpile-only -r /tmp/fhfh-luna-offline-network-guard.cjs ../tasks/artifacts/luna-identity-offline-2026-10-20/acronym-continuation/prepare-and-validate.ts --check-label-bindings
```

All passed: **4 Vitest files / 91 tests**, typecheck, targeted lint, actual local caller preparation and label-binding checks. The initial test run had one test using array position instead of canonical ID; corrected, then the affected suite passed. The earlier 81 neighboring tests were not rerun because those modules did not change. The network guard replaces fetch and http/https request/get and fails on any attempted network call; none occurred during offline checks.

From repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 tasks/artifacts/luna-identity-offline-2026-10-20/acronym-continuation/run-once.py --seal
PYTHONDONTWRITEBYTECODE=1 python3 tasks/artifacts/luna-identity-offline-2026-10-20/acronym-continuation/test-admission.py
PYTHONDONTWRITEBYTECODE=1 python3 tasks/artifacts/luna-identity-offline-2026-10-20/acronym-continuation/run-once.py
```

Passed: five offline admission/usage tests on a disposable in-memory copy, read-only preflight, independent manifest review and final unchanged-ledger/reference checks. The real ledger was not copied or reset for spending. All new state stayed in local artifacts. Exact files: this REPORT.md, prepare-and-validate.ts, run-once.py, test-admission.py, AUTHORIZATION.json, MANIFEST.json, INDEPENDENT-REVIEW.json, GRADING-BINDINGS.json, LOCAL-BASELINE.json, PREPARED-INPUT.json, OUTPUT-SCHEMA.json, WIRE.json, BLOCKED-EXECUTION.json and CURRENT-OWNED-FILES.patch. Diary and handoff updated. The patch represents the six current experimental source/test files against tracked HEAD; they remain untracked, so it includes their prior-stage contents as well as the acronym additions.

## Exact remaining blocker

`exec_command` with `require_escalated` rejected `run-once.py --execute` at process creation. Automatic approval review said the trusted evidence covered the Supabase read but did not clearly authorize exporting this tweet/identity snapshot to a paid external model with this payload/destination/spend. No process or transport started; this is **denied**, not an uncertain provider attempt. No workaround or retry occurred.

The narrow confirmation needed for a later retry is: “Approve one request sending the sealed S06 source and approved candidate evidence (wire SHA `3f30779c9e886822373e491404a26d49e87edca98799abdd1a4676664988127f`) to `https://api.openai.com/v1/responses`, exact model `gpt-6-luna`, max output 1,024, reserved maximum $0.231844800 within the original $0.52 aggregate cap, preserving the old unknown reservation/block, with no retries or fan-out.” Read-only Supabase approval does not need repeating. Fresh explicit confirmation would be materially new evidence; the unchanged seal and ledger must still be rechecked before the one permitted retry of the rejected execution.

No Luna accuracy, fewer-email, claim-certainty, subject-binding, replacement-slot or live-rollout conclusion is supported yet. Nothing was published, pushed or deployed.
