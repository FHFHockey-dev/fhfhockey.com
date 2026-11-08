# Yahoo status sticky fix (Claude, 2026-11-03)

## Scope
Finding `CLAUDE-SS-YAHOO-STATUS-STICKY-20261103`: `upsert_yahoo_players_atomic` keeps
`status = coalesce(excluded.status, yahoo_players.status)`, so IR/O/NA/DTD never clear.
Writer + RPC migration (not applied) + stale-row cleanup plan (not run). Started by
`local_c4fd32c8` (Social Share owner); report to `local_799e2b6c`.

## Where
- `octoberBranch`, base HEAD `fc480f582`.
- Files: `web/lib/integrations/yahoo/playerWriter.ts`, `writerPermissions.test.ts`,
  new `supabase/migrations/<ts>_clear_stale_yahoo_player_status.sql`,
  `migration-authority.json`, `supportedBaselineMigration.test.ts`, super-goal summary count,
  `tasks/artifacts/yahoo-status-sticky-2026-11-03/`, leases, `CLAUDE-TO-CODEX.md`.

## State
- Codex's "uncommitted" Yahoo work is already committed as `1f7262c3e` (TJ, 18:51 -0500). Nothing uncommitted in the six leased files.
- TJ (via `local_c4fd32c8`) transferred the Yahoo writer lane to Claude outright; Codex is out of usage.
- Live RPC read (SELECT pg_get_functiondef) = repo atomic migration + captured_at fix. No drift.
- Callers: TS route `update-yahoo-players.ts` and env-gated `yahooAPI.py` both read `players;player_keys=…;out=draft_analysis,percent_owned` (full base resource). No partial caller today.
- Pre-existing: `supportedBaselineMigration.test.ts` fails at HEAD on 4 unregistered migrations (WGO 20261029184950, NST 20261101161622/20261103180000/20261103180100). Not mine; do not register.

## Decisions
- Writer marks `status_observed: true` only when the source carries Yahoo's base profile; RPC clears status, status_full, injury_note only on that explicit marker. Missing marker = old coalesce. Order-independent rollout; receipt unchanged.
- Python script left unchanged (no marker → keeps coalesce).

## Checkpoint 01:30Z
- Done: writer marker + 7 tests (72/72 focused); migration `20261104012000_clear_stale_yahoo_player_status.sql` (md5 guard 178d877f…, verified on scratch PG15 replay: clears/replaces/keeps/rejects as designed, grants intact, replay refused); authority row 105 pending, test counts 105/9, summary count 105; cleanup plan `tasks/artifacts/yahoo-status-sticky-2026-11-03/CLEANUP-PLAN.md` (self-heal on next normal run, no UPDATE); leases + CLAUDE-TO-CODEX note.
- eslint on changed files exit 0. Typecheck running.
- Gotcha: WiGO lane has a staged rename in the shared index and renamed NST migrations to 20261104010705/20261104011002; BLSH orchestrator has an uncommitted note in CLAUDE-TO-CODEX.md. Commit through a temp index with HEAD+my note so neither is swept in.
- Gotcha: scratch PG needs LC_ALL=C and loopback TCP (scratchpad socket path > 103 bytes).

## Checkpoint 01:40Z: committed f48c624b0 (parent 6dd622eb9)
- Typecheck exit 2: 51 errors, all outside this lane (50 in untracked BLSH currentProcessEvidence.server*, 1 Buffer typing in retainedBlsh.test.ts, unchanged since 46de3c1b6); 0 in Yahoo or baseline files.
- supportedBaselineMigration first test still fails only on 4 unregistered migrations from other lanes: WGO 20261029184950, NST 20261101161622, WiGO 20261104010705 + 20261104011002 (WiGO applied P-1/P-2 to Production tonight). They sort before mine, so whoever registers them renumbers my row 105.
- BLSH orchestrator's note in CLAUDE-TO-CODEX.md left uncommitted in place.

## Next
Waiting on TJ: migration apply (step 2 of CLEANUP-PLAN), writer release, then step 5 verification SELECTs. Keep this diary until the lane closes.

- Chef outcome (2026-11-07): migration applied as 20261104011912; writer shipped in #407 (9eb3de632). Left: step 5 verification SELECTs (stale flags cleared after an update-yahoo-players run) were not run by the Chef. Keep until that check is recorded.

- Step 5 (2026-11-07, data-checks lane, SELECT only): 11-07 08:40 UTC run refreshed 1,610/1,610 game-477 rows, 0 residual
  flags; DTD 118→13, IR 102→66, O 40→10; McAvoy and Bedard clear. Recorded in CLEANUP-PLAN.md. Lane done; this diary
  can be retired by Chef once the commit lands.
