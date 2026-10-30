# Combined-goal owner compatibility handoff

Intended owner: combined FORGE/RSO/Start Chart task **01a14283-f596-73c3-8590-37d198756c4b**. Scout can route this prepared internal handoff with the implementation checkpoint. This artifact does not claim a direct message was sent to that task or grant another task's files to IFTTT.

The accepted IFTTT consumer/runtime73 paths are unchanged, manifest `../consumer-binding-increment/owned-source-v2-sha256.json`, SHA256 `9cba26d4e4617532c14d784b2d39038dce3ba9a085a0c337a0c68345532deefb`. Its11 retained dependency snapshots match. One owner-controlled live file differs:

- Path: `web/lib/player-forecasts/contributions.ts`.
- Accepted dependency hash: `282c8b1e9c7362190c39a48b031e392afb6c2abaa45190d8f83d95d6319f9df7`.
- Observed live hash, stable during independent reconciliation review: `af6bbef4898cae4805c079deba37162269ee19bd648b6192a153bd3083c38f5b`.
- Diff: `outputs/root-owned-dependency.diff`; retained accepted copy: `../consumer-binding-increment/dependency-snapshot/web/lib/player-forecasts/contributions.ts`.

The diff adds optional `catalogExpiresAt` and its timestamp/admission checks to contribution handling. It was preserved, not edited or restored by IFTTT. The inspected diff does not change the exported calendar policy used by the schedule helper, but this observation is not combined-runtime compatibility acceptance. The full52 reconciliation remains historical evidence, not a release approval for the new dependency set.

Requested next owner checkpoint: provide exact current hashes for the changed dependency and any further sourceObservations/scopeReads/schedule/contracts changes; preserve original source expiry semantics; run the owner's focused contribution-admission regression checks and the bounded native consumer26 checks against a frozen captured dependency set, then record/independently review compatibility. No aggregate build or hosted validation is needed merely to assess this local change.

Preserve frozen test outputs. Do not rerun the accepted consumer harness in place, because its afterAll writes owner evidence. For a safe local consumer replay, copy its harness, SQL4, Vitest/scoped-TS configs and appropriately attributed manifest into a **new task artifact root at the same depth**; create its `correction-v2/evidence/` output directory. The existing relative paths then continue to read the accepted core SQL/runtime, while all outputs remain in the new root. Record the actual new live/snapshot dependency hashes, retain the original consumer assertions, and use disposable Unix-socket PG with TCP disabled. The current harness is26 cases,25 private-PG plus one default-off; nine original CR042–044 assertions are included. An exact immutable capture or the dependency owner's short coordinated hold avoids testing moving files.

Keep IFTTT source changes excluded from production until its own schema/history/fencing/operational prerequisites and explicit deployment authorization are satisfied. The separate combined-goal approval is not IFTTT authorization. No migration, caller/flag/scheduler/cohort activation, live ingestion/dispatch/replay, publication or compensation is part of this compatibility handoff.
