# D1 shared NST policy

- Scope: shared policy, burst plans, request ledger/client and their existing tests only; Chef owns route integration.
- Where: canonical `octoberBranch`, shared dirty checkout. Preserve unrelated work; no Git publication or provider calls.
- Start: active metadata verified `gpt-6.1-sol` / `high`; read repository and mise-en-place rules. Existing blanket 21-second patches need the updated full-job burst exception.
- Decision: `NstRequestControl.plannedRequestCount?: number` carries authoritative full job URL count. Only integer 1..39 plus requested zero interval may burst; absent/invalid counts remain paced. Ledger counts every attempt conservatively across shared local jobs.
- Checkpoint: policy and existing tests updated in the eight owned source/test files. `aceaf430351755ddb3eea50a79b862d1cab31525` remains HEAD. Full-job plans permit bursts below 40, reject unsafe explicit intervals, and keep schedule clearance advisory. Canonical duplicates ignore query-key spelling/order/encoding and fragments.
- Checks: guarded Vitest run passed all four files, 66/66 tests, 1.62s. Fake timers, mocked fetch, and temporary filesystem ledger only. `git diff --check` passed for owned files. Supplied `/usr/local/bin/node22.11.0` was absent; `/usr/local/bin/node --version` confirmed v22.11.0 and was used instead. No implementation correction loop needed.
- Next: stop and hand off for Chef diff review and route integration; no typecheck/build/provider call or publication performed.
- Limits: shared filesystem ledger excludes separate hosts/containers; no distributed coordination claim.
