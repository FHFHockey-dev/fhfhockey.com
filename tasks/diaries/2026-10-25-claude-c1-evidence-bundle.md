# C1 — player-card evidence-bundle validator (Claude, 2026-10-25)

## Scope
SITE-PLAYER-CARDS P1, package C1 of `tasks/today-plan-2026-10-25.md`. New `evidenceBundle.ts` + `.test.ts` only; all existing `web/lib/player-cards/**`, UI and formulas read-only. No DB/provider reads, no Git.

## Where
- Snapshot: `/private/tmp/fhfh-c1-isolated/web` (copied 14:13Z from working tree, node_modules symlinked, `.next*`/`.env*` excluded). Manifest `/private/tmp/fhfh-c1-isolated/SNAPSHOT-MANIFEST.sha256` (4488 files, sha256 b5aea737…).
- Artifacts: `tasks/artifacts/today-plan-2026-10-25/C1/`.
- Canonical paths wait for Codex grant (reply to CLAUDE-20261025-060). Latest Codex entry at start: CODEX-20261025-078, no grant.

## State / checks
- 14:13Z snapshot built. Read adapter/windows/aggregation/ranking/nstCapture + observed-adapter-01/READINESS.md + completion-read-01.
- Design: validator re-derives every adapter proof flag (completeHistory, completion, verifiedMetrics, population.complete) from resolved retained receipts, ignoring caller flags, then calls adaptLocalSnapshot unchanged, once per distinct verified metric population.
- 14:20Z vitest lib/player-cards/: 7 files / 76 tests pass (26 new). Mutation check: accepting ingestion-completion as finality fails 1 test (restored, cmp ok).
- Lint (scoped) exit 0. Types: plain tsc OOM (134); `npm run typecheck` (8 GB) exit 2, with 2 inherited Luna Buffer errors outside C1 and 0 in evidenceBundle. Lock released (C2 holds it now).
- Frozen: RECEIPT.md, source.patch d859293b…, source-files/, tests/lint/types logs, SNAPSHOT-MANIFEST in tasks/artifacts/today-plan-2026-10-25/C1/.

## Next
- Codex: grant the 2 canonical paths + agree the retained-receipt boundary; then re-check pins and apply source.patch. Second pass = review fixes only.

## Blockers
- ~~Canonical install pending grant + coordinator safe-base handback.~~ Resolved 16:24Z (installed, see below). Remaining: Codex commit.

## Gotchas

## Install (2026-10-25T16:24Z)
- Grant CODEX-20261025-080 (lease CODEX-CLAUDE-C1-EVIDENCE-BUNDLE-20261025); orchestrator relayed cleanup handback. HEAD 2f2b43230 = origin, 0/0; web/ unchanged vs 1ee5127dc.
- Pre-checks: both paths absent, patch sha d859293b… matches accepted, dry-run clean, 9 dependency pins MATCH.
- Applied exactly source.patch; installed hashes = accepted (2899407e… / d4c674cb…). Only these 2 untracked files under web/.
- Canonical checks: vitest lib/player-cards 76/76; scoped tsc (C1/install/tsconfig.json) exit 0; eslint exit 0.
- INSTALL-RECEIPT.md written, with findings F1–F3 (self-label trust depends on loader; no type brand on `retained`; "retained" wording). Not changed.
- Gotcha: shell is zsh, so use $pipestatus, not PIPESTATUS.
- Next: Codex reviews and commits; F1–F3 decide whether a follow-up naming/brand patch is wanted. Diary kept until Codex commits.
