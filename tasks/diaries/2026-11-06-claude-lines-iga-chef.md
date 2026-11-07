# 2026-11-06 Claude: Lines IGA Chef

## Scope
Chef (orchestrator) for the Lines page three-layer finish (entry lineup, IGA rail, next-game defaults, evidence feed, safeguards) fed by FxTwitter intake. PLANNING STAGE: no implementation until TJ approves the plan by pop-up.

Deliverables: (1) gap report, (2) design pop-ups, (3) lane plan in `tasks/`, (4) staff lanes as new sessions.

## Where
- Branch `octoberBranch`, HEAD `ab07d4da9` at start. Lines work landed in `26f04ef88`.
- Lines files (clean in tree at start): `web/lib/lines/*`, `web/components/LineCombinations/*`, `web/pages/lines/*`.
- Other lanes' dirty files (do not touch): `web/lib/sources/{lineSourceProcessing,linesCccIngestion,tweetInterpretation,tweetPlayerEvents,tweetReviewSidecar,tweetSwipeTrainer*,tweetDecisionReviewMapping}.ts`, `web/components/TweetSwipeTrainer/*`, `supabase/functions/{x-timeline-poll,x-timeline-ingest,_shared}/*`, new `supabase/migrations/202611062*`.

## State / checks
- Read `web/lib/lines/*` (types, gameState, binding, identity, sourceClaims, reconcile, processor, service, storage), `GameLineSnapshots.tsx`, `ProjectedLineups.tsx`, `pages/api/v1/lines/projected.ts`, team page wiring.
- Prod read-only (2026-11-06): Vercel `fhfhockey` env keys only (no decrypt) + 4 SELECTs on Supabase `fyhftlxokyjtpndbkfse`.
  - No `LINES_*` env vars in prod: observations, entryServing, carryForward all OFF. Prod `/api/v1/lines/projected` serves the legacy projected path (gated by `TWEET_PIPELINE_PUBLISHING_ENABLED`, value not read).
  - Migration `20261002134400_game_line_snapshots` NOT applied: `line_source_captures`, `line_claim_revisions`, `line_claim_relations`, `line_entry_revisions`, `line_pp_decisions`, `line_game_state_observations`, RPC `append_line_decisions` do not exist in prod.
  - Counts: x_timeline_shadow_posts 239; line_source_ifttt_events 5,659; line_source_snapshots 6,795; tweet_pattern_review_items 9,604, of which 5 carry `metadata.answerKey`.
- Key code gap: nothing in production code writes `metadata.lineEvidence` (per-claim decisionEvidence/binding/phase spans/kind/certainty). Only tests supply it, so every real claim gets review reasons and is ineligible; the entry lineup would be empty even with flags on.

- Gap report written: `tasks/artifacts/lines-iga-gap-report-2026-11-06.md`. Awaiting TJ pop-up approval.
- Extra gaps found: CCC path (`update-lines-ccc.ts`) never feeds the snapshot engine; freeze only persists if the processor runs while live (no scheduled trigger); `/lines` index 400s under entry serving; rail mixes raw and interpreted; mobile rail defaults expanded; PP carry needs full 5-man unit (no delta swaps) and has no expiry; FxTwitter queue rows flatten repost/quote provenance into IFTTT-shaped text.

- TJ approved (pop-ups): gap report; layout = sidebar tabs; authority = original author; trainer = reviewed override; practice = context marker; PP expiry = superseded or stale (3 games / ruled out / newer report); PP swaps = apply to base unit; freeze = read-time + next run.
- Plan written and approved: `tasks/artifacts/lines-iga-plan-2026-11-06.md`. Lane D gate: ask owners to commit their `web/lib/sources/*` work.
- Folded in style audit from `Web pages lines` session (`tasks/artifacts/Lines-Superstyle-Audit-2026-11-06.md`).

- Staffing: start_session refused direct start (turn began on a cross-session message), so A and C are proposal cards: `task_5c3ef46e` (lines-engine), `task_e07e6a85` (lines-pages). Awaiting TJ click.
- Sent swipe-trainer (`local_b1e7da0c`): D commit request (delivered) and E v2 ticket (queued). Acked Web pages lines audit session.

- TJ started both: Lane A = `local_14d48f9d-e5e7-4049-aec8-6ccd3659876b`, Lane C = `local_f0c5e29a-beb1-4e56-beea-2506a2b6c406`.

- GOTCHA: my real session id is `local_3f3bae11-08af-4e4b-8198-488d12a385ea` (scratchpad path id b70f2c6c is NOT it). Corrected A, C, swipe-trainer.
- Lane D gate cleared: swipe-trainer committed `d80b8e5f6` (parser, 15 files) and `a2556bbb6` (trainer, 11 files). Chef re-ran 8 test files: 283/283 pass. Still dirty in lib/sources, not ours: `tweetReviewSidecar.ts`, `tweetDecisionReviewMapping.ts`, `lunaHosted/` (Codex Luna). Migration file `20261106204707` + its authority row (order 114) belong with the X-timeline chef's migration-authority.json commit.
- Lane D proposed as card `task_56889288` (lines-parser). E ticket status unconfirmed; asked swipe-trainer.

- Lane C ownership widened (Chef decision): optional additive `teamId` prop on `web/components/LinemateMatrix` (clean, unowned); default output must be unchanged for shiftChart, Replay, line-combo screenshot.

- A1 contract `7f862a278` verified (3 files, additive; Chef run: lib/lines + LineCombinations + API tests 109/109). Lane B proposed as card `task_9a71946f` (lines-ui). Lane A reads FxTwitter author from `source.rawPayload.fx` until Lane D exposes fields.

- Lane E done: `4218359a8` (answer key v2: context, scope, game binding {gameId always null, opponent+date}, powerPlaySwaps; `readAnswerKeyRecord`). Chef run: 32/32 trainer tests. Field names forwarded to Lane A. Note for Lane D brief: swaps only parsed from "will take X's spot on the first/second unit" — widen.
- Typecheck exit 2 from Lane C's in-progress `web/__tests__/pages/lines/abbreviation-header.test.tsx`; told Lane C (now owns `web/__tests__/pages/lines/*`).
- Someone else fixed the bottom-nav toenail in `d33d2c8a5`.

- Lane D (`local_f17e4302`) done: `505ed430a` (8 owned files). Chef run lib/sources 1283 pass / 39 skip. Fields spec in side-session-notes/local_3f3bae11…/lane-d-parser-fields.md; forwarded to Lane A. Open: `toQueueRow` (X chef's `x-timeline-poll/fxtwitter.ts`) doesn't write `first_seen_at` → ingestedAt = received_at; audit H2 (F→D carry) out of scope.

- PENDING SEND: `first_seen_at` ticket to X chef (`local_1fb55d9b`) blocked by the app's 10-message cap until TJ types here. Resend after.

- Lane C done `1d08ce7fc` (22 files; 64 tests; shots in side-session-notes/…/lane-c-shots) + `389ea0ea3` (LinemateMatrix teamId, own-team matrix). TJ approved (pop-up) teamId + matrix a11y rows (h4, aria, truncation, select) and the first_seen_at ticket. Both sends BLOCKED by app cap (pop-up answers don't reset it). Resend after TJ types: Lane C = a11y rows only now; X chef = first_seen_at.
- Lane A done: `8282653f2`, `58aa44937`, `44a79c695` (author seed TJ-approved). Chef run engine+API+ingest tests 162/162. Lane A still has dirty lib/lines files (decisions, processor, trainerDecisions) — in progress, await report. Open: in_for/draws_in/out not yet IGA claims; team handles from memory need check; Sabres untagged stays ineligible until cue/reviewed key.
- Lane B committed `ef694105a` (7 files); Chef run LineCombinations+LinemateMatrix+pages/lines 56/56. Report not yet received.

- Lane B reported (`local_addc5903`): `ef694105a`, 50/50, axe 0, shots in side-session-notes/…/lane-b-screens. Chef viewed desktop+mobile shots: grouping, practice/carried/derived chips, entryView heading, tabs, mobile collapsed all correct. Nits for superstyle: goalie unit shows "Confirmed" chip beside "starter isn't confirmed"; ISO dates in game select; check left gutter of snapshot header on real page.
- Lane C `389ea0ea3`: teamId prop done, default byte-identical. Open: pre-existing Discord capture selector `#linemate-matrix-<id> > .content` finds no direct child (check on next real webhook).
- TJ pop-ups: matrix heading → optional `headingLevel` prop (default h4; /lines passes h3); Lane B runs /superstyle now, before RC.
- QUEUED SENDS (cap): Lane C = headingLevel prop + remaining matrix a11y (aria/truncation/select); Lane B = run /superstyle on /lines, /lines/[team], line-combo (+ nits above); X chef = first_seen_at.

- Lane A final `e501e2ad3` (no invented practice; readAnswerKeyRecord; sourceMarker certainty). All Lines files clean. Chef combined run (lib/lines, API, ccc, line-sources, LineCombinations, LinemateMatrix, pages/lines): 218/218. Full `npm run typecheck` exit 0 at HEAD `e501e2ad3`+lanes.
- TJ said "Send them": sent Lane C (headingLevel + matrix a11y), Lane B (/superstyle on 3 routes + nits), X chef (first_seen_at). All delivered.
- X chef: `raw_payload.first_seen_at` added locally in `x-timeline-poll/fxtwitter.ts` + `_shared/xTimelineStore.ts` (uncommitted, ships with poller v7 deploy on TJ approval). Parser already reads `raw.first_seen_at` (`linesCccIngestion.ts:1498`) → engine uses it (`processor.ts:65`). Rows before v7 keep received_at fallback (accepted).
- Lane C `6d29edbe0`: LinemateMatrix opt-in headingLevel/labelGrid/wideNames/controlsAlign; default byte-identical (16 combos). Chef run 59/59. Approved h3 on line-combo with ?isScreenshot=1 pixel check (last Lane C item).
- X chef: poller v7 deployed ~00:05 UTC 11-07 (TJ-approved in that session); real row 2118857705532121311 carries raw_payload.first_seen_at. Code still uncommitted in X chef's files (not ours).
- Lane C closed: `e1120ba9c` (line-combo h3; ?isScreenshot=1 pixel-identical). Lane C commits: 1d08ce7fc, 389ea0ea3, 6d29edbe0, e1120ba9c.
- Goalie-order bug (UPL/Ellis, tweet 2118850118849864168) from swipe-trainer → routed to Lane D session `local_f17e4302`. Trainer has uncommitted files again (tweetSwipeTrainer*, TweetSwipeTrainer/*).
- Lane D goalie-slot fix `1877dea90` (5 files): lone one-name lines after D pairs = goalie slots; unresolved slot-1 span kept; writes skip goalies when goalie_1 id null. Chef run lib/sources+lib/lines+LineCombinations+API: 1453 pass / 39 skip. Goalie unit `number` now = list slot (engine/UI should show slot order; check in integrated UI review).
- TJ source rule (pop-ups, direct): the six relay accounts never appear as a source anywhere on the site and no via chips; a relay post with no original = evidence at "unknown", originalAuthor null, never confirmation. FHFHockey IS allowed: shown and counted at aggregator, not confirmation unless it quotes an original. Supersedes plan decision 2's FHFH exclusion. Routed: Lane A (authority.ts RELAY_ACCOUNTS, service.ts:73 fallback), Lane B (hide RELAY_ACCOUNTS only).
- Lane A `db63e6116` relay rule (RELAY_ONLY_WEIGHT 0.5, unknown tier, null author; FHFH aggregator). Chef run 134/134. Chef decision: relay handles stripped from public API (relays[].account → string|null, null publicly; strip "RT @relay:" text; JSON scan test). EXCLUDED_AUTHORS now empty, remove after Lane B drops import.
- Lane A `80115ffc5`: public JSON scrubbed of relay handles (relays[].account null publicly, RT prefix/links/mentions scrubbed; JSON scan tests). Chef run 136/136. Pending: tell Lane A to remove EXCLUDED_AUTHORS once Lane B commits without the import.
- Lane B `d47bd652d` (hide RELAY_ACCOUNTS only, FHFH shown), superstyle `0c6590360` (passes 0–1), `734b88a96` (pass 2); pass 3 a11y in progress. Superstyle log: `tasks/artifacts/Lines-Snapshot-Superstyle-2026-11-06.md`. Told Lane A: remove EXCLUDED_AUTHORS, add dfo_fantasy variant.
- Lane A closed `d71671399` (EXCLUDED_AUTHORS removed, dfo_fantasy relay variant). Lane A commits: 7f862a278, 8282653f2, 58aa44937, 44a79c695, e501e2ad3, db63e6116, 80115ffc5, d71671399. Follow-ups (not in this release): in_for/draws_in/out → IGA claims; beat-reporter list empty (needs TJ list); verify 32 club handles.
- Next: after B reports, integrated gate in clean export (vitest, eslint, typecheck, CSS pure), then RC via commit-tree on origin/master; then pop-ups P1 (migration) → P2 (push) → P3–P5 flags.

## Next
- (done) When A reports A1 SHA: verify it (git show, tests), then propose/start Lane B (lines-ui).
- When swipe-trainer reports commit SHAs: verify, then propose Lane D (parser IGA).
- Integration + release candidate later; P1–P6 each need a TJ pop-up.

## Blockers / approvals
- None yet. Prod reads must be read-only.

## Insights

## Checkpoint: Lane B superstyle, sticky rail (11-06 late)
- B committed passes 3–5: 590074499 (a11y), 96765b807 (copy), 34a29a6b4 (unslop). Pass 6 (frontend-design) is in progress.
- Pass 6 sticky rail is blocked: the shared Container `.pageContent` has overflow-x:hidden, so <main> scrolls. TJ chose "Ask Chef → Lane C page" (I verified this in B's transcript). Ticket sent to Lane C: on the two Lines routes only, use `.pageContentFull` or overflow-x:clip; the shared Container stays untouched. When C's SHA lands, forward it to B.
- TJ's :3000 next-server (PID 30210) has been up 11h at about 9.5 GB RSS, which explains the slow captures.
- Lane C 7af32ee7d (sticky-safe main on the 2 Lines routes, clip/visible !important; 6/6 tests, typecheck 0, pure check passing). Verified with git show and forwarded to B.

## Checkpoint: release candidate tree (11-06 late)
- Lane B is done: passes 6–7 plus the sticky rail and final sweep (5b742af8f, fab521e5a, d45fdce52). Its tree is clean.
- Import closure from the 6 Lines entry points: 177 files, 50 differ from master. Every Lines, parser and shared-component diff is attributable only to approved lane commits (D: d80b8e5f6/505ed430a/1877dea90; E: 7e7e3dfd2/a2556bbb6/4218359a8/cf5de3224/7a8ee3dc9; C: 1d08ce7fc/389ea0ea3/6d29edbe0/e1120ba9c/7af32ee7d; A and B as logged).
- Excluded (master kept): lib/cron/* (bbc707815 is "not released; needs its migrations"), MobileMenu.module.scss, siteSurfaceLinks.ts, update-line-sources.ts (its only diff is the cron skipAuditWhenNoOp).
- Hybrid blobs: styles/vars.scss = master + `$text-on-primary` only; update-lines-ccc.ts = master + the processLineSnapshotEvidence import and call only (flag-gated no-op until LINES_OBSERVATIONS_ENABLED).
- Tree fcdbfef01 (63 files). Exported to scratchpad rc/export with node_modules symlinked; gate running: pure check, eslint, typecheck, full vitest.
- Lane B final report received; all 9 SHAs on octoberBranch; the candidate's LineCombinations matches octoberBranch.

## Checkpoint: gate passed, RC built (11-06 late)
- Gate on a full `git archive` of tree fcdbfef01 (node_modules symlinked): CSS pure 9/9, eslint exit 0, typecheck exit 0. Vitest: 6 files / 5 tests fail, and the identical 6 fail on a clean origin/master export (FORGE CLI receipt tests plus the next-sanity symlink resolution), so the candidate adds no failures. GOTCHA: export the whole repo, not just web/, because tests read ../supabase and ../tasks.
- RC commit 9b3e12ed3 (parent origin/master c09aa95ac). Local only.
- UI review: Lane B's final fixture shots (flags are off on :3000) show F/D/G/PP grouping, honest practice/carried/derived chips, "Tandem confirmed" + "Starter not confirmed", "Original source not identified" for relay-only, and both rails collapsed on mobile.
- Migration 20261002134400 is identical to master, its sha matches registry entry order 78, and it's additive (6 tables with RLS, service_role select/insert, append-only triggers, append_line_decisions RPC). Lane A's storage needs no schema change (jsonb payloads).
- Registry file migration-authority.json is dirty from another lane (+50). Update entry 78 with an index-only blob commit so their working-tree changes stay put.
- Next: pop-ups P1 (apply migration) and P2 (chef/ branch, PR, squash-merge: 1 fhfhockey build + 3 cancels).

## Checkpoint: P1 and P2 done (11-07 early)
- TJ approved P1 and P2 by pop-up.
- P1: pre-check showed 0 tables, 0 functions, no ledger row. Applied the file verbatim with execute_sql in one transaction, with ledger row version 20261002134400 (statements = reference comment with the sha). Readback OK. Registry entry 78 marked applied in b940e7af9 (index-only blob; the other lane's +50 working-tree lines kept).
- P2: Vercel baseline = c09aa95ac (fhfhockey READY dpl_FSckWWb7). Pushed 9b3e12ed3 to chef/release-lines-iga (0 deployments for that sha). PR #413 squash-merged → master 08344ca14, tree == gated candidate fcdbfef01. Expected 4 entries appeared (fhfhockey BUILDING dpl_3e94BXcC; the other 3 cancel/skip). Waiting on the build, then a smoke test of 5 or fewer GETs.
- Not done: octoberBranch sync (ours-merge) needs TJ's go-ahead plus a no-build watch. P3–P5 flags need separate pop-ups and deploys.
