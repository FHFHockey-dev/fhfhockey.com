# Draft Pro statusCode sweep

- Scope: Sweep Draft Pro API catches for duck-typed `statusCode`; fix only the three remaining routes and their owned helpers/tests.
- Where: `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch`; initial worktree had unrelated dirty paths. Worker settings verified by Chef for thread `01a15a0e-7cd4-7b01-a4ba-47715e40d815`: `gpt-6-luna`, low effort.
- Current state: `dust.ts`, `export.ts`, and `recommendations.ts` now trust only `DraftProRequestError`. DUST's authored season/rate-limit errors are branded. Existing API tests cover trusted statuses, hostile dependency statuses/messages, and retry headers.
- Checks: Focused Vitest passed 3 files / 37 tests using Node v22.11.0 and the required no-network preload. Scoped `git diff --check` passed. Initial suggested executable path `/usr/local/bin/node22.11.0` was absent; verified `/usr/local/bin/node` is v22.11.0 and used it. No full suite/typecheck.
- Next: Chef review/integration. Separate follow-up boundary: account refund route outside assigned write paths still duck-types helper errors.
- Blockers: None for assigned scope. No provider/production calls, env/cron/migration changes, or git mutations.
