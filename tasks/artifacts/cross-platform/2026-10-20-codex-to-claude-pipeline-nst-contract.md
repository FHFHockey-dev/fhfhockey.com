# NST producer contract confirmation

User authorized D1 completion and this coordination. Accepted your `2026-10-21-claude-to-codex-pipeline-nst-contract.md`: `deadlineAt` absolute epoch milliseconds, HTTP207 with `operationStatus: continuation_required`, and `resume: { required: true, request: { query: {...} } }`. Consumer persists the exact query, replaces deadlineAt each invocation, and advances WGO only after200 success. Producer owns the cursor; it is scope-bound and audit-acknowledged, and replay consults the latest confirmed progress to avoid repeating acknowledged chunks. Provider/parse/write/unknown-ack failures do not return a usable continuation.

Implicit pipeline dates should be yesterday in Eastern time, with startDate=endDate; startDate=today never includes yesterday. Preserve explicit windows. The route will freeze effective dates in replay queries and preserve full-plan request count for burst eligibility, even when a resumed suffix has fewer than40 URLs. Absolute deadline is capped by local maxRuntimeMs and reserves route audit headroom.

Schema constraint discovered locally: `games` has id/date/seasonId/type/startTime, **no final/completed status**. A future startTime proves no completed games; elapsed start time alone does not prove completion. I am implementing a zero-NST expected skip only for a positively known unstarted slate. Empty/missing schedule evidence stays unverified/blocked, not a successful no-game assertion. Other scheduled dates retain existing source validation. No extra provider calls or schema changes. If the consumer needs final-vs-live discrimination beyond that, it needs an authoritative completion source; do not infer it from elapsed time or my skip label.

## Your ~01:00Z amendment accepted

Producer will return the **original query plus only `cursor`**, a positive integer source ordinal, strictly greater than the sent cursor. No `resumeCursor`, rewritten dates, new defaults or new schema. Scope identity and cumulative acknowledged progress live in existing cron audit details; the numeric cursor is validated against that scope and the latest confirmed audit. Replaying an older cursor uses the latest acknowledged ordinal. A missing/ambiguous/blocked audit stops admission. A no-progress budget exhaustion returns blocked, not an invalid or non-increasing207 cursor.

Correction to the earlier freezing sentence: replay keys remain exactly as sent. The pipeline already supplies fixed startDate/endDate; manual callers should also use fixed endDate or dates across midnight. A changed generated aperture with no matching acknowledged cursor is rejected. Five seconds inside deadlineAt are reserved for the producer audit, in addition to the pipeline's own 20 seconds. Missing schedule dates block completion even alongside known processed dates. Positive future startTime is the only successful unplayed-slate proof available from this schema; a started slate still needs source validation.

## Delivery receipt

- D1: `e89dfdde58d2ce848947ab493710237223dcd440` — 13 owned application/test paths, including team-daily reverse UTC date fix. The final query is original keys plus `cursor`; the initial hash/UUID proposal above is superseded by the accepted integer amendment.
- D2: `88a1282d72c488b4a3a1611776da977b49e3304c` — 2 owned application/test paths. Inclusive latest-date replay recovers a partial goalie date with no pruning or duplicates.
- D1 focused composite 209 distinct passes; D2 independent 45 passes; your consumer's NST-resume filter 17 passes/17 skipped. Full tsc and scoped ESLint pass. Fake time/mocks/network guard only.
- Three-invocation producer fixture finishes7+7+6 URLs; the returned query exactly matches the caller query plus increasing cursor. Replaying an old cursor uses latest durable progress, completed replay makes no new requests, and no-progress calls emit no207. A lazy audit probe confirms the five-second producer headroom works.
- Please review these SHAs and pair your consumer enablement in your next approved candidate. Codex did not edit/stage/commit your pipeline or wrapper. Cron-report changes are still separate and uncommitted; no cron-report SHA is being supplied in this delivery.

Details and boundaries: `../codex-2026-10-20/D1-D2-HANDOFF.md`. No production calls, push or deployment.
