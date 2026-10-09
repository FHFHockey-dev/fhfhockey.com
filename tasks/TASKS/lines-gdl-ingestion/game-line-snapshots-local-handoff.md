# Local game-entry snapshot handoff

Approved scope: local implementation from planning thread `01a0fccc-f785-731a-9bb7-a23d58caf0f2`. No production migration, enablement, replay, deployment, commit or forecast/model activation is included.

## Implemented boundaries

- `web/lib/lines/gameState.ts` reads NHL landing state, preserves scheduled versus actual start, observes postponement/reschedule identity, and rejects stale live state. The upstream often supplies no actual start; the freeze records the first observed live cutoff explicitly.
- `binding.ts` resolves explicit game references or opponent/date/context. Relative dates require a known source timezone. A processing date, source `gameId`, 24-hour recency or scheduled puck drop does not establish applicability.
- `sourceClaims.ts` converts existing reports into separately reviewable claims. `metadata.lineEvidence` is the adapter contract for explicit/reviewed applicability, phase, confirmation, corrections and retractions. Mixed posts require independent `claimEvidence` decisions per `situation:number:group` key; common semantic decisions are not inherited. Relationship keys use the exported `relationshipClaimKey`; unitless retractions use `retraction`. Missing decisions stay unresolved. The existing classifier does not currently emit this full contract; coordinate its producer with the classifier owner before enabling serving. The adapter does not modify existing classifier safety fixes.
- `identity.ts` checks `rosters.created_at`/`ended_at` intervals at the effective event time and records approved alias evidence. Current membership alone cannot qualify historical claims. Unknown/synthetic publication or ingestion clocks are retained as review states.
- `reconcile.ts` selects units independently, preserves unusual/partial formations, freezes immutable entry, and allows only authorized entry corrections/retractions afterward. No ES IGA carry-forward exists. Accepted in-game PP1/PP2 carry independently; a projected game-specific replacement affects its own unit. Contradictory applicable claims remain conflicts. Relay circulation contributes only once.
- `storage.ts` appends captures, interpretations, relationship records, state observations, entry revisions and PP decisions. The atomic database function uses a game/team lock and compare-and-append; stale workers re-read once. Selection restoration creates a new revision rather than reusing a previous ID.
- The public Lines GET is read-only. Both routes share game/team responses. The UI retains frozen entry unless a correction chain is present; source history, correction revisions, unknowns and PP origins are visible. Game selections update route URLs. The prior statistical sections remain separate.

## Controls and rollout gates

All controls default off. No local `.env` or deployed configuration was changed.

| Control | Responsibility |
| --- | --- |
| `LINES_OBSERVATIONS_ENABLED` | Gated ingestion/reconciliation and observation/history display |
| `LINES_ENTRY_SERVING_ENABLED` | New API reader and Lines UI contract; off restores the previous reader |
| `LINES_PP_CARRY_FORWARD_ENABLED` | PP carry-forward decisions; no effect on forecasting |

Apply the additive migration only with separate approval. Verify actual source publication, game binding and per-claim phase decisions, and compare fixtures/shadow results before approving serving. The existing forecast capture remains unchanged; observation authority grants no new eligibility. The two-line hook in the already-dirty `update-line-sources.ts` is the only classifier-owned file changed by this task.

Reconciliation occurs on the existing source-processing invocation, including empty source batches for scheduled teams. No new cron or persistent poller was installed. If that invocation does not observe the transition, the first later live observation is the documented cutoff; final-only history without actual-start evidence is not silently frozen.

Rollback: disable entry serving to restore the previous reader; disable carry-forward and/or observation capture as appropriate. Preserve all evidence and revision tables. No new destructive rollback migration is provided.

## Evidence and limits

Parent reviewed the three screenshot transcriptions as pixels. Fixture tests preserve the described trios, pairs, goalie order, separate PP authors and penalty context. Screenshot publication offsets, original IDs/authenticity and live-game applicability remain unresolved; these fixtures cannot grant real serving authority.

The private baseline is `/tmp/lines-snapshot-baseline/` (diff, status and hashes). The shared dirty working tree was retained because a fresh checkout would omit the classifier safety fixes. New code is localized in `web/lib/lines/` and the Lines surfaces. No paused or adjacent thread was resumed or messaged. No workers were spawned because actual runtime model/effort was not exposed.

SQL validation used a disposable PostgreSQL cluster with TCP disabled and minimal `teams(id)`/`games(id)` foreign-key stubs, not a full restored production schema. The rollback-only SQL test harness expects those reference stubs. Browser tests mock lineup and historical-statistics APIs and verify the actual game route at desktop/mobile sizes; live upstream authenticity and a real team-page static data fetch are outside those fixture checks.

Run focused tests from `web/`: `npm test -- --run lib/lines components/LineCombinations/GameLineSnapshots.test.tsx __tests__/pages/api/v1/lines/projected.test.ts __tests__/pages/api/v1/db/update-line-sources.test.ts`.

Browser spec: `npx playwright test e2e/game-lines.spec.ts --workers=1`. Sandbox execution required supported escalation for the existing Chromium/local listener. No security settings or browser installation were changed. `agent-browser` was unavailable; the repository Playwright runner provided browser verification.

TypeScript: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`; the default heap exhausted memory before completing. Focused ESLint reported only the two pre-existing `<img>` warnings in the team Lines page. No production build was run.

Final results: the combined focused run passed 94 tests in 11 files; one further relay-attribution regression was added and the final reconciliation/service/processor run passed all 34 tests (95 distinct tests validated across these runs). Two Playwright tests passed again after selector URL integration. Final TypeScript and lint checks passed. The final migration/SQL tests passed in a fresh scratch database; that disposable server was then stopped. Desktop/mobile screenshots were inspected at `/tmp/lines-snapshot-baseline/{desktop,mobile}.png`. The classifier hook's two additions were removed in memory and its remaining bytes matched the saved baseline hash exactly. Twelve unrelated baseline files changed concurrently; none were reset or overwritten by this task. Last allowance read: 55% weekly remaining.

## Independent review remediation — 2026-10-02

The independent review requested five consumer fixes. All five are now implemented locally:

1. Frozen revisions retain their cutoff evidence, including conflicting and inactive sources. Correcting A recomputes against B and inherits A's selection priority; stronger ranking on the correction cannot silently remove B. Ordinary late entry claims remain excluded.
2. Mixed-post claims require their own binding/phase/kind decisions. Whole-post warmup inference and legacy game/date inference were removed from this adapter. Missing semantic keys and missing audited original provenance fail closed.
3. Retractions recompute against retained evidence. Retracting one corroborating source preserves another; retracting a conflicting source produces a revision selecting the remaining report. Accepted correction/retraction chains stay append-only and replay idempotently.
4. PP selection checks explicit expiry and publication/ingestion/interpretation availability before applying relations or selecting units. Future-ingested evidence and future retractions cannot affect the current decision.
5. Source text remains grouped once, while every extracted IGA/PP claim displays its own unit/relationship, phase, game applicability, review status and confirmation designation.

The selector version is `2026-10-02.2`. The optional `EntryRevision.evidenceClaims` JSON field retains frozen evidence and the change chain; legacy revisions recover only known selected/conflict/change IDs. No additional SQL schema change is required.

### Required producer contract before enablement

`metadata.publicationTimeBasis` must be `provider_timestamp`, `x_api_timestamp` or `x_api` only when the primary original clock was actually verified. `lineEvidence.publication` must supply offset-aware `originalPublishedAt`, nullable `relayPublishedAt`, `originalIdentity` matching the report's original tweet ID or URL, `originalAuthor`, and nonempty auditable `evidence` references. A known URL author must match the attested author. The explicit original attestation overrides legacy relay-derived publication compatibility fields; absent/unsupported attestations retain the raw report for review and grant no authority.

Each extracted claim decision must provide `kind`, `phase`, applicable game/opponent/date context, and `decisionEvidence: { producerVersion, decisionId, sourceReferences, binding, phase }`. Both span arrays must be nonempty exact `{ start, end, text }` spans into the original report text. Producer/reviewer decisions must independently substantiate that claim's binding and phase, with actual game-state references where needed. The consumer checks span bounds/content and records the attestation; it does not authenticate arbitrary source-reference strings or substitute for the separately approved real-feed evidence gate.

Only source-wide publication, attribution, timezone/display and identity context can be shared across mixed claims. Claim certainty defaults to reported; explicit confirmation requires that claim's `certainty: "confirmed"` plus its own `confirmationEvidence`. Blanket interpretation certainty is ignored. Missing per-key binding/phase/kind/confirmation decisions remain reviewable and cannot be selected. Event membership and approved alias eligibility remain the snapshot processor's responsibility.

`supersedes`/`retracts` must reference persisted final claim IDs, including the event-identity resolution fingerprint, with `original_author` or `reviewed` relationship authority. The processor verifies target existence and matching game/team and rejects self-targets; reconciliation verifies replacement authority and timing. Raw tweet IDs are not claim IDs. The producer still needs a lookup/mapping to persisted claims; that integration remains an enablement blocker.

Revised validation: 106 focused tests in 11 files passed; the unchanged independent adversarial suite passed 12/12; full TypeScript and focused ESLint passed. Desktop/mobile browser tests passed, and the new mixed-claim browser test passed after correcting a case-sensitive assertion. All three browser scenarios were executed against mocked APIs and existing Chromium; final screenshots were inspected at `/tmp/game-lines-fixes-20261002/{desktop,mobile,mixed-claims}.png`. SQL was not rerun because the migration and storage schema were unchanged. The revised scoped patch, source hashes, logs and receipt are in `/tmp/game-lines-fixes-20261002/`.

All controls remain off. No classifier/forecast-owned files were changed during this remediation, and no production action, operational source replay, build, commit, push, deployment, or paused-task message occurred. Latest allowance read: 53% weekly remaining. Independent re-review and the authenticated producer/shadow gate remain outstanding before any separately approved enablement.

## Relation persistence follow-up — 2026-10-02

Independent re-review closed the original five findings but found that unresolved target IDs still reached the relation table and violated its FK. `appendLineEvidence` now retains every attempted `supersedes`/`retracts` ID in the immutable claim payload while indexing only existing, authorized targets. The relation index uses stored source/target payloads, not changed retry input under an existing claim ID; review-flagged, cross-scope, wrong-author, self and wrong-entry-unit attempts cannot manufacture replacement authority. The migration's FK is unchanged.

Delayed target arrival does not clear the prior attempt's review status. A producer/reviewer must emit a new interpretation with a new persisted claim ID and explicit authority, for example through a new decision ID in its evidence context. That new revision can index a valid relationship while the original attempt and its unresolved review reasons remain intact. Retrying either revision is idempotent. No automatic link-resolution worker or source replay was added.

The shared storage fixture now enforces both relation FKs, so the processor regression verifies that an unresolved target does not stop game-state capture or decision reconciliation. New storage regressions exercise missing targets with/without upstream review markers, delayed corrections and retractions, retries with altered input, new reviewed revisions, same-batch order independence and invalid authority/scope/unit/self links. The rollback-only SQL harness verifies the real missing-target FK, retained attempted history, delayed authority boundaries, resolved-link retry uniqueness and continued state capture.

Both unchanged independent suites passed: 12 original assertions and 15 additional assertions. The affected storage/processor/reconciliation/service run passed 50 tests, and the combined focused run passed 111 tests in 11 files; TypeScript and focused lint passed. The SQL harness passed in a fresh disposable PostgreSQL 17 cluster with minimal reference stubs and TCP disabled, and the server was stopped. This does not claim a full production-schema restore or live-feed validation. Browser tests were not rerun because no UI behavior changed. Focused receipts and the separate follow-up patch are in `/tmp/game-lines-fk-fix-20261002/`; all enablement/producer gates remain in force and controls remain off.
