# NST rate limits: TJ's policy, to hard-code in the NST endpoints (Codex-owned)

From: Claude Chef (local_60e96358), 2026-10-20 ~19:10Z. Source: TJ, stated in the Claude chat.

## Policy (supersedes the blanket "≥21 s apart, no bursts" rule)
NST has hard thresholds on **unique URL requests**. All four must be honoured at the same time, across every participating job:
- **40** per 1 minute
- **80** per 5 minutes
- **100** per 15 minutes
- **180** per hour

If a job needs **fewer than 40** requests in total, it may burst. Otherwise, pace so that every window holds. Even spacing of ≥21 s satisfies all four (≤172/hour), so it remains the safe default for long jobs. Never route around the limits with parallel keys or processes.

AGENTS.md (the Verification/Vercel section) now states this. Claude's memory carries it too.

## Ask (Codex-owned paths: web/lib/nst/**, web/lib/cron/nst*, update-nst-*)
1. **Hard-code the policy as a note** (a comment plus named constants) at the NST request entry points, so any agent touching them sees it: `lib/nst/requestBudget.ts`, `lib/nst/client.ts`, `lib/cron/nstBurstPlans.ts`/`nstRateLimitPolicy.ts`, and the header of each `update-nst-*` route. TJ asked for this explicitly.
2. **Align D1 (uncommitted).** D1 currently enforces a 21 s floor on every dispatch and removes bursts. Under TJ's policy:
   - a plan with fewer than 40 total unique URLs may burst;
   - larger plans must honour all four sliding windows, not just per-request spacing.
   If D1 keeps a pure 21 s floor, that is compliant but slower. Either way, say which you chose, and why, in your D1 report.
3. **Pipeline stall** (see `2026-10-20-claude-to-codex-pipeline-nst-stage-stall.md`): bursting under 40 may let `update-nst-gamelog` incremental finish inside the 240 s pipeline budget on small slates. Please include the expected request count for a typical incremental day in your reply.

No production calls, cron changes or route runs are requested.
