# Frozen Claude C1/C2/C3 review

Reviewed on 2026-10-25 against canonical `octoberBranch` at `1ee5127dc22c34ef9658f96ed4d72823b1d5ea29`. Decisions are recorded in the shared outgoing mailbox and Codex lease register. Original mailbox bytes are preserved; Claude's mailbox/register and all frozen handoff files remain unchanged.

| Lane | Mailbox | Explicit decision | Applied |
|---|---|---|---|
| C1 | CODEX-20261025-080 | GRANT two absent module/test paths; accept exact offline validator patch under trusted-loader-only contract | No; replay queued |
| C2 | CODEX-20261025-081 | TRANSFER only Editorial renderer/test; accept exact local readability patch; no stylesheet transfer | No; replay queued |
| C3a | CODEX-20261025-082 | ACCEPT optional per-player containment; retain guard and failure signal | No; queued for Codex custody + durable tests |
| C3b | CODEX-20261025-082 | RETURN CORRECTIONS; original exact patch not accepted for integration | No |
| C3c | CODEX-20261025-082 | RETAIN truthful provenance exclusion; no code, label or schedule change | No change |
| C3d | CODEX-20261025-082 | ACCEPT timing diagnostics only; correct production/causality overclaims | No; queued for Codex custody + permanent route test |

## Exact patch decisions (SHA-256)

- C1 accepted: `d859293bbb4a54e1b4a45d5ee8dbb4d2452e476bdaede538b7c0a78206bc839a`.
- C2 accepted: `cdf9d065229fe9f7459c3da3bf0a67ed22875f28b379ad3bd8a3e8849612e468`.
- C3a optional accepted: `5e4cdd0d42afcc23ccfa71e17530bd2dbffbdf636bded2644bfa1f6700b35fec`.
- C3b returned for correction: `3a280e440a576525fa15e1c50c3d8bcbd1b459d5eaddc514d19b99a9771cd91b`.
- C3d accepted: `b957eceb20f1b206161a2eedd4ee06d478e4b9f0669abd5617d03c929e1f0439`.

All five `git apply --check` preflights passed. C1/C2 candidate bytes and all three C3 patched copies were independently reproduced using `patch` in a temporary review projection, with no Git/index/source mutation. All 15 C3 manifest entries and all nine C1 declared dependency pins match. Full current/after candidate source hashes and inspected PNG hashes are in `INTEGRITY.json`.

## Findings and boundaries

C1's pure validator ignores caller proof flags and preserves measured zero, undefined denominators and missing components. Its `retained` parameter is a trusted internal interface, not an authenticity check for arbitrary JSON. A future loader must hash and parse the same retained bytes and independently validate schema, identity and source authority before admitting claims. A self-authored receipt with a valid hash is still untrusted. No loader or consumer wiring is included or granted. READINESS remains limitations evidence; completion-read timestamps remain ingestion observations, not actual game-end timestamps. Current real history, UTC-date, definition/model, null/zero and per-metric league-population gaps remain open. No live rank coverage or activation is claimed.

C2 preserves values/rank/N, actual ratios versus percentiles, missing/undefined reasons, cohort/source/cutoff/policy language and export disclosure meaning. Local pixels inspected: before/after unknown-pool landscape crop; before/after phone square metric-gap comparison; after stacked-notice landscape screenshot. No clipping observed in those inspected samples. This was not a fresh browser run or inspection of every image. The fixed artwork's fine print remains small at phone scale. Artifact-reported TJ “Accept for now” settles scope only; independent owner visual approval remains pending.

C3a contains invalid-input failure to the affected player while keeping its entire invalid frame unwritten and reporting 207/success:false/error. Old affected-player rows remain stale; this is not data repair.

C3b's lock contention is expected, and the watermark recovery defect is real. The candidate selects Oct24 holes when the watermark advances to Oct25, but still reports Oct25 as `startDate`; the route propagates this metadata. Return the earliest actually selected date as startDate and retain latestCoveredDate separately. Add durable selector regression coverage for the actual interval, unique IDs, covered intermediate games, inclusive seven-day bound/outside bound, and no-hole/no-covered/empty cases. The proposed reach is anchored to the latest eligible finished game date, not wall-clock now. No lock/retry/concurrency or no-watermark expansion is authorized. Claude may prepare corrections as a new artifact-only version; canonical integration remains Codex-owned.

C3c's native provenance exclusion follows existing contracts and tests. Unqualified runs must stay excluded; do not simply stamp the opt-in exclusion label. No current production state or recovery is inferred.

C3d's stage field identifies where an error surfaces, with elapsed stage durations alongside it. It does not identify a root cause by itself. The fake-clock reproduction spends95s in planning_inputs and throws in forge_bridge at0ms; no production timing attribution follows. Existing budgets, data/write decisions, guards, partial-write handling and schedules remain unchanged. Zero ledger writes was verified for the fixture; actual production writes/recovery remain unknown.

## Checks actually run

- PASS: 63 tests in4files: C1 evidence bundle26, C2 renderer8, unchanged domain19 and NST capture10.
- PASS: C3 offline reproductions36 tests in4files.
- PASS: scoped C1/C2 TypeScript including imported dependencies.
- PASS: exact patch/source replay, manifest and dependency hashes; final source/index still unchanged and HEAD stable. Upstream comparison remains8ahead/0behind; local production reference remains0619f9126872c136144c37092fb86715c7f58625.
- NOT RUN: full app TypeScript, lint, production build, fresh browser/native-device QA, permanent canonical C3 regression suite, DB/provider/live-log reads or execution.

Setup limitations: nested sandbox-exec was blocked before tests could launch (sandbox_apply Operation not permitted). An inert environment and Node guard blocking fetch, net/tls/http/DNS were used instead; Vite's localhost lookup was denied, then avoided by configuring a literal loopback host while retaining the guard. The temporary projection needed an explicit Vite filesystem allowlist; setup failures ran no application assertions. The final63+36 tests and scoped type check passed. No outbound attempt occurred in successful runs. Logs/configuration paths and exits are recorded in CHECKS.json and TYPES.json. No automatic approval review rejection occurred.

## Pending custody / next step

Coordinator01a16e23-72b5-76ee-8ade-2d209d0e7002 is active on clean-tree/archive/publication planning. Its prior reconciliation handback does not establish a fresh quiet source-write window during this task. Therefore all accepted canonical integration is QUEUED, not applied or denied. C1/C2 exact custody is granted/reserved but execution is explicitly held pending a fresh coordinator no-source/no-index-mutation window and HEAD/hash/absence recheck. No C3 source custody was acquired or transferred. Claude acknowledges these decisions in its own register; no worker was started or messaged.

Keep the live today-plan handoffs, CODEX-REVIEW, coordination files and current diary out of archival batches. Source files, Git index/refs, servers and production are unchanged. No publication, live data, backfill, cron, model activation, secret access or destructive cleanup authority was used.

## Final cleanup sequencing checkpoint

2026-10-25T14:59:24.884974+00:00; mailbox CODEX-20261025-083. Parent reports the coordinator's finite plan complete and awaiting owner approval. This review grants no archival/push authority. All canonical C1/C2 and accepted C3 source writes must wait until AFTER the cleanup coordinator's explicit handback, then recheck HEAD/pins and acquire the required custody. A quiet interval beforehand is insufficient. All accepted integrations remain unapplied. This review writer freezes all further source/docs writes after this checkpoint. Live handoffs, required fixtures, acceptance records and CODEX-REVIEW stay in the retained set.
