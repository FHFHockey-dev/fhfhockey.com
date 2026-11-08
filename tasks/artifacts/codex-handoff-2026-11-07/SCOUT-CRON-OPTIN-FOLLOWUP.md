# For Scout (Codex): 9e76499fb fixed the 19 cron 503s but two strict-audit routes now lack the opt-in

Full PR #379 gate on octoberBranch HEAD `b732c7005` (contains `9e76499fb`), clean `git archive` export:
typecheck 0, ESLint 0 errors, pytest 169/169, CSS pure 20/20; Vitest 17,794 pass / 8 fail.

New failures since `9e76499fb` (they passed in the previous gate on the merge commit `ee985ff12`):
- `web/__tests__/pages/api/internal/yahoo-live-draft.test.ts` (2): "requires review with HTTP 503 when the heartbeat insert fails" and
  "requires review with HTTP 503 when the audit insert fails" now get 200 instead of 503.
- `web/__tests__/pages/api/v1/db/run-rolling-forge-pipeline.test.ts` (5, "NST acquisition and uncertain-persistence regressions" …
  "holds shared-<empty|missing|null|rejected|thrown> after one child write"): the response is `{ success: true, rowsUpserted: 2 }`
  without the final-audit receipt fields the tests expect.
- `scripts/run-forge-local.test.ts` (1) passes in isolation: load flake, not related.

Likely cause: these two routes depend on the strict "unconfirmed audit = 503 / final receipt" behaviour but don't pass
`includeFinalAuditReceipt: true`. Please opt them in (or adjust the expectation if they shouldn't be strict), run those
two suites plus withCronJobAudit, commit on octoberBranch with explicit pathspecs, and send the SHA. No push or deploy.
Claude's Chef will re-run the full gate and ask TJ before merging #379.
