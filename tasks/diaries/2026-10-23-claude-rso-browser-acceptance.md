# RSO browser acceptance lane (CR-REL-04 / R6)

- Scope: browser acceptance for P07 (review-before-use "—"/partial), task 10 (expected / if-starts FP in the slot grid), P04 (PlayerSearchBar prefetch correction), current-read nonce mismatch, and the Yahoo goalie-mark policy, on the exact frozen candidate the release owner supplies. Browser acceptance only; no RSO/FORGE edits, no git mutation, no production reads, no private league data.
- Where: canonical checkout `/Users/tim/Code/fhfhockey.com` (`octoberBranch`, HEAD `2a5092d37` at start) is read-only for this lane. Harness: `tasks/artifacts/rso-browser-acceptance-2026-10-23/harness/`. Exports and Playwright output go to this session's scratchpad.
- Started 2026-10-23 (phase 1: harness, then wait for the candidate SHA).

## Checkpoints

- No frozen candidate published: `release-integration-2026-10-23/production-model-prototype/FIXED-SNAPSHOT.json` is "DRAFT … NOT accepted"; PARENT-REVIEW.md says the final SHA still needs parent review. Codex holds a fresh `trusted-yahoo/LEASE.json` (09:07) on currentPlanningRead/executionAdapter/useRosterPlanning/RSO component, so the goalie policy may move from badge-only to server-confirmed.
- CHECKPOINT.json goalie decision ("80/65% … confirmed 1 / ruled_out 0") is the trusted server-news policy, not the Yahoo-mark policy. Yahoo marks default to badge-only per the brief.

## Gotchas

- Next pages-router `router.prefetch` is a no-op in `next dev`, so P04 "no prefetch" is checked by spying on `window.next.router.prefetch`/`push`, not by network traffic.
- Committed `web/.env.development` points at production Supabase/CMS. The harness starts Next with `env -i` and blackhole overrides (`http://127.0.0.1:9`); no `.env.local` is exported.
- The candidate config's `reuseExistingServer` would silently test whatever owns the port; the harness starts its own server, refuses an occupied port, and checks the listener's cwd is the export.
- Port 3112 is in use by another lane's game-grid fixture server; harness default is 3117.

- Harness written: `harness/run-acceptance.sh` (git archive export, node_modules symlink, `env -i` server on :3117, Playwright desktop 1440x900 + mobile 375x812, existing RSO spec + any P04 spec, receipt), `acceptance.config.ts`, `rso-p07-acceptance.spec.ts`, `p04-search-acceptance.spec.ts`, `write-receipt.mjs`.
- Worktree dry run was unusable by design: Codex's in-progress trusted-Yahoo edits route Yahoo-context current reads through POST `yahoo-current-data` (broker + bearer). The spec's current-read mock now answers both `data` (header nonce) and `yahoo-current-data` (body nonce + echoed scope, `expiresAt: null`).
- HEAD `2a5092d37` dry run (commit mode): P07/task10/nonce pass on both viewports; goalie badge-only fails (HEAD still applies provider-snapshot marks: 5.0/0.0) and P04 fails (HEAD component still uses Link: router.prefetch on hover/touch). Both are correct negative controls. Existing "compact partial" spec is stale at HEAD (default view is now By position).
- First HEAD receipt landed in the artifacts root; removed and added `--validation` (receipt kind says NOT ACCEPTANCE, files go to `harness-validation/`). Re-running HEAD validation with the full RSO spec.

- HEAD validation (`--validation`): acceptance 6 pass / 4 fail (goalie + P04, both correct negative controls) / 2 skipped; existing RSO spec 3 pass / 41 fail in 22 min from UI drift (R6). Receipt `harness-validation/RECEIPT-2a5092d37cb8.json` sha256 `8f21b3df…`; existing-spec failure screenshots kept in scratch only. REPORT.md written (status: waiting for candidate SHA). Server stopped; port 3117 free.

## Next

- Phase 2 when TJ relays the candidate: `harness/run-acceptance.sh <sha> [--goalie-policy …]` (~25 min with the full existing spec), then REPORT.md results and the Codex note at `tasks/artifacts/cross-platform/2026-10-23-claude-to-codex-browser-acceptance.md`.
- If the candidate carries the trusted-Yahoo path, re-check the `yahoo-current-data` response contract against the mock before trusting results.
