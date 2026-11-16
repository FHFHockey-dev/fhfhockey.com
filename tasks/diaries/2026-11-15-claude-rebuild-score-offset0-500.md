# Diary: rebuild-score offset-0 HTTP 500 / empty error — Claude, 2026-11-15

## Scope
Map the branches behind the recorded offset-0 rebuild-score 500 (empty error, last log "Fetching current season"). Phase/error tag + injected-failure regression in the rebuild-score handler only. No live reads, retries, deploys, backfills.

## Where
octoberBranch, uncommitted. Files: web/pages/api/v1/sustainability/rebuild-score.ts, web/__tests__/pages/api/v1/sustainability/rebuild-score.test.ts.

## Overlap
L7 diary + handover (local_78a99adf notes) say L7 closed 2026-11-12; no claim on rebuild-score.ts in leases or either mailbox; paths clean before edit. Edits PRECEDED owner confirmation. L7 Chef replied: no Claude overlap, but rebuild-score.ts is Astra's (release TSV row 914, no hand-back yet); the test file is not on that list. TJ chose (pop-up) to keep the edits uncommitted; note CLAUDE-REBUILD-SCORE-FAILURE-TAG-20261115 posted in CLAUDE-TO-CODEX.md.

## Findings
- The #444 receipt itself is not on disk (repo, diaries, side-session notes). Only source code evidence.
- 500 can only come from the handler's generic catch, or the platform (crash/OOM = FUNCTION_INVOCATION_FAILED, no body, no audit row). Dependency errors are 424; off-season wrapper fails open; audit wrapper's own 500 needs a throw the handler never lets out.
- Handler-catch 500 always has `details.error = null` in cron_job_audit (thrown == null) and no `error` key in the body: "empty error" is structural, not cause-specific. Real message only in body.message / console.error.
- "Fetching current season..." is not phase evidence: only windows.ts (2 console.warn) can log between it and the catch's console.error.
- Literal empty error: withCronJobAudit uses `err?.message ?? "Unknown error"`, so an Error("") escaping the handler gives error "" (body and details.error). Handler catches everything, so only a throw inside its own catch block or a wrapper reaches that path.
- Throw sites: raw Supabase rethrows (500, message may be empty): windows.ts 25/97/312, incremental.ts 171, dependencyChecks.ts 38 (a query error inside prerequisites is raw, so 500 not 424), config.ts 164, distribution.ts 172, persist.ts 61/202, score.ts 91/204, verify_sample. new Error(text) (500 with text): config.ts, persist.ts guards. SustainabilityDependencyError: 424.
- Discriminator: if the retained log has no "rebuild-score error" line and no "Internal season API failed" warning, the catch probably never ran (wrapper escape or platform kill), and the new tag would be absent too.

- 2026-11-15 TJ: the #444 Vercel log shows "Fetching current season..." then `rebuild-score error { message: '' }`, which confirms the generic 500 catch.
- That printout is a plain object holding only `message: ''`. An `Error("")` would print a stack. In postgrest-js 2.89.0 (`src/PostgrestBuilder.ts` ~179-200), exactly this object is built when a non-2xx response (other than an empty 404) has a body that is not JSON and is empty. Network failures produce four keys and a non-empty message; PostgREST JSON errors carry code, details and hint. So the failed dependency is most likely a Supabase REST request whose response had an empty error body (a gateway-type 5xx, or a timeout). The operation is still unknown. Its HTTP `status` is lost because `if (error) throw error` keeps only the error object.
- The old catch body had no phase field: #444 `details.response` = message "Dependency request failed." + dependencyError + timing. Only `timing.durationMs` can roughly place the failure in time against normal phase durations. With the new patch this shape gives error_message_empty=true and error_code/name=null, so `last_completed_phase` is the locator. The upstream status would need edits at the lib throw sites (out of scope; Astra/lib owners).

## State
Handler now returns error_source, last_completed_phase, score_writes_started on both failure branches, plus scrubbed error_name/error_code/error_message_empty on the 500; console.error logs these instead of the raw error. 3 new tests fail on HEAD; 189/189 pass across rebuild-score, cron-audit-wrappers, cron-report; eslint clean; npm run typecheck exit 0.

## Next
TJ: retrieve the #444 receipt (Vercel log for that invocation: is there a "rebuild-score error" line? and the audit row's details.response) — that decides catch vs platform crash.
